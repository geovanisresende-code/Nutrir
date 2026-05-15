
-- =========================================================
-- NUTRIR ENTERPRISE — Schema Multi-tenant SaaS
-- =========================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.plan_tier AS ENUM ('free', 'pro', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.sample_status AS ENUM ('low','medium','high','optimal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- Plans
-- =========================================================
CREATE TABLE IF NOT EXISTS public.plans (
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
('enterprise','Enterprise',999,999999,99999,99999,49900) ON CONFLICT DO NOTHING;

-- =========================================================
-- Organizations
-- =========================================================
CREATE TABLE IF NOT EXISTS public.organizations (
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
CREATE TABLE IF NOT EXISTS public.profiles (
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
CREATE TABLE IF NOT EXISTS public.organization_members (
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
CREATE TABLE IF NOT EXISTS public.organization_invites (
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
CREATE TABLE IF NOT EXISTS public.usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric text NOT NULL, -- 'ai_call' | 'ndvi_call' | 'sample' | 'hectare'
  amount numeric NOT NULL DEFAULT 1,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_org_metric_idx ON public.usage_metrics (organization_id, metric, occurred_at);

-- =========================================================
-- DOMAIN: Mapas / Talhões (fields)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.farms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fields (
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
CREATE INDEX IF NOT EXISTS fields_org_idx ON public.fields (organization_id);

-- =========================================================
-- DOMAIN: Nutrição — Amostras de solo / foliar
-- =========================================================
CREATE TABLE IF NOT EXISTS public.soil_samples (
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
CREATE INDEX IF NOT EXISTS soil_org_idx ON public.soil_samples (organization_id);

-- =========================================================
-- DOMAIN: IA — Recomendações
-- =========================================================
CREATE TABLE IF NOT EXISTS public.ai_recommendations (
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
CREATE INDEX IF NOT EXISTS ai_reco_org_idx ON public.ai_recommendations (organization_id);

-- =========================================================
-- DOMAIN: Satélite — NDVI cache
-- =========================================================
CREATE TABLE IF NOT EXISTS public.ndvi_readings (
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
CREATE INDEX IF NOT EXISTS ndvi_field_date_idx ON public.ndvi_readings (field_id, captured_at);

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
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

DROP TRIGGER IF EXISTS trg_orgs_touch ON public.organizations;
CREATE TRIGGER trg_orgs_touch BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_fields_touch ON public.fields;
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

DROP TRIGGER IF EXISTS trg_org_owner_member ON public.organizations;
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
DROP POLICY IF EXISTS "plans_read_all" ON public.plans;
CREATE POLICY "plans_read_all" ON public.plans FOR SELECT TO authenticated USING (true);

-- Profiles
DROP POLICY IF EXISTS "profiles_self_read" ON public.profiles;
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "profiles_self_insert" ON public.profiles;
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Organizations
DROP POLICY IF EXISTS "orgs_member_read" ON public.organizations;
CREATE POLICY "orgs_member_read" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()));
DROP POLICY IF EXISTS "orgs_owner_create" ON public.organizations;
CREATE POLICY "orgs_owner_create" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "orgs_admin_update" ON public.organizations;
CREATE POLICY "orgs_admin_update" ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(id, auth.uid(), ARRAY['owner','admin']::app_role[]));
DROP POLICY IF EXISTS "orgs_owner_delete" ON public.organizations;
CREATE POLICY "orgs_owner_delete" ON public.organizations FOR DELETE TO authenticated
  USING (public.has_org_role(id, auth.uid(), ARRAY['owner']::app_role[]));

-- Members
DROP POLICY IF EXISTS "members_self_read" ON public.organization_members;
CREATE POLICY "members_self_read" ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(organization_id, auth.uid()));
DROP POLICY IF EXISTS "members_admin_insert" ON public.organization_members;
CREATE POLICY "members_admin_insert" ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));
DROP POLICY IF EXISTS "members_admin_update" ON public.organization_members;
CREATE POLICY "members_admin_update" ON public.organization_members FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));
DROP POLICY IF EXISTS "members_admin_delete" ON public.organization_members;
CREATE POLICY "members_admin_delete" ON public.organization_members FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

-- Invites
DROP POLICY IF EXISTS "invites_admin_read" ON public.organization_invites;
CREATE POLICY "invites_admin_read" ON public.organization_invites FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));
DROP POLICY IF EXISTS "invites_admin_write" ON public.organization_invites;
CREATE POLICY "invites_admin_write" ON public.organization_invites FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

-- Usage
DROP POLICY IF EXISTS "usage_member_read" ON public.usage_metrics;
CREATE POLICY "usage_member_read" ON public.usage_metrics FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- Farms / Fields / Samples / AI / NDVI — uniform org-member access
DROP POLICY IF EXISTS "farms_org_all" ON public.farms;
CREATE POLICY "farms_org_all" ON public.farms FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "fields_org_all" ON public.fields;
CREATE POLICY "fields_org_all" ON public.fields FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "samples_org_all" ON public.soil_samples;
CREATE POLICY "samples_org_all" ON public.soil_samples FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "ai_org_all" ON public.ai_recommendations;
CREATE POLICY "ai_org_all" ON public.ai_recommendations FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "ndvi_org_all" ON public.ndvi_readings;
CREATE POLICY "ndvi_org_all" ON public.ndvi_readings FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));


-- 1) organizations: token Mapbox
DO $$ BEGIN
  ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS mapbox_token text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 2) clients
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  document text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clients_org_all ON public.clients;
CREATE POLICY clients_org_all ON public.clients
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
DROP TRIGGER IF EXISTS clients_touch ON public.clients;
CREATE TRIGGER clients_touch BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS idx_clients_org ON public.clients(organization_id);

-- 3) collection_routes (sessão de coleta de campo)
CREATE TABLE IF NOT EXISTS public.collection_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  client_id uuid,
  field_id uuid,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress', -- in_progress | finished | cancelled
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  path jsonb,            -- LineString GeoJSON do trajeto GPS
  area_geometry jsonb,   -- Polygon GeoJSON da área desenhada/finalizada
  hectares numeric,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.collection_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS routes_org_all ON public.collection_routes;
CREATE POLICY routes_org_all ON public.collection_routes
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
DROP TRIGGER IF EXISTS routes_touch ON public.collection_routes;
CREATE TRIGGER routes_touch BEFORE UPDATE ON public.collection_routes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS idx_routes_org ON public.collection_routes(organization_id);

-- 4) collection_points
CREATE TABLE IF NOT EXISTS public.collection_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  route_id uuid,
  client_id uuid,
  field_id uuid,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  accuracy_m numeric,
  altitude_m numeric,
  kind text NOT NULL DEFAULT 'manual', -- manual | gps | sample
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.collection_points ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS points_org_all ON public.collection_points;
CREATE POLICY points_org_all ON public.collection_points
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_points_org ON public.collection_points(organization_id);
CREATE INDEX IF NOT EXISTS idx_points_route ON public.collection_points(route_id);

-- 5) fields & soil_samples: vincular cliente
DO $$ BEGIN
  ALTER TABLE public.fields ADD COLUMN IF NOT EXISTS client_id uuid;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.soil_samples ADD COLUMN IF NOT EXISTS client_id uuid;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.soil_samples ADD COLUMN IF NOT EXISTS point_id uuid;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============ SOIL SAMPLES: add crop + report ============
ALTER TABLE public.soil_samples
  ADD COLUMN IF NOT EXISTS crop text,
  ADD COLUMN IF NOT EXISTS report_path text;

-- ============ LEAF SAMPLES ============
CREATE TABLE IF NOT EXISTS public.leaf_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  client_id uuid,
  field_id uuid,
  point_id uuid,
  crop text,
  collected_at date NOT NULL DEFAULT CURRENT_DATE,
  -- macro
  n numeric, p numeric, k numeric, ca numeric, mg numeric, s numeric,
  -- micro
  b numeric, cu numeric, fe numeric, mn numeric, zn numeric,
  classification jsonb,
  raw jsonb,
  report_path text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leaf_samples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leaf_org_all ON public.leaf_samples;
CREATE POLICY leaf_org_all ON public.leaf_samples
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_leaf_samples_org ON public.leaf_samples(organization_id);
CREATE INDEX IF NOT EXISTS idx_leaf_samples_field ON public.leaf_samples(field_id);

-- ============ CROP NUTRIENT RANGES ============
CREATE TABLE IF NOT EXISTS public.crop_nutrient_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crop text NOT NULL,
  analysis_type text NOT NULL CHECK (analysis_type IN ('soil','leaf')),
  nutrient text NOT NULL,
  unit text,
  low_max numeric,        -- valores <= low_max => baixo
  medium_max numeric,     -- (low_max, medium_max] => médio
  adequate_max numeric,   -- (medium_max, adequate_max] => adequado
  -- acima de adequate_max => alto
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (crop, analysis_type, nutrient)
);

ALTER TABLE public.crop_nutrient_ranges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ranges_read_all ON public.crop_nutrient_ranges;
CREATE POLICY ranges_read_all ON public.crop_nutrient_ranges
  FOR SELECT TO authenticated USING (true);

-- ============ STORAGE BUCKET (private) ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('lab-reports', 'lab-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: path structure {org_id}/{filename}
DROP POLICY IF EXISTS "lab_reports_select" ON storage.objects;
CREATE POLICY "lab_reports_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'lab-reports'
    AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "lab_reports_insert" ON storage.objects;
CREATE POLICY "lab_reports_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lab-reports'
    AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "lab_reports_update" ON storage.objects;
CREATE POLICY "lab_reports_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'lab-reports'
    AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "lab_reports_delete" ON storage.objects;
CREATE POLICY "lab_reports_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'lab-reports'
    AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

-- ============ SEED CROP RANGES ============
-- Faixas baseadas em referências CFSEMG, IAC, Embrapa (genéricas, didáticas).
-- SOLO (unidades comuns): pH (CaCl2), MO (g/kg), P (mg/dm3, Mehlich), K (mg/dm3),
-- Ca/Mg (cmolc/dm3), S (mg/dm3), CTC (cmolc/dm3), V (%).
INSERT INTO public.crop_nutrient_ranges (crop, analysis_type, nutrient, unit, low_max, medium_max, adequate_max) VALUES
-- SOJA - solo
('soja','soil','ph','',5.0,5.5,6.5),
('soja','soil','organic_matter','g/kg',15,25,40),
('soja','soil','phosphorus','mg/dm³',8,15,30),
('soja','soil','potassium','mg/dm³',40,80,150),
('soja','soil','calcium','cmolc/dm³',1.5,3.0,6.0),
('soja','soil','magnesium','cmolc/dm³',0.5,1.0,2.0),
('soja','soil','sulfur','mg/dm³',5,10,20),
('soja','soil','cec','cmolc/dm³',4,8,15),
-- SOJA - foliar
('soja','leaf','n','g/kg',35,40,55),
('soja','leaf','p','g/kg',2.0,2.6,5.0),
('soja','leaf','k','g/kg',15,17,25),
('soja','leaf','ca','g/kg',4,6,20),
('soja','leaf','mg','g/kg',2.5,3.0,10),
('soja','leaf','s','g/kg',1.5,2.0,4.0),
('soja','leaf','b','mg/kg',20,25,55),
('soja','leaf','cu','mg/kg',5,8,30),
('soja','leaf','fe','mg/kg',40,51,350),
('soja','leaf','mn','mg/kg',15,21,100),
('soja','leaf','zn','mg/kg',15,21,50),
-- MILHO
('milho','soil','ph','',5.0,5.5,6.2),
('milho','soil','organic_matter','g/kg',15,25,40),
('milho','soil','phosphorus','mg/dm³',10,18,35),
('milho','soil','potassium','mg/dm³',50,100,180),
('milho','soil','calcium','cmolc/dm³',1.5,3.0,6.0),
('milho','soil','magnesium','cmolc/dm³',0.5,1.0,2.0),
('milho','soil','sulfur','mg/dm³',5,10,20),
('milho','soil','cec','cmolc/dm³',4,8,15),
('milho','leaf','n','g/kg',25,30,35),
('milho','leaf','p','g/kg',2.0,2.5,3.5),
('milho','leaf','k','g/kg',15,18,25),
('milho','leaf','ca','g/kg',2.5,3.0,8),
('milho','leaf','mg','g/kg',1.5,2.0,5),
('milho','leaf','s','g/kg',1.5,2.0,3),
-- CAFÉ
('cafe','soil','ph','',5.0,5.5,6.2),
('cafe','soil','organic_matter','g/kg',20,30,50),
('cafe','soil','phosphorus','mg/dm³',8,15,30),
('cafe','soil','potassium','mg/dm³',60,120,200),
('cafe','soil','calcium','cmolc/dm³',1.5,2.5,5.0),
('cafe','soil','magnesium','cmolc/dm³',0.5,0.9,1.8),
('cafe','soil','sulfur','mg/dm³',5,10,20),
('cafe','soil','cec','cmolc/dm³',4,8,15),
('cafe','leaf','n','g/kg',25,28,33),
('cafe','leaf','p','g/kg',1.0,1.4,2.0),
('cafe','leaf','k','g/kg',18,21,27),
('cafe','leaf','ca','g/kg',8,11,17),
('cafe','leaf','mg','g/kg',3.0,3.5,5.0),
('cafe','leaf','s','g/kg',1.2,1.6,2.5),
-- SORGO
('sorgo','soil','ph','',5.0,5.5,6.2),
('sorgo','soil','organic_matter','g/kg',15,25,40),
('sorgo','soil','phosphorus','mg/dm³',8,15,25),
('sorgo','soil','potassium','mg/dm³',40,80,150),
('sorgo','soil','calcium','cmolc/dm³',1.5,3.0,6.0),
('sorgo','soil','magnesium','cmolc/dm³',0.5,1.0,2.0),
('sorgo','soil','cec','cmolc/dm³',4,8,15),
('sorgo','leaf','n','g/kg',25,30,40),
('sorgo','leaf','p','g/kg',2.0,2.5,3.5),
('sorgo','leaf','k','g/kg',15,18,25),
-- CANA
('cana','soil','ph','',5.0,5.5,6.2),
('cana','soil','organic_matter','g/kg',15,25,40),
('cana','soil','phosphorus','mg/dm³',10,18,30),
('cana','soil','potassium','mg/dm³',50,100,180),
('cana','soil','calcium','cmolc/dm³',2.0,3.5,7.0),
('cana','soil','magnesium','cmolc/dm³',0.5,1.0,2.0),
('cana','soil','cec','cmolc/dm³',5,10,18),
('cana','leaf','n','g/kg',18,21,26),
('cana','leaf','p','g/kg',1.5,1.9,2.5),
('cana','leaf','k','g/kg',11,13,17),
-- ALGODAO
('algodao','soil','ph','',5.5,6.0,6.5),
('algodao','soil','organic_matter','g/kg',15,25,40),
('algodao','soil','phosphorus','mg/dm³',12,20,35),
('algodao','soil','potassium','mg/dm³',60,120,200),
('algodao','soil','calcium','cmolc/dm³',2.0,3.5,7.0),
('algodao','soil','magnesium','cmolc/dm³',0.5,1.0,2.0),
('algodao','leaf','n','g/kg',35,40,50),
('algodao','leaf','p','g/kg',2.5,3.0,5.0),
('algodao','leaf','k','g/kg',15,17,25),
-- TRIGO
('trigo','soil','ph','',5.0,5.5,6.2),
('trigo','soil','organic_matter','g/kg',15,25,40),
('trigo','soil','phosphorus','mg/dm³',8,15,25),
('trigo','soil','potassium','mg/dm³',40,80,150),
('trigo','leaf','n','g/kg',25,30,40),
('trigo','leaf','p','g/kg',2.0,2.5,3.5),
('trigo','leaf','k','g/kg',15,18,25),
-- CITRUS
('citrus','soil','ph','',5.5,6.0,6.5),
('citrus','soil','organic_matter','g/kg',15,25,40),
('citrus','soil','phosphorus','mg/dm³',10,18,30),
('citrus','soil','potassium','mg/dm³',60,120,200),
('citrus','soil','calcium','cmolc/dm³',2.0,3.5,7.0),
('citrus','soil','magnesium','cmolc/dm³',0.5,1.0,2.0),
('citrus','leaf','n','g/kg',23,27,35),
('citrus','leaf','p','g/kg',1.2,1.5,3.0),
('citrus','leaf','k','g/kg',10,14,20),
('citrus','leaf','ca','g/kg',30,40,55),
('citrus','leaf','mg','g/kg',2.5,3.5,6.0),
-- PASTAGEM
('pastagem','soil','ph','',4.8,5.3,6.0),
('pastagem','soil','organic_matter','g/kg',15,25,40),
('pastagem','soil','phosphorus','mg/dm³',5,10,20),
('pastagem','soil','potassium','mg/dm³',30,60,120),
('pastagem','soil','calcium','cmolc/dm³',1.0,2.0,4.0),
('pastagem','soil','magnesium','cmolc/dm³',0.4,0.8,1.5),
('pastagem','leaf','n','g/kg',15,20,28),
('pastagem','leaf','p','g/kg',1.5,2.0,3.0),
('pastagem','leaf','k','g/kg',12,15,22),
-- GIRASSOL
('girassol','soil','ph','',5.5,6.0,6.5),
('girassol','soil','organic_matter','g/kg',15,25,40),
('girassol','soil','phosphorus','mg/dm³',10,18,30),
('girassol','soil','potassium','mg/dm³',50,100,180),
('girassol','leaf','n','g/kg',30,35,50),
('girassol','leaf','p','g/kg',2.5,3.5,5.0),
('girassol','leaf','k','g/kg',20,25,40)
ON CONFLICT (crop, analysis_type, nutrient) DO NOTHING;
-- ============ AI CHAT ============
CREATE TABLE IF NOT EXISTS public.ai_chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_chat_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS threads_org_all ON public.ai_chat_threads;
CREATE POLICY threads_org_all ON public.ai_chat_threads FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_threads_org ON public.ai_chat_threads(organization_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.ai_chat_threads(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_org_all ON public.ai_chat_messages;
CREATE POLICY messages_org_all ON public.ai_chat_messages FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.ai_chat_messages(thread_id, created_at);

-- ============ IMAGE DIAGNOSIS ============
CREATE TABLE IF NOT EXISTS public.ai_image_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  created_by uuid,
  client_id uuid,
  field_id uuid,
  crop text,
  image_path text NOT NULL,
  diagnosis text,
  severity text,
  treatment text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_image_diagnoses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS diag_org_all ON public.ai_image_diagnoses;
CREATE POLICY diag_org_all ON public.ai_image_diagnoses FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_diag_org ON public.ai_image_diagnoses(organization_id, created_at DESC);

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('plant-photos', 'plant-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "plant_photos_select" ON storage.objects;
CREATE POLICY "plant_photos_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'plant-photos' AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));
DROP POLICY IF EXISTS "plant_photos_insert" ON storage.objects;
CREATE POLICY "plant_photos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'plant-photos' AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));
DROP POLICY IF EXISTS "plant_photos_delete" ON storage.objects;
CREATE POLICY "plant_photos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'plant-photos' AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS ndvi_source text NOT NULL DEFAULT 'demo';

CREATE INDEX IF NOT EXISTS idx_ndvi_field_date
  ON public.ndvi_readings (field_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_ndvi_org_date
  ON public.ndvi_readings (organization_id, captured_at DESC);
-- Tabela de relatórios
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  created_by uuid,
  kind text NOT NULL,
  title text NOT NULL,
  client_id uuid,
  field_id uuid,
  sample_id uuid,
  storage_path text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_org_all" ON public.reports;
CREATE POLICY "reports_org_all" ON public.reports
  FOR ALL TO authenticated
  USING (is_org_member(organization_id, auth.uid()))
  WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_reports_org_date ON public.reports (organization_id, created_at DESC);

-- Bucket de storage para PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket: pasta = organization_id/...
DROP POLICY IF EXISTS "reports_select_org" ON storage.objects;
CREATE POLICY "reports_select_org" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'reports'
    AND is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "reports_insert_org" ON storage.objects;
CREATE POLICY "reports_insert_org" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reports'
    AND is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "reports_delete_org" ON storage.objects;
CREATE POLICY "reports_delete_org" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'reports'
    AND is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );
-- Audit log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  client_id uuid,
  field_id uuid,
  description text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_admin_read" ON public.audit_log;
CREATE POLICY "audit_admin_read" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]));

DROP POLICY IF EXISTS "audit_member_insert" ON public.audit_log;
CREATE POLICY "audit_member_insert" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_audit_org_date ON public.audit_log (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_client ON public.audit_log (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_field ON public.audit_log (field_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_log (entity_type, entity_id);
-- Subscriptions per organization
CREATE TABLE IF NOT EXISTS public.org_subscriptions (
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

CREATE INDEX IF NOT EXISTS idx_org_subs_org ON public.org_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_subs_stripe ON public.org_subscriptions(stripe_subscription_id);

ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subs_member_read" ON public.org_subscriptions;
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

DROP TRIGGER IF EXISTS touch_org_subs_updated_at ON public.org_subscriptions;
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
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_step SMALLINT NOT NULL DEFAULT 0;
-- Tabela
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info','success','warning','error')),
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  metadata JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_org_user ON public.notifications (organization_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications (user_id, read_at) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS: ver
DROP POLICY IF EXISTS notif_member_read ON public.notifications;
CREATE POLICY notif_member_read ON public.notifications
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (user_id = auth.uid() OR user_id IS NULL)
  );

-- RLS: marcar como lida (UPDATE apenas read_at)
DROP POLICY IF EXISTS notif_self_update ON public.notifications;
CREATE POLICY notif_self_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (user_id = auth.uid() OR user_id IS NULL)
  );

-- Sem INSERT/DELETE para usuários comuns; só funções SECURITY DEFINER

-- Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN others THEN NULL; END $$;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Função interna para criar notificações
CREATE OR REPLACE FUNCTION public.create_notification(
  _org UUID,
  _user UUID,
  _type TEXT,
  _title TEXT,
  _message TEXT,
  _link TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO public.notifications (organization_id, user_id, type, title, message, link, metadata)
  VALUES (_org, _user, _type, _title, _message, _link, _metadata)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_notification(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

-- Trigger: novo relatório → notificar membros (broadcast user_id NULL)
CREATE OR REPLACE FUNCTION public.notify_on_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (organization_id, user_id, type, title, message, link)
  VALUES (
    NEW.organization_id,
    NULL,
    'success',
    'Novo relatório disponível',
    COALESCE(NEW.title, 'Um novo relatório foi gerado.'),
    '/app/relatorios'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_report ON public.reports;
DROP TRIGGER IF EXISTS trg_notify_on_report ON public.reports;
CREATE TRIGGER trg_notify_on_report
AFTER INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.notify_on_report();

-- Trigger: novo membro aceito → notificar owners/admins
CREATE OR REPLACE FUNCTION public.notify_on_new_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user UUID;
  member_email TEXT;
BEGIN
  SELECT email INTO member_email FROM public.profiles WHERE id = NEW.user_id;
  FOR admin_user IN
    SELECT user_id FROM public.organization_members
    WHERE organization_id = NEW.organization_id
      AND role IN ('owner','admin')
      AND user_id <> NEW.user_id
  LOOP
    INSERT INTO public.notifications (organization_id, user_id, type, title, message, link)
    VALUES (
      NEW.organization_id,
      admin_user,
      'info',
      'Novo membro na equipe',
      COALESCE(member_email, 'Um novo usuário') || ' entrou na organização.',
      '/app/equipe'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_new_member ON public.organization_members;
DROP TRIGGER IF EXISTS trg_notify_on_new_member ON public.organization_members;
CREATE TRIGGER trg_notify_on_new_member
AFTER INSERT ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_member();
-- Cache de cotações
CREATE TABLE IF NOT EXISTS public.commodity_quotes (
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_commodity_latest ON public.commodity_quotes (commodity, source, reference_date);
CREATE INDEX IF NOT EXISTS idx_commodity_fetched ON public.commodity_quotes (commodity, fetched_at DESC);

ALTER TABLE public.commodity_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commodity_read_all ON public.commodity_quotes;
CREATE POLICY commodity_read_all ON public.commodity_quotes
  FOR SELECT TO authenticated USING (true);

-- Webhooks de ERP
CREATE TABLE IF NOT EXISTS public.erp_webhooks (
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

CREATE INDEX IF NOT EXISTS idx_erp_webhooks_org ON public.erp_webhooks (organization_id);

ALTER TABLE public.erp_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS erp_admin_all ON public.erp_webhooks;
CREATE POLICY erp_admin_all ON public.erp_webhooks
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]));

-- Helper: add FK only if not exists
DO $$
DECLARE
  fk RECORD;
BEGIN
  -- profiles
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='profiles_default_org_fkey') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_default_org_fkey FOREIGN KEY (default_org_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;

  -- organizations
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='organizations_owner_fkey') THEN
    ALTER TABLE public.organizations ADD CONSTRAINT organizations_owner_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- organization_members
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='org_members_org_fkey') THEN
    ALTER TABLE public.organization_members ADD CONSTRAINT org_members_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='org_members_user_fkey') THEN
    ALTER TABLE public.organization_members ADD CONSTRAINT org_members_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- organization_invites
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='invites_org_fkey') THEN
    ALTER TABLE public.organization_invites ADD CONSTRAINT invites_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  -- farms
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='farms_org_fkey') THEN
    ALTER TABLE public.farms ADD CONSTRAINT farms_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  -- clients
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='clients_org_fkey') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  -- fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fields_org_fkey') THEN
    ALTER TABLE public.fields ADD CONSTRAINT fields_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fields_farm_fkey') THEN
    ALTER TABLE public.fields ADD CONSTRAINT fields_farm_fkey FOREIGN KEY (farm_id) REFERENCES public.farms(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fields_client_fkey') THEN
    ALTER TABLE public.fields ADD CONSTRAINT fields_client_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;

  -- collection_routes
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='routes_org_fkey') THEN
    ALTER TABLE public.collection_routes ADD CONSTRAINT routes_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='routes_field_fkey') THEN
    ALTER TABLE public.collection_routes ADD CONSTRAINT routes_field_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='routes_client_fkey') THEN
    ALTER TABLE public.collection_routes ADD CONSTRAINT routes_client_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;

  -- collection_points
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='points_org_fkey') THEN
    ALTER TABLE public.collection_points ADD CONSTRAINT points_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='points_field_fkey') THEN
    ALTER TABLE public.collection_points ADD CONSTRAINT points_field_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='points_client_fkey') THEN
    ALTER TABLE public.collection_points ADD CONSTRAINT points_client_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='points_route_fkey') THEN
    ALTER TABLE public.collection_points ADD CONSTRAINT points_route_fkey FOREIGN KEY (route_id) REFERENCES public.collection_routes(id) ON DELETE SET NULL;
  END IF;

  -- soil_samples
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='soil_org_fkey') THEN
    ALTER TABLE public.soil_samples ADD CONSTRAINT soil_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='soil_field_fkey') THEN
    ALTER TABLE public.soil_samples ADD CONSTRAINT soil_field_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='soil_client_fkey') THEN
    ALTER TABLE public.soil_samples ADD CONSTRAINT soil_client_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='soil_point_fkey') THEN
    ALTER TABLE public.soil_samples ADD CONSTRAINT soil_point_fkey FOREIGN KEY (point_id) REFERENCES public.collection_points(id) ON DELETE SET NULL;
  END IF;

  -- leaf_samples
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='leaf_org_fkey') THEN
    ALTER TABLE public.leaf_samples ADD CONSTRAINT leaf_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='leaf_field_fkey') THEN
    ALTER TABLE public.leaf_samples ADD CONSTRAINT leaf_field_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='leaf_client_fkey') THEN
    ALTER TABLE public.leaf_samples ADD CONSTRAINT leaf_client_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='leaf_point_fkey') THEN
    ALTER TABLE public.leaf_samples ADD CONSTRAINT leaf_point_fkey FOREIGN KEY (point_id) REFERENCES public.collection_points(id) ON DELETE SET NULL;
  END IF;

  -- ai_recommendations
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='ai_org_fkey') THEN
    ALTER TABLE public.ai_recommendations ADD CONSTRAINT ai_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='ai_field_fkey') THEN
    ALTER TABLE public.ai_recommendations ADD CONSTRAINT ai_field_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE SET NULL;
  END IF;

  -- ai_image_diagnoses
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='diag_org_fkey') THEN
    ALTER TABLE public.ai_image_diagnoses ADD CONSTRAINT diag_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='diag_field_fkey') THEN
    ALTER TABLE public.ai_image_diagnoses ADD CONSTRAINT diag_field_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='diag_client_fkey') THEN
    ALTER TABLE public.ai_image_diagnoses ADD CONSTRAINT diag_client_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;

  -- ai_chat_threads / messages
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='threads_org_fkey') THEN
    ALTER TABLE public.ai_chat_threads ADD CONSTRAINT threads_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='messages_thread_fkey') THEN
    ALTER TABLE public.ai_chat_messages ADD CONSTRAINT messages_thread_fkey FOREIGN KEY (thread_id) REFERENCES public.ai_chat_threads(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='messages_org_fkey') THEN
    ALTER TABLE public.ai_chat_messages ADD CONSTRAINT messages_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  -- ndvi_readings
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='ndvi_org_fkey') THEN
    ALTER TABLE public.ndvi_readings ADD CONSTRAINT ndvi_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='ndvi_field_fkey') THEN
    ALTER TABLE public.ndvi_readings ADD CONSTRAINT ndvi_field_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE CASCADE;
  END IF;

  -- reports
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='reports_org_fkey') THEN
    ALTER TABLE public.reports ADD CONSTRAINT reports_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='reports_field_fkey') THEN
    ALTER TABLE public.reports ADD CONSTRAINT reports_field_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='reports_client_fkey') THEN
    ALTER TABLE public.reports ADD CONSTRAINT reports_client_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;

  -- audit_log
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='audit_org_fkey') THEN
    ALTER TABLE public.audit_log ADD CONSTRAINT audit_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='audit_field_fkey') THEN
    ALTER TABLE public.audit_log ADD CONSTRAINT audit_field_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='audit_client_fkey') THEN
    ALTER TABLE public.audit_log ADD CONSTRAINT audit_client_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;

  -- notifications
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='notif_org_fkey') THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notif_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  -- erp_webhooks
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='erp_org_fkey') THEN
    ALTER TABLE public.erp_webhooks ADD CONSTRAINT erp_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  -- usage_metrics
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='usage_org_fkey') THEN
    ALTER TABLE public.usage_metrics ADD CONSTRAINT usage_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  -- org_subscriptions
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='subs_org_fkey') THEN
    ALTER TABLE public.org_subscriptions ADD CONSTRAINT subs_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Force PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';


DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conrelid::regclass::text AS tbl, conname
    FROM pg_constraint
    WHERE contype='f' AND connamespace='public'::regnamespace
      AND conname IN (
        'profiles_default_org_fkey','organizations_owner_fkey',
        'org_members_org_fkey','org_members_user_fkey','invites_org_fkey',
        'farms_org_fkey','clients_org_fkey',
        'fields_org_fkey','fields_farm_fkey','fields_client_fkey',
        'routes_org_fkey','routes_field_fkey','routes_client_fkey',
        'points_org_fkey','points_field_fkey','points_client_fkey','points_route_fkey',
        'soil_org_fkey','soil_field_fkey','soil_client_fkey','soil_point_fkey',
        'leaf_org_fkey','leaf_field_fkey','leaf_client_fkey','leaf_point_fkey',
        'ai_org_fkey','ai_field_fkey',
        'diag_org_fkey','diag_field_fkey','diag_client_fkey',
        'threads_org_fkey','messages_thread_fkey','messages_org_fkey',
        'ndvi_org_fkey','ndvi_field_fkey',
        'reports_org_fkey','reports_field_fkey','reports_client_fkey',
        'audit_org_fkey','audit_field_fkey','audit_client_fkey',
        'notif_org_fkey','erp_org_fkey','usage_org_fkey','subs_org_fkey'
      )
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- PROGRAMA NUTRIR — schema multi-tenant
-- Tabelas com prefixo nutrir_ (e algumas globais como nutrientes/culturas)
-- ============================================================

-- Enum de papéis específico do Nutrir (admin/gerente comercial/representante/vendedor)
DO $$ BEGIN
  CREATE TYPE public.nutrir_role AS ENUM ('admin','gerente','representante','vendedor','consultor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- USUÁRIOS DO NUTRIR (perfil comercial dentro de uma org)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nutrir_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.nutrir_role NOT NULL DEFAULT 'vendedor',
  nome TEXT,
  email TEXT,
  telefone TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_nutrir_users_org ON public.nutrir_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_nutrir_users_user ON public.nutrir_users(user_id);
ALTER TABLE public.nutrir_users ENABLE ROW LEVEL SECURITY;

-- Helper: verifica papel dentro do nutrir
CREATE OR REPLACE FUNCTION public.has_nutrir_role(_org uuid, _user uuid, _roles public.nutrir_role[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.nutrir_users
    WHERE organization_id = _org AND user_id = _user AND ativo = true AND role = ANY(_roles)
  );
$$;

DROP POLICY IF EXISTS "nutrir_users_org_read" ON public.nutrir_users;
CREATE POLICY "nutrir_users_org_read" ON public.nutrir_users
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "nutrir_users_admin_write" ON public.nutrir_users;
CREATE POLICY "nutrir_users_admin_write" ON public.nutrir_users
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]))
  WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

-- ============================================================
-- CATÁLOGOS BASE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nutrir_regionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  uf TEXT,
  descricao TEXT,
  custo_adicional_litro NUMERIC(10,4) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, nome)
);

CREATE TABLE IF NOT EXISTS public.nutrir_modalidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  prazo_dias INTEGER,
  tipo TEXT,
  margens_por_categoria JSONB DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, nome)
);

CREATE TABLE IF NOT EXISTS public.nutrir_embalagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  volume NUMERIC(10,3),
  unidade TEXT NOT NULL DEFAULT 'L',
  custo_adicional_litro NUMERIC(10,4) NOT NULL DEFAULT 0,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Culturas: GLOBAL (compartilhado entre orgs)
CREATE TABLE IF NOT EXISTS public.nutrir_culturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  nome_cientifico TEXT,
  ciclo_dias INTEGER,
  imagem_url TEXT,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nutrir_estagios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cultura_id UUID NOT NULL REFERENCES public.nutrir_culturas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  descricao TEXT,
  dias_apos_plantio_min INTEGER,
  dias_apos_plantio_max INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cultura_id, nome)
);

-- Nutrientes: GLOBAL
CREATE TABLE IF NOT EXISTS public.nutrir_nutrientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simbolo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  unidade_padrao TEXT NOT NULL DEFAULT 'gr/ha',
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO public.nutrir_nutrientes (simbolo, nome, unidade_padrao, ordem) VALUES
  ('Mn','Manganês','gr/ha',1),('Mg','Magnésio','gr/ha',2),('Zn','Zinco','gr/ha',3),
  ('Cu','Cobre','gr/ha',4),('P','Fósforo','gr/ha',5),('K','Potássio','gr/ha',6),
  ('B','Boro','gr/ha',7),('N','Nitrogênio (foliar)','gr/ha',8),('Ca','Cálcio','gr/ha',9),
  ('S','Enxofre','gr/ha',10),('Co','Cobalto','gr/ha',11),('Mo','Molibdênio','gr/ha',12),
  ('Ni','Níquel','gr/ha',13),('Se','Selênio','gr/ha',14),('Si','Silício','gr/ha',15),
  ('Fe','Ferro','gr/ha',16),('N_solo','Nitrogênio (solo)','kg/ha',17) ON CONFLICT DO NOTHING;

-- ============================================================
-- COMERCIAL
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nutrir_representantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf TEXT,
  regional_id UUID REFERENCES public.nutrir_regionais(id) ON DELETE SET NULL,
  comissao_percentual NUMERIC(5,2) DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nutrir_rep_org ON public.nutrir_representantes(organization_id);
CREATE INDEX IF NOT EXISTS idx_nutrir_rep_user ON public.nutrir_representantes(user_id);

CREATE TABLE IF NOT EXISTS public.nutrir_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  -- ligação opcional ao client genérico do app (mapas)
  client_id UUID,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  inscricao_estadual TEXT,
  email TEXT,
  telefone TEXT,
  whatsapp TEXT,
  contato_nome TEXT,
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  regional_id UUID REFERENCES public.nutrir_regionais(id) ON DELETE SET NULL,
  representante_id UUID REFERENCES public.nutrir_representantes(id) ON DELETE SET NULL,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nutrir_cli_org ON public.nutrir_clientes(organization_id);
CREATE INDEX IF NOT EXISTS idx_nutrir_cli_rep ON public.nutrir_clientes(representante_id);

-- ============================================================
-- PRODUTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nutrir_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  codigo TEXT,
  nome TEXT NOT NULL,
  classificacao TEXT,
  categoria TEXT CHECK (categoria IN ('DIAMANTE','OURO','PRATA','BRONZE') OR categoria IS NULL),
  linha TEXT,
  descricao TEXT,
  modo_aplicacao TEXT,
  dose_recomendada TEXT,
  recomendacao_uso TEXT,
  custo_industria NUMERIC(12,4),
  compatibilidade TEXT,
  armazenamento TEXT,
  registro_mapa TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nutrir_prod_org ON public.nutrir_produtos(organization_id);
CREATE INDEX IF NOT EXISTS idx_nutrir_prod_cat ON public.nutrir_produtos(categoria);

CREATE TABLE IF NOT EXISTS public.nutrir_produto_garantias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.nutrir_produtos(id) ON DELETE CASCADE,
  nutriente_id UUID NOT NULL REFERENCES public.nutrir_nutrientes(id) ON DELETE RESTRICT,
  teor NUMERIC(10,4) NOT NULL,
  unidade TEXT NOT NULL DEFAULT '%',
  observacao TEXT,
  UNIQUE (produto_id, nutriente_id)
);

CREATE TABLE IF NOT EXISTS public.nutrir_produto_imagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.nutrir_produtos(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  principal BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.nutrir_produto_recomendacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.nutrir_produtos(id) ON DELETE CASCADE,
  cultura_id UUID NOT NULL REFERENCES public.nutrir_culturas(id) ON DELETE CASCADE,
  estagio_id UUID REFERENCES public.nutrir_estagios(id) ON DELETE SET NULL,
  dosagem_min NUMERIC(10,3),
  dosagem_max NUMERIC(10,3),
  unidade TEXT NOT NULL DEFAULT 'L/ha',
  numero_aplicacoes INTEGER,
  intervalo_dias INTEGER,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MATÉRIAS-PRIMAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nutrir_materias_primas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  codigo TEXT,
  nome TEXT NOT NULL,
  fornecedor TEXT,
  embalagem_id UUID REFERENCES public.nutrir_embalagens(id) ON DELETE SET NULL,
  preco_atual NUMERIC(12,4),
  unidade_preco TEXT NOT NULL DEFAULT 'kg',
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nutrir_mp_org ON public.nutrir_materias_primas(organization_id);

CREATE TABLE IF NOT EXISTS public.nutrir_mp_garantias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  materia_prima_id UUID NOT NULL REFERENCES public.nutrir_materias_primas(id) ON DELETE CASCADE,
  nutriente_id UUID NOT NULL REFERENCES public.nutrir_nutrientes(id) ON DELETE RESTRICT,
  teor NUMERIC(10,4) NOT NULL,
  unidade TEXT NOT NULL DEFAULT '%',
  UNIQUE (materia_prima_id, nutriente_id)
);

-- ============================================================
-- FORMULAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nutrir_formulacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  codigo TEXT,
  nome TEXT NOT NULL,
  descricao TEXT,
  produto_id UUID REFERENCES public.nutrir_produtos(id) ON DELETE SET NULL,
  rendimento_total NUMERIC(12,3),
  unidade_rendimento TEXT DEFAULT 'kg',
  custo_estimado NUMERIC(12,4),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nutrir_form_org ON public.nutrir_formulacoes(organization_id);

CREATE TABLE IF NOT EXISTS public.nutrir_formulacao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formulacao_id UUID NOT NULL REFERENCES public.nutrir_formulacoes(id) ON DELETE CASCADE,
  materia_prima_id UUID NOT NULL REFERENCES public.nutrir_materias_primas(id) ON DELETE RESTRICT,
  quantidade NUMERIC(12,4) NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'kg',
  percentual NUMERIC(7,4),
  ordem INTEGER NOT NULL DEFAULT 0,
  observacao TEXT
);

-- ============================================================
-- PREÇOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nutrir_precos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.nutrir_produtos(id) ON DELETE CASCADE,
  embalagem_id UUID REFERENCES public.nutrir_embalagens(id) ON DELETE SET NULL,
  regional_id UUID REFERENCES public.nutrir_regionais(id) ON DELETE SET NULL,
  modalidade_id UUID REFERENCES public.nutrir_modalidades(id) ON DELETE SET NULL,
  preco NUMERIC(12,4) NOT NULL,
  moeda TEXT NOT NULL DEFAULT 'BRL',
  vigencia_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  vigencia_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nutrir_precos_org ON public.nutrir_precos(organization_id);
CREATE INDEX IF NOT EXISTS idx_nutrir_precos_prod ON public.nutrir_precos(produto_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_nutrir_precos
  ON public.nutrir_precos (organization_id, produto_id, regional_id, modalidade_id, embalagem_id) NULLS NOT DISTINCT;

-- ============================================================
-- ORÇAMENTO CONSULTORIA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nutrir_parametros_consultoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  custo_amostra NUMERIC(12,4) NOT NULL DEFAULT 50,
  meta_lucratividade NUMERIC(5,2) NOT NULL DEFAULT 30,
  rendimento_ref_soja NUMERIC(12,4) NOT NULL DEFAULT 8000,
  piso_amostra NUMERIC(12,4) NOT NULL DEFAULT 60,
  piso_hectare NUMERIC(12,4) NOT NULL DEFAULT 8,
  grid_min_cereais NUMERIC(8,2) NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nutrir_orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.nutrir_clientes(id) ON DELETE SET NULL,
  -- ligação opcional ao client genérico do app
  client_id UUID,
  representante_id UUID REFERENCES public.nutrir_representantes(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho, enviado, aprovado, rejeitado
  parametros JSONB NOT NULL,
  total_geral NUMERIC(14,2) NOT NULL DEFAULT 0,
  area_total_ha NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nutrir_orc_org ON public.nutrir_orcamentos(organization_id);
CREATE INDEX IF NOT EXISTS idx_nutrir_orc_cli ON public.nutrir_orcamentos(cliente_id);

CREATE TABLE IF NOT EXISTS public.nutrir_orcamento_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES public.nutrir_orcamentos(id) ON DELETE CASCADE,
  -- INTEGRAÇÃO COM MAPAS: cada item pode vir de um talhão (field)
  field_id UUID,
  cultura_id UUID REFERENCES public.nutrir_culturas(id) ON DELETE SET NULL,
  cultura_nome TEXT NOT NULL,
  area_ha NUMERIC(12,2) NOT NULL,
  metodo_amostragem TEXT NOT NULL DEFAULT 'grade',  -- 'grade' | 'talhoes'
  grid_ha NUMERIC(8,2) NOT NULL DEFAULT 5,
  numero_talhoes INTEGER NOT NULL DEFAULT 0,
  amostras_por_talhao INTEGER NOT NULL DEFAULT 1,
  numero_amostragens INTEGER NOT NULL DEFAULT 1,
  total_amostras INTEGER NOT NULL DEFAULT 0,
  valor_amostra NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_ha NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nutrir_orc_item ON public.nutrir_orcamento_itens(orcamento_id);

-- ============================================================
-- PEDIDOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nutrir_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  numero TEXT,
  cliente_id UUID REFERENCES public.nutrir_clientes(id) ON DELETE SET NULL,
  representante_id UUID REFERENCES public.nutrir_representantes(id) ON DELETE SET NULL,
  regional_id UUID REFERENCES public.nutrir_regionais(id) ON DELETE SET NULL,
  modalidade_id UUID REFERENCES public.nutrir_modalidades(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  data_pedido DATE NOT NULL DEFAULT CURRENT_DATE,
  data_entrega DATE,
  observacoes TEXT,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nutrir_ped_org ON public.nutrir_pedidos(organization_id);
CREATE INDEX IF NOT EXISTS idx_nutrir_ped_cli ON public.nutrir_pedidos(cliente_id);

CREATE TABLE IF NOT EXISTS public.nutrir_pedido_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.nutrir_pedidos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.nutrir_produtos(id),
  embalagem_id UUID REFERENCES public.nutrir_embalagens(id),
  quantidade NUMERIC(12,3) NOT NULL,
  preco_unitario NUMERIC(12,4) NOT NULL,
  desconto_pct NUMERIC(5,2) DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- ENABLE RLS + POLICIES (modelo: membros da org leem; admin/gerente gerenciam)
-- ============================================================
ALTER TABLE public.nutrir_regionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_modalidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_embalagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_culturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_estagios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_nutrientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_representantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_produto_garantias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_produto_imagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_produto_recomendacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_materias_primas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_mp_garantias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_formulacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_formulacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_precos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_parametros_consultoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_orcamento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_pedido_itens ENABLE ROW LEVEL SECURITY;

-- Catálogos GLOBAIS (culturas/estagios/nutrientes): leitura para todos autenticados
DROP POLICY IF EXISTS "nutrir_culturas_read" ON public.nutrir_culturas;
CREATE POLICY "nutrir_culturas_read" ON public.nutrir_culturas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "nutrir_estagios_read" ON public.nutrir_estagios;
CREATE POLICY "nutrir_estagios_read" ON public.nutrir_estagios FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "nutrir_nutrientes_read" ON public.nutrir_nutrientes;
CREATE POLICY "nutrir_nutrientes_read" ON public.nutrir_nutrientes FOR SELECT TO authenticated USING (true);

-- Catálogos por org: membros leem; admin/gerente escrevem
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'nutrir_regionais','nutrir_modalidades','nutrir_embalagens',
    'nutrir_representantes','nutrir_clientes',
    'nutrir_produtos','nutrir_materias_primas','nutrir_formulacoes','nutrir_precos',
    'nutrir_orcamentos','nutrir_pedidos'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_read" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "%1$s_read" ON public.%1$I FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()))', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_write" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "%1$s_write" ON public.%1$I FOR ALL TO authenticated USING (is_org_member(organization_id, auth.uid())) WITH CHECK (is_org_member(organization_id, auth.uid()))', t);
  END LOOP;
END $$;

-- Itens (herdam segurança via parent)
DROP POLICY IF EXISTS "nutrir_prod_gar_all" ON public.nutrir_produto_garantias;
CREATE POLICY "nutrir_prod_gar_all" ON public.nutrir_produto_garantias FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM nutrir_produtos p WHERE p.id = produto_id AND is_org_member(p.organization_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM nutrir_produtos p WHERE p.id = produto_id AND is_org_member(p.organization_id, auth.uid())));

DROP POLICY IF EXISTS "nutrir_prod_img_all" ON public.nutrir_produto_imagens;
CREATE POLICY "nutrir_prod_img_all" ON public.nutrir_produto_imagens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM nutrir_produtos p WHERE p.id = produto_id AND is_org_member(p.organization_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM nutrir_produtos p WHERE p.id = produto_id AND is_org_member(p.organization_id, auth.uid())));

DROP POLICY IF EXISTS "nutrir_prod_rec_all" ON public.nutrir_produto_recomendacoes;
CREATE POLICY "nutrir_prod_rec_all" ON public.nutrir_produto_recomendacoes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM nutrir_produtos p WHERE p.id = produto_id AND is_org_member(p.organization_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM nutrir_produtos p WHERE p.id = produto_id AND is_org_member(p.organization_id, auth.uid())));

DROP POLICY IF EXISTS "nutrir_mp_gar_all" ON public.nutrir_mp_garantias;
CREATE POLICY "nutrir_mp_gar_all" ON public.nutrir_mp_garantias FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM nutrir_materias_primas m WHERE m.id = materia_prima_id AND is_org_member(m.organization_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM nutrir_materias_primas m WHERE m.id = materia_prima_id AND is_org_member(m.organization_id, auth.uid())));

DROP POLICY IF EXISTS "nutrir_form_itens_all" ON public.nutrir_formulacao_itens;
CREATE POLICY "nutrir_form_itens_all" ON public.nutrir_formulacao_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM nutrir_formulacoes f WHERE f.id = formulacao_id AND is_org_member(f.organization_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM nutrir_formulacoes f WHERE f.id = formulacao_id AND is_org_member(f.organization_id, auth.uid())));

DROP POLICY IF EXISTS "nutrir_orc_itens_all" ON public.nutrir_orcamento_itens;
CREATE POLICY "nutrir_orc_itens_all" ON public.nutrir_orcamento_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM nutrir_orcamentos o WHERE o.id = orcamento_id AND is_org_member(o.organization_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM nutrir_orcamentos o WHERE o.id = orcamento_id AND is_org_member(o.organization_id, auth.uid())));

DROP POLICY IF EXISTS "nutrir_ped_itens_all" ON public.nutrir_pedido_itens;
CREATE POLICY "nutrir_ped_itens_all" ON public.nutrir_pedido_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM nutrir_pedidos p WHERE p.id = pedido_id AND is_org_member(p.organization_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM nutrir_pedidos p WHERE p.id = pedido_id AND is_org_member(p.organization_id, auth.uid())));

-- Parametros consultoria
DROP POLICY IF EXISTS "nutrir_param_read" ON public.nutrir_parametros_consultoria;
CREATE POLICY "nutrir_param_read" ON public.nutrir_parametros_consultoria
  FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
DROP POLICY IF EXISTS "nutrir_param_write" ON public.nutrir_parametros_consultoria;
CREATE POLICY "nutrir_param_write" ON public.nutrir_parametros_consultoria
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]))
  WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

-- ============================================================
-- TRIGGERS DE updated_at
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'nutrir_regionais','nutrir_modalidades','nutrir_embalagens','nutrir_culturas',
    'nutrir_representantes','nutrir_clientes','nutrir_produtos','nutrir_materias_primas',
    'nutrir_formulacoes','nutrir_precos','nutrir_orcamentos','nutrir_pedidos','nutrir_users'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t);
  END LOOP;
END $$;

-- Triggers de notificação para Programa Nutrir
CREATE OR REPLACE FUNCTION public.notify_on_nutrir_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cliente_nome TEXT;
  admin_user UUID;
BEGIN
  SELECT razao_social INTO cliente_nome FROM public.nutrir_clientes WHERE id = NEW.cliente_id;

  -- Notifica criação
  IF TG_OP = 'INSERT' THEN
    FOR admin_user IN
      SELECT user_id FROM public.organization_members
      WHERE organization_id = NEW.organization_id AND role IN ('owner','admin','manager')
    LOOP
      INSERT INTO public.notifications (organization_id, user_id, type, title, message, link)
      VALUES (
        NEW.organization_id, admin_user, 'success',
        'Novo pedido Nutrir',
        'Pedido para ' || COALESCE(cliente_nome, 'cliente') || ' — R$ ' || to_char(NEW.total, 'FM999G999G990D00'),
        '/app/nutrir/pedidos'
      );
    END LOOP;
  END IF;

  -- Notifica mudança de status
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (organization_id, user_id, type, title, message, link)
    VALUES (
      NEW.organization_id, NULL, 'info',
      'Pedido ' || NEW.status,
      'Pedido de ' || COALESCE(cliente_nome, 'cliente') || ' agora está ' || NEW.status,
      '/app/nutrir/pedidos'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_nutrir_pedido ON public.nutrir_pedidos;
CREATE TRIGGER trg_notify_nutrir_pedido
AFTER INSERT OR UPDATE ON public.nutrir_pedidos
FOR EACH ROW EXECUTE FUNCTION public.notify_on_nutrir_pedido();

CREATE OR REPLACE FUNCTION public.notify_on_nutrir_orcamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cliente_nome TEXT;
BEGIN
  SELECT razao_social INTO cliente_nome FROM public.nutrir_clientes WHERE id = NEW.cliente_id;
  INSERT INTO public.notifications (organization_id, user_id, type, title, message, link)
  VALUES (
    NEW.organization_id, NULL, 'info',
    'Orçamento de consultoria salvo',
    COALESCE(NEW.titulo, 'Orçamento') || ' — ' || COALESCE(cliente_nome, 'sem cliente') ||
    ' (' || to_char(NEW.area_total_ha, 'FM999G990D0') || ' ha · R$ ' || to_char(NEW.total_geral, 'FM999G999G990D00') || ')',
    '/app/nutrir/orcamentos'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_nutrir_orcamento ON public.nutrir_orcamentos;
DROP TRIGGER IF EXISTS trg_notify_nutrir_orcamento ON public.nutrir_orcamentos;
CREATE TRIGGER trg_notify_nutrir_orcamento
AFTER INSERT ON public.nutrir_orcamentos
FOR EACH ROW EXECUTE FUNCTION public.notify_on_nutrir_orcamento();

-- 1. Categoria nas culturas globais
ALTER TABLE public.nutrir_culturas
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'Anual';

-- Marcar perenes
UPDATE public.nutrir_culturas SET categoria = 'Perene'
  WHERE nome IN ('Café Arábica','Café Conilon','Cana-de-açúcar','Laranja','Limão','Tangerina','Maçã','Manga','Mamão','Banana','Uva','Abacaxi','Coco','Açaí','Cacau','Eucalipto','Pinus','Seringueira','Erva-mate','Goiaba','Maracujá','Pastagem','Pimenta-do-reino');

UPDATE public.nutrir_culturas SET categoria = 'Cereal'
  WHERE nome IN ('Soja','Milho','Milho Safrinha','Trigo','Arroz','Aveia','Cevada','Centeio','Sorgo','Triticale','Feijão','Algodão','Girassol','Canola','Amendoim','Gergelim','Mamona','Linho','Tabaco');

UPDATE public.nutrir_culturas SET categoria = 'Olerícola'
  WHERE nome IN ('Tomate','Batata','Cenoura','Cebola','Alho','Pimentão','Mandioca');

-- 2. Defaults dos parâmetros de consultoria
ALTER TABLE public.nutrir_parametros_consultoria
  ALTER COLUMN custo_amostra SET DEFAULT 350,
  ALTER COLUMN meta_lucratividade SET DEFAULT 45,
  ALTER COLUMN piso_amostra SET DEFAULT 0,
  ALTER COLUMN piso_hectare SET DEFAULT 0,
  ALTER COLUMN grid_min_cereais SET DEFAULT 50;

-- 3. Caminho do laudo (relatório anexado) — coluna já chamada `report_path` existe; reaproveitar.
-- Apenas garantir que classification possa receber recomendações geradas pela IA
-- Nada a fazer aqui (jsonb já cobre).

-- 4. Catálogo: Complexadores (globais — todos veem)
CREATE TABLE IF NOT EXISTS public.nutrir_complexadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  preco_litro numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrir_complexadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nutrir_complex_read ON public.nutrir_complexadores;
CREATE POLICY nutrir_complex_read ON public.nutrir_complexadores FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS nutrir_complex_write ON public.nutrir_complexadores;
CREATE POLICY nutrir_complex_write ON public.nutrir_complexadores FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Fator complexador × nutriente (por nível: basico, intermediario, avancado)
CREATE TABLE IF NOT EXISTS public.nutrir_complexador_fatores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complexador_id uuid NOT NULL REFERENCES public.nutrir_complexadores(id) ON DELETE CASCADE,
  nutriente_id uuid NOT NULL REFERENCES public.nutrir_nutrientes(id) ON DELETE CASCADE,
  nivel text NOT NULL DEFAULT 'padrao',
  fator_l_kg_sal numeric NOT NULL DEFAULT 0,
  observacao text,
  UNIQUE (complexador_id, nutriente_id, nivel)
);
ALTER TABLE public.nutrir_complexador_fatores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nutrir_complex_fat_read ON public.nutrir_complexador_fatores;
CREATE POLICY nutrir_complex_fat_read ON public.nutrir_complexador_fatores FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS nutrir_complex_fat_write ON public.nutrir_complexador_fatores;
CREATE POLICY nutrir_complex_fat_write ON public.nutrir_complexador_fatores FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Fórmulas hardcoded (N180, N180_BORO, N32, FOLIAR, NPK_FOLIAR…)
CREATE TABLE IF NOT EXISTS public.nutrir_formula_cabecalho (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_codigo text NOT NULL,
  nivel text NOT NULL DEFAULT 'padrao',
  titulo text NOT NULL,
  descricao text,
  instrucoes_preparo text,
  volume_batida_padrao_l numeric DEFAULT 1000,
  fator_diluicao numeric NOT NULL DEFAULT 1.0,
  auto_ajuste_limite boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'publicada',
  ativa_calculadora boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formula_codigo, nivel)
);
ALTER TABLE public.nutrir_formula_cabecalho ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nutrir_fcab_read ON public.nutrir_formula_cabecalho;
CREATE POLICY nutrir_fcab_read ON public.nutrir_formula_cabecalho FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS nutrir_fcab_write ON public.nutrir_formula_cabecalho;
CREATE POLICY nutrir_fcab_write ON public.nutrir_formula_cabecalho FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.nutrir_formula_regra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_codigo text NOT NULL,
  nivel text NOT NULL DEFAULT 'padrao',
  ordem int NOT NULL DEFAULT 0,
  materia_prima_id uuid,
  materia_prima_nome text NOT NULL,
  tipo_calculo text NOT NULL DEFAULT 'PCT_BASE',
  base_calculo text,
  percentual numeric NOT NULL DEFAULT 0,
  dose_valor numeric,
  complexante_nome text,
  fator_complex_l_kg numeric NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'kg',
  fator_diluicao numeric NOT NULL DEFAULT 1.0,
  ativo boolean NOT NULL DEFAULT true
);
ALTER TABLE public.nutrir_formula_regra ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nutrir_freg_read ON public.nutrir_formula_regra;
CREATE POLICY nutrir_freg_read ON public.nutrir_formula_regra FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS nutrir_freg_write ON public.nutrir_formula_regra;
CREATE POLICY nutrir_freg_write ON public.nutrir_formula_regra FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.nutrir_formula_limite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_codigo text NOT NULL UNIQUE,
  limite_max_kg_por_1000l numeric NOT NULL DEFAULT 400
);
ALTER TABLE public.nutrir_formula_limite ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nutrir_flim_read ON public.nutrir_formula_limite;
CREATE POLICY nutrir_flim_read ON public.nutrir_formula_limite FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS nutrir_flim_write ON public.nutrir_formula_limite;
CREATE POLICY nutrir_flim_write ON public.nutrir_formula_limite FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.nutrir_formula_nivel_dose (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_codigo text NOT NULL,
  nivel text NOT NULL DEFAULT 'padrao',
  nutriente_id uuid REFERENCES public.nutrir_nutrientes(id) ON DELETE CASCADE,
  parametro text,
  valor numeric NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'g/ha'
);
ALTER TABLE public.nutrir_formula_nivel_dose ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nutrir_fdose_read ON public.nutrir_formula_nivel_dose;
CREATE POLICY nutrir_fdose_read ON public.nutrir_formula_nivel_dose FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS nutrir_fdose_write ON public.nutrir_formula_nivel_dose;
CREATE POLICY nutrir_fdose_write ON public.nutrir_formula_nivel_dose FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Fórmulas custom (por organização)
CREATE TABLE IF NOT EXISTS public.nutrir_formulas_custom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  codigo text NOT NULL,
  nome text NOT NULL,
  descricao text,
  motor text NOT NULL DEFAULT 'por_nutriente',
  complexador_id uuid REFERENCES public.nutrir_complexadores(id) ON DELETE SET NULL,
  nivel text NOT NULL DEFAULT 'padrao',
  volume_batida_padrao_l numeric NOT NULL DEFAULT 1000,
  fator_diluicao_global numeric NOT NULL DEFAULT 4.5,
  limite_sais_pct numeric NOT NULL DEFAULT 40,
  auto_ajuste_limite boolean NOT NULL DEFAULT true,
  enxofre_automatico boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'rascunho',
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrir_formulas_custom ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nutrir_fcustom_read ON public.nutrir_formulas_custom;
CREATE POLICY nutrir_fcustom_read ON public.nutrir_formulas_custom FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
DROP POLICY IF EXISTS nutrir_fcustom_write ON public.nutrir_formulas_custom;
CREATE POLICY nutrir_fcustom_write ON public.nutrir_formulas_custom FOR ALL TO authenticated
  USING (is_org_member(organization_id, auth.uid())) WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.nutrir_formulas_custom_nutrientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id uuid NOT NULL REFERENCES public.nutrir_formulas_custom(id) ON DELETE CASCADE,
  nutriente_id uuid NOT NULL REFERENCES public.nutrir_nutrientes(id) ON DELETE CASCADE,
  materia_prima_id uuid NOT NULL REFERENCES public.nutrir_materias_primas(id) ON DELETE CASCADE,
  garantia_pct_override numeric,
  step_arredondamento numeric NOT NULL DEFAULT 1,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true
);
ALTER TABLE public.nutrir_formulas_custom_nutrientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nutrir_fcn_all ON public.nutrir_formulas_custom_nutrientes;
CREATE POLICY nutrir_fcn_all ON public.nutrir_formulas_custom_nutrientes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM nutrir_formulas_custom f WHERE f.id = formula_id AND is_org_member(f.organization_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM nutrir_formulas_custom f WHERE f.id = formula_id AND is_org_member(f.organization_id, auth.uid())));

-- 8. Regras de cálculo globais
CREATE TABLE IF NOT EXISTS public.nutrir_regras_calculo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor numeric NOT NULL,
  descricao text
);
ALTER TABLE public.nutrir_regras_calculo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nutrir_regras_read ON public.nutrir_regras_calculo;
CREATE POLICY nutrir_regras_read ON public.nutrir_regras_calculo FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS nutrir_regras_write ON public.nutrir_regras_calculo;
CREATE POLICY nutrir_regras_write ON public.nutrir_regras_calculo FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

INSERT INTO public.nutrir_regras_calculo (chave, valor, descricao) VALUES
  ('limite_sais_pct', 40, 'Limite máximo de sais (% do volume da batida)'),
  ('fator_diluicao_padrao', 4.5, 'Fator de diluição global padrão'),
  ('volume_batida_padrao_l', 1000, 'Volume da batida padrão (L)'),
  ('grid_perene_ha', 10, 'Grid padrão para culturas perenes (ha)'),
  ('grid_anual_ha', 50, 'Grid padrão para culturas anuais/cereais (ha)'),
  ('amostragens_perene', 8, 'Número de amostragens para perenes'),
  ('amostragens_anual', 5, 'Número de amostragens para anuais/cereais')
ON CONFLICT (chave) DO NOTHING;

-- Atualiza valores existentes (para orgs já configuradas)
UPDATE public.nutrir_parametros_consultoria
   SET custo_amostra = 350, meta_lucratividade = 45, piso_amostra = 0, piso_hectare = 0, grid_min_cereais = 50
 WHERE custo_amostra <= 60 OR meta_lucratividade <= 30;


-- ENUMs
DO $$ BEGIN CREATE TYPE public.nutrir_cargo AS ENUM ('diretor','gerente_regional','rtv','at','consultor','representante'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.nutrir_veiculo_tipo AS ENUM ('empresa','locado','particular','sem_veiculo'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Colaboradores hierárquicos
CREATE TABLE IF NOT EXISTS public.nutrir_colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  superior_id UUID REFERENCES public.nutrir_colaboradores(id) ON DELETE SET NULL,
  cargo public.nutrir_cargo NOT NULL,
  nome TEXT NOT NULL,
  razao_social TEXT,
  cpf_cnpj TEXT,
  registro_core TEXT,
  email TEXT,
  telefone TEXT,
  regional_id UUID REFERENCES public.nutrir_regionais(id) ON DELETE SET NULL,
  ajuda_custo NUMERIC DEFAULT 0,
  adiantamento NUMERIC DEFAULT 0,
  comissao_base_pct NUMERIC DEFAULT 0,
  meta_mensal NUMERIC DEFAULT 0,
  bonus_meta_pct NUMERIC DEFAULT 0,
  veiculo_tipo public.nutrir_veiculo_tipo DEFAULT 'sem_veiculo',
  veiculo_modelo TEXT,
  veiculo_placa TEXT,
  veiculo_valor NUMERIC,
  veiculo_aluguel_mensal NUMERIC,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nutrir_colab_org ON public.nutrir_colaboradores(organization_id);
CREATE INDEX IF NOT EXISTS idx_nutrir_colab_superior ON public.nutrir_colaboradores(superior_id);
CREATE INDEX IF NOT EXISTS idx_nutrir_colab_user ON public.nutrir_colaboradores(user_id);
ALTER TABLE public.nutrir_colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nutrir_colab_read" ON public.nutrir_colaboradores;
DROP POLICY IF EXISTS "nutrir_colab_read" ON public.nutrir_colaboradores;
CREATE POLICY "nutrir_colab_read" ON public.nutrir_colaboradores FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));
DROP POLICY IF EXISTS "nutrir_colab_write" ON public.nutrir_colaboradores;
DROP POLICY IF EXISTS "nutrir_colab_write" ON public.nutrir_colaboradores;
CREATE POLICY "nutrir_colab_write" ON public.nutrir_colaboradores FOR ALL TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));
DROP TRIGGER IF EXISTS trg_nutrir_colab_touch ON public.nutrir_colaboradores;
DROP TRIGGER IF EXISTS trg_nutrir_colab_touch ON public.nutrir_colaboradores;
CREATE TRIGGER trg_nutrir_colab_touch BEFORE UPDATE ON public.nutrir_colaboradores
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.has_nutrir_cargo(_org uuid, _user uuid, _cargos public.nutrir_cargo[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.nutrir_colaboradores
    WHERE organization_id = _org AND user_id = _user AND ativo = true AND cargo = ANY(_cargos));
$$;

-- Catálogos globais
CREATE TABLE IF NOT EXISTS public.nutrir_consultoria_culturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  produtividade_kg_ha NUMERIC DEFAULT 0,
  unidade_comercial TEXT,
  peso_unidade_kg NUMERIC,
  preco_unidade NUMERIC,
  rendimento_bruto_ha NUMERIC DEFAULT 0,
  fonte TEXT,
  grid_minimo NUMERIC DEFAULT 5,
  categoria TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrir_consultoria_culturas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nutrir_cc_read" ON public.nutrir_consultoria_culturas;
DROP POLICY IF EXISTS "nutrir_cc_read" ON public.nutrir_consultoria_culturas;
CREATE POLICY "nutrir_cc_read" ON public.nutrir_consultoria_culturas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "nutrir_cc_write" ON public.nutrir_consultoria_culturas;
DROP POLICY IF EXISTS "nutrir_cc_write" ON public.nutrir_consultoria_culturas;
CREATE POLICY "nutrir_cc_write" ON public.nutrir_consultoria_culturas FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP TRIGGER IF EXISTS trg_nutrir_cc_touch ON public.nutrir_consultoria_culturas;
DROP TRIGGER IF EXISTS trg_nutrir_cc_touch ON public.nutrir_consultoria_culturas;
CREATE TRIGGER trg_nutrir_cc_touch BEFORE UPDATE ON public.nutrir_consultoria_culturas
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.nutrir_cultura_demanda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cultura_id UUID NOT NULL REFERENCES public.nutrir_culturas(id) ON DELETE CASCADE,
  nutriente_id UUID NOT NULL REFERENCES public.nutrir_nutrientes(id) ON DELETE CASCADE,
  extracao_kg_ton NUMERIC DEFAULT 0,
  exportacao_kg_ton NUMERIC DEFAULT 0,
  produtividade_referencia_kg NUMERIC,
  unidade_referencia TEXT,
  fator_kg NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cultura_id, nutriente_id)
);
ALTER TABLE public.nutrir_cultura_demanda ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nutrir_cd_read" ON public.nutrir_cultura_demanda;
DROP POLICY IF EXISTS "nutrir_cd_read" ON public.nutrir_cultura_demanda;
CREATE POLICY "nutrir_cd_read" ON public.nutrir_cultura_demanda FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "nutrir_cd_write" ON public.nutrir_cultura_demanda;
DROP POLICY IF EXISTS "nutrir_cd_write" ON public.nutrir_cultura_demanda;
CREATE POLICY "nutrir_cd_write" ON public.nutrir_cultura_demanda FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.nutrir_nutriente_sal_padrao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nutriente_id UUID NOT NULL REFERENCES public.nutrir_nutrientes(id) ON DELETE CASCADE,
  materia_prima_id UUID NOT NULL REFERENCES public.nutrir_materias_primas(id) ON DELETE CASCADE,
  garantia_percentual NUMERIC DEFAULT 0,
  fator_conversao NUMERIC DEFAULT 1,
  padrao BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrir_nutriente_sal_padrao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nutrir_nsp_read" ON public.nutrir_nutriente_sal_padrao;
DROP POLICY IF EXISTS "nutrir_nsp_read" ON public.nutrir_nutriente_sal_padrao;
CREATE POLICY "nutrir_nsp_read" ON public.nutrir_nutriente_sal_padrao FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "nutrir_nsp_write" ON public.nutrir_nutriente_sal_padrao;
DROP POLICY IF EXISTS "nutrir_nsp_write" ON public.nutrir_nutriente_sal_padrao;
CREATE POLICY "nutrir_nsp_write" ON public.nutrir_nutriente_sal_padrao FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.nutrir_mp_incompatibilidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  materia_prima_a_id UUID NOT NULL REFERENCES public.nutrir_materias_primas(id) ON DELETE CASCADE,
  materia_prima_b_id UUID NOT NULL REFERENCES public.nutrir_materias_primas(id) ON DELETE CASCADE,
  severidade TEXT NOT NULL DEFAULT 'aviso',
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrir_mp_incompatibilidade ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nutrir_mpi_read" ON public.nutrir_mp_incompatibilidade;
DROP POLICY IF EXISTS "nutrir_mpi_read" ON public.nutrir_mp_incompatibilidade;
CREATE POLICY "nutrir_mpi_read" ON public.nutrir_mp_incompatibilidade FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "nutrir_mpi_write" ON public.nutrir_mp_incompatibilidade;
DROP POLICY IF EXISTS "nutrir_mpi_write" ON public.nutrir_mp_incompatibilidade;
CREATE POLICY "nutrir_mpi_write" ON public.nutrir_mp_incompatibilidade FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Colunas que faltam
DO $$ BEGIN
  ALTER TABLE public.nutrir_materias_primas ADD COLUMN IF NOT EXISTS tipo TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_materias_primas ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_materias_primas ADD COLUMN IF NOT EXISTS imagem_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_materias_primas ADD COLUMN IF NOT EXISTS compatibilidade TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_regionais       ADD COLUMN IF NOT EXISTS multiplicador NUMERIC DEFAULT 1.0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_embalagens      ADD COLUMN IF NOT EXISTS multiplicador NUMERIC DEFAULT 1.0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_modalidades     ADD COLUMN IF NOT EXISTS multiplicador NUMERIC DEFAULT 1.0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_modalidades     ADD COLUMN IF NOT EXISTS tipo_negociacao TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_produtos        ADD COLUMN IF NOT EXISTS tipos_negociacao_permitidos JSONB;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_produtos        ADD COLUMN IF NOT EXISTS imagem_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_regras_calculo  ADD COLUMN IF NOT EXISTS valor_numerico NUMERIC;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_regras_calculo  ADD COLUMN IF NOT EXISTS valor_texto TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_regras_calculo  ADD COLUMN IF NOT EXISTS categoria TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_regras_calculo  ADD COLUMN IF NOT EXISTS editavel BOOLEAN DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_regras_calculo  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_estagios        ADD COLUMN IF NOT EXISTS percentual_dose NUMERIC;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_estagios        ADD COLUMN IF NOT EXISTS volume_min_l_ha NUMERIC;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_estagios        ADD COLUMN IF NOT EXISTS volume_max_l_ha NUMERIC;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_estagios        ADD COLUMN IF NOT EXISTS periodo TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_estagios        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.nutrir_nutrientes      ADD COLUMN IF NOT EXISTS categoria TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Unique constraints necessárias para upserts idempotentes do seed Nutrir
DO $$ BEGIN
  ALTER TABLE nutrir_nutrientes ADD CONSTRAINT nutrir_nutrientes_simbolo_key UNIQUE (simbolo);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE nutrir_culturas ADD CONSTRAINT nutrir_culturas_nome_key UNIQUE (nome);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE nutrir_complexadores ADD CONSTRAINT nutrir_complexadores_nome_key UNIQUE (nome);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE nutrir_formula_cabecalho ADD CONSTRAINT nutrir_formula_cabecalho_codigo_nivel_key UNIQUE (formula_codigo, nivel);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE nutrir_formula_limite ADD CONSTRAINT nutrir_formula_limite_codigo_key UNIQUE (formula_codigo);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE nutrir_consultoria_culturas ADD CONSTRAINT nutrir_consultoria_culturas_nome_key UNIQUE (nome);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE nutrir_materias_primas ADD CONSTRAINT nutrir_materias_primas_org_nome_key UNIQUE (organization_id, nome);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE nutrir_embalagens ADD CONSTRAINT nutrir_embalagens_org_nome_key UNIQUE (organization_id, nome);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE nutrir_modalidades ADD CONSTRAINT nutrir_modalidades_org_nome_key UNIQUE (organization_id, nome);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;
INSERT INTO public.nutrir_culturas (nome, nome_cientifico, categoria, ciclo_dias, ativo)
VALUES
  ('Beterraba', 'Beta vulgaris', 'Anual', 90, true),
  ('Brócolis', 'Brassica oleracea var. italica', 'Anual', 100, true)
ON CONFLICT (nome) DO NOTHING;

-- Primeiro removemos duplicatas mantendo o registro mais antigo
DELETE FROM nutrir_formula_regra a
USING nutrir_formula_regra b
WHERE a.id > b.id
  AND a.formula_codigo = b.formula_codigo
  AND a.nivel = b.nivel
  AND a.ordem = b.ordem
  AND a.materia_prima_nome = b.materia_prima_nome;

-- Agora podemos adicionar a constraint única
DO $$ BEGIN
  ALTER TABLE nutrir_formula_regra ADD CONSTRAINT nutrir_formula_regra_uq UNIQUE (formula_codigo, nivel, ordem, materia_prima_nome);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

-- Histórico de cálculos foliares NUTRIR
CREATE TABLE IF NOT EXISTS public.nutrir_foliar_historico (
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

DROP POLICY IF EXISTS "nutrir_foliar_hist_read" ON public.nutrir_foliar_historico;
CREATE POLICY "nutrir_foliar_hist_read" ON public.nutrir_foliar_historico
  FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "nutrir_foliar_hist_write" ON public.nutrir_foliar_historico;
CREATE POLICY "nutrir_foliar_hist_write" ON public.nutrir_foliar_historico
  FOR ALL TO authenticated
  USING (is_org_member(organization_id, auth.uid()))
  WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_nutrir_foliar_hist_org ON public.nutrir_foliar_historico(organization_id, created_at DESC);

DROP TRIGGER IF EXISTS nutrir_foliar_hist_touch ON public.nutrir_foliar_historico;
CREATE TRIGGER nutrir_foliar_hist_touch
  BEFORE UPDATE ON public.nutrir_foliar_historico
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
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

DROP POLICY IF EXISTS "Membros da organização podem ver histórico NPK" ON public.nutrir_npk_historico;
CREATE POLICY "Membros da organização podem ver histórico NPK" ON public.nutrir_npk_historico FOR SELECT
USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Membros da organização podem criar histórico NPK" ON public.nutrir_npk_historico;
CREATE POLICY "Membros da organização podem criar histórico NPK" ON public.nutrir_npk_historico FOR INSERT
WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "Autor pode atualizar próprio histórico NPK" ON public.nutrir_npk_historico;
CREATE POLICY "Autor pode atualizar próprio histórico NPK" ON public.nutrir_npk_historico FOR UPDATE
USING (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Autor ou admin pode excluir histórico NPK" ON public.nutrir_npk_historico;
CREATE POLICY "Autor ou admin pode excluir histórico NPK" ON public.nutrir_npk_historico FOR DELETE
USING (
  public.is_org_member(organization_id, auth.uid())
  AND (user_id = auth.uid() OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
);

DROP TRIGGER IF EXISTS trg_nutrir_npk_historico_updated ON public.nutrir_npk_historico;
CREATE TRIGGER trg_nutrir_npk_historico_updated
BEFORE UPDATE ON public.nutrir_npk_historico
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.nutrir_pedidos
  ADD COLUMN IF NOT EXISTS orcamento_origem_id UUID
  REFERENCES public.nutrir_orcamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nutrir_pedidos_orcamento_origem
  ON public.nutrir_pedidos(orcamento_origem_id);
-- Tabela de auditoria de mudanças de status
CREATE TABLE IF NOT EXISTS public.nutrir_auditoria_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid,
  entidade text NOT NULL CHECK (entidade IN ('pedido', 'orcamento')),
  entidade_id uuid NOT NULL,
  status_anterior text,
  status_novo text NOT NULL,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrir_audit_org_entidade ON public.nutrir_auditoria_status (organization_id, entidade, entidade_id, created_at DESC);

ALTER TABLE public.nutrir_auditoria_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_org" ON public.nutrir_auditoria_status;
DROP POLICY IF EXISTS "audit_select_org" ON public.nutrir_auditoria_status;
CREATE POLICY "audit_select_org" ON public.nutrir_auditoria_status
  FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','member','viewer']::app_role[]));

DROP POLICY IF EXISTS "audit_insert_admin" ON public.nutrir_auditoria_status;
DROP POLICY IF EXISTS "audit_insert_admin" ON public.nutrir_auditoria_status;
CREATE POLICY "audit_insert_admin" ON public.nutrir_auditoria_status
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','member']::app_role[]));

-- Trigger: log mudanças de status em pedidos
CREATE OR REPLACE FUNCTION public.log_nutrir_pedido_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.nutrir_auditoria_status (organization_id, user_id, entidade, entidade_id, status_anterior, status_novo)
    VALUES (NEW.organization_id, auth.uid(), 'pedido', NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_nutrir_pedido_status ON public.nutrir_pedidos;
CREATE TRIGGER trg_log_nutrir_pedido_status
  AFTER UPDATE OF status ON public.nutrir_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.log_nutrir_pedido_status();

-- Trigger: log mudanças de status em orçamentos
CREATE OR REPLACE FUNCTION public.log_nutrir_orcamento_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.nutrir_auditoria_status (organization_id, user_id, entidade, entidade_id, status_anterior, status_novo)
    VALUES (NEW.organization_id, auth.uid(), 'orcamento', NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_nutrir_orcamento_status ON public.nutrir_orcamentos;
CREATE TRIGGER trg_log_nutrir_orcamento_status
  AFTER UPDATE OF status ON public.nutrir_orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.log_nutrir_orcamento_status();

-- Restrição de cancelamento: apenas owner/admin podem cancelar pedidos
CREATE OR REPLACE FUNCTION public.guard_nutrir_pedido_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'cancelado'
     AND OLD.status IS DISTINCT FROM 'cancelado' THEN
    IF NOT public.has_org_role(NEW.organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]) THEN
      RAISE EXCEPTION 'Apenas administradores podem cancelar pedidos.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_nutrir_pedido_cancel ON public.nutrir_pedidos;
CREATE TRIGGER trg_guard_nutrir_pedido_cancel
  BEFORE UPDATE OF status ON public.nutrir_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.guard_nutrir_pedido_cancel();
-- =========================================================================
-- 1) CLIENTES: categoria + propriedades múltiplas
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.nutrir_cliente_categoria AS ENUM
    ('produtor_rural','grupo','revenda','b2b','cooperativa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.nutrir_clientes
  ADD COLUMN IF NOT EXISTS categoria public.nutrir_cliente_categoria NOT NULL DEFAULT 'produtor_rural',
  ADD COLUMN IF NOT EXISTS cpf text;

CREATE TABLE IF NOT EXISTS public.nutrir_cliente_propriedades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.nutrir_clientes(id) ON DELETE CASCADE,
  nome_fazenda text NOT NULL,
  inscricao_estadual text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  cep text,
  latitude numeric,
  longitude numeric,
  contato_nome text,
  contato_telefone text,
  contato_email text,
  observacoes text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrir_cliente_propriedades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prop_org_all ON public.nutrir_cliente_propriedades;
DROP POLICY IF EXISTS prop_org_all ON public.nutrir_cliente_propriedades;
CREATE POLICY prop_org_all ON public.nutrir_cliente_propriedades
  FOR ALL TO authenticated
  USING (is_org_member(organization_id, auth.uid()))
  WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_prop_cliente ON public.nutrir_cliente_propriedades(cliente_id);

DROP TRIGGER IF EXISTS trg_prop_updated ON public.nutrir_cliente_propriedades;
DROP TRIGGER IF EXISTS trg_prop_updated ON public.nutrir_cliente_propriedades;
CREATE TRIGGER trg_prop_updated BEFORE UPDATE ON public.nutrir_cliente_propriedades
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- 2) OUVIDORIA
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.nutrir_alerta_nivel AS ENUM
    ('muito_urgente','ponto_atencao','relato_rotina');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.nutrir_ouvidoria_status AS ENUM
    ('aberto','em_analise','respondido','fechado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.nutrir_ouvidoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  cliente_id uuid REFERENCES public.nutrir_clientes(id) ON DELETE SET NULL,
  cliente_nome_livre text,
  visita_id uuid,
  nivel public.nutrir_alerta_nivel NOT NULL DEFAULT 'relato_rotina',
  status public.nutrir_ouvidoria_status NOT NULL DEFAULT 'aberto',
  titulo text NOT NULL,
  mensagem text NOT NULL,
  resposta text,
  respondido_por uuid,
  respondido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrir_ouvidoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ouv_select ON public.nutrir_ouvidoria;
DROP POLICY IF EXISTS ouv_select ON public.nutrir_ouvidoria;
CREATE POLICY ouv_select ON public.nutrir_ouvidoria
  FOR SELECT TO authenticated
  USING (
    is_org_member(organization_id, auth.uid())
    AND (user_id = auth.uid()
         OR has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
  );

DROP POLICY IF EXISTS ouv_insert ON public.nutrir_ouvidoria;
DROP POLICY IF EXISTS ouv_insert ON public.nutrir_ouvidoria;
CREATE POLICY ouv_insert ON public.nutrir_ouvidoria
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());

DROP POLICY IF EXISTS ouv_update_admin ON public.nutrir_ouvidoria;
DROP POLICY IF EXISTS ouv_update_admin ON public.nutrir_ouvidoria;
CREATE POLICY ouv_update_admin ON public.nutrir_ouvidoria
  FOR UPDATE TO authenticated
  USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

DROP TRIGGER IF EXISTS trg_ouv_updated ON public.nutrir_ouvidoria;
DROP TRIGGER IF EXISTS trg_ouv_updated ON public.nutrir_ouvidoria;
CREATE TRIGGER trg_ouv_updated BEFORE UPDATE ON public.nutrir_ouvidoria
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.notify_on_ouvidoria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  alvo uuid;
  tipo text;
BEGIN
  tipo := CASE NEW.nivel
    WHEN 'muito_urgente' THEN 'error'
    WHEN 'ponto_atencao' THEN 'warning'
    ELSE 'info' END;

  FOR alvo IN
    SELECT user_id FROM public.organization_members
    WHERE organization_id = NEW.organization_id
      AND role IN ('owner','admin')
      AND user_id <> NEW.user_id
  LOOP
    INSERT INTO public.notifications (organization_id, user_id, type, title, message, link)
    VALUES (
      NEW.organization_id, alvo, tipo,
      CASE NEW.nivel
        WHEN 'muito_urgente' THEN 'OUVIDORIA — Muito Urgente'
        WHEN 'ponto_atencao' THEN 'Ouvidoria — Ponto de Atenção'
        ELSE 'Ouvidoria — Relato de Rotina' END,
      NEW.titulo,
      '/app/gerente/ouvidoria'
    ) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_notify_ouvidoria ON public.nutrir_ouvidoria;
DROP TRIGGER IF EXISTS trg_notify_ouvidoria ON public.nutrir_ouvidoria;
CREATE TRIGGER trg_notify_ouvidoria AFTER INSERT ON public.nutrir_ouvidoria
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_ouvidoria();

-- =========================================================================
-- 3) VISITAS
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.nutrir_visita_motivo AS ENUM
    ('rotina_relacionamento','prospeccao_venda','acompanhamento_teste',
     'entrega_produto','acompanhamento_aplicacao','geracao_demanda',
     'dia_de_campo','evento_social','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.nutrir_visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  cliente_id uuid REFERENCES public.nutrir_clientes(id) ON DELETE SET NULL,
  cliente_nome_livre text,
  propriedade_id uuid REFERENCES public.nutrir_cliente_propriedades(id) ON DELETE SET NULL,
  campo_teste_id uuid,
  data_visita date NOT NULL DEFAULT CURRENT_DATE,
  motivo public.nutrir_visita_motivo NOT NULL,
  motivo_outro text,
  relato text NOT NULL,
  observacao text,
  fotos jsonb NOT NULL DEFAULT '[]'::jsonb,
  alerta_nivel public.nutrir_alerta_nivel,
  ouvidoria_id uuid REFERENCES public.nutrir_ouvidoria(id) ON DELETE SET NULL,
  latitude numeric,
  longitude numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrir_visitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vis_select ON public.nutrir_visitas;
DROP POLICY IF EXISTS vis_select ON public.nutrir_visitas;
CREATE POLICY vis_select ON public.nutrir_visitas
  FOR SELECT TO authenticated
  USING (
    is_org_member(organization_id, auth.uid())
    AND (user_id = auth.uid()
         OR has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
  );

DROP POLICY IF EXISTS vis_insert ON public.nutrir_visitas;
DROP POLICY IF EXISTS vis_insert ON public.nutrir_visitas;
CREATE POLICY vis_insert ON public.nutrir_visitas
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());

DROP POLICY IF EXISTS vis_update_own ON public.nutrir_visitas;
DROP POLICY IF EXISTS vis_update_own ON public.nutrir_visitas;
CREATE POLICY vis_update_own ON public.nutrir_visitas
  FOR UPDATE TO authenticated
  USING (
    is_org_member(organization_id, auth.uid())
    AND (user_id = auth.uid()
         OR has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
  );

DROP POLICY IF EXISTS vis_delete_admin ON public.nutrir_visitas;
DROP POLICY IF EXISTS vis_delete_admin ON public.nutrir_visitas;
CREATE POLICY vis_delete_admin ON public.nutrir_visitas
  FOR DELETE TO authenticated
  USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

CREATE INDEX IF NOT EXISTS idx_visitas_org_user ON public.nutrir_visitas(organization_id, user_id, data_visita DESC);

DROP TRIGGER IF EXISTS trg_visitas_updated ON public.nutrir_visitas;
DROP TRIGGER IF EXISTS trg_visitas_updated ON public.nutrir_visitas;
CREATE TRIGGER trg_visitas_updated BEFORE UPDATE ON public.nutrir_visitas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- 4) STORAGE — bucket privado para fotos de visitas
-- =========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('visitas-fotos', 'visitas-fotos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS visitas_fotos_select ON storage.objects;
DROP POLICY IF EXISTS visitas_fotos_select ON storage.objects;
CREATE POLICY visitas_fotos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'visitas-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS visitas_fotos_insert ON storage.objects;
DROP POLICY IF EXISTS visitas_fotos_insert ON storage.objects;
CREATE POLICY visitas_fotos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'visitas-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS visitas_fotos_delete ON storage.objects;
DROP POLICY IF EXISTS visitas_fotos_delete ON storage.objects;
CREATE POLICY visitas_fotos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'visitas-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =========================================================================
-- 5) Função para vincular usuários de teste à organização
-- =========================================================================
CREATE OR REPLACE FUNCTION public.add_test_user_to_org(_email text, _role app_role)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  caller_org uuid;
  target_user uuid;
BEGIN
  SELECT organization_id INTO caller_org
  FROM public.organization_members
  WHERE user_id = auth.uid() AND role IN ('owner','admin')
  LIMIT 1;

  IF caller_org IS NULL THEN
    RAISE EXCEPTION 'Apenas owner/admin pode adicionar usuários de teste.';
  END IF;

  SELECT id INTO target_user FROM auth.users WHERE email = _email LIMIT 1;
  IF target_user IS NULL THEN
    RETURN 'Usuário com email ' || _email || ' ainda não foi cadastrado em /auth.';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (caller_org, target_user, _role)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  RETURN 'OK: ' || _email || ' vinculado como ' || _role::text;
END $fn$;
-- Tabela de solicitações de cadastro (autorização pelo admin)
CREATE TABLE IF NOT EXISTS public.signup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  full_name text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  requested_role app_role NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reviewed_by uuid,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signup_requests ENABLE ROW LEVEL SECURITY;

-- O próprio usuário vê seu request
DROP POLICY IF EXISTS "signup_self_read" ON public.signup_requests;
CREATE POLICY "signup_self_read" ON public.signup_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins/owners podem ver/atualizar requests da própria org OU sem org (pendentes globais)
DROP POLICY IF EXISTS "signup_admin_read" ON public.signup_requests;
CREATE POLICY "signup_admin_read" ON public.signup_requests
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[])
  );

DROP POLICY IF EXISTS "signup_admin_update" ON public.signup_requests;
CREATE POLICY "signup_admin_update" ON public.signup_requests
  FOR UPDATE TO authenticated
  USING (
    organization_id IS NULL
    OR has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[])
  );

-- Trigger: ao criar profile, criar signup_request pendente (a menos que o usuário já vire owner ao criar org)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Cria solicitação de aprovação
  INSERT INTO public.signup_requests (user_id, email, full_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    'pending'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Função para aprovar: vincula usuário à organização do admin com a role escolhida
CREATE OR REPLACE FUNCTION public.approve_signup_request(_request_id uuid, _role app_role DEFAULT 'member')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_org uuid;
  req record;
BEGIN
  SELECT organization_id INTO caller_org
  FROM public.organization_members
  WHERE user_id = auth.uid() AND role IN ('owner','admin')
  LIMIT 1;

  IF caller_org IS NULL THEN
    RAISE EXCEPTION 'Apenas owner/admin pode aprovar cadastros.';
  END IF;

  SELECT * INTO req FROM public.signup_requests WHERE id = _request_id FOR UPDATE;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Solicitação já processada.'; END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (caller_org, req.user_id, _role)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.signup_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
      organization_id = caller_org, requested_role = _role
  WHERE id = _request_id;

  RETURN 'OK';
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_signup_request(_request_id uuid, _notes text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ) INTO caller_is_admin;

  IF NOT caller_is_admin THEN
    RAISE EXCEPTION 'Apenas owner/admin pode rejeitar cadastros.';
  END IF;

  UPDATE public.signup_requests
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), notes = _notes
  WHERE id = _request_id AND status = 'pending';

  RETURN 'OK';
END;
$$;

-- Já existem usuários cadastrados? Cria requests aprovados retroativos para quem já tem membership,
-- e pendentes para quem não tem.
INSERT INTO public.signup_requests (user_id, email, full_name, status, organization_id, reviewed_at)
SELECT p.id, p.email, p.full_name,
       CASE WHEN m.user_id IS NOT NULL THEN 'approved' ELSE 'pending' END,
       m.organization_id,
       CASE WHEN m.user_id IS NOT NULL THEN now() ELSE NULL END
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT user_id, organization_id FROM public.organization_members WHERE user_id = p.id LIMIT 1
) m ON true
ON CONFLICT (user_id) DO NOTHING;
-- ============ RDV (Relatório Diário de Viagem / despesas) ============
DO $$ BEGIN
  CREATE TYPE public.rdv_categoria AS ENUM (
  'combustivel','alimentacao','hospedagem','pedagio','manutencao','estacionamento','outros'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rdv_status AS ENUM ('rascunho','enviado','aprovado','rejeitado','pago');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.nutrir_rdv (
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
CREATE INDEX IF NOT EXISTS idx_rdv_org_user_data ON public.nutrir_rdv (organization_id, user_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_rdv_status ON public.nutrir_rdv (organization_id, status);

ALTER TABLE public.nutrir_rdv ENABLE ROW LEVEL SECURITY;

-- Representante vê e edita os próprios; admin/owner/manager vêem tudo da org
DROP POLICY IF EXISTS rdv_self_or_admin_select ON public.nutrir_rdv;
CREATE POLICY rdv_self_or_admin_select ON public.nutrir_rdv FOR SELECT TO authenticated
USING (
  is_org_member(organization_id, auth.uid()) AND (
    user_id = auth.uid()
    OR has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[])
  )
);
DROP POLICY IF EXISTS rdv_self_insert ON public.nutrir_rdv;
CREATE POLICY rdv_self_insert ON public.nutrir_rdv FOR INSERT TO authenticated
WITH CHECK (is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());

DROP POLICY IF EXISTS rdv_self_update_draft ON public.nutrir_rdv;
CREATE POLICY rdv_self_update_draft ON public.nutrir_rdv FOR UPDATE TO authenticated
USING (
  is_org_member(organization_id, auth.uid()) AND (
    (user_id = auth.uid() AND status IN ('rascunho','enviado'))
    OR has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[])
  )
)
WITH CHECK (is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS rdv_admin_delete ON public.nutrir_rdv;
CREATE POLICY rdv_admin_delete ON public.nutrir_rdv FOR DELETE TO authenticated
USING (
  (user_id = auth.uid() AND status = 'rascunho')
  OR has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[])
);

DROP TRIGGER IF EXISTS trg_rdv_updated ON public.nutrir_rdv;
CREATE TRIGGER trg_rdv_updated BEFORE UPDATE ON public.nutrir_rdv
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Bucket para cupons
INSERT INTO storage.buckets (id, name, public) VALUES ('rdv-cupons','rdv-cupons', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "rdv-cupons own read" ON storage.objects;
CREATE POLICY "rdv-cupons own read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'rdv-cupons' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "rdv-cupons own write" ON storage.objects;
CREATE POLICY "rdv-cupons own write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'rdv-cupons' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "rdv-cupons own update" ON storage.objects;
CREATE POLICY "rdv-cupons own update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'rdv-cupons' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "rdv-cupons own delete" ON storage.objects;
CREATE POLICY "rdv-cupons own delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'rdv-cupons' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============ Estoque do Cliente ============
DO $$ BEGIN
  CREATE TYPE public.estoque_mov_tipo AS ENUM ('entrada','saida','ajuste');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.nutrir_estoque_cliente (
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
DROP POLICY IF EXISTS estoque_org_all ON public.nutrir_estoque_cliente;
CREATE POLICY estoque_org_all ON public.nutrir_estoque_cliente FOR ALL TO authenticated
USING (is_org_member(organization_id, auth.uid()))
WITH CHECK (is_org_member(organization_id, auth.uid()));

DROP TRIGGER IF EXISTS trg_estoque_updated ON public.nutrir_estoque_cliente;
CREATE TRIGGER trg_estoque_updated BEFORE UPDATE ON public.nutrir_estoque_cliente
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.nutrir_estoque_movimentacoes (
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
CREATE INDEX IF NOT EXISTS idx_estmov_estoque ON public.nutrir_estoque_movimentacoes (estoque_id, created_at DESC);
ALTER TABLE public.nutrir_estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS estmov_org_all ON public.nutrir_estoque_movimentacoes;
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
DROP TRIGGER IF EXISTS trg_estoque_mov ON public.nutrir_estoque_movimentacoes;
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
-- ============ Contas a Receber ============
DO $$ BEGIN
  CREATE TYPE public.cr_status AS ENUM ('em_aberto','vencendo','vencido','pago','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.nutrir_contas_receber (
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
CREATE INDEX IF NOT EXISTS idx_cr_org_venc ON public.nutrir_contas_receber (organization_id, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cr_status ON public.nutrir_contas_receber (organization_id, status);
ALTER TABLE public.nutrir_contas_receber ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cr_read ON public.nutrir_contas_receber;
CREATE POLICY cr_read ON public.nutrir_contas_receber FOR SELECT TO authenticated
USING (is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS cr_admin_write ON public.nutrir_contas_receber;
CREATE POLICY cr_admin_write ON public.nutrir_contas_receber FOR ALL TO authenticated
USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

DROP TRIGGER IF EXISTS trg_cr_updated ON public.nutrir_contas_receber;
CREATE TRIGGER trg_cr_updated BEFORE UPDATE ON public.nutrir_contas_receber
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Comissões ============
DO $$ BEGIN
  CREATE TYPE public.comissao_status AS ENUM ('prevista','apurada','paga','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.nutrir_comissoes (
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
CREATE INDEX IF NOT EXISTS idx_com_org_mes ON public.nutrir_comissoes (organization_id, mes_referencia DESC);
CREATE INDEX IF NOT EXISTS idx_com_rep ON public.nutrir_comissoes (representante_id, mes_referencia DESC);
ALTER TABLE public.nutrir_comissoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS com_self_or_admin_read ON public.nutrir_comissoes;
CREATE POLICY com_self_or_admin_read ON public.nutrir_comissoes FOR SELECT TO authenticated
USING (
  is_org_member(organization_id, auth.uid()) AND (
    user_id = auth.uid()
    OR has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[])
  )
);

DROP POLICY IF EXISTS com_admin_write ON public.nutrir_comissoes;
CREATE POLICY com_admin_write ON public.nutrir_comissoes FOR ALL TO authenticated
USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

DROP TRIGGER IF EXISTS trg_com_updated ON public.nutrir_comissoes;
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

  SELECT COALESCE(prazo_dias, 30) INTO prazo FROM public.nutrir_modalidades WHERE id = NEW.modalidade_id;

  SELECT EXISTS(SELECT 1 FROM public.nutrir_contas_receber WHERE pedido_id = NEW.id) INTO ja_existe;
  IF NOT ja_existe AND NEW.total > 0 THEN
    INSERT INTO public.nutrir_contas_receber
      (organization_id, cliente_id, pedido_id, representante_id, data_emissao, data_vencimento, valor)
    VALUES
      (NEW.organization_id, NEW.cliente_id, NEW.id, NEW.representante_id,
       NEW.data_pedido, NEW.data_pedido + (prazo || ' days')::interval, NEW.total);
  END IF;

  SELECT comissao_percentual, user_id INTO pct, rep_user
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
ALTER TABLE public.nutrir_rdv
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS combustivel_tipo text,
  ADD COLUMN IF NOT EXISTS litros numeric,
  ADD COLUMN IF NOT EXISTS preco_litro numeric,
  ADD COLUMN IF NOT EXISTS hotel_nome text;
-- Enum de status
DO $$ BEGIN
  CREATE TYPE public.campo_teste_status AS ENUM ('em_andamento','finalizado','cancelado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tabela principal: cadastro de campos de teste
CREATE TABLE IF NOT EXISTS public.nutrir_campos_teste (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid,
  representante_id uuid,
  cliente_id uuid NOT NULL,
  propriedade_id uuid,
  titulo text NOT NULL,
  cultura text,
  data_plantio date,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_finalizacao date,
  area_total_ha numeric NOT NULL DEFAULT 0,
  produtos jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{nome, area_ha, dose, observacao}]
  area_geometry jsonb,                          -- polígono opcional
  centroid_lat numeric,
  centroid_lng numeric,
  observacoes text,
  status public.campo_teste_status NOT NULL DEFAULT 'em_andamento',
  relatorio_final_path text,
  relatorio_final_resumo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrir_campos_teste ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ct_org_all ON public.nutrir_campos_teste;
DROP POLICY IF EXISTS ct_org_all ON public.nutrir_campos_teste;
CREATE POLICY ct_org_all ON public.nutrir_campos_teste
  FOR ALL TO authenticated
  USING (is_org_member(organization_id, auth.uid()))
  WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS ct_org_idx ON public.nutrir_campos_teste(organization_id);
CREATE INDEX IF NOT EXISTS ct_cliente_idx ON public.nutrir_campos_teste(cliente_id);

DROP TRIGGER IF EXISTS trg_ct_updated ON public.nutrir_campos_teste;
DROP TRIGGER IF EXISTS trg_ct_updated ON public.nutrir_campos_teste;
CREATE TRIGGER trg_ct_updated BEFORE UPDATE ON public.nutrir_campos_teste
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Tabela de relatórios periódicos
CREATE TABLE IF NOT EXISTS public.nutrir_campos_teste_relatorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  campo_teste_id uuid NOT NULL REFERENCES public.nutrir_campos_teste(id) ON DELETE CASCADE,
  user_id uuid,
  data date NOT NULL DEFAULT CURRENT_DATE,
  estagio text,
  observacoes text,
  fotos jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{path, legenda}]
  ndvi_medio numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrir_campos_teste_relatorios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ctr_org_all ON public.nutrir_campos_teste_relatorios;
DROP POLICY IF EXISTS ctr_org_all ON public.nutrir_campos_teste_relatorios;
CREATE POLICY ctr_org_all ON public.nutrir_campos_teste_relatorios
  FOR ALL TO authenticated
  USING (is_org_member(organization_id, auth.uid()))
  WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS ctr_campo_idx ON public.nutrir_campos_teste_relatorios(campo_teste_id);

-- Bucket privado para fotos
INSERT INTO storage.buckets (id, name, public)
VALUES ('campos-teste-fotos', 'campos-teste-fotos', false)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket: qualquer usuário autenticado da organização pode ler/escrever as próprias pastas
DROP POLICY IF EXISTS ctf_select ON storage.objects;
DROP POLICY IF EXISTS ctf_select ON storage.objects;
CREATE POLICY ctf_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'campos-teste-fotos');

DROP POLICY IF EXISTS ctf_insert ON storage.objects;
DROP POLICY IF EXISTS ctf_insert ON storage.objects;
CREATE POLICY ctf_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campos-teste-fotos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS ctf_delete ON storage.objects;
DROP POLICY IF EXISTS ctf_delete ON storage.objects;
CREATE POLICY ctf_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'campos-teste-fotos' AND (storage.foldername(name))[1] = auth.uid()::text);

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

DROP POLICY IF EXISTS "ndvi campos teste org members select" ON public.nutrir_campos_teste_ndvi;
CREATE POLICY "ndvi campos teste org members select" ON public.nutrir_campos_teste_ndvi FOR SELECT
USING (is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "ndvi campos teste org members insert" ON public.nutrir_campos_teste_ndvi;
CREATE POLICY "ndvi campos teste org members insert" ON public.nutrir_campos_teste_ndvi FOR INSERT
WITH CHECK (is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "ndvi campos teste org members delete" ON public.nutrir_campos_teste_ndvi;
CREATE POLICY "ndvi campos teste org members delete" ON public.nutrir_campos_teste_ndvi FOR DELETE
USING (is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_campos_teste_ndvi_campo_data
  ON public.nutrir_campos_teste_ndvi (campo_teste_id, data DESC);

ALTER TABLE public.nutrir_campos_teste
  ADD COLUMN IF NOT EXISTS variedade text;
ALTER TABLE public.nutrir_pedidos
  ADD COLUMN IF NOT EXISTS assinatura_path text,
  ADD COLUMN IF NOT EXISTS assinatura_nome text,
  ADD COLUMN IF NOT EXISTS assinatura_em timestamptz;

INSERT INTO storage.buckets (id, name, public)
VALUES ('pedidos-assinaturas', 'pedidos-assinaturas', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "pedidos_assin_select" ON storage.objects FOR SELECT
    USING (bucket_id = 'pedidos-assinaturas' AND auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "pedidos_assin_insert" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'pedidos-assinaturas' AND auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "pedidos_assin_update" ON storage.objects FOR UPDATE
    USING (bucket_id = 'pedidos-assinaturas' AND auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "pedidos_assin_delete" ON storage.objects FOR DELETE
    USING (bucket_id = 'pedidos-assinaturas' AND auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
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
DROP POLICY IF EXISTS "fc_org_all" ON public.nutrir_financeiro_contas;
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
DROP POLICY IF EXISTS "fcat_org_all" ON public.nutrir_financeiro_categorias;
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
DROP POLICY IF EXISTS "fl_org_all" ON public.nutrir_financeiro_lancamentos;
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
DROP POLICY IF EXISTS "crm_org_all" ON public.nutrir_crm_oportunidades;
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
DROP POLICY IF EXISTS "crm_int_org_all" ON public.nutrir_crm_interacoes;
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
DROP POLICY IF EXISTS "lote_org_all" ON public.nutrir_estoque_lotes;
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
DROP POLICY IF EXISTS "rom_org_all" ON public.nutrir_romaneios;
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
DROP POLICY IF EXISTS "pt_org_manage" ON public.nutrir_portal_tokens;
CREATE POLICY "pt_org_manage" ON public.nutrir_portal_tokens FOR ALL TO authenticated
USING (is_org_member(organization_id, auth.uid())) WITH CHECK (is_org_member(organization_id, auth.uid()));

DROP TRIGGER IF EXISTS trg_crm_op_upd ON public.nutrir_crm_oportunidades;
CREATE TRIGGER trg_crm_op_upd BEFORE UPDATE ON public.nutrir_crm_oportunidades
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_lote_upd ON public.nutrir_estoque_lotes;
CREATE TRIGGER trg_lote_upd BEFORE UPDATE ON public.nutrir_estoque_lotes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_rom_upd ON public.nutrir_romaneios;
CREATE TRIGGER trg_rom_upd BEFORE UPDATE ON public.nutrir_romaneios
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO storage.buckets (id, name, public)
VALUES ('produto-imagens', 'produto-imagens', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "produto_imagens_public_read" ON storage.objects;
CREATE POLICY "produto_imagens_public_read" ON storage.objects FOR SELECT
USING (bucket_id = 'produto-imagens');

DROP POLICY IF EXISTS "produto_imagens_auth_insert" ON storage.objects;
CREATE POLICY "produto_imagens_auth_insert" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'produto-imagens');

DROP POLICY IF EXISTS "produto_imagens_auth_update" ON storage.objects;
CREATE POLICY "produto_imagens_auth_update" ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'produto-imagens');

DROP POLICY IF EXISTS "produto_imagens_auth_delete" ON storage.objects;
CREATE POLICY "produto_imagens_auth_delete" ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'produto-imagens');
-- Adicionar campos para o novo formulário de pedido
ALTER TABLE public.nutrir_pedidos
  ADD COLUMN IF NOT EXISTS tipo_venda text,
  ADD COLUMN IF NOT EXISTS condicao_pagamento text,
  ADD COLUMN IF NOT EXISTS data_vencimento date;

-- Validação leve por trigger (evita CHECK imutável)
CREATE OR REPLACE FUNCTION public.validate_pedido_tipo_venda()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_venda IS NOT NULL AND NEW.tipo_venda NOT IN ('b2b','grupo_compra','revenda','venda_direta') THEN
    RAISE EXCEPTION 'tipo_venda inválido: %', NEW.tipo_venda;
  END IF;
  IF NEW.condicao_pagamento IS NOT NULL AND NEW.condicao_pagamento NOT IN ('a_vista','a_prazo') THEN
    RAISE EXCEPTION 'condicao_pagamento inválido: %', NEW.condicao_pagamento;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_pedido_tipo_venda ON public.nutrir_pedidos;
CREATE TRIGGER trg_validate_pedido_tipo_venda
BEFORE INSERT OR UPDATE ON public.nutrir_pedidos
FOR EACH ROW EXECUTE FUNCTION public.validate_pedido_tipo_venda();
-- Enum dos 6 cargos visíveis ao usuário final
DO $$ BEGIN
  CREATE TYPE public.position_type AS ENUM (
    'proprietario','diretor','gerente','representante','assistente_tecnico','cliente'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  position position_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.user_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_positions_read" ON public.user_positions;
DROP POLICY IF EXISTS "user_positions_read" ON public.user_positions;
CREATE POLICY "user_positions_read" ON public.user_positions
  FOR SELECT USING (is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "user_positions_admin_write" ON public.user_positions;
DROP POLICY IF EXISTS "user_positions_admin_write" ON public.user_positions;
CREATE POLICY "user_positions_admin_write" ON public.user_positions
  FOR ALL USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

DROP TRIGGER IF EXISTS touch_user_positions ON public.user_positions;
DROP TRIGGER IF EXISTS touch_user_positions ON public.user_positions;
CREATE TRIGGER touch_user_positions BEFORE UPDATE ON public.user_positions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.get_user_position(_org uuid, _user uuid)
RETURNS position_type LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT position FROM public.user_positions
  WHERE organization_id=_org AND user_id=_user LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_position(_org uuid, _user uuid, _positions position_type[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_positions
    WHERE organization_id=_org AND user_id=_user AND position=ANY(_positions));
$$;

-- Bootstrap: marcar owners como 'proprietario'
INSERT INTO public.user_positions (organization_id, user_id, position)
SELECT organization_id, user_id, 'proprietario'::position_type
FROM public.organization_members WHERE role='owner'
ON CONFLICT (organization_id, user_id) DO NOTHING;