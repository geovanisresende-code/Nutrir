INSERT INTO storage.buckets (id, name, public)
VALUES ('produto-imagens', 'produto-imagens', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "produto_imagens_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'produto-imagens');

CREATE POLICY "produto_imagens_auth_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'produto-imagens');

CREATE POLICY "produto_imagens_auth_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'produto-imagens');

CREATE POLICY "produto_imagens_auth_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'produto-imagens');