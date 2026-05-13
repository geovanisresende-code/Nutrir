
-- ENUMs
DO $$ BEGIN CREATE TYPE public.nutrir_cargo AS ENUM ('diretor','gerente_regional','rtv','at','consultor','representante'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.nutrir_veiculo_tipo AS ENUM ('empresa','locado','particular','sem_veiculo'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Colaboradores hierárquicos
CREATE TABLE IF NOT EXISTS public.nutrir_colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  superior_id UUID REFERENCES public.nutrir_colaboradores(id) ON DELETE SET NULL,
  cargo public.nutrir_cargo NOT NULL,
  nome TEXT NOT NULL,
  razao_social TEXT,
  cpf_cnpj TEXT,
  registro_core TEXT,
  email TEXT,
  telefone TEXT,
  regional_id UUID REFERENCES public.nutrir_regionais(id) ON DELETE SET NULL,
  ajuda_custo NUMERIC DEFAULT 0,
  adiantamento NUMERIC DEFAULT 0,
  comissao_base_pct NUMERIC DEFAULT 0,
  meta_mensal NUMERIC DEFAULT 0,
  bonus_meta_pct NUMERIC DEFAULT 0,
  veiculo_tipo public.nutrir_veiculo_tipo DEFAULT 'sem_veiculo',
  veiculo_modelo TEXT,
  veiculo_placa TEXT,
  veiculo_valor NUMERIC,
  veiculo_aluguel_mensal NUMERIC,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nutrir_colab_org ON public.nutrir_colaboradores(organization_id);
CREATE INDEX IF NOT EXISTS idx_nutrir_colab_superior ON public.nutrir_colaboradores(superior_id);
CREATE INDEX IF NOT EXISTS idx_nutrir_colab_user ON public.nutrir_colaboradores(user_id);
ALTER TABLE public.nutrir_colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nutrir_colab_read" ON public.nutrir_colaboradores;
CREATE POLICY "nutrir_colab_read" ON public.nutrir_colaboradores FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));
DROP POLICY IF EXISTS "nutrir_colab_write" ON public.nutrir_colaboradores;
CREATE POLICY "nutrir_colab_write" ON public.nutrir_colaboradores FOR ALL TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::app_role[]));
DROP TRIGGER IF EXISTS trg_nutrir_colab_touch ON public.nutrir_colaboradores;
CREATE TRIGGER trg_nutrir_colab_touch BEFORE UPDATE ON public.nutrir_colaboradores
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.has_nutrir_cargo(_org uuid, _user uuid, _cargos public.nutrir_cargo[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.nutrir_colaboradores
    WHERE organization_id = _org AND user_id = _user AND ativo = true AND cargo = ANY(_cargos));
$$;

-- Catálogos globais
CREATE TABLE IF NOT EXISTS public.nutrir_consultoria_culturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  produtividade_kg_ha NUMERIC DEFAULT 0,
  unidade_comercial TEXT,
  peso_unidade_kg NUMERIC,
  preco_unidade NUMERIC,
  rendimento_bruto_ha NUMERIC DEFAULT 0,
  fonte TEXT,
  grid_minimo NUMERIC DEFAULT 5,
  categoria TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrir_consultoria_culturas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nutrir_cc_read" ON public.nutrir_consultoria_culturas;
CREATE POLICY "nutrir_cc_read" ON public.nutrir_consultoria_culturas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "nutrir_cc_write" ON public.nutrir_consultoria_culturas;
CREATE POLICY "nutrir_cc_write" ON public.nutrir_consultoria_culturas FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP TRIGGER IF EXISTS trg_nutrir_cc_touch ON public.nutrir_consultoria_culturas;
CREATE TRIGGER trg_nutrir_cc_touch BEFORE UPDATE ON public.nutrir_consultoria_culturas
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.nutrir_cultura_demanda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cultura_id UUID NOT NULL REFERENCES public.nutrir_culturas(id) ON DELETE CASCADE,
  nutriente_id UUID NOT NULL REFERENCES public.nutrir_nutrientes(id) ON DELETE CASCADE,
  extracao_kg_ton NUMERIC DEFAULT 0,
  exportacao_kg_ton NUMERIC DEFAULT 0,
  produtividade_referencia_kg NUMERIC,
  unidade_referencia TEXT,
  fator_kg NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cultura_id, nutriente_id)
);
ALTER TABLE public.nutrir_cultura_demanda ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nutrir_cd_read" ON public.nutrir_cultura_demanda;
CREATE POLICY "nutrir_cd_read" ON public.nutrir_cultura_demanda FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "nutrir_cd_write" ON public.nutrir_cultura_demanda;
CREATE POLICY "nutrir_cd_write" ON public.nutrir_cultura_demanda FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.nutrir_nutriente_sal_padrao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nutriente_id UUID NOT NULL REFERENCES public.nutrir_nutrientes(id) ON DELETE CASCADE,
  materia_prima_id UUID NOT NULL REFERENCES public.nutrir_materias_primas(id) ON DELETE CASCADE,
  garantia_percentual NUMERIC DEFAULT 0,
  fator_conversao NUMERIC DEFAULT 1,
  padrao BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrir_nutriente_sal_padrao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nutrir_nsp_read" ON public.nutrir_nutriente_sal_padrao;
CREATE POLICY "nutrir_nsp_read" ON public.nutrir_nutriente_sal_padrao FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "nutrir_nsp_write" ON public.nutrir_nutriente_sal_padrao;
CREATE POLICY "nutrir_nsp_write" ON public.nutrir_nutriente_sal_padrao FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.nutrir_mp_incompatibilidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  materia_prima_a_id UUID NOT NULL REFERENCES public.nutrir_materias_primas(id) ON DELETE CASCADE,
  materia_prima_b_id UUID NOT NULL REFERENCES public.nutrir_materias_primas(id) ON DELETE CASCADE,
  severidade TEXT NOT NULL DEFAULT 'aviso',
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrir_mp_incompatibilidade ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nutrir_mpi_read" ON public.nutrir_mp_incompatibilidade;
CREATE POLICY "nutrir_mpi_read" ON public.nutrir_mp_incompatibilidade FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "nutrir_mpi_write" ON public.nutrir_mp_incompatibilidade;
CREATE POLICY "nutrir_mpi_write" ON public.nutrir_mp_incompatibilidade FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Colunas que faltam
ALTER TABLE public.nutrir_materias_primas ADD COLUMN IF NOT EXISTS tipo TEXT;
ALTER TABLE public.nutrir_materias_primas ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo';
ALTER TABLE public.nutrir_materias_primas ADD COLUMN IF NOT EXISTS imagem_url TEXT;
ALTER TABLE public.nutrir_materias_primas ADD COLUMN IF NOT EXISTS compatibilidade TEXT;
ALTER TABLE public.nutrir_regionais       ADD COLUMN IF NOT EXISTS multiplicador NUMERIC DEFAULT 1.0;
ALTER TABLE public.nutrir_embalagens      ADD COLUMN IF NOT EXISTS multiplicador NUMERIC DEFAULT 1.0;
ALTER TABLE public.nutrir_modalidades     ADD COLUMN IF NOT EXISTS multiplicador NUMERIC DEFAULT 1.0;
ALTER TABLE public.nutrir_modalidades     ADD COLUMN IF NOT EXISTS tipo_negociacao TEXT;
ALTER TABLE public.nutrir_produtos        ADD COLUMN IF NOT EXISTS tipos_negociacao_permitidos JSONB;
ALTER TABLE public.nutrir_produtos        ADD COLUMN IF NOT EXISTS imagem_url TEXT;
ALTER TABLE public.nutrir_regras_calculo  ADD COLUMN IF NOT EXISTS valor_numerico NUMERIC;
ALTER TABLE public.nutrir_regras_calculo  ADD COLUMN IF NOT EXISTS valor_texto TEXT;
ALTER TABLE public.nutrir_regras_calculo  ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE public.nutrir_regras_calculo  ADD COLUMN IF NOT EXISTS editavel BOOLEAN DEFAULT true;
ALTER TABLE public.nutrir_regras_calculo  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.nutrir_estagios        ADD COLUMN IF NOT EXISTS percentual_dose NUMERIC;
ALTER TABLE public.nutrir_estagios        ADD COLUMN IF NOT EXISTS volume_min_l_ha NUMERIC;
ALTER TABLE public.nutrir_estagios        ADD COLUMN IF NOT EXISTS volume_max_l_ha NUMERIC;
ALTER TABLE public.nutrir_estagios        ADD COLUMN IF NOT EXISTS periodo TEXT;
ALTER TABLE public.nutrir_estagios        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.nutrir_nutrientes      ADD COLUMN IF NOT EXISTS categoria TEXT;
