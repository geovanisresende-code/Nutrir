ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS ndvi_source text NOT NULL DEFAULT 'demo';

CREATE INDEX IF NOT EXISTS idx_ndvi_field_date
  ON public.ndvi_readings (field_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_ndvi_org_date
  ON public.ndvi_readings (organization_id, captured_at DESC);