export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/** Without Supabase keys the app runs fully on-device (no sign-in, no sync). */
export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
