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
CREATE POLICY "signup_self_read" ON public.signup_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins/owners podem ver/atualizar requests da própria org OU sem org (pendentes globais)
CREATE POLICY "signup_admin_read" ON public.signup_requests
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[])
  );

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