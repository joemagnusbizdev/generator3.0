import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { query } = await req.json();
    
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Invalid query" }), { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Supabase not configured" }), { status: 500 });
    }

    const client = createClient(supabaseUrl, supabaseServiceKey);

    // Execute raw SQL using Postgres function or RPC
    // Since Supabase doesn't expose raw SQL execution directly, we use a workaround:
    // Call the database directly via postgres connection
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_raw_sql`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql_query: query }),
    });

    if (!response.ok) {
      // If the RPC doesn't exist, return a helpful message
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ 
            error: "Raw SQL execution not available. Create a PostgreSQL function `execute_raw_sql(sql_query text)` in your database.",
            hint: "See deployment guide for setup instructions."
          }),
          { status: 400 }
        );
      }
      const error = await response.text();
      return new Response(JSON.stringify({ error }), { status: response.status });
    }

    const result = await response.json();
    return new Response(JSON.stringify({ data: result }), { status: 200 });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
