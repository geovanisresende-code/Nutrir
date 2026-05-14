-- ────────────────────────────────────────────────────────────────────────
-- SEED Nutrir — Dados básicos pra começar a testar
-- ────────────────────────────────────────────────────────────────────────
-- Como rodar:
--   1. Abra: https://supabase.com/dashboard/project/wkvvgsjunippzwpybaeb/sql/new
--   2. Cole TODO este arquivo
--   3. Clique Run
--
-- O script é IDEMPOTENTE: pode rodar várias vezes sem duplicar.
-- Popula dados na sua organização (a primeira encontrada).
-- ────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Pega a primeira organização
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma organização encontrada. Cria uma conta primeiro.';
  END IF;

  -- ────────────────────────────────────────────────────────────────────
  -- 1) EMBALAGENS
  -- ────────────────────────────────────────────────────────────────────
  INSERT INTO nutrir_embalagens (organization_id, nome, unidade, volume, multiplicador, ativo) VALUES
    (v_org_id, 'Bombona 5L',  'L',  5,   1, true),
    (v_org_id, 'Bombona 10L', 'L',  10,  1, true),
    (v_org_id, 'Bombona 20L', 'L',  20,  1, true),
    (v_org_id, 'Bombona 25L', 'L',  25,  1, true),
    (v_org_id, 'Bombona 50L', 'L',  50,  1, true),
    (v_org_id, 'IBC 1000L',   'L',  1000,1, true),
    (v_org_id, 'Saco 25Kg',   'kg', 25,  1, true),
    (v_org_id, 'Saco 50Kg',   'kg', 50,  1, true),
    (v_org_id, 'Big Bag 500Kg','kg',500, 1, true),
    (v_org_id, 'Big Bag 1000Kg','kg',1000,1,true)
  ON CONFLICT DO NOTHING;

  -- ────────────────────────────────────────────────────────────────────
  -- 2) PRODUTOS (exemplos das principais linhas Nutrir)
  -- ────────────────────────────────────────────────────────────────────
  INSERT INTO nutrir_produtos (organization_id, nome, categoria, linha, ativo) VALUES
    -- Complexadores
    (v_org_id, 'TSH',           'Complexador', 'Complexadores', true),
    (v_org_id, 'Life Grow',     'Complexador', 'Complexadores', true),
    (v_org_id, 'LEG',           'Complexador', 'Complexadores', true),
    (v_org_id, 'Íon',           'Complexador', 'Complexadores', true),
    -- Foliar
    (v_org_id, 'NitroPlus',     'Foliar',      'Adubação Foliar', true),
    (v_org_id, 'NPK Foliar',    'Foliar',      'Adubação Foliar', true),
    (v_org_id, 'Complex Bor',   'Foliar',      'Adubação Foliar', true),
    (v_org_id, 'Ácido Bórico',  'Foliar',      'Adubação Foliar', true),
    -- Extrato e Condicionadores
    (v_org_id, 'Extrato de Algas', 'Bioestimulante', 'Bioestimulantes', true),
    (v_org_id, 'Condicionador de Solo', 'Condicionador', 'Condicionadores', true),
    -- NPK
    (v_org_id, 'Ureia complexada', 'NPK', 'Matérias-Primas', true),
    (v_org_id, 'MAP purificado',   'NPK', 'Matérias-Primas', true),
    (v_org_id, 'KCl solúvel',      'NPK', 'Matérias-Primas', true)
  ON CONFLICT DO NOTHING;

  -- ────────────────────────────────────────────────────────────────────
  -- 3) REGIONAIS
  -- ────────────────────────────────────────────────────────────────────
  INSERT INTO nutrir_regionais (organization_id, nome, estado, ativo) VALUES
    (v_org_id, 'Minas Gerais',   'MG', true),
    (v_org_id, 'Goiás',          'GO', true),
    (v_org_id, 'São Paulo',      'SP', true),
    (v_org_id, 'Mato Grosso',    'MT', true),
    (v_org_id, 'Mato Grosso do Sul', 'MS', true)
  ON CONFLICT DO NOTHING;

  -- ────────────────────────────────────────────────────────────────────
  -- 4) MODALIDADES (categorias de venda)
  -- ────────────────────────────────────────────────────────────────────
  INSERT INTO nutrir_modalidades (organization_id, nome, ativo) VALUES
    (v_org_id, 'B2B',             true),
    (v_org_id, 'Grupo de Compra', true),
    (v_org_id, 'Revenda',         true),
    (v_org_id, 'Venda Direta',    true),
    (v_org_id, 'Cooperativa',     true)
  ON CONFLICT DO NOTHING;

  -- ────────────────────────────────────────────────────────────────────
  -- 5) CULTURAS
  -- ────────────────────────────────────────────────────────────────────
  INSERT INTO nutrir_culturas (organization_id, nome, tipo) VALUES
    (v_org_id, 'Soja',      'anual'),
    (v_org_id, 'Milho',     'anual'),
    (v_org_id, 'Algodão',   'anual'),
    (v_org_id, 'Feijão',    'anual'),
    (v_org_id, 'Arroz',     'anual'),
    (v_org_id, 'Trigo',     'anual'),
    (v_org_id, 'Café',      'perene'),
    (v_org_id, 'Cana-de-açúcar', 'perene'),
    (v_org_id, 'Citros',    'perene'),
    (v_org_id, 'Eucalipto', 'perene'),
    (v_org_id, 'Banana',    'perene'),
    (v_org_id, 'Uva',       'perene'),
    (v_org_id, 'Mamão',     'perene'),
    (v_org_id, 'Manga',     'perene')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed concluído para organização %', v_org_id;
END $$;

-- ────────────────────────────────────────────────────────────────────────
-- Conferir o que entrou
-- ────────────────────────────────────────────────────────────────────────
SELECT 'embalagens' AS tabela, count(*) FROM nutrir_embalagens
UNION ALL SELECT 'produtos',   count(*) FROM nutrir_produtos
UNION ALL SELECT 'regionais',  count(*) FROM nutrir_regionais
UNION ALL SELECT 'modalidades',count(*) FROM nutrir_modalidades
UNION ALL SELECT 'culturas',   count(*) FROM nutrir_culturas;
