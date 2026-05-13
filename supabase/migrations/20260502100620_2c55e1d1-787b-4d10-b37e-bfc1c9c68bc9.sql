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
CREATE POLICY "user_positions_read" ON public.user_positions
  FOR SELECT USING (is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "user_positions_admin_write" ON public.user_positions;
CREATE POLICY "user_positions_admin_write" ON public.user_positions
  FOR ALL USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

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