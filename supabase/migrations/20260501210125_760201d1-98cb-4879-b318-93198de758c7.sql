-- Histórico de cálculos foliares NUTRIR
CREATE TABLE public.nutrir_foliar_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  created_by UUID,
  titulo TEXT NOT NULL,
  produtor TEXT,
  fazenda TEXT,
  cultura TEXT,
  area_ha NUMERIC NOT NULL DEFAULT 0,
  nivel TEXT NOT NULL DEFAULT 'padrao',
  complexador TEXT NOT NULL DEFAULT 'leg',
  numero_batidas INTEGER NOT NULL DEFAULT 0,
  aplicacao_foliar_l_ha NUMERIC NOT NULL DEFAULT 0,
  custo_nutrir_rs_ha NUMERIC NOT NULL DEFAULT 0,
  custo_convencional_rs_ha NUMERIC NOT NULL DEFAULT 0,
  economia_rs_ha NUMERIC NOT NULL DEFAULT 0,
  economia_total_rs NUMERIC NOT NULL DEFAULT 0,
  inputs JSONB NOT NULL,
  resultado JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrir_foliar_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrir_foliar_hist_read" ON public.nutrir_foliar_historico
  FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));

CREATE POLICY "nutrir_foliar_hist_write" ON public.nutrir_foliar_historico
  FOR ALL TO authenticated
  USING (is_org_member(organization_id, auth.uid()))
  WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE INDEX idx_nutrir_foliar_hist_org ON public.nutrir_foliar_historico(organization_id, created_at DESC);

CREATE TRIGGER nutrir_foliar_hist_touch
  BEFORE UPDATE ON public.nutrir_foliar_historico
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();