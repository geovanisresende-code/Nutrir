-- Audit log table
CREATE TABLE public.audit_log (
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

CREATE POLICY "audit_admin_read" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE POLICY "audit_member_insert" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());

CREATE INDEX idx_audit_org_date ON public.audit_log (organization_id, created_at DESC);
CREATE INDEX idx_audit_client ON public.audit_log (client_id, created_at DESC);
CREATE INDEX idx_audit_field ON public.audit_log (field_id, created_at DESC);
CREATE INDEX idx_audit_entity ON public.audit_log (entity_type, entity_id);