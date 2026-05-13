// Cria 4 usuários de teste (adm, gerente, rtv, cliente) e vincula à organização Cristiano Agro.
// Idempotente: se o e-mail já existir, apenas garante o vínculo + papel.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORG_ID = "adf4f58e-f1b3-408b-90ba-baf707662b91";
const PASSWORD = "Teste@2026";

const USERS = [
  { email: "adm@teste.com",     name: "ADM Teste",     role: "admin"  as const, cargo: "diretor"          },
  { email: "gerente@teste.com", name: "Gerente Teste", role: "member" as const, cargo: "gerente_regional" },
  { email: "rtv@teste.com",     name: "RTV Teste",     role: "member" as const, cargo: "rtv"              },
  { email: "cliente@teste.com", name: "Cliente Teste", role: "viewer" as const, cargo: null               },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: any[] = [];
  for (const u of USERS) {
    // Procurar usuário existente
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    let user = list.users.find((x) => x.email?.toLowerCase() === u.email);

    if (!user) {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.name },
      });
      if (error) { results.push({ email: u.email, error: error.message }); continue; }
      user = created.user!;
    } else {
      // Reset senha pra garantir
      await supabase.auth.admin.updateUserById(user.id, { password: PASSWORD, email_confirm: true });
    }

    // Profile
    await supabase.from("profiles").upsert(
      { id: user.id, email: u.email, full_name: u.name },
      { onConflict: "id" },
    );

    // Vínculo org + role
    await supabase.from("organization_members").upsert(
      { organization_id: ORG_ID, user_id: user.id, role: u.role },
      { onConflict: "organization_id,user_id" },
    );

    // Aprovar signup pendente
    await supabase
      .from("signup_requests")
      .update({ status: "approved", organization_id: ORG_ID, requested_role: u.role, reviewed_at: new Date().toISOString() })
      .eq("user_id", user.id);

    // Cargo nutrir (se aplicável)
    if (u.cargo) {
      await supabase.from("nutrir_colaboradores").upsert(
        { organization_id: ORG_ID, user_id: user.id, nome: u.name, email: u.email, cargo: u.cargo, ativo: true },
        { onConflict: "organization_id,user_id" },
      );
    }

    results.push({ email: u.email, password: PASSWORD, user_id: user.id, role: u.role, cargo: u.cargo, ok: true });
  }

  return new Response(JSON.stringify({ ok: true, org: ORG_ID, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
