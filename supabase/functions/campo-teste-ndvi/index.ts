// Edge function: campo-teste-ndvi
// Calcula NDVI para um campo de teste usando geometria GeoJSON salva.
// Body: { campo_teste_id: string, mode?: 'latest' | 'history' }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function simulateNdvi(seedStr: string, date: Date) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) % 100000;
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const seasonal = 0.55 + 0.2 * Math.sin((dayOfYear / 365) * 2 * Math.PI + (seed % 100) / 30);
  const noise = ((seed * (dayOfYear + 1)) % 100) / 1000;
  const mean = Math.max(0.1, Math.min(0.92, seasonal + noise - 0.05));
  return {
    mean: Number(mean.toFixed(3)),
    min: Number(Math.max(0.05, mean - 0.15).toFixed(3)),
    max: Number(Math.min(0.95, mean + 0.12).toFixed(3)),
  };
}

async function getSentinelToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch("https://services.sentinel-hub.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`Sentinel auth failed: ${res.status}`);
  return (await res.json()).access_token;
}

async function fetchSentinelNdvi(token: string, geometry: any, fromDate: string, toDate: string) {
  const evalscript = `//VERSION=3
function setup(){return{input:[{bands:["B04","B08","dataMask"]}],output:[{id:"default",bands:1,sampleType:"FLOAT32"}]};}
function evaluatePixel(s){if(s.dataMask===0)return[NaN];return[(s.B08-s.B04)/(s.B08+s.B04)];}`;

  const body = {
    input: {
      bounds: { geometry, properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" } },
      data: [{
        type: "sentinel-2-l2a",
        dataFilter: {
          timeRange: { from: `${fromDate}T00:00:00Z`, to: `${toDate}T23:59:59Z` },
          maxCloudCoverage: 30,
          mosaickingOrder: "leastCC",
        },
      }],
    },
    aggregation: {
      timeRange: { from: `${fromDate}T00:00:00Z`, to: `${toDate}T23:59:59Z` },
      aggregationInterval: { of: "P1D" },
      evalscript,
      resx: 10,
      resy: 10,
    },
    calculations: { default: { statistics: { default: { percentiles: { k: [50] } } } } },
  };

  const res = await fetch("https://services.sentinel-hub.com/api/v1/statistics", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const intervals = data?.data ?? [];
  for (let i = intervals.length - 1; i >= 0; i--) {
    const stats = intervals[i]?.outputs?.default?.bands?.B0?.stats;
    if (stats?.mean != null && !isNaN(stats.mean)) {
      return {
        mean: Number(stats.mean.toFixed(3)),
        min: Number((stats.min ?? stats.mean - 0.1).toFixed(3)),
        max: Number((stats.max ?? stats.mean + 0.1).toFixed(3)),
        date: intervals[i].interval.from.slice(0, 10),
      };
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { campo_teste_id, mode = "latest" } = await req.json();
    if (!campo_teste_id) return new Response(JSON.stringify({ error: "campo_teste_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: campo, error: cErr } = await service
      .from("nutrir_campos_teste")
      .select("id, organization_id, geometria, titulo")
      .eq("id", campo_teste_id)
      .maybeSingle();
    if (cErr || !campo) return new Response(JSON.stringify({ error: "campo not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!campo.geometria) return new Response(JSON.stringify({ error: "Geometria do talhão não definida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: member } = await service
      .from("organization_members").select("id")
      .eq("organization_id", campo.organization_id).eq("user_id", userData.user.id).maybeSingle();
    if (!member) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: org } = await service.from("organizations").select("ndvi_source").eq("id", campo.organization_id).maybeSingle();
    const source = (org as any)?.ndvi_source ?? "demo";

    const today = new Date();
    const dates: Date[] = [];
    if (mode === "history") {
      for (let i = 11; i >= 0; i--) dates.push(new Date(today.getFullYear(), today.getMonth() - i, 15));
    } else {
      dates.push(today);
    }

    const results: any[] = [];
    if (source === "sentinel_hub") {
      const cid = Deno.env.get("SENTINEL_HUB_CLIENT_ID");
      const csec = Deno.env.get("SENTINEL_HUB_CLIENT_SECRET");
      if (cid && csec) {
        const token = await getSentinelToken(cid, csec);
        for (const d of dates) {
          const to = d.toISOString().slice(0, 10);
          const from = new Date(d.getTime() - 30 * 86400000).toISOString().slice(0, 10);
          try {
            const r = await fetchSentinelNdvi(token, campo.geometria, from, to);
            if (r) results.push({
              organization_id: campo.organization_id,
              campo_teste_id,
              data: r.date,
              ndvi_mean: r.mean, ndvi_min: r.min, ndvi_max: r.max,
              fonte: "sentinel-hub",
            });
          } catch (e) { console.error(e); }
        }
      }
    }
    if (results.length === 0) {
      for (const d of dates) {
        const r = simulateNdvi(campo_teste_id, d);
        results.push({
          organization_id: campo.organization_id,
          campo_teste_id,
          data: d.toISOString().slice(0, 10),
          ndvi_mean: r.mean, ndvi_min: r.min, ndvi_max: r.max,
          fonte: "simulado",
        });
      }
    }

    if (results.length > 0) {
      const datas = results.map((r) => r.data);
      await service.from("nutrir_campos_teste_ndvi").delete()
        .eq("campo_teste_id", campo_teste_id).in("data", datas);
      const { error: insErr } = await service.from("nutrir_campos_teste_ndvi").insert(results);
      if (insErr) throw insErr;
    }

    return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
