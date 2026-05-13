-- Histórico de cálculos NPK (drench/fertirrigação/nonino/localizada)
CREATE TABLE IF NOT EXISTS public.nutrir_npk_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  produtor TEXT,
  fazenda TEXT,
  cultura TEXT,
  area_ha NUMERIC,
  modo_aplicacao TEXT,
  modo_producao TEXT,
  custo_por_ha NUMERIC,
  custo_total NUMERIC,
  economia_vs_mp_pct NUMERIC,
  economia_vs_formulado_pct NUMERIC,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  resultado JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrir_npk_historico_org ON public.nutrir_npk_historico(organization_id, created_at DESC);

ALTER TABLE public.nutrir_npk_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da organização podem ver histórico NPK"
ON public.nutrir_npk_historico FOR SELECT
USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Membros da organização podem criar histórico NPK"
ON public.nutrir_npk_historico FOR INSERT
WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Autor pode atualizar próprio histórico NPK"
ON public.nutrir_npk_historico FOR UPDATE
USING (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Autor ou admin pode excluir histórico NPK"
ON public.nutrir_npk_historico FOR DELETE
USING (
  public.is_org_member(organization_id, auth.uid())
  AND (user_id = auth.uid() OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
);

CREATE TRIGGER trg_nutrir_npk_historico_updated
BEFORE UPDATE ON public.nutrir_npk_historico
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();