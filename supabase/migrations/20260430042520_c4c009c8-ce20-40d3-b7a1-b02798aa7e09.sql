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
CREATE POLICY diag_org_all ON public.ai_image_diagnoses FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_diag_org ON public.ai_image_diagnoses(organization_id, created_at DESC);

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('plant-photos', 'plant-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "plant_photos_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'plant-photos' AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));
CREATE POLICY "plant_photos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'plant-photos' AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));
CREATE POLICY "plant_photos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'plant-photos' AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));