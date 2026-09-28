import { addDays, todayISO } from "@/lib/dates";
import { digest, digestEntries } from "@/lib/expiry";
import { pushConfigured, sendPush } from "@/lib/push/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Row = Record<string, any>;

function localToday(timeZone: string): string {
  try {
    return todayISO(new Date(), timeZone);
  } catch {
    return todayISO(new Date(), "UTC");
  }
}

/**
 * Daily expiry summary. Vercel Cron calls this once a day (see vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`. Each device gets at most one summary per local day.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = getAdminSupabase();
  if (!sb || !pushConfigured()) return Response.json({ error: "not_configured" }, { status: 503 });

  const { data: subs, error: subErr } = await sb.from("push_subscriptions").select("*");
  if (subErr) return Response.json({ error: subErr.message }, { status: 500 });
  if (!subs?.length) return Response.json({ sent: 0 });

  const userIds = [...new Set(subs.map((s: Row) => s.user_id))];
  const { data: members } = await sb.from("household_members").select("user_id, household_id").in("user_id", userIds);
  const householdOf = new Map<string, string>((members ?? []).map((m: Row) => [m.user_id, m.household_id]));
  const householdIds = [...new Set([...householdOf.values()])];
  if (!householdIds.length) return Response.json({ sent: 0 });

  // Fetch everything dated within the widest window any device could want (7 days + time-zone slack).
  const horizon = addDays(todayISO(new Date(), "UTC"), 9);
  const { data: batches } = await sb
    .from("inventory_batches")
    .select("inventory_id, household_id, quantity, use_by, best_before")
    .in("household_id", householdIds)
    .gt("quantity", 0)
    .or(`use_by.lte.${horizon},best_before.lte.${horizon}`);

  const invIds = [...new Set((batches ?? []).map((b: Row) => b.inventory_id))];
  const { data: inv } = invIds.length
    ? await sb.from("kitchen_inventory").select("id, ingredient_id, custom_name, custom_name_en, custom_name_th").in("id", invIds)
    : { data: [] as Row[] };
  const ingIds = [...new Set((inv ?? []).map((i: Row) => i.ingredient_id).filter(Boolean))];
  const { data: ings } = ingIds.length
    ? await sb.from("ingredients").select("id, name_en, name_th").in("id", ingIds)
    : { data: [] as Row[] };
  const ingById = new Map<string, Row>((ings ?? []).map((g: Row) => [g.id, g] as [string, Row]));
  const invById = new Map<string, Row>((inv ?? []).map((i: Row) => [i.id, i] as [string, Row]));
  const nameFor = (inventoryId: string, lang: "en" | "th") => {
    const i = invById.get(inventoryId);
    if (!i) return "?";
    const g = i.ingredient_id ? ingById.get(i.ingredient_id) : null;
    if (g) return lang === "th" ? g.name_th : g.name_en;
    return (lang === "th" ? i.custom_name_th : i.custom_name_en) || i.custom_name || "?";
  };

  let sent = 0;
  let removed = 0;
  let skipped = 0;
  for (const s of subs as Row[]) {
    const hh = householdOf.get(s.user_id);
    const today = localToday(s.time_zone);
    if (!hh || s.last_sent_on === today) {
      skipped++;
      continue;
    }
    const lang: "en" | "th" = s.lang === "th" ? "th" : "en";
    const entries = digestEntries(
      (batches ?? [])
        .filter((b: Row) => b.household_id === hh)
        .map((b: Row) => ({ inventoryId: b.inventory_id, useBy: b.use_by, bestBefore: b.best_before, qty: Number(b.quantity) })),
      today,
      Number(s.alert_days ?? 2),
    );
    const msg = digest(entries.map((e) => ({ name: nameFor(e.inventoryId, lang), kind: e.kind, days: e.days })), lang);
    if (!msg) {
      skipped++;
      continue;
    }
    const result = await sendPush(s as { endpoint: string; p256dh: string; auth: string }, { ...msg, url: "/#expiring", tag: "expiry-digest" });
    if (result === "gone") {
      await sb.from("push_subscriptions").delete().eq("id", s.id);
      removed++;
    } else if (result === "ok") {
      await sb.from("push_subscriptions").update({ last_sent_on: today }).eq("id", s.id);
      sent++;
    }
  }
  return Response.json({ sent, removed, skipped });
}
