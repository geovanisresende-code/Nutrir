-- ============ Contas a Receber ============
CREATE TYPE public.cr_status AS ENUM ('em_aberto','vencendo','vencido','pago','cancelado');

CREATE TABLE public.nutrir_contas_receber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  cliente_id uuid REFERENCES public.nutrir_clientes(id) ON DELETE SET NULL,
  pedido_id uuid REFERENCES public.nutrir_pedidos(id) ON DELETE SET NULL,
  representante_id uuid REFERENCES public.nutrir_representantes(id) ON DELETE SET NULL,
  numero_nf text,
  parcela int NOT NULL DEFAULT 1,
  parcelas_total int NOT NULL DEFAULT 1,
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento date NOT NULL,
  valor numeric(14,2) NOT NULL CHECK (valor >= 0),
  valor_pago numeric(14,2) NOT NULL DEFAULT 0,
  data_pagamento date,
  status public.cr_status NOT NULL DEFAULT 'em_aberto',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cr_org_venc ON public.nutrir_contas_receber (organization_id, data_vencimento);
CREATE INDEX idx_cr_status ON public.nutrir_contas_receber (organization_id, status);
ALTER TABLE public.nutrir_contas_receber ENABLE ROW LEVEL SECURITY;

CREATE POLICY cr_read ON public.nutrir_contas_receber FOR SELECT TO authenticated
USING (is_org_member(organization_id, auth.uid()));

CREATE POLICY cr_admin_write ON public.nutrir_contas_receber FOR ALL TO authenticated
USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

CREATE TRIGGER trg_cr_updated BEFORE UPDATE ON public.nutrir_contas_receber
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Comissões ============
CREATE TYPE public.comissao_status AS ENUM ('prevista','apurada','paga','cancelada');

CREATE TABLE public.nutrir_comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  representante_id uuid REFERENCES public.nutrir_representantes(id) ON DELETE SET NULL,
  user_id uuid,                      -- auth.users do representante (se houver)
  pedido_id uuid REFERENCES public.nutrir_pedidos(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.nutrir_clientes(id) ON DELETE SET NULL,
  mes_referencia date NOT NULL,      -- primeiro dia do mês
  base_calculo numeric(14,2) NOT NULL DEFAULT 0,
  percentual numeric(6,3) NOT NULL DEFAULT 0,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  bonus_meta numeric(14,2) NOT NULL DEFAULT 0,
  status public.comissao_status NOT NULL DEFAULT 'prevista',
  data_pagamento date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_com_org_mes ON public.nutrir_comissoes (organization_id, mes_referencia DESC);
CREATE INDEX idx_com_rep ON public.nutrir_comissoes (representante_id, mes_referencia DESC);
ALTER TABLE public.nutrir_comissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY com_self_or_admin_read ON public.nutrir_comissoes FOR SELECT TO authenticated
USING (
  is_org_member(organization_id, auth.uid()) AND (
    user_id = auth.uid()
    OR has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[])
  )
);

CREATE POLICY com_admin_write ON public.nutrir_comissoes FOR ALL TO authenticated
USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

CREATE TRIGGER trg_com_updated BEFORE UPDATE ON public.nutrir_comissoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Trigger: pedido confirmado/entregue gera título + comissão ============
CREATE OR REPLACE FUNCTION public.gerar_cr_e_comissao_do_pedido()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prazo int := 30;
  pct numeric := 0;
  rep_user uuid;
  ja_existe boolean;
BEGIN
  IF NEW.status NOT IN ('confirmado','entregue','faturado') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN RETURN NEW; END IF;

  -- prazo da modalidade
  SELECT COALESCE(prazo_dias, 30) INTO prazo FROM public.nutrir_modalidades WHERE id = NEW.modalidade_id;

  -- Conta a receber (1 parcela inicial; futuras parcelas podem ser geradas manualmente)
  SELECT EXISTS(SELECT 1 FROM public.nutrir_contas_receber WHERE pedido_id = NEW.id) INTO ja_existe;
  IF NOT ja_existe AND NEW.total > 0 THEN
    INSERT INTO public.nutrir_contas_receber
      (organization_id, cliente_id, pedido_id, representante_id, data_emissao, data_vencimento, valor)
    VALUES
      (NEW.organization_id, NEW.cliente_id, NEW.id, NEW.representante_id,
       NEW.data_pedido, NEW.data_pedido + (prazo || ' days')::interval, NEW.total);
  END IF;

  -- Comissão prevista
  SELECT comissao_pct, user_id INTO pct, rep_user
  FROM public.nutrir_representantes WHERE id = NEW.representante_id;
  IF pct IS NULL THEN pct := 0; END IF;

  SELECT EXISTS(SELECT 1 FROM public.nutrir_comissoes WHERE pedido_id = NEW.id) INTO ja_existe;
  IF NOT ja_existe AND NEW.representante_id IS NOT NULL AND NEW.total > 0 THEN
    INSERT INTO public.nutrir_comissoes
      (organization_id, representante_id, user_id, pedido_id, cliente_id,
       mes_referencia, base_calculo, percentual, valor)
    VALUES
      (NEW.organization_id, NEW.representante_id, rep_user, NEW.id, NEW.cliente_id,
       date_trunc('month', NEW.data_pedido)::date, NEW.total, pct, NEW.total * pct / 100.0);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pedido_gera_cr_com ON public.nutrir_pedidos;
CREATE TRIGGER trg_pedido_gera_cr_com
AFTER INSERT OR UPDATE OF status ON public.nutrir_pedidos
FOR EACH ROW EXECUTE FUNCTION public.gerar_cr_e_comissao_do_pedido();

-- ============ Função para atualizar status (vencendo/vencido) ============
CREATE OR REPLACE FUNCTION public.atualizar_status_cr()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rows_affected int;
BEGIN
  UPDATE public.nutrir_contas_receber
  SET status = 'vencido'
  WHERE status IN ('em_aberto','vencendo')
    AND data_vencimento < CURRENT_DATE;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  UPDATE public.nutrir_contas_receber
  SET status = 'vencendo'
  WHERE status = 'em_aberto'
    AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '15 days';

  RETURN rows_affected;
END $$;