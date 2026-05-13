import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * ERP webhook receiver.
 * URL: /functions/v1/erp-webhook?token=<uuid>
 * Body (JSON): {
 *   type: "soil_sample" | "leaf_sample",
 *   field_id?: string,
 *   collected_at?: string (YYYY-MM-DD),
 *   crop?: string,
 *   data: { ph, n, p, k, ... }
 * }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return json({ error: "Missing ?token=" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate token
    const { data: hook, error: hookErr } = await supabase
      .from("erp_webhooks")
      .select("id, organization_id, enabled, total_calls")
      .eq("token", token)
      .maybeSingle();

    if (hookErr || !hook) return json({ error: "Invalid token" }, 401);
    if (!hook.enabled) return json({ error: "Webhook disabled" }, 403);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

    const type = String(body.type ?? "");
    if (!["soil_sample", "leaf_sample"].includes(type)) {
      return json({ error: "type must be soil_sample or leaf_sample" }, 400);
    }

    const table = type === "soil_sample" ? "soil_samples" : "leaf_samples";
    const data = body.data ?? {};
    const record: Record<string, unknown> = {
      organization_id: hook.organization_id,
      field_id: body.field_id ?? null,
      crop: body.crop ?? null,
      collected_at: body.collected_at ?? new Date().toISOString().slice(0, 10),
      raw: body,
      ...(type === "soil_sample"
        ? {
            ph: data.ph ?? null,
            nitrogen: data.n ?? data.nitrogen ?? null,
            phosphorus: data.p ?? data.phosphorus ?? null,
            potassium: data.k ?? data.potassium ?? null,
            calcium: data.ca ?? data.calcium ?? null,
            magnesium: data.mg ?? data.magnesium ?? null,
            sulfur: data.s ?? data.sulfur ?? null,
            organic_matter: data.organic_matter ?? data.mo ?? null,
            cec: data.cec ?? null,
          }
        : {
            n: data.n ?? null, p: data.p ?? null, k: data.k ?? null,
            ca: data.ca ?? null, mg: data.mg ?? null, s: data.s ?? null,
            b: data.b ?? null, cu: data.cu ?? null, fe: data.fe ?? null,
            mn: data.mn ?? null, zn: data.zn ?? null,
          }),
    };

    const { data: inserted, error: insErr } = await supabase
      .from(table)
      .insert(record)
      .select("id")
      .maybeSingle();

    if (insErr) return json({ error: insErr.message }, 500);

    // Update webhook stats + create notification
    await supabase
      .from("erp_webhooks")
      .update({ last_used_at: new Date().toISOString(), total_calls: (hook.total_calls ?? 0) + 1 })
      .eq("id", hook.id);

    await supabase.rpc("create_notification", {
      _org: hook.organization_id,
      _user: null,
      _type: "info",
      _title: "Nova amostra recebida via ERP",
      _message: `Tipo: ${type === "soil_sample" ? "Solo" : "Folha"}`,
      _link: type === "soil_sample" ? "/app/nutricao" : "/app/nutricao",
      _metadata: null,
    }).catch(() => {});

    return json({ success: true, id: inserted?.id });
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
