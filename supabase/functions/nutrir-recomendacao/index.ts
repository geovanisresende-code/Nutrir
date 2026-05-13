import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

interface ReqBody {
  tipo: "solo" | "folha";
  cultura: string;
  area_ha?: number;
  produtividade_meta?: number;
  dados: Record<string, number | string>;
  observacoes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "missing_auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = (await req.json()) as ReqBody;
    if (!body.tipo || !body.cultura || !body.dados) {
      return new Response(JSON.stringify({ error: "tipo, cultura e dados obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "AI key missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sysSolo = `Você é um agrônomo especialista em fertilidade e manejo de solo no Brasil. Recebe uma análise de solo e gera recomendação técnica de CALAGEM e ADUBAÇÃO (NPK + micros).
RESPONDA EM PORTUGUÊS, formato JSON estrito:
{
  "diagnostico": "string curta",
  "calagem": { "necessidade_t_ha": number, "metodo": "string", "justificativa": "string" },
  "adubacao": [ { "nutriente": "N|P2O5|K2O|...", "dose_kg_ha": number, "fonte_sugerida": "string", "epoca": "string" } ],
  "micronutrientes": [ { "nutriente": "B|Zn|...", "dose_kg_ha": number, "modo_aplicacao": "string" } ],
  "manejo": "string com recomendação geral, parcelamento, timing",
  "alerta_limitantes": ["fator1","fator2"]
}`;
    const sysFolha = `Você é um agrônomo nutricionista. Recebe uma análise FOLIAR e gera diagnóstico nutricional + recomendação de adubação foliar para a calculadora Nutrir.
RESPONDA EM JSON:
{
  "diagnostico_geral": "string",
  "deficiencias": [ { "nutriente": "N|P|K|Ca|Mg|B|Zn|Mn|Fe|Cu|S", "nivel": "leve|moderada|severa", "dose_recomendada_g_ha": number } ],
  "excessos": [ { "nutriente": "string", "observacao": "string" } ],
  "formula_sugerida": "código (ex: FOLIAR-PADRAO, NPK-DRENCH, BOR, ZN)",
  "tipo_aplicacao_sugerido": "fertirrigacao|pulverizacao|drench",
  "complexador_sugerido": "TSH|LEG|ION|BOR|nenhum",
  "timing": "string (estágio fenológico, número de aplicações)",
  "observacoes": "string"
}`;

    const prompt = `Cultura: ${body.cultura}
${body.area_ha ? `Área: ${body.area_ha} ha\n` : ""}${body.produtividade_meta ? `Meta produtividade: ${body.produtividade_meta} sc/ha ou kg/ha\n` : ""}
Dados da análise:
${JSON.stringify(body.dados, null, 2)}
${body.observacoes ? `\nObservações: ${body.observacoes}` : ""}

Gere a recomendação no formato JSON solicitado, sem markdown.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: body.tipo === "solo" ? sysSolo : sysFolha },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      return new Response(JSON.stringify({ error: "ai_failed", detail: t }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiJson = await aiResp.json();
    const content = aiJson.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { raw: content }; }

    return new Response(JSON.stringify({ recomendacao: parsed, tipo: body.tipo, cultura: body.cultura }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
