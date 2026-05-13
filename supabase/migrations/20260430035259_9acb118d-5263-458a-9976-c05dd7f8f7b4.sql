
-- 1) organizations: token Mapbox
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS mapbox_token text;

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
CREATE POLICY clients_org_all ON public.clients
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
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
CREATE POLICY routes_org_all ON public.collection_routes
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
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
CREATE POLICY points_org_all ON public.collection_points
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_points_org ON public.collection_points(organization_id);
CREATE INDEX IF NOT EXISTS idx_points_route ON public.collection_points(route_id);

-- 5) fields & soil_samples: vincular cliente
ALTER TABLE public.fields ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE public.soil_samples ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE public.soil_samples ADD COLUMN IF NOT EXISTS point_id uuid;
