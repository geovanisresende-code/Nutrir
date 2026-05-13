// Extrai valores de laudo (solo ou foliar) de um PDF usando Lovable AI (Gemini).
// Recebe { storage_path, analysis_type }, baixa o PDF do bucket privado lab-reports,
// e devolve { values: { ph, phosphorus, ... } } estruturado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOIL_FIELDS = ["ph","organic_matter","phosphorus","potassium","calcium","magnesium","sulfur","cec","nitrogen"];
const LEAF_FIELDS = ["n","p","k","ca","mg","s","b","cu","fe","mn","zn"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const body = await req.json();
    const storage_path: string = body?.storage_path;
    const analysis_type: "soil" | "leaf" = body?.analysis_type ?? "soil";
    if (!storage_path) return json({ error: "storage_path required" }, 400);

    // baixa o PDF do bucket
    const { data: file, error: dlErr } = await supabase.storage.from("lab-reports").download(storage_path);
    if (dlErr || !file) return json({ error: "Falha ao baixar PDF: " + (dlErr?.message ?? "") }, 400);

    const buf = await file.arrayBuffer();
    const b64 = base64Encode(new Uint8Array(buf));

    const fields = analysis_type === "soil" ? SOIL_FIELDS : LEAF_FIELDS;
    const schema = {
      type: "object",
      properties: Object.fromEntries(fields.map(f => [f, { type: ["number", "null"] }])),
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um extrator de dados de laudos agronômicos brasileiros (${analysis_type === "soil" ? "análise de solo" : "análise foliar"}). Extraia APENAS os valores numéricos. Use null quando o nutriente não aparecer no laudo. Não invente valores.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Extraia os valores deste laudo. Campos: ${fields.join(", ")}. Para análise de solo: pH em CaCl2 ou H2O, MO em g/kg ou %, P/K em mg/dm³, Ca/Mg em cmolc/dm³ (mE/100cm³), CTC em cmolc/dm³. Para foliar: macros em g/kg, micros em mg/kg.` },
              { type: "file", file: { filename: "laudo.pdf", file_data: `data:application/pdf;base64,${b64}` } }
            ]
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_values",
            description: "Valores extraídos do laudo",
            parameters: schema,
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_values" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      return json({ error: `Lovable AI falhou [${aiRes.status}]: ${t}` }, 500);
    }
    const ai = await aiRes.json();
    const args = ai?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return json({ error: "sem extração", raw: ai }, 500);
    const values = JSON.parse(args);

    return json({ values, analysis_type });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function base64Encode(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
