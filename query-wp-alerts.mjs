import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = "https://gnobnyzezkuyptuakztf.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc1B1YmxpYyI6dHJ1ZX0.2Z3kn8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f5g6h7i8"; // anon key

const supabase = createClient(supabaseUrl, supabaseKey);

const { data, error } = await supabase
  .from("alerts")
  .select("id, title, location, country, severity, created_at, wordpress_post_id, source_url")
  .not("wordpress_post_id", "is", null)
  .order("created_at", { ascending: false })
  .limit(3);

if (error) {
  console.error("Error:", error);
} else {
  console.log("Last 3 alerts sent to WordPress:\n");
  data.forEach((alert, i) => {
    console.log(`${i + 1}. ${alert.title}`);
    console.log(`   Location: ${alert.location}, ${alert.country}`);
    console.log(`   Severity: ${alert.severity}`);
    console.log(`   Created: ${alert.created_at}`);
    console.log(`   WordPress Post ID: ${alert.wordpress_post_id}`);
    console.log(`   Source: ${alert.source_url}\n`);
  });
}
