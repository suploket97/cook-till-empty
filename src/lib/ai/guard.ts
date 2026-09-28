import "server-only";
import { currentUserId } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

/**
 * Who may call the AI routes, and how often. With Supabase configured only signed-in people may;
 * everyone gets a per-person limit. The limit is in memory, per server instance: enough to stop a
 * runaway loop, not a determined abuser. Use a shared store (e.g. Upstash) if the app goes public.
 */
export async function guardAi(req: Request): Promise<Response | null> {
  let who: string | null = null;
  if (supabaseEnabled) {
    who = await currentUserId();
    if (!who) return Response.json({ error: "sign_in_required" }, { status: 401 });
  } else {
    who = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  }
  const limit = Number(process.env.AI_RATE_LIMIT) || 12;
  const now = Date.now();
  const recent = (hits.get(who) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) return Response.json({ error: "rate_limited" }, { status: 429 });
  recent.push(now);
  hits.set(who, recent);
  return null;
}
