// Edge function: ndvi-fetch
// Fetches NDVI for a field. Source = 'demo' (simulated) or 'sentinel_hub' (real Sentinel-2).
// Body: { field_id: string, mode?: 'latest' | 'history' (12 months) }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FieldGeometry {
  type: string;
  coordinates: any;
}

function bboxFromGeometry(geom: FieldGeometry): [number, number, number, number] {
  const coords: number[][] = [];
  const walk = (arr: any) => {
    if (typeof arr[0] === "number") coords.push(arr as number[]);
    else arr.forEach(walk);
  };
  walk(geom.coordinates);
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

// Deterministic pseudo-random NDVI based on field id + date (smooth seasonal curve)
function simulateNdvi(fieldId: string, date: Date): { mean: number; min: number; max: number } {
  let seed = 0;
  for (let i = 0; i < fieldId.length; i++) seed = (seed * 31 + fieldId.charCodeAt(i)) % 100000;
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  // Seasonal sine: peak around day 90-180 (southern hemisphere growing season varies)
  const seasonal = 0.55 + 0.2 * Math.sin((dayOfYear / 365) * 2 * Math.PI + (seed % 100) / 30);
  const noise = ((seed * (dayOfYear + 1)) % 100) / 1000; // small noise
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
  const data = await res.json();
  return data.access_token;
}

async function fetchSentinelNdvi(
  token: string,
  geometry: FieldGeometry,
  fromDate: string,
  toDate: string,
): Promise<{ mean: number; min: number; max: number; date: string } | null> {
  const evalscript = `
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04","B08","dataMask"] }],
    output: [{ id: "default", bands: 1, sampleType: "FLOAT32" }],
  };
}
function evaluatePixel(s) {
  if (s.dataMask === 0) return [NaN];
  const ndvi = (s.B08 - s.B04) / (s.B08 + s.B04);
  return [ndvi];
}`;

  const body = {
    input: {
      bounds: { geometry, properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" } },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: { from: `${fromDate}T00:00:00Z`, to: `${toDate}T23:59:59Z` },
            maxCloudCoverage: 30,
            mosaickingOrder: "leastCC",
          },
        },
      ],
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
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Sentinel statistics failed ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const intervals = data?.data ?? [];
  // pick latest with valid stats
  for (let i = intervals.length - 1; i >= 0; i--) {
    const it = intervals[i];
    const stats = it?.outputs?.default?.bands?.B0?.stats;
    if (stats && stats.mean != null && !isNaN(stats.mean)) {
      return {
        mean: Number(stats.mean.toFixed(3)),
        min: Number((stats.min ?? stats.mean - 0.1).toFixed(3)),
        max: Number((stats.max ?? stats.mean + 0.1).toFixed(3)),
        date: it.interval.from.slice(0, 10),
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
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { field_id, mode = "latest" } = await req.json();
    if (!field_id) {
      return new Response(JSON.stringify({ error: "field_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get field + org
    const { data: field, error: fieldErr } = await service
      .from("fields")
      .select("id, organization_id, geometry, name")
      .eq("id", field_id)
      .maybeSingle();
    if (fieldErr || !field) {
      return new Response(JSON.stringify({ error: "field not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // membership check
    const { data: member } = await service
      .from("organization_members")
      .select("id")
      .eq("organization_id", field.organization_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!member) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: org } = await service
      .from("organizations")
      .select("ndvi_source")
      .eq("id", field.organization_id)
      .maybeSingle();
    const source = org?.ndvi_source ?? "demo";

    // Build dates
    const today = new Date();
    const dates: Date[] = [];
    if (mode === "history") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 15);
        dates.push(d);
      }
    } else {
      dates.push(today);
    }

    const results: any[] = [];

    if (source === "sentinel_hub") {
      const clientId = Deno.env.get("SENTINEL_HUB_CLIENT_ID");
      const clientSecret = Deno.env.get("SENTINEL_HUB_CLIENT_SECRET");
      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: "Sentinel Hub credentials not configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const token = await getSentinelToken(clientId, clientSecret);
      for (const d of dates) {
        const to = d.toISOString().slice(0, 10);
        const from = new Date(d.getTime() - 30 * 86400000).toISOString().slice(0, 10);
        try {
          const r = await fetchSentinelNdvi(token, field.geometry as any, from, to);
          if (r) {
            results.push({
              field_id,
              organization_id: field.organization_id,
              captured_at: r.date,
              ndvi_mean: r.mean,
              ndvi_min: r.min,
              ndvi_max: r.max,
              source: "sentinel-hub",
            });
          }
        } catch (e) {
          console.error("sentinel error", e);
        }
      }
    } else {
      for (const d of dates) {
        const r = simulateNdvi(field_id, d);
        results.push({
          field_id,
          organization_id: field.organization_id,
          captured_at: d.toISOString().slice(0, 10),
          ndvi_mean: r.mean,
          ndvi_min: r.min,
          ndvi_max: r.max,
          source: "demo",
        });
      }
    }

    if (results.length > 0) {
      // Upsert-ish: delete same dates then insert
      const datesArr = results.map((r) => r.captured_at);
      await service
        .from("ndvi_readings")
        .delete()
        .eq("field_id", field_id)
        .in("captured_at", datesArr);
      const { error: insErr } = await service.from("ndvi_readings").insert(results);
      if (insErr) throw insErr;

      await service.from("usage_metrics").insert({
        organization_id: field.organization_id,
        metric: "ndvi_call",
        amount: results.length,
      });
    }

    return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
