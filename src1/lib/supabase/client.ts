import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, publicAnonKey } from "./info";

if (!supabaseUrl || !publicAnonKey) {
  console.error("Supabase client cannot be initialized: missing VITE_SUPABASE_PROJECT_ID or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  publicAnonKey || "placeholder-key",
  {
    auth: {
      // Use a custom key so you don't clash with other instances
      storageKey: "magnus-intel-ui-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
