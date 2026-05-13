// Classifica valores de uma análise (solo ou foliar) usando crop_nutrient_ranges.
// Body: { values: Record<string,number>, crop: string, analysis_type: 'soil'|'leaf' }
// Resposta: { classification: { nutrient: 'baixo'|'medio'|'adequado'|'alto', value, low_max, medium_max, adequate_max } }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );

    const { values, crop, analysis_type } = await req.json();
    if (!values || !crop || !analysis_type) {
      return json({ error: "values, crop e analysis_type são obrigatórios" }, 400);
    }

    const { data: ranges, error } = await supabase
      .from("crop_nutrient_ranges")
      .select("nutrient, unit, low_max, medium_max, adequate_max")
      .eq("crop", crop)
      .eq("analysis_type", analysis_type);

    if (error) return json({ error: error.message }, 500);

    const byNut = new Map((ranges ?? []).map((r: any) => [r.nutrient, r]));
    const classification: Record<string, any> = {};
    const summary = { baixo: 0, medio: 0, adequado: 0, alto: 0 };

    for (const [k, v] of Object.entries(values)) {
      if (typeof v !== "number" || !isFinite(v)) continue;
      const r: any = byNut.get(k);
      if (!r) continue;
      let level: "baixo"|"medio"|"adequado"|"alto" = "adequado";
      if (r.low_max != null && v <= r.low_max) level = "baixo";
      else if (r.medium_max != null && v <= r.medium_max) level = "medio";
      else if (r.adequate_max != null && v <= r.adequate_max) level = "adequado";
      else level = "alto";
      classification[k] = { value: v, level, unit: r.unit, low_max: r.low_max, medium_max: r.medium_max, adequate_max: r.adequate_max };
      summary[level]++;
    }

    return json({ classification, summary, crop, analysis_type });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
