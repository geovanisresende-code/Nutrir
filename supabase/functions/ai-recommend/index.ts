// Recomendação agronômica para uma análise específica (solo ou foliar).
// Body: { organization_id, sample_id, analysis_type: 'soil'|'leaf' }
// Retorna texto markdown com diagnóstico + recomendação NPK + corretivos.
// Persistido em ai_recommendations.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";

const SYSTEM = `Você é um agrônomo consultor especialista em nutrição vegetal, formulação NPK, calagem, gessagem e adubação foliar para o Brasil.
Use as referências CFSEMG/IAC/Embrapa como base. Responda SEMPRE em português brasileiro, em Markdown.

Estrutura obrigatória:
## Diagnóstico
Análise crítica dos nutrientes apontando o que está baixo, médio, adequado ou alto, e o impacto no crescimento da cultura.

## Recomendação de adubação
Tabela com produto, dose por hectare e modo de aplicação.

## Calagem e corretivos
Necessidade de calagem (V%), gessagem agrícola e micronutrientes, se aplicável.

## Observações
Riscos, época, parcelamento, interações, melhores práticas.

Seja prático e direto. Não invente valores que não estejam nos dados.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const { organization_id, sample_id, analysis_type } = await req.json();
    if (!organization_id || !sample_id || !analysis_type) {
      return json({ error: "organization_id, sample_id, analysis_type obrigatórios" }, 400);
    }

    const table = analysis_type === "soil" ? "soil_samples" : "leaf_samples";
    const { data: sample, error: sErr } = await supabase
      .from(table)
      .select("*, fields(name, cultura), clients(name)")
      .eq("id", sample_id)
      .maybeSingle();
    if (sErr || !sample) return json({ error: "amostra não encontrada" }, 404);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const ctx = {
      tipo: analysis_type === "soil" ? "Análise de solo" : "Análise foliar",
      cultura: sample.crop ?? sample.fields?.cultura ?? "não informada",
      cliente: sample.clients?.name ?? null,
      talhao: sample.fields?.name ?? null,
      data_coleta: sample.collected_at,
      valores: sample.raw ?? {},
      classificacao: sample.classification ?? {},
    };

    const prompt = `Dados da amostra:\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`\n\nGere o diagnóstico e a recomendação completa para esta análise.`;

    const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (ai.status === 429) return json({ error: "Limite de requisições atingido. Tente novamente em alguns instantes." }, 429);
    if (ai.status === 402) return json({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }, 402);
    if (!ai.ok) return json({ error: `Falha IA [${ai.status}]: ${await ai.text()}` }, 500);

    const data = await ai.json();
    const response = data?.choices?.[0]?.message?.content ?? "";

    // persistir
    await supabase.from("ai_recommendations").insert({
      organization_id,
      field_id: sample.field_id ?? null,
      sample_id,
      prompt,
      response,
      model: MODEL,
      created_by: user.id,
      metadata: { analysis_type, crop: sample.crop },
    });
    await supabase.from("usage_metrics").insert({ organization_id, metric: "ai_recommend" });

    return json({ response });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
