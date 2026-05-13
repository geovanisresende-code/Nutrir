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
CREATE POLICY "reports_select_org" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'reports'
    AND is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "reports_insert_org" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reports'
    AND is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "reports_delete_org" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'reports'
    AND is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );