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
CREATE POLICY prop_org_all ON public.nutrir_cliente_propriedades
  FOR ALL TO authenticated
  USING (is_org_member(organization_id, auth.uid()))
  WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_prop_cliente ON public.nutrir_cliente_propriedades(cliente_id);

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
CREATE POLICY ouv_select ON public.nutrir_ouvidoria
  FOR SELECT TO authenticated
  USING (
    is_org_member(organization_id, auth.uid())
    AND (user_id = auth.uid()
         OR has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
  );

DROP POLICY IF EXISTS ouv_insert ON public.nutrir_ouvidoria;
CREATE POLICY ouv_insert ON public.nutrir_ouvidoria
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());

DROP POLICY IF EXISTS ouv_update_admin ON public.nutrir_ouvidoria;
CREATE POLICY ouv_update_admin ON public.nutrir_ouvidoria
  FOR UPDATE TO authenticated
  USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

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
    );
  END LOOP;
  RETURN NEW;
END $fn$;

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
CREATE POLICY vis_select ON public.nutrir_visitas
  FOR SELECT TO authenticated
  USING (
    is_org_member(organization_id, auth.uid())
    AND (user_id = auth.uid()
         OR has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
  );

DROP POLICY IF EXISTS vis_insert ON public.nutrir_visitas;
CREATE POLICY vis_insert ON public.nutrir_visitas
  FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());

DROP POLICY IF EXISTS vis_update_own ON public.nutrir_visitas;
CREATE POLICY vis_update_own ON public.nutrir_visitas
  FOR UPDATE TO authenticated
  USING (
    is_org_member(organization_id, auth.uid())
    AND (user_id = auth.uid()
         OR has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
  );

DROP POLICY IF EXISTS vis_delete_admin ON public.nutrir_visitas;
CREATE POLICY vis_delete_admin ON public.nutrir_visitas
  FOR DELETE TO authenticated
  USING (has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

CREATE INDEX IF NOT EXISTS idx_visitas_org_user ON public.nutrir_visitas(organization_id, user_id, data_visita DESC);

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
CREATE POLICY visitas_fotos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'visitas-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS visitas_fotos_insert ON storage.objects;
CREATE POLICY visitas_fotos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'visitas-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);

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