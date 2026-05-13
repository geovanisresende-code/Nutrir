// deno-lint-ignore-file
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Cliente {
  id: string;
  razao_social: string;
  cidade?: string | null;
  uf?: string | null;
  ultima_visita?: string | null;
  pendencias?: string[];
  lat?: number | null;
  lng?: number | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { clientes, origem } = (await req.json()) as {
      clientes: Cliente[];
      origem?: { lat: number; lng: number; cidade?: string };
    };
    if (!Array.isArray(clientes) || clientes.length === 0) {
      return new Response(JSON.stringify({ error: "Lista de clientes vazia." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente.");

    const prompt = `Você é um assistente de planejamento de visitas comerciais agro.
Receberá uma lista de clientes com cidade, última visita e pendências. Sugira a MELHOR ORDEM DE VISITAS para hoje, considerando:
- Clientes sem visita há mais tempo têm prioridade
- Pendências (contas vencendo, testes em andamento) elevam prioridade
- Agrupe por proximidade de cidade quando possível
- Máximo 6 paradas

Origem do dia: ${JSON.stringify(origem ?? null)}
Clientes: ${JSON.stringify(clientes.slice(0, 30))}

Responda APENAS JSON válido no formato:
{
  "rota": [
    { "cliente_id": "uuid", "ordem": 1, "motivo": "razão curta" }
  ],
  "resumo": "1-2 frases explicando a estratégia"
}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você responde apenas JSON válido, sem markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`AI Gateway: ${resp.status} ${t}`);
    }
    const data = await resp.json();
    let content: string = data.choices?.[0]?.message?.content ?? "{}";
    content = content.replace(/```json\s*|\s*```/g, "").trim();
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { rota: [], resumo: content.slice(0, 200) };
    }
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
