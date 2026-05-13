-- Enum de status
DO $$ BEGIN
  CREATE TYPE public.campo_teste_status AS ENUM ('em_andamento','finalizado','cancelado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tabela principal: cadastro de campos de teste
CREATE TABLE IF NOT EXISTS public.nutrir_campos_teste (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid,
  representante_id uuid,
  cliente_id uuid NOT NULL,
  propriedade_id uuid,
  titulo text NOT NULL,
  cultura text,
  data_plantio date,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_finalizacao date,
  area_total_ha numeric NOT NULL DEFAULT 0,
  produtos jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{nome, area_ha, dose, observacao}]
  area_geometry jsonb,                          -- polígono opcional
  centroid_lat numeric,
  centroid_lng numeric,
  observacoes text,
  status public.campo_teste_status NOT NULL DEFAULT 'em_andamento',
  relatorio_final_path text,
  relatorio_final_resumo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrir_campos_teste ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ct_org_all ON public.nutrir_campos_teste;
CREATE POLICY ct_org_all ON public.nutrir_campos_teste
  FOR ALL TO authenticated
  USING (is_org_member(organization_id, auth.uid()))
  WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS ct_org_idx ON public.nutrir_campos_teste(organization_id);
CREATE INDEX IF NOT EXISTS ct_cliente_idx ON public.nutrir_campos_teste(cliente_id);

DROP TRIGGER IF EXISTS trg_ct_updated ON public.nutrir_campos_teste;
CREATE TRIGGER trg_ct_updated BEFORE UPDATE ON public.nutrir_campos_teste
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Tabela de relatórios periódicos
CREATE TABLE IF NOT EXISTS public.nutrir_campos_teste_relatorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  campo_teste_id uuid NOT NULL REFERENCES public.nutrir_campos_teste(id) ON DELETE CASCADE,
  user_id uuid,
  data date NOT NULL DEFAULT CURRENT_DATE,
  estagio text,
  observacoes text,
  fotos jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{path, legenda}]
  ndvi_medio numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrir_campos_teste_relatorios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ctr_org_all ON public.nutrir_campos_teste_relatorios;
CREATE POLICY ctr_org_all ON public.nutrir_campos_teste_relatorios
  FOR ALL TO authenticated
  USING (is_org_member(organization_id, auth.uid()))
  WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS ctr_campo_idx ON public.nutrir_campos_teste_relatorios(campo_teste_id);

-- Bucket privado para fotos
INSERT INTO storage.buckets (id, name, public)
VALUES ('campos-teste-fotos', 'campos-teste-fotos', false)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket: qualquer usuário autenticado da organização pode ler/escrever as próprias pastas
DROP POLICY IF EXISTS ctf_select ON storage.objects;
CREATE POLICY ctf_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'campos-teste-fotos');

DROP POLICY IF EXISTS ctf_insert ON storage.objects;
CREATE POLICY ctf_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campos-teste-fotos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS ctf_delete ON storage.objects;
CREATE POLICY ctf_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'campos-teste-fotos' AND (storage.foldername(name))[1] = auth.uid()::text);