import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const fieldId = url.searchParams.get("field_id");
    let lat = parseFloat(url.searchParams.get("lat") ?? "");
    let lng = parseFloat(url.searchParams.get("lng") ?? "");

    // Authed if user wants by field_id
    if (fieldId) {
      const auth = req.headers.get("Authorization");
      if (!auth) return json({ error: "Unauthorized" }, 401);
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: auth } } }
      );
      const { data, error } = await supabase
        .from("fields")
        .select("centroid_lat, centroid_lng")
        .eq("id", fieldId)
        .maybeSingle();
      if (error || !data) return json({ error: "Field not found" }, 404);
      lat = Number(data.centroid_lat);
      lng = Number(data.centroid_lng);
    }

    if (!isFinite(lat) || !isFinite(lng)) {
      return json({ error: "lat/lng required (or field_id with centroid)" }, 400);
    }

    const omUrl = new URL("https://api.open-meteo.com/v1/forecast");
    omUrl.searchParams.set("latitude", String(lat));
    omUrl.searchParams.set("longitude", String(lng));
    omUrl.searchParams.set("timezone", "auto");
    omUrl.searchParams.set("current", "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m");
    omUrl.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,wind_speed_10m_max");
    omUrl.searchParams.set("forecast_days", "7");

    const res = await fetch(omUrl.toString());
    if (!res.ok) {
      const text = await res.text();
      return json({ error: `Open-Meteo failed [${res.status}]: ${text}` }, 502);
    }
    const data = await res.json();

    return json({ lat, lng, ...data });
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
