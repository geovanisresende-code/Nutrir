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
CREATE POLICY "audit_select_org" ON public.nutrir_auditoria_status
  FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','member','viewer']::app_role[]));

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