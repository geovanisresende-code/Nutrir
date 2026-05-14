-- ────────────────────────────────────────────────────────────────────────
-- RLS em cascata — Diretor → Gerente Regional → Representante → AT
-- ────────────────────────────────────────────────────────────────────────
-- Modelo:
--   • Proprietário/Diretor: vê TUDO da organização
--   • Gerente Regional:     vê TUDO de sua regional + reps subordinados
--   • Representante:        vê APENAS o que ele criou / é responsável
--   • Cliente:              vê apenas o que está marcado pra ele
--
-- Tabelas: nutrir_clientes, nutrir_visitas, nutrir_pedidos, nutrir_rdv,
-- nutrir_estoque_cliente, nutrir_contas_receber, nutrir_comissoes, nutrir_campos_teste.
--
-- Rodar em: https://supabase.com/dashboard/project/wkvvgsjunippzwpybaeb/sql/new
-- ────────────────────────────────────────────────────────────────────────

-- ── 1) HELPER FUNCTIONS ─────────────────────────────────────────────────

-- Diretor / Proprietário / Admin?
CREATE OR REPLACE FUNCTION public.is_director_or_owner(p_org uuid, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = p_org AND o.owner_id = p_user
  )
  OR EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.organization_id = p_org AND m.user_id = p_user
      AND m.role IN ('owner','admin')
  )
  OR EXISTS (
    SELECT 1 FROM nutrir_colaboradores c
    WHERE c.organization_id = p_org AND c.user_id = p_user AND c.cargo = 'diretor'
  );
$$;

-- Regional do user na org
CREATE OR REPLACE FUNCTION public.user_regional_id(p_org uuid, p_user uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT regional_id FROM nutrir_colaboradores
       WHERE organization_id = p_org AND user_id = p_user LIMIT 1),
    (SELECT regional_id FROM nutrir_representantes
       WHERE organization_id = p_org AND user_id = p_user LIMIT 1)
  );
$$;

-- Gerente regional? (verifica cargo na tabela nutrir_colaboradores;
-- o enum app_role NÃO tem 'manager' - só owner/admin/member/viewer)
CREATE OR REPLACE FUNCTION public.is_regional_manager(p_org uuid, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM nutrir_colaboradores
    WHERE organization_id = p_org AND user_id = p_user AND cargo = 'gerente_regional'
  );
$$;

-- Cliente está na hierarquia visível do user?
CREATE OR REPLACE FUNCTION public.cliente_visivel(p_cliente_id uuid, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH cli AS (
    SELECT c.organization_id, c.user_id AS rep_user_id, r.regional_id
    FROM nutrir_clientes c
    LEFT JOIN nutrir_representantes r
      ON r.user_id = c.user_id AND r.organization_id = c.organization_id
    WHERE c.id = p_cliente_id
  )
  SELECT
    is_director_or_owner((SELECT organization_id FROM cli), p_user)
    OR (SELECT rep_user_id FROM cli) = p_user
    OR (
      is_regional_manager((SELECT organization_id FROM cli), p_user)
      AND user_regional_id((SELECT organization_id FROM cli), p_user)
          = (SELECT regional_id FROM cli)
    );
$$;

-- ── 2) APLICA POLICIES ──────────────────────────────────────────────────
-- nutrir_clientes
DROP POLICY IF EXISTS clientes_select_hier ON public.nutrir_clientes;
CREATE POLICY clientes_select_hier ON public.nutrir_clientes
  FOR SELECT TO authenticated
  USING (
    is_director_or_owner(organization_id, auth.uid())
    OR user_id = auth.uid()
    OR (
      is_regional_manager(organization_id, auth.uid())
      AND EXISTS (
        SELECT 1 FROM nutrir_representantes r
        WHERE r.user_id = nutrir_clientes.user_id
          AND r.organization_id = nutrir_clientes.organization_id
          AND r.regional_id = user_regional_id(nutrir_clientes.organization_id, auth.uid())
      )
    )
  );

-- nutrir_visitas
DROP POLICY IF EXISTS visitas_select_hier ON public.nutrir_visitas;
CREATE POLICY visitas_select_hier ON public.nutrir_visitas
  FOR SELECT TO authenticated
  USING (
    is_director_or_owner(organization_id, auth.uid())
    OR user_id = auth.uid()
    OR (cliente_id IS NOT NULL AND cliente_visivel(cliente_id, auth.uid()))
  );

-- nutrir_pedidos
DROP POLICY IF EXISTS pedidos_select_hier ON public.nutrir_pedidos;
CREATE POLICY pedidos_select_hier ON public.nutrir_pedidos
  FOR SELECT TO authenticated
  USING (
    is_director_or_owner(organization_id, auth.uid())
    OR created_by = auth.uid()
    OR (cliente_id IS NOT NULL AND cliente_visivel(cliente_id, auth.uid()))
  );

-- nutrir_rdv
DROP POLICY IF EXISTS rdv_select_hier ON public.nutrir_rdv;
CREATE POLICY rdv_select_hier ON public.nutrir_rdv
  FOR SELECT TO authenticated
  USING (
    is_director_or_owner(organization_id, auth.uid())
    OR user_id = auth.uid()
    OR (
      is_regional_manager(organization_id, auth.uid())
      AND EXISTS (
        SELECT 1 FROM nutrir_representantes r
        WHERE r.user_id = nutrir_rdv.user_id
          AND r.organization_id = nutrir_rdv.organization_id
          AND r.regional_id = user_regional_id(nutrir_rdv.organization_id, auth.uid())
      )
    )
  );

-- nutrir_estoque_cliente
DROP POLICY IF EXISTS estoque_select_hier ON public.nutrir_estoque_cliente;
CREATE POLICY estoque_select_hier ON public.nutrir_estoque_cliente
  FOR SELECT TO authenticated
  USING (cliente_visivel(cliente_id, auth.uid()));

-- nutrir_contas_receber
DROP POLICY IF EXISTS cr_select_hier ON public.nutrir_contas_receber;
CREATE POLICY cr_select_hier ON public.nutrir_contas_receber
  FOR SELECT TO authenticated
  USING (
    is_director_or_owner(organization_id, auth.uid())
    OR (cliente_id IS NOT NULL AND cliente_visivel(cliente_id, auth.uid()))
  );

-- nutrir_comissoes
DROP POLICY IF EXISTS comissoes_select_hier ON public.nutrir_comissoes;
CREATE POLICY comissoes_select_hier ON public.nutrir_comissoes
  FOR SELECT TO authenticated
  USING (
    is_director_or_owner(organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM nutrir_representantes r
      WHERE r.id = nutrir_comissoes.representante_id
        AND r.user_id = auth.uid()
    )
    OR (
      is_regional_manager(organization_id, auth.uid())
      AND EXISTS (
        SELECT 1 FROM nutrir_representantes r
        WHERE r.id = nutrir_comissoes.representante_id
          AND r.regional_id = user_regional_id(organization_id, auth.uid())
      )
    )
  );

-- nutrir_campos_teste
DROP POLICY IF EXISTS ct_select_hier ON public.nutrir_campos_teste;
CREATE POLICY ct_select_hier ON public.nutrir_campos_teste
  FOR SELECT TO authenticated
  USING (
    is_director_or_owner(organization_id, auth.uid())
    OR user_id = auth.uid()
    OR (cliente_id IS NOT NULL AND cliente_visivel(cliente_id, auth.uid()))
  );

SELECT 'RLS hierárquica aplicada' AS status,
       'clientes, visitas, pedidos, rdv, estoque_cliente, contas_receber, comissoes, campos_teste' AS escopo;
