import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return new Response(JSON.stringify({ error: "token required" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: t } = await sb.from("nutrir_portal_tokens").select("*").eq("token", token).eq("ativo", true).maybeSingle();
    if (!t) return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } });
    if (t.expira_em && new Date(t.expira_em) < new Date()) return new Response(JSON.stringify({ error: "expired" }), { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } });

    await sb.from("nutrir_portal_tokens").update({ ultimo_acesso: new Date().toISOString() }).eq("id", t.id);

    const [{ data: cliente }, { data: pedidos }, { data: contas }, { data: campos }, { data: estoque }] = await Promise.all([
      sb.from("nutrir_clientes").select("id,razao_social,nome_fantasia,cnpj,cpf,email,whatsapp").eq("id", t.cliente_id).maybeSingle(),
      sb.from("nutrir_pedidos" as any).select("*").eq("cliente_id", t.cliente_id).order("created_at", { ascending: false }).limit(50).then(r => r).catch(() => ({ data: [] })),
      sb.from("nutrir_contas_receber").select("*").eq("cliente_id", t.cliente_id).order("data_vencimento").limit(50),
      sb.from("nutrir_campos_teste").select("id,titulo,cultura,status,data_inicio,area_total_ha").eq("cliente_id", t.cliente_id).limit(50),
      sb.from("nutrir_estoque_cliente").select("*").eq("cliente_id", t.cliente_id).limit(100),
    ]);

    return new Response(JSON.stringify({
      cliente, pedidos: pedidos ?? [], contas: contas ?? [], campos: campos ?? [], estoque: estoque ?? [],
    }), { headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
