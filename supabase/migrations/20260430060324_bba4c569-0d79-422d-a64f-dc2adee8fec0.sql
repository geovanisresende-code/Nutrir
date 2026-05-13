
-- ============================================================
-- PROGRAMA NUTRIR — schema multi-tenant
-- Tabelas com prefixo nutrir_ (e algumas globais como nutrientes/culturas)
-- ============================================================

-- Enum de papéis específico do Nutrir (admin/gerente comercial/representante/vendedor)
DO $$ BEGIN
  CREATE TYPE public.nutrir_role AS ENUM ('admin','gerente','representante','vendedor','consultor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- USUÁRIOS DO NUTRIR (perfil comercial dentro de uma org)
-- ============================================================
CREATE TABLE public.nutrir_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.nutrir_role NOT NULL DEFAULT 'vendedor',
  nome TEXT,
  email TEXT,
  telefone TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX idx_nutrir_users_org ON public.nutrir_users(organization_id);
CREATE INDEX idx_nutrir_users_user ON public.nutrir_users(user_id);
ALTER TABLE public.nutrir_users ENABLE ROW LEVEL SECURITY;

-- Helper: verifica papel dentro do nutrir
CREATE OR REPLACE FUNCTION public.has_nutrir_role(_org uuid, _user uuid, _roles public.nutrir_role[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.nutrir_users
    WHERE organization_id = _org AND user_id = _user AND ativo = true AND role = ANY(_roles)
  );
$$;

CREATE POLICY "nutrir_users_org_read" ON public.nutrir_users
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()));

CREATE POLICY "nutrir_users_admin_write" ON public.nutrir_users
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]))
  WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

-- ============================================================
-- CATÁLOGOS BASE
-- ============================================================
CREATE TABLE public.nutrir_regionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  uf TEXT,
  descricao TEXT,
  custo_adicional_litro NUMERIC(10,4) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, nome)
);

CREATE TABLE public.nutrir_modalidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  prazo_dias INTEGER,
  tipo TEXT,
  margens_por_categoria JSONB DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, nome)
);

CREATE TABLE public.nutrir_embalagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  volume NUMERIC(10,3),
  unidade TEXT NOT NULL DEFAULT 'L',
  custo_adicional_litro NUMERIC(10,4) NOT NULL DEFAULT 0,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Culturas: GLOBAL (compartilhado entre orgs)
CREATE TABLE public.nutrir_culturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  nome_cientifico TEXT,
  ciclo_dias INTEGER,
  imagem_url TEXT,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.nutrir_estagios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cultura_id UUID NOT NULL REFERENCES public.nutrir_culturas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  descricao TEXT,
  dias_apos_plantio_min INTEGER,
  dias_apos_plantio_max INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cultura_id, nome)
);

-- Nutrientes: GLOBAL
CREATE TABLE public.nutrir_nutrientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simbolo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  unidade_padrao TEXT NOT NULL DEFAULT 'gr/ha',
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO public.nutrir_nutrientes (simbolo, nome, unidade_padrao, ordem) VALUES
  ('Mn','Manganês','gr/ha',1),('Mg','Magnésio','gr/ha',2),('Zn','Zinco','gr/ha',3),
  ('Cu','Cobre','gr/ha',4),('P','Fósforo','gr/ha',5),('K','Potássio','gr/ha',6),
  ('B','Boro','gr/ha',7),('N','Nitrogênio (foliar)','gr/ha',8),('Ca','Cálcio','gr/ha',9),
  ('S','Enxofre','gr/ha',10),('Co','Cobalto','gr/ha',11),('Mo','Molibdênio','gr/ha',12),
  ('Ni','Níquel','gr/ha',13),('Se','Selênio','gr/ha',14),('Si','Silício','gr/ha',15),
  ('Fe','Ferro','gr/ha',16),('N_solo','Nitrogênio (solo)','kg/ha',17);

-- ============================================================
-- COMERCIAL
-- ============================================================
CREATE TABLE public.nutrir_representantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf TEXT,
  regional_id UUID REFERENCES public.nutrir_regionais(id) ON DELETE SET NULL,
  comissao_percentual NUMERIC(5,2) DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nutrir_rep_org ON public.nutrir_representantes(organization_id);
CREATE INDEX idx_nutrir_rep_user ON public.nutrir_representantes(user_id);

CREATE TABLE public.nutrir_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  -- ligação opcional ao client genérico do app (mapas)
  client_id UUID,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  inscricao_estadual TEXT,
  email TEXT,
  telefone TEXT,
  whatsapp TEXT,
  contato_nome TEXT,
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  regional_id UUID REFERENCES public.nutrir_regionais(id) ON DELETE SET NULL,
  representante_id UUID REFERENCES public.nutrir_representantes(id) ON DELETE SET NULL,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nutrir_cli_org ON public.nutrir_clientes(organization_id);
CREATE INDEX idx_nutrir_cli_rep ON public.nutrir_clientes(representante_id);

-- ============================================================
-- PRODUTOS
-- ============================================================
CREATE TABLE public.nutrir_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  codigo TEXT,
  nome TEXT NOT NULL,
  classificacao TEXT,
  categoria TEXT CHECK (categoria IN ('DIAMANTE','OURO','PRATA','BRONZE') OR categoria IS NULL),
  linha TEXT,
  descricao TEXT,
  modo_aplicacao TEXT,
  dose_recomendada TEXT,
  recomendacao_uso TEXT,
  custo_industria NUMERIC(12,4),
  compatibilidade TEXT,
  armazenamento TEXT,
  registro_mapa TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nutrir_prod_org ON public.nutrir_produtos(organization_id);
CREATE INDEX idx_nutrir_prod_cat ON public.nutrir_produtos(categoria);

CREATE TABLE public.nutrir_produto_garantias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.nutrir_produtos(id) ON DELETE CASCADE,
  nutriente_id UUID NOT NULL REFERENCES public.nutrir_nutrientes(id) ON DELETE RESTRICT,
  teor NUMERIC(10,4) NOT NULL,
  unidade TEXT NOT NULL DEFAULT '%',
  observacao TEXT,
  UNIQUE (produto_id, nutriente_id)
);

CREATE TABLE public.nutrir_produto_imagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.nutrir_produtos(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  principal BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE public.nutrir_produto_recomendacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.nutrir_produtos(id) ON DELETE CASCADE,
  cultura_id UUID NOT NULL REFERENCES public.nutrir_culturas(id) ON DELETE CASCADE,
  estagio_id UUID REFERENCES public.nutrir_estagios(id) ON DELETE SET NULL,
  dosagem_min NUMERIC(10,3),
  dosagem_max NUMERIC(10,3),
  unidade TEXT NOT NULL DEFAULT 'L/ha',
  numero_aplicacoes INTEGER,
  intervalo_dias INTEGER,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MATÉRIAS-PRIMAS
-- ============================================================
CREATE TABLE public.nutrir_materias_primas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  codigo TEXT,
  nome TEXT NOT NULL,
  fornecedor TEXT,
  embalagem_id UUID REFERENCES public.nutrir_embalagens(id) ON DELETE SET NULL,
  preco_atual NUMERIC(12,4),
  unidade_preco TEXT NOT NULL DEFAULT 'kg',
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nutrir_mp_org ON public.nutrir_materias_primas(organization_id);

CREATE TABLE public.nutrir_mp_garantias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  materia_prima_id UUID NOT NULL REFERENCES public.nutrir_materias_primas(id) ON DELETE CASCADE,
  nutriente_id UUID NOT NULL REFERENCES public.nutrir_nutrientes(id) ON DELETE RESTRICT,
  teor NUMERIC(10,4) NOT NULL,
  unidade TEXT NOT NULL DEFAULT '%',
  UNIQUE (materia_prima_id, nutriente_id)
);

-- ============================================================
-- FORMULAÇÕES
-- ============================================================
CREATE TABLE public.nutrir_formulacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  codigo TEXT,
  nome TEXT NOT NULL,
  descricao TEXT,
  produto_id UUID REFERENCES public.nutrir_produtos(id) ON DELETE SET NULL,
  rendimento_total NUMERIC(12,3),
  unidade_rendimento TEXT DEFAULT 'kg',
  custo_estimado NUMERIC(12,4),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nutrir_form_org ON public.nutrir_formulacoes(organization_id);

CREATE TABLE public.nutrir_formulacao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formulacao_id UUID NOT NULL REFERENCES public.nutrir_formulacoes(id) ON DELETE CASCADE,
  materia_prima_id UUID NOT NULL REFERENCES public.nutrir_materias_primas(id) ON DELETE RESTRICT,
  quantidade NUMERIC(12,4) NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'kg',
  percentual NUMERIC(7,4),
  ordem INTEGER NOT NULL DEFAULT 0,
  observacao TEXT
);

-- ============================================================
-- PREÇOS
-- ============================================================
CREATE TABLE public.nutrir_precos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.nutrir_produtos(id) ON DELETE CASCADE,
  embalagem_id UUID REFERENCES public.nutrir_embalagens(id) ON DELETE SET NULL,
  regional_id UUID REFERENCES public.nutrir_regionais(id) ON DELETE SET NULL,
  modalidade_id UUID REFERENCES public.nutrir_modalidades(id) ON DELETE SET NULL,
  preco NUMERIC(12,4) NOT NULL,
  moeda TEXT NOT NULL DEFAULT 'BRL',
  vigencia_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  vigencia_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nutrir_precos_org ON public.nutrir_precos(organization_id);
CREATE INDEX idx_nutrir_precos_prod ON public.nutrir_precos(produto_id);
CREATE UNIQUE INDEX uniq_nutrir_precos
  ON public.nutrir_precos (organization_id, produto_id, regional_id, modalidade_id, embalagem_id) NULLS NOT DISTINCT;

-- ============================================================
-- ORÇAMENTO CONSULTORIA
-- ============================================================
CREATE TABLE public.nutrir_parametros_consultoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  custo_amostra NUMERIC(12,4) NOT NULL DEFAULT 50,
  meta_lucratividade NUMERIC(5,2) NOT NULL DEFAULT 30,
  rendimento_ref_soja NUMERIC(12,4) NOT NULL DEFAULT 8000,
  piso_amostra NUMERIC(12,4) NOT NULL DEFAULT 60,
  piso_hectare NUMERIC(12,4) NOT NULL DEFAULT 8,
  grid_min_cereais NUMERIC(8,2) NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.nutrir_orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.nutrir_clientes(id) ON DELETE SET NULL,
  -- ligação opcional ao client genérico do app
  client_id UUID,
  representante_id UUID REFERENCES public.nutrir_representantes(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho, enviado, aprovado, rejeitado
  parametros JSONB NOT NULL,
  total_geral NUMERIC(14,2) NOT NULL DEFAULT 0,
  area_total_ha NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nutrir_orc_org ON public.nutrir_orcamentos(organization_id);
CREATE INDEX idx_nutrir_orc_cli ON public.nutrir_orcamentos(cliente_id);

CREATE TABLE public.nutrir_orcamento_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES public.nutrir_orcamentos(id) ON DELETE CASCADE,
  -- INTEGRAÇÃO COM MAPAS: cada item pode vir de um talhão (field)
  field_id UUID,
  cultura_id UUID REFERENCES public.nutrir_culturas(id) ON DELETE SET NULL,
  cultura_nome TEXT NOT NULL,
  area_ha NUMERIC(12,2) NOT NULL,
  metodo_amostragem TEXT NOT NULL DEFAULT 'grade',  -- 'grade' | 'talhoes'
  grid_ha NUMERIC(8,2) NOT NULL DEFAULT 5,
  numero_talhoes INTEGER NOT NULL DEFAULT 0,
  amostras_por_talhao INTEGER NOT NULL DEFAULT 1,
  numero_amostragens INTEGER NOT NULL DEFAULT 1,
  total_amostras INTEGER NOT NULL DEFAULT 0,
  valor_amostra NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_ha NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nutrir_orc_item ON public.nutrir_orcamento_itens(orcamento_id);

-- ============================================================
-- PEDIDOS
-- ============================================================
CREATE TABLE public.nutrir_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  numero TEXT,
  cliente_id UUID REFERENCES public.nutrir_clientes(id) ON DELETE SET NULL,
  representante_id UUID REFERENCES public.nutrir_representantes(id) ON DELETE SET NULL,
  regional_id UUID REFERENCES public.nutrir_regionais(id) ON DELETE SET NULL,
  modalidade_id UUID REFERENCES public.nutrir_modalidades(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  data_pedido DATE NOT NULL DEFAULT CURRENT_DATE,
  data_entrega DATE,
  observacoes TEXT,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nutrir_ped_org ON public.nutrir_pedidos(organization_id);
CREATE INDEX idx_nutrir_ped_cli ON public.nutrir_pedidos(cliente_id);

CREATE TABLE public.nutrir_pedido_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.nutrir_pedidos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.nutrir_produtos(id),
  embalagem_id UUID REFERENCES public.nutrir_embalagens(id),
  quantidade NUMERIC(12,3) NOT NULL,
  preco_unitario NUMERIC(12,4) NOT NULL,
  desconto_pct NUMERIC(5,2) DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- ENABLE RLS + POLICIES (modelo: membros da org leem; admin/gerente gerenciam)
-- ============================================================
ALTER TABLE public.nutrir_regionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_modalidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_embalagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_culturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_estagios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_nutrientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_representantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_produto_garantias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_produto_imagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_produto_recomendacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_materias_primas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_mp_garantias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_formulacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_formulacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_precos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_parametros_consultoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_orcamento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrir_pedido_itens ENABLE ROW LEVEL SECURITY;

-- Catálogos GLOBAIS (culturas/estagios/nutrientes): leitura para todos autenticados
CREATE POLICY "nutrir_culturas_read" ON public.nutrir_culturas FOR SELECT TO authenticated USING (true);
CREATE POLICY "nutrir_estagios_read" ON public.nutrir_estagios FOR SELECT TO authenticated USING (true);
CREATE POLICY "nutrir_nutrientes_read" ON public.nutrir_nutrientes FOR SELECT TO authenticated USING (true);

-- Catálogos por org: membros leem; admin/gerente escrevem
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'nutrir_regionais','nutrir_modalidades','nutrir_embalagens',
    'nutrir_representantes','nutrir_clientes',
    'nutrir_produtos','nutrir_materias_primas','nutrir_formulacoes','nutrir_precos',
    'nutrir_orcamentos','nutrir_pedidos'
  ])
  LOOP
    EXECUTE format('CREATE POLICY "%1$s_read" ON public.%1$I FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()))', t);
    EXECUTE format('CREATE POLICY "%1$s_write" ON public.%1$I FOR ALL TO authenticated USING (is_org_member(organization_id, auth.uid())) WITH CHECK (is_org_member(organization_id, auth.uid()))', t);
  END LOOP;
END $$;

-- Itens (herdam segurança via parent)
CREATE POLICY "nutrir_prod_gar_all" ON public.nutrir_produto_garantias FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM nutrir_produtos p WHERE p.id = produto_id AND is_org_member(p.organization_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM nutrir_produtos p WHERE p.id = produto_id AND is_org_member(p.organization_id, auth.uid())));

CREATE POLICY "nutrir_prod_img_all" ON public.nutrir_produto_imagens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM nutrir_produtos p WHERE p.id = produto_id AND is_org_member(p.organization_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM nutrir_produtos p WHERE p.id = produto_id AND is_org_member(p.organization_id, auth.uid())));

CREATE POLICY "nutrir_prod_rec_all" ON public.nutrir_produto_recomendacoes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM nutrir_produtos p WHERE p.id = produto_id AND is_org_member(p.organization_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM nutrir_produtos p WHERE p.id = produto_id AND is_org_member(p.organization_id, auth.uid())));

CREATE POLICY "nutrir_mp_gar_all" ON public.nutrir_mp_garantias FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM nutrir_materias_primas m WHERE m.id = materia_prima_id AND is_org_member(m.organization_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM nutrir_materias_primas m WHERE m.id = materia_prima_id AND is_org_member(m.organization_id, auth.uid())));

CREATE POLICY "nutrir_form_itens_all" ON public.nutrir_formulacao_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM nutrir_formulacoes f WHERE f.id = formulacao_id AND is_org_member(f.organization_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM nutrir_formulacoes f WHERE f.id = formulacao_id AND is_org_member(f.organization_id, auth.uid())));

CREATE POLICY "nutrir_orc_itens_all" ON public.nutrir_orcamento_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM nutrir_orcamentos o WHERE o.id = orcamento_id AND is_org_member(o.organization_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM nutrir_orcamentos o WHERE o.id = orcamento_id AND is_org_member(o.organization_id, auth.uid())));

CREATE POLICY "nutrir_ped_itens_all" ON public.nutrir_pedido_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM nutrir_pedidos p WHERE p.id = pedido_id AND is_org_member(p.organization_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM nutrir_pedidos p WHERE p.id = pedido_id AND is_org_member(p.organization_id, auth.uid())));

-- Parametros consultoria
CREATE POLICY "nutrir_param_read" ON public.nutrir_parametros_consultoria
  FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY "nutrir_param_write" ON public.nutrir_parametros_consultoria
  FOR ALL TO authenticated
  USING (has_org_role(organization_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]))
  WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

-- ============================================================
-- TRIGGERS DE updated_at
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'nutrir_regionais','nutrir_modalidades','nutrir_embalagens','nutrir_culturas',
    'nutrir_representantes','nutrir_clientes','nutrir_produtos','nutrir_materias_primas',
    'nutrir_formulacoes','nutrir_precos','nutrir_orcamentos','nutrir_pedidos','nutrir_users'
  ])
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t);
  END LOOP;
END $$;
