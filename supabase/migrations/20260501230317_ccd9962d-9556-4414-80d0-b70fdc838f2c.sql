
-- Adiciona geometria GeoJSON e série NDVI por campo de teste
ALTER TABLE public.nutrir_campos_teste
  ADD COLUMN IF NOT EXISTS geometria jsonb,
  ADD COLUMN IF NOT EXISTS centro_lat numeric,
  ADD COLUMN IF NOT EXISTS centro_lng numeric;

CREATE TABLE IF NOT EXISTS public.nutrir_campos_teste_ndvi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  campo_teste_id uuid NOT NULL REFERENCES public.nutrir_campos_teste(id) ON DELETE CASCADE,
  data date NOT NULL,
  ndvi_mean numeric,
  ndvi_min numeric,
  ndvi_max numeric,
  fonte text NOT NULL DEFAULT 'simulado',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campo_teste_id, data)
);

ALTER TABLE public.nutrir_campos_teste_ndvi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ndvi campos teste org members select"
ON public.nutrir_campos_teste_ndvi FOR SELECT
USING (is_org_member(organization_id, auth.uid()));

CREATE POLICY "ndvi campos teste org members insert"
ON public.nutrir_campos_teste_ndvi FOR INSERT
WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE POLICY "ndvi campos teste org members delete"
ON public.nutrir_campos_teste_ndvi FOR DELETE
USING (is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_campos_teste_ndvi_campo_data
  ON public.nutrir_campos_teste_ndvi (campo_teste_id, data DESC);
