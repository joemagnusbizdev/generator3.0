// Supabase project configuration
// Set these in Vercel (Project Settings Ã¢â€ â€™ Environment Variables) and in your local .env file.
// Required:
//   VITE_SUPABASE_PROJECT_ID
//   VITE_SUPABASE_ANON_KEY
// Optional:
//   VITE_SUPABASE_FUNCTION_NAME (defaults to clever-function)

export const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Function name configuration (cache-busting deployment suffix supported)
export const functionName =
  (import.meta.env.VITE_SUPABASE_FUNCTION_NAME as string | undefined) ?? "clever-function";

// Validate required environment variables
if (!projectId) {
  console.error("Missing env var: VITE_SUPABASE_PROJECT_ID");
}
if (!publicAnonKey) {
  console.error("Missing env var: VITE_SUPABASE_ANON_KEY");
}

// Full Supabase URL
export const supabaseUrl = projectId ? `https://${projectId}.supabase.co` : "";


