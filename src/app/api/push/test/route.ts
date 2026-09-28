import { pushConfigured, sendPush } from "@/lib/push/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Sends a test notification to the signed-in person's devices. */
export async function POST(req: Request) {
  if (!pushConfigured()) return Response.json({ error: "not_configured" }, { status: 503 });
  const sb = await getServerSupabase();
  if (!sb) return Response.json({ error: "not_configured" }, { status: 503 });
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return Response.json({ error: "sign_in_required" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { lang?: string };
  const th = body.lang === "th";
  // Row-level security limits this to the caller's own devices.
  const { data: subs } = await sb.from("push_subscriptions").select("endpoint, p256dh, auth");
  let sent = 0;
  for (const s of subs ?? []) {
    const r = await sendPush(s, {
      title: "Cook-Till-Empty",
      body: th ? "เปิดการแจ้งเตือนแล้ว เราจะเตือนเมื่อของใกล้หมดอายุ" : "Notifications are on. We'll tell you when food is about to expire.",
      url: "/",
      tag: "test",
    });
    if (r === "ok") sent++;
  }
  return Response.json({ sent });
}
