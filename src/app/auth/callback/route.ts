import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/** The magic-link email lands here; exchange the code for a session and go home. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const sb = await getServerSupabase();
  if (sb && code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/?auth=failed", url.origin));
  }
  return NextResponse.redirect(new URL("/", url.origin));
}
