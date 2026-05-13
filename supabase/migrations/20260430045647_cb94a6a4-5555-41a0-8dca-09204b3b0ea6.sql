-- Subscriptions per organization
CREATE TABLE public.org_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_subs_org ON public.org_subscriptions(organization_id);
CREATE INDEX idx_org_subs_stripe ON public.org_subscriptions(stripe_subscription_id);

ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subs_member_read" ON public.org_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- Service role bypassa RLS, então não criamos política de write.

-- Map stripe price_id -> plan tier
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS stripe_price_id_monthly text,
  ADD COLUMN IF NOT EXISTS stripe_price_id_yearly text;

-- Usage helper function
CREATE OR REPLACE FUNCTION public.get_org_usage(_org uuid)
RETURNS TABLE (
  hectares numeric,
  members int,
  ai_calls_month int,
  ndvi_calls_month int,
  reports_month int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT SUM(hectares) FROM fields WHERE organization_id = _org), 0)::numeric AS hectares,
    (SELECT COUNT(*) FROM organization_members WHERE organization_id = _org)::int AS members,
    (SELECT COUNT(*) FROM ai_recommendations WHERE organization_id = _org AND created_at >= date_trunc('month', now()))::int
      + (SELECT COUNT(*) FROM ai_image_diagnoses WHERE organization_id = _org AND created_at >= date_trunc('month', now()))::int
      + (SELECT COUNT(*) FROM ai_chat_messages WHERE organization_id = _org AND role = 'assistant' AND created_at >= date_trunc('month', now()))::int
      AS ai_calls_month,
    (SELECT COUNT(*) FROM ndvi_readings WHERE organization_id = _org AND created_at >= date_trunc('month', now()))::int AS ndvi_calls_month,
    (SELECT COUNT(*) FROM reports WHERE organization_id = _org AND created_at >= date_trunc('month', now()))::int AS reports_month;
$$;

CREATE TRIGGER touch_org_subs_updated_at
  BEFORE UPDATE ON public.org_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed price IDs into plans
UPDATE public.plans SET
  stripe_price_id_monthly = CASE tier
    WHEN 'pro' THEN 'pro_monthly'
    WHEN 'enterprise' THEN 'enterprise_monthly'
    ELSE NULL END,
  stripe_price_id_yearly = CASE tier
    WHEN 'pro' THEN 'pro_yearly'
    WHEN 'enterprise' THEN 'enterprise_yearly'
    ELSE NULL END
WHERE tier IN ('pro', 'enterprise');