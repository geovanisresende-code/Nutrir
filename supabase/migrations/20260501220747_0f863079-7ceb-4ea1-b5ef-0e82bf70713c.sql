-- ============ RDV (Relatório Diário de Viagem / despesas) ============
CREATE TYPE public.rdv_categoria AS ENUM (
  'combustivel','alimentacao','hospedagem','pedagio','manutencao','estacionamento','outros'
);

CREATE TYPE public.rdv_status AS ENUM ('rascunho','enviado','aprovado','rejeitado','pago');

CREATE TABLE public.nutrir_rdv (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,            -- representante que lançou
  data date NOT NULL DEFAULT CURRENT_DATE,
  categoria public.rdv_categoria NOT NULL,
  descricao text,
  valor numeric NOT NULL CHECK (valor >= 0),
  km_inicial numeric,
  km_final numeric,
  cliente_id uuid,                  -- nutrir_clientes opcional
  visita_id uuid,                   -- nutrir_visitas opcional
  cupom_path text,                  -- storage: rdv-cupons/<user>/<file>
  status public.rdv_status NOT NULL DEFAULT 'rascunho',
  reviewed_by uuid,
  reviewed_at timestamptz,
  notas_revisao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rdv_org_user_data ON public.nutrir_rdv (organization_id, user_id, data DESC);
CREATE INDEX idx_rdv_status ON public.nutrir_rdv (organization_id, status);

ALTER TABLE public.nutrir_rdv ENABLE ROW LEVEL SECURITY;

-- Representante vê e edita os próprios; admin/owner/manager vêem tudo da org
CREATE POLICY rdv_self_or_admin_select ON public.nutrir_rdv FOR SELECT TO authenticated
USING (
  is_org_member(organization_id, auth.uid()) AND (
    user_id = auth.uid()
    OR has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[])
  )
);
CREATE POLICY rdv_self_insert ON public.nutrir_rdv FOR INSERT TO authenticated
WITH CHECK (is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());

CREATE POLICY rdv_self_update_draft ON public.nutrir_rdv FOR UPDATE TO authenticated
USING (
  is_org_member(organization_id, auth.uid()) AND (
    (user_id = auth.uid() AND status IN ('rascunho','enviado'))
    OR has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[])
  )
)
WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE POLICY rdv_admin_delete ON public.nutrir_rdv FOR DELETE TO authenticated
USING (
  (user_id = auth.uid() AND status = 'rascunho')
  OR has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[])
);

CREATE TRIGGER trg_rdv_updated BEFORE UPDATE ON public.nutrir_rdv
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Bucket para cupons
INSERT INTO storage.buckets (id, name, public) VALUES ('rdv-cupons','rdv-cupons', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "rdv-cupons own read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'rdv-cupons' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "rdv-cupons own write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'rdv-cupons' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "rdv-cupons own update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'rdv-cupons' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "rdv-cupons own delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'rdv-cupons' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============ Estoque do Cliente ============
CREATE TYPE public.estoque_mov_tipo AS ENUM ('entrada','saida','ajuste');

CREATE TABLE public.nutrir_estoque_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  produto_id uuid,                       -- nutrir_produtos
  produto_nome text NOT NULL,            -- snapshot
  unidade text NOT NULL DEFAULT 'L',
  saldo numeric NOT NULL DEFAULT 0,
  custo_medio numeric NOT NULL DEFAULT 0,
  ultima_movimentacao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, produto_nome, unidade)
);
ALTER TABLE public.nutrir_estoque_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY estoque_org_all ON public.nutrir_estoque_cliente FOR ALL TO authenticated
USING (is_org_member(organization_id, auth.uid()))
WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE TRIGGER trg_estoque_updated BEFORE UPDATE ON public.nutrir_estoque_cliente
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.nutrir_estoque_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  estoque_id uuid NOT NULL REFERENCES public.nutrir_estoque_cliente(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL,
  tipo public.estoque_mov_tipo NOT NULL,
  quantidade numeric NOT NULL,
  custo_unitario numeric,
  origem text,                            -- 'pedido','manual','ajuste'
  origem_id uuid,                         -- ex: pedido id
  observacao text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_estmov_estoque ON public.nutrir_estoque_movimentacoes (estoque_id, created_at DESC);
ALTER TABLE public.nutrir_estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY estmov_org_all ON public.nutrir_estoque_movimentacoes FOR ALL TO authenticated
USING (is_org_member(organization_id, auth.uid()))
WITH CHECK (is_org_member(organization_id, auth.uid()));

-- Trigger: movimentação atualiza saldo + custo médio
CREATE OR REPLACE FUNCTION public.apply_estoque_movimentacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  est record;
  novo_saldo numeric;
  novo_cm numeric;
BEGIN
  SELECT * INTO est FROM public.nutrir_estoque_cliente WHERE id = NEW.estoque_id FOR UPDATE;

  IF NEW.tipo = 'entrada' THEN
    novo_saldo := est.saldo + NEW.quantidade;
    -- custo médio ponderado
    IF novo_saldo > 0 AND NEW.custo_unitario IS NOT NULL THEN
      novo_cm := ((est.saldo * est.custo_medio) + (NEW.quantidade * NEW.custo_unitario)) / novo_saldo;
    ELSE
      novo_cm := est.custo_medio;
    END IF;
  ELSIF NEW.tipo = 'saida' THEN
    novo_saldo := est.saldo - NEW.quantidade;
    novo_cm := est.custo_medio;
  ELSE -- ajuste: quantidade pode ser positiva ou negativa
    novo_saldo := est.saldo + NEW.quantidade;
    novo_cm := COALESCE(NEW.custo_unitario, est.custo_medio);
  END IF;

  UPDATE public.nutrir_estoque_cliente
  SET saldo = novo_saldo,
      custo_medio = novo_cm,
      ultima_movimentacao = NEW.created_at
  WHERE id = NEW.estoque_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_estoque_mov AFTER INSERT ON public.nutrir_estoque_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.apply_estoque_movimentacao();

-- RPC: dá entrada/saída por nome de produto (cria estoque se não existir)
CREATE OR REPLACE FUNCTION public.estoque_movimentar(
  _org uuid, _cliente uuid, _produto_nome text, _unidade text,
  _tipo public.estoque_mov_tipo, _quantidade numeric,
  _custo numeric DEFAULT NULL, _origem text DEFAULT 'manual',
  _origem_id uuid DEFAULT NULL, _obs text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  est_id uuid;
  mov_id uuid;
BEGIN
  IF NOT is_org_member(_org, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão na organização.';
  END IF;

  SELECT id INTO est_id FROM public.nutrir_estoque_cliente
    WHERE cliente_id = _cliente AND produto_nome = _produto_nome AND unidade = COALESCE(_unidade,'L');
  IF est_id IS NULL THEN
    INSERT INTO public.nutrir_estoque_cliente (organization_id, cliente_id, produto_nome, unidade)
    VALUES (_org, _cliente, _produto_nome, COALESCE(_unidade,'L')) RETURNING id INTO est_id;
  END IF;

  INSERT INTO public.nutrir_estoque_movimentacoes
    (organization_id, estoque_id, cliente_id, tipo, quantidade, custo_unitario, origem, origem_id, observacao, user_id)
  VALUES (_org, est_id, _cliente, _tipo, _quantidade, _custo, _origem, _origem_id, _obs, auth.uid())
  RETURNING id INTO mov_id;

  RETURN mov_id;
END $$;