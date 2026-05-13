
-- =========================================================
-- NUTRIR ENTERPRISE — Schema Multi-tenant SaaS
-- =========================================================

-- Enums
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE public.plan_tier AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
CREATE TYPE public.sample_status AS ENUM ('low','medium','high','optimal');

-- =========================================================
-- Plans
-- =========================================================
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier plan_tier NOT NULL UNIQUE,
  name text NOT NULL,
  max_users int NOT NULL DEFAULT 3,
  max_hectares numeric NOT NULL DEFAULT 100,
  max_ai_calls_month int NOT NULL DEFAULT 100,
  max_ndvi_calls_month int NOT NULL DEFAULT 50,
  price_cents int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.plans (tier,name,max_users,max_hectares,max_ai_calls_month,max_ndvi_calls_month,price_cents) VALUES
('free','Free',3,100,100,50,0),
('pro','Pro',15,5000,2000,1000,9900),
('enterprise','Enterprise',999,999999,99999,99999,49900);

-- =========================================================
-- Organizations
-- =========================================================
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan_tier plan_tier NOT NULL DEFAULT 'free',
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Profiles
-- =========================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  default_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Organization members (roles per org)
-- =========================================================
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- =========================================================
-- Invites
-- =========================================================
CREATE TABLE public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'member',
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status invite_status NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Usage tracking (per org per month)
-- =========================================================
CREATE TABLE public.usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric text NOT NULL, -- 'ai_call' | 'ndvi_call' | 'sample' | 'hectare'
  amount numeric NOT NULL DEFAULT 1,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_org_metric_idx ON public.usage_metrics (organization_id, metric, occurred_at);

-- =========================================================
-- DOMAIN: Mapas / Talhões (fields)
-- =========================================================
CREATE TABLE public.farms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  farm_id uuid REFERENCES public.farms(id) ON DELETE SET NULL,
  name text NOT NULL,
  cultura text,
  hectares numeric,
  -- GeoJSON polygon stored as jsonb (PostGIS optional, kept simple/portable)
  geometry jsonb NOT NULL,
  centroid_lat numeric,
  centroid_lng numeric,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fields_org_idx ON public.fields (organization_id);

-- =========================================================
-- DOMAIN: Nutrição — Amostras de solo / foliar
-- =========================================================
CREATE TABLE public.soil_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  field_id uuid REFERENCES public.fields(id) ON DELETE SET NULL,
  collected_at date NOT NULL DEFAULT current_date,
  -- nutrient values (g/dm3, mg/dm3, etc)
  nitrogen numeric, phosphorus numeric, potassium numeric,
  calcium numeric, magnesium numeric, sulfur numeric,
  ph numeric, organic_matter numeric, cec numeric,
  raw jsonb,
  classification jsonb, -- { N: 'low', P: 'medium', ... }
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX soil_org_idx ON public.soil_samples (organization_id);

-- =========================================================
-- DOMAIN: IA — Recomendações
-- =========================================================
CREATE TABLE public.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  field_id uuid REFERENCES public.fields(id) ON DELETE SET NULL,
  sample_id uuid REFERENCES public.soil_samples(id) ON DELETE SET NULL,
  prompt text NOT NULL,
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  response text NOT NULL,
  metadata jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_reco_org_idx ON public.ai_recommendations (organization_id);

-- =========================================================
-- DOMAIN: Satélite — NDVI cache
-- =========================================================
CREATE TABLE public.ndvi_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  field_id uuid REFERENCES public.fields(id) ON DELETE CASCADE,
  captured_at date NOT NULL,
  ndvi_mean numeric,
  ndvi_min numeric,
  ndvi_max numeric,
  source text DEFAULT 'sentinel-hub',
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ndvi_field_date_idx ON public.ndvi_readings (field_id, captured_at);

-- =========================================================
-- SECURITY DEFINER helpers (avoid recursive RLS)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org uuid, _user uuid, _roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = _user AND role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_org_ids(_user uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = _user;
$$;

-- =========================================================
-- Auto-create profile on signup
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_orgs_touch BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_fields_touch BEFORE UPDATE ON public.fields
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- Auto-add owner as member when an organization is created
-- =========================================================
CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_org_owner_member AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

-- =========================================================
-- RLS
-- =========================================================
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soil_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ndvi_readings ENABLE ROW LEVEL SECURITY;

-- Plans: everyone authenticated can read
CREATE POLICY "plans_read_all" ON public.plans FOR SELECT TO authenticated USING (true);

-- Profiles
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Organizations
CREATE POLICY "orgs_member_read" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()));
CREATE POLICY "orgs_owner_create" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "orgs_admin_update" ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(id, auth.uid(), ARRAY['owner','admin']::app_role[]));
CREATE POLICY "orgs_owner_delete" ON public.organizations FOR DELETE TO authenticated
  USING (public.has_org_role(id, auth.uid(), ARRAY['owner']::app_role[]));

-- Members
CREATE POLICY "members_self_read" ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members_admin_insert" ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));
CREATE POLICY "members_admin_update" ON public.organization_members FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));
CREATE POLICY "members_admin_delete" ON public.organization_members FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

-- Invites
CREATE POLICY "invites_admin_read" ON public.organization_invites FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));
CREATE POLICY "invites_admin_write" ON public.organization_invites FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

-- Usage
CREATE POLICY "usage_member_read" ON public.usage_metrics FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- Farms / Fields / Samples / AI / NDVI — uniform org-member access
CREATE POLICY "farms_org_all" ON public.farms FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "fields_org_all" ON public.fields FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "samples_org_all" ON public.soil_samples FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "ai_org_all" ON public.ai_recommendations FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "ndvi_org_all" ON public.ndvi_readings FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
