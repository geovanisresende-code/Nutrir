-- Função para updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE IF NOT EXISTS public.nutrir_financeiro_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'banco',
  saldo_inicial numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrir_financeiro_contas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fc_org_all" ON public.nutrir_financeiro_contas FOR ALL TO authenticated
USING (is_org_member(organization_id, auth.uid())) WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.nutrir_financeiro_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'despesa',
  cor text DEFAULT '#3B82F6',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrir_financeiro_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fcat_org_all" ON public.nutrir_financeiro_categorias FOR ALL TO authenticated
USING (is_org_member(organization_id, auth.uid())) WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.nutrir_financeiro_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  conta_id uuid REFERENCES public.nutrir_financeiro_contas(id) ON DELETE SET NULL,
  categoria_id uuid REFERENCES public.nutrir_financeiro_categorias(id) ON DELETE SET NULL,
  cliente_id uuid,
  pedido_id uuid,
  data date NOT NULL DEFAULT CURRENT_DATE,
  descricao text NOT NULL,
  tipo text NOT NULL,
  valor numeric NOT NULL,
  status text NOT NULL DEFAULT 'pago',
  forma_pagamento text,
  observacoes text,
  anexo_path text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrir_financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fl_org_all" ON public.nutrir_financeiro_lancamentos FOR ALL TO authenticated
USING (is_org_member(organization_id, auth.uid())) WITH CHECK (is_org_member(organization_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_fl_org_data ON public.nutrir_financeiro_lancamentos(organization_id, data DESC);

CREATE TABLE IF NOT EXISTS public.nutrir_crm_oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  cliente_id uuid,
  cliente_nome text,
  representante_id uuid,
  titulo text NOT NULL,
  descricao text,
  valor_estimado numeric DEFAULT 0,
  etapa text NOT NULL DEFAULT 'prospeccao',
  probabilidade integer NOT NULL DEFAULT 30,
  data_prevista date,
  motivo_perda text,
  ordem integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrir_crm_oportunidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_org_all" ON public.nutrir_crm_oportunidades FOR ALL TO authenticated
USING (is_org_member(organization_id, auth.uid())) WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.nutrir_crm_interacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  oportunidade_id uuid REFERENCES public.nutrir_crm_oportunidades(id) ON DELETE CASCADE,
  cliente_id uuid,
  tipo text NOT NULL DEFAULT 'nota',
  descricao text NOT NULL,
  data timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrir_crm_interacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_int_org_all" ON public.nutrir_crm_interacoes FOR ALL TO authenticated
USING (is_org_member(organization_id, auth.uid())) WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.nutrir_estoque_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  produto_id uuid,
  produto_nome text NOT NULL,
  numero_lote text NOT NULL,
  data_fabricacao date,
  data_validade date,
  quantidade numeric NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'L',
  custo_unitario numeric NOT NULL DEFAULT 0,
  deposito text DEFAULT 'principal',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrir_estoque_lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lote_org_all" ON public.nutrir_estoque_lotes FOR ALL TO authenticated
USING (is_org_member(organization_id, auth.uid())) WITH CHECK (is_org_member(organization_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_lote_validade ON public.nutrir_estoque_lotes(organization_id, data_validade);

CREATE TABLE IF NOT EXISTS public.nutrir_romaneios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  pedido_id uuid,
  cliente_id uuid,
  cliente_nome text,
  numero text NOT NULL,
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  data_entrega date,
  motorista text,
  placa text,
  transportadora text,
  status text NOT NULL DEFAULT 'preparando',
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacoes text,
  endereco_entrega text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrir_romaneios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rom_org_all" ON public.nutrir_romaneios FOR ALL TO authenticated
USING (is_org_member(organization_id, auth.uid())) WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.nutrir_portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expira_em timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_acesso timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrir_portal_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pt_org_manage" ON public.nutrir_portal_tokens FOR ALL TO authenticated
USING (is_org_member(organization_id, auth.uid())) WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE TRIGGER trg_crm_op_upd BEFORE UPDATE ON public.nutrir_crm_oportunidades
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_lote_upd BEFORE UPDATE ON public.nutrir_estoque_lotes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_rom_upd BEFORE UPDATE ON public.nutrir_romaneios
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();