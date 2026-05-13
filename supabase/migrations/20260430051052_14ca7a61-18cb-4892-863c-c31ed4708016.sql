-- Tabela
CREATE TABLE public.notifications (
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

CREATE INDEX idx_notifications_org_user ON public.notifications (organization_id, user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications (user_id, read_at) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS: ver
CREATE POLICY notif_member_read ON public.notifications
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (user_id = auth.uid() OR user_id IS NULL)
  );

-- RLS: marcar como lida (UPDATE apenas read_at)
CREATE POLICY notif_self_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (user_id = auth.uid() OR user_id IS NULL)
  );

-- Sem INSERT/DELETE para usuários comuns; só funções SECURITY DEFINER

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
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
CREATE TRIGGER trg_notify_on_new_member
AFTER INSERT ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_member();