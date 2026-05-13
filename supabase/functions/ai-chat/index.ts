// Chat agronômico com streaming SSE.
// Body: { thread_id, message }
// Persiste mensagens na tabela ai_chat_messages e devolve stream OpenAI-compatible.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";

const SYSTEM = `Você é Nutrir AI, agrônomo consultor sênior do agronegócio brasileiro. Especialista em:
- Nutrição vegetal e formulação NPK
- Calagem, gessagem e correção de solo
- Adubação foliar
- Diagnóstico de pragas e doenças
- Manejo integrado e sustentabilidade

Responda em português brasileiro, em Markdown, de forma prática e objetiva. Use tabelas quando útil. Cite referências (CFSEMG, IAC, Embrapa) quando pertinente.
Quando faltar dado, peça o que precisa em vez de inventar.`;

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

    const { thread_id, message } = await req.json();
    if (!thread_id || !message) return json({ error: "thread_id e message obrigatórios" }, 400);

    const { data: thread, error: tErr } = await supabase
      .from("ai_chat_threads").select("id, organization_id").eq("id", thread_id).maybeSingle();
    if (tErr || !thread) return json({ error: "thread não encontrada" }, 404);

    // Carrega histórico (max 30 msgs)
    const { data: history } = await supabase
      .from("ai_chat_messages")
      .select("role, content")
      .eq("thread_id", thread_id)
      .order("created_at", { ascending: true })
      .limit(30);

    // Salva mensagem do usuário
    await supabase.from("ai_chat_messages").insert({
      thread_id, organization_id: thread.organization_id, role: "user", content: message,
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        messages: [
          { role: "system", content: SYSTEM },
          ...(history ?? []),
          { role: "user", content: message },
        ],
      }),
    });

    if (upstream.status === 429) return json({ error: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
    if (upstream.status === 402) return json({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }, 402);
    if (!upstream.ok || !upstream.body) {
      return json({ error: `Falha IA [${upstream.status}]: ${await upstream.text()}` }, 500);
    }

    // Tee: stream para o cliente E acumula para salvar resposta no DB
    const [a, b] = upstream.body.tee();

    // Background: parse SSE no stream b e salva resposta
    (async () => {
      try {
        const reader = b.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let full = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") continue;
            try {
              const j = JSON.parse(payload);
              const c = j?.choices?.[0]?.delta?.content;
              if (c) full += c;
            } catch { /* ignore */ }
          }
        }
        if (full) {
          await supabase.from("ai_chat_messages").insert({
            thread_id, organization_id: thread.organization_id, role: "assistant", content: full,
          });
          await supabase.from("ai_chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", thread_id);
          await supabase.from("usage_metrics").insert({ organization_id: thread.organization_id, metric: "ai_chat" });
        }
      } catch (e) { console.error("save assistant fail", e); }
    })();

    return new Response(a, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
