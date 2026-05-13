// Receita de correção de solo via IA (sem necessidade de thread).
// Body: { organization_id, prompt }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um agrônomo consultor sênior especialista em fertilidade do solo, calagem, gessagem e adubação NPK no Brasil. Use referências CFSEMG, IAC e Embrapa. Responda SEMPRE em Markdown PT-BR, prático, com tabelas quando útil, sem inventar valores que não estão nos dados.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") return json({ error: "prompt obrigatório" }, 400);

    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (ai.status === 429) return json({ error: "Limite de requisições atingido." }, 429);
    if (ai.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    if (!ai.ok) return json({ error: `IA falhou [${ai.status}]: ${await ai.text()}` }, 500);

    const j = await ai.json();
    const content = j?.choices?.[0]?.message?.content ?? "";
    return json({ content });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
