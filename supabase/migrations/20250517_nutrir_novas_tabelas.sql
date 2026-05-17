-- ════════════════════════════════════════════════════════════════
-- MIGRATION: Nutrir AgTech — novas tabelas e colunas
-- Rodar no SQL Editor do Supabase antes de usar os novos módulos
-- ════════════════════════════════════════════════════════════════

-- 1. nutrir_talhoes (talhões/áreas agrícolas com GPS)
CREATE TABLE IF NOT EXISTS nutrir_talhoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  fazenda_nome    text,
  cliente_id      uuid REFERENCES nutrir_clientes(id) ON DELETE SET NULL,
  area_ha         numeric,
  cultura         text,
  safra           text,
  geometria       jsonb,
  centro_lat      numeric,
  centro_lng      numeric,
  observacoes     text,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE nutrir_talhoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_members" ON nutrir_talhoes;
CREATE POLICY "org_members" ON nutrir_talhoes USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);

-- 2. nutrir_talhao_coletas (coletas de solo vinculadas a talhões)
CREATE TABLE IF NOT EXISTS nutrir_talhao_coletas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  talhao_id       uuid REFERENCES nutrir_talhoes(id) ON DELETE CASCADE,
  codigo          text NOT NULL,
  data            date NOT NULL,
  tipo            text DEFAULT 'solo',        -- solo, foliar, agua, raiz
  profundidade    text,
  laboratorio     text,
  observacoes     text,
  status          text DEFAULT 'pendente',    -- pendente, enviada, resultado_recebido
  resultado_url   text,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE nutrir_talhao_coletas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_members" ON nutrir_talhao_coletas;
CREATE POLICY "org_members" ON nutrir_talhao_coletas USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);

-- 3. nutrir_campanhas (campanhas de prospecção)
CREATE TABLE IF NOT EXISTS nutrir_campanhas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  produto         text,
  regiao          text,
  status          text DEFAULT 'planejamento',  -- planejamento, ativa, pausada, encerrada
  meta_leads      integer DEFAULT 50,
  descricao       text,
  data_inicio     date,
  data_fim        date,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE nutrir_campanhas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_members" ON nutrir_campanhas;
CREATE POLICY "org_members" ON nutrir_campanhas USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);

-- 4. nutrir_leads (leads por campanha)
CREATE TABLE IF NOT EXISTS nutrir_leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  campanha_id     uuid REFERENCES nutrir_campanhas(id) ON DELETE SET NULL,
  nome            text NOT NULL,
  telefone        text,
  email           text,
  cidade          text,
  area_ha         numeric,
  cultura         text,
  status          text DEFAULT 'novo',   -- novo, contatado, qualificado, convertido, perdido
  observacoes     text,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE nutrir_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_members" ON nutrir_leads;
CREATE POLICY "org_members" ON nutrir_leads USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);

-- 5. Colunas novas em nutrir_colaboradores (remuneração)
ALTER TABLE nutrir_colaboradores
  ADD COLUMN IF NOT EXISTS salario_base      numeric,
  ADD COLUMN IF NOT EXISTS auxilio_carro     numeric,
  ADD COLUMN IF NOT EXISTS adiantamento_max  numeric;

-- 6. Coluna limite mensal RDV em profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS rdv_limite_mensal numeric;

-- 7. Colunas extras em nutrir_rdv (auditoria contábil)
ALTER TABLE nutrir_rdv
  ADD COLUMN IF NOT EXISTS cnpj_fornecedor text,
  ADD COLUMN IF NOT EXISTS hotel_nome      text;

-- 8. nutrir_comissoes: coluna tipo para distinguir comissão vs bonificação
ALTER TABLE nutrir_comissoes
  ADD COLUMN IF NOT EXISTS tipo       text DEFAULT 'comissao',  -- comissao, bonificacao, adiantamento
  ADD COLUMN IF NOT EXISTS descricao  text;
