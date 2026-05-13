import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Demo set: in production replace with proper CEPEA/B3 scraping or paid API.
// Values are realistic but illustrative; always tagged with source.
const DEMO_QUOTES = [
  { commodity: "soja", price_brl: 132.45, unit: "saca 60kg", variation_pct: 0.8 },
  { commodity: "milho", price_brl: 67.10, unit: "saca 60kg", variation_pct: -0.3 },
  { commodity: "cafe-arabica", price_brl: 1980.00, unit: "saca 60kg", variation_pct: 1.5 },
  { commodity: "trigo", price_brl: 78.50, unit: "saca 60kg", variation_pct: 0.2 },
  { commodity: "algodao", price_brl: 145.30, unit: "@ (15kg)", variation_pct: -0.6 },
  { commodity: "boi-gordo", price_brl: 305.20, unit: "@ (15kg)", variation_pct: 0.4 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up cache (under 1h)
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: cached } = await supabase
      .from("commodity_quotes")
      .select("*")
      .gte("fetched_at", cutoff)
      .order("fetched_at", { ascending: false });

    if (cached && cached.length >= DEMO_QUOTES.length) {
      return json({ quotes: cached, cached: true });
    }

    // Refresh
    const today = new Date().toISOString().slice(0, 10);
    const records = DEMO_QUOTES.map((q) => ({
      ...q,
      source: "CEPEA (demo)",
      reference_date: today,
      fetched_at: new Date().toISOString(),
    }));

    const { data: upserted, error } = await supabase
      .from("commodity_quotes")
      .upsert(records, { onConflict: "commodity,source,reference_date" })
      .select();

    if (error) return json({ error: error.message }, 500);
    return json({ quotes: upserted, cached: false });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
