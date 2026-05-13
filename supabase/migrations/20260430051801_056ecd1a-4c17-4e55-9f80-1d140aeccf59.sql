-- Cache de cotações
CREATE TABLE public.commodity_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity TEXT NOT NULL,
  price_brl NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'saca 60kg',
  variation_pct NUMERIC,
  source TEXT NOT NULL DEFAULT 'CEPEA',
  reference_date DATE,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw JSONB
);

CREATE UNIQUE INDEX uq_commodity_latest ON public.commodity_quotes (commodity, source, reference_date);
CREATE INDEX idx_commodity_fetched ON public.commodity_quotes (commodity, fetched_at DESC);

ALTER TABLE public.commodity_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY commodity_read_all ON public.commodity_quotes
  FOR SELECT TO authenticated USING (true);

-- Webhooks de ERP
CREATE TABLE public.erp_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  label TEXT NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  total_calls INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_erp_webhooks_org ON public.erp_webhooks (organization_id);

ALTER TABLE public.erp_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY erp_admin_all ON public.erp_webhooks
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]));