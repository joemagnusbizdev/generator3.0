// Supabase project configuration
// Set these in Vercel (Project Settings  Environment Variables) and in your local .env file.
// Required:
//   VITE_SUPABASE_PROJECT_ID
//   VITE_SUPABASE_ANON_KEY
// Optional:
//   VITE_SUPABASE_FUNCTION_NAME (defaults to clever-function)
export const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// Function name configuration (cache-busting deployment suffix supported)
export const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME ?? "clever-function";
// Validate required environment variables
if (!projectId) {
    console.error("Missing env var: VITE_SUPABASE_PROJECT_ID");
}
if (!publicAnonKey) {
    console.error("Missing env var: VITE_SUPABASE_ANON_KEY");
}
// Full Supabase URL
export const supabaseUrl = projectId ? `https://${projectId}.supabase.co` : "";
