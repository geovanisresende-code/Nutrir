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