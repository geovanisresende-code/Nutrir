// Gera relatório final de Campo de Teste com IA (Lovable AI Gateway)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );

    const { campo_teste_id } = await req.json();
    if (!campo_teste_id) {
      return new Response(JSON.stringify({ error: "campo_teste_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ct, error: e1 } = await supabase
      .from("nutrir_campos_teste").select("*").eq("id", campo_teste_id).single();
    if (e1 || !ct) throw new Error(e1?.message ?? "Teste não encontrado");

    const { data: rels } = await supabase
      .from("nutrir_campos_teste_relatorios")
      .select("*").eq("campo_teste_id", campo_teste_id)
      .order("data", { ascending: true });

    const { data: cli } = await supabase
      .from("nutrir_clientes").select("razao_social, cidade, uf").eq("id", ct.cliente_id).single();

    const prompt = `Você é um agrônomo sênior. Gere um relatório técnico-comercial conciso (máx 600 palavras) em português, em Markdown, sobre o seguinte CAMPO DE TESTE:

CLIENTE: ${cli?.razao_social ?? "—"} (${cli?.cidade ?? ""}/${cli?.uf ?? ""})
TÍTULO: ${ct.titulo}
CULTURA: ${ct.cultura ?? "—"}
DATA PLANTIO: ${ct.data_plantio ?? "—"}
DATA INÍCIO TESTE: ${ct.data_inicio}
ÁREA TOTAL: ${ct.area_total_ha} ha
PRODUTOS TESTADOS: ${JSON.stringify(ct.produtos)}
OBSERVAÇÕES GERAIS: ${ct.observacoes ?? "—"}

ACOMPANHAMENTOS (${rels?.length ?? 0}):
${(rels ?? []).map((r: any, i: number) => `
[${i + 1}] ${r.data} — Estágio: ${r.estagio ?? "—"} — NDVI: ${r.ndvi_medio ?? "—"}
${r.observacoes ?? ""}
`).join("\n")}

Estruture com seções:
## Resumo Executivo
## Evolução da Cultura
## Análise dos Produtos
## Resultados e NDVI
## Recomendação Comercial

Use linguagem clara, técnica mas vendedora. Destaque ganhos em produtividade ou sanidade.`;

    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um agrônomo sênior brasileiro especializado em nutrição vegetal." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de IA atingido. Tente novamente em instantes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Cloud." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`AI error: ${t}`);
    }

    const aiJson = await aiResp.json();
    const resumo = aiJson?.choices?.[0]?.message?.content ?? "";

    await supabase.from("nutrir_campos_teste").update({
      status: "finalizado",
      data_finalizacao: new Date().toISOString().slice(0, 10),
      relatorio_final_resumo: resumo,
    }).eq("id", campo_teste_id);

    return new Response(JSON.stringify({ ok: true, resumo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
