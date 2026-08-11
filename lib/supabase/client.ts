import { createClient, SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let hasWarnedMissingEnv = false;

function getSupabaseUrl(): string | undefined {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_SUPABASE_URL;
  }

  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = getSupabaseUrl();
  // Support both legacy and current Supabase public key env names.
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (!hasWarnedMissingEnv) {
      hasWarnedMissingEnv = true;
      console.warn("Missing Supabase URL or anon key. Check NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    }
    return null;
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}