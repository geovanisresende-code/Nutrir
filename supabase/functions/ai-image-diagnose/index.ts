// Diagnóstico de doenças/pragas a partir de foto da planta.
// Body: { organization_id, image_path, crop?, field_id?, client_id? }
// Baixa imagem do bucket plant-photos, envia ao Gemini multimodal e persiste.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";

const SYSTEM = `Você é um fitopatologista e entomologista consultor do agronegócio brasileiro.
Analise a foto da planta/folha e identifique:
- A cultura visível (se possível)
- Possíveis doenças (fúngicas, bacterianas, virais)
- Possíveis pragas (insetos, ácaros)
- Deficiências nutricionais aparentes
- Fatores abióticos (queimadura, geada, deficiência hídrica)

Sempre responda como JSON válido seguindo o schema fornecido. Use português brasileiro.
Se a foto for ruim ou não tiver planta, retorne severidade "indeterminado" e explique no campo diagnosis.`;

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

    const { organization_id, image_path, crop, field_id, client_id } = await req.json();
    if (!organization_id || !image_path) return json({ error: "organization_id e image_path obrigatórios" }, 400);

    const { data: file, error: dErr } = await supabase.storage.from("plant-photos").download(image_path);
    if (dErr || !file) return json({ error: "Falha ao baixar imagem: " + (dErr?.message ?? "") }, 400);

    const buf = await file.arrayBuffer();
    const b64 = base64Encode(new Uint8Array(buf));
    const mime = file.type || "image/jpeg";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const userText = `Cultura informada: ${crop ?? "não informada"}. Analise a imagem e devolva o diagnóstico estruturado.`;

    const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "submit_diagnosis",
            description: "Diagnóstico estruturado da planta",
            parameters: {
              type: "object",
              properties: {
                detected_crop: { type: "string", description: "Cultura identificada na imagem (vazio se incerto)" },
                diagnosis: { type: "string", description: "Diagnóstico completo em markdown: causas mais prováveis, sintomas observados" },
                severity: { type: "string", enum: ["leve","moderado","severo","indeterminado"] },
                treatment: { type: "string", description: "Tratamento e manejo recomendados em markdown" },
                confidence: { type: "number", description: "0 a 1" },
              },
              required: ["diagnosis","severity","treatment","confidence"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_diagnosis" } },
      }),
    });

    if (ai.status === 429) return json({ error: "Limite de requisições atingido." }, 429);
    if (ai.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    if (!ai.ok) return json({ error: `Falha IA [${ai.status}]: ${await ai.text()}` }, 500);

    const data = await ai.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return json({ error: "IA não retornou diagnóstico estruturado" }, 500);
    const parsed = JSON.parse(args);

    const { data: inserted } = await supabase.from("ai_image_diagnoses").insert({
      organization_id,
      created_by: user.id,
      client_id: client_id ?? null,
      field_id: field_id ?? null,
      crop: crop ?? parsed.detected_crop ?? null,
      image_path,
      diagnosis: parsed.diagnosis,
      severity: parsed.severity,
      treatment: parsed.treatment,
      raw: parsed,
    }).select().single();

    await supabase.from("usage_metrics").insert({ organization_id, metric: "ai_image" });

    return json({ result: parsed, record: inserted });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});

function base64Encode(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
