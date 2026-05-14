-- ────────────────────────────────────────────────────────────────────────
-- SEED Nutrir — Dados básicos pra começar a testar
-- ────────────────────────────────────────────────────────────────────────
-- Como rodar:
--   1. Abra: https://supabase.com/dashboard/project/wkvvgsjunippzwpybaeb/sql/new
--   2. Cole TODO este arquivo
--   3. Clique Run
--
-- Idempotente: pode rodar várias vezes sem duplicar.
-- ────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma organização encontrada. Crie uma conta primeiro.';
  END IF;

  -- 1) EMBALAGENS ──────────────────────────────────────────────────────
  INSERT INTO nutrir_embalagens (organization_id, nome, unidade, volume, ativo) VALUES
    (v_org_id, 'Bombona 5L',  'L',  5,    true),
    (v_org_id, 'Bombona 10L', 'L',  10,   true),
    (v_org_id, 'Bombona 20L', 'L',  20,   true),
    (v_org_id, 'Bombona 25L', 'L',  25,   true),
    (v_org_id, 'Bombona 50L', 'L',  50,   true),
    (v_org_id, 'IBC 1000L',   'L',  1000, true),
    (v_org_id, 'Saco 25Kg',   'kg', 25,   true),
    (v_org_id, 'Saco 50Kg',   'kg', 50,   true),
    (v_org_id, 'Big Bag 500Kg','kg', 500,  true),
    (v_org_id, 'Big Bag 1000Kg','kg',1000, true)
  ON CONFLICT DO NOTHING;

  -- 2) PRODUTOS ───────────────────────────────────────────────────────
  --   categoria = classe comercial (DIAMANTE/OURO/PRATA/BRONZE)
  --   linha = família  ·  classificacao = tipo técnico
  INSERT INTO nutrir_produtos (organization_id, nome, categoria, linha, classificacao, ativo) VALUES
    -- Complexadores
    (v_org_id, 'TSH',           'DIAMANTE', 'Complexadores',    'Complexador',   true),
    (v_org_id, 'Life Grow',     'OURO',     'Complexadores',    'Complexador',   true),
    (v_org_id, 'LEG',           'OURO',     'Complexadores',    'Complexador',   true),
    (v_org_id, 'Íon',           'PRATA',    'Complexadores',    'Complexador',   true),
    -- Foliar
    (v_org_id, 'NitroPlus',     'DIAMANTE', 'Adubação Foliar',  'Foliar',        true),
    (v_org_id, 'NPK Foliar',    'OURO',     'Adubação Foliar',  'Foliar',        true),
    (v_org_id, 'Complex Bor',   'OURO',     'Adubação Foliar',  'Foliar',        true),
    (v_org_id, 'Ácido Bórico',  'BRONZE',   'Adubação Foliar',  'Foliar',        true),
    -- Bioestimulantes e Condicionadores
    (v_org_id, 'Extrato de Algas',      'OURO',  'Bioestimulantes',  'Bioestimulante', true),
    (v_org_id, 'Condicionador de Solo', 'PRATA', 'Condicionadores',  'Condicionador',  true),
    -- Matérias-primas NPK
    (v_org_id, 'Ureia complexada',  'BRONZE', 'Matérias-Primas', 'NPK', true),
    (v_org_id, 'MAP purificado',    'BRONZE', 'Matérias-Primas', 'NPK', true),
    (v_org_id, 'KCl solúvel',       'BRONZE', 'Matérias-Primas', 'NPK', true)
  ON CONFLICT DO NOTHING;

  -- 3) REGIONAIS (coluna correta: uf) ─────────────────────────────────
  INSERT INTO nutrir_regionais (organization_id, nome, uf, ativo) VALUES
    (v_org_id, 'Minas Gerais',       'MG', true),
    (v_org_id, 'Goiás',              'GO', true),
    (v_org_id, 'São Paulo',          'SP', true),
    (v_org_id, 'Mato Grosso',        'MT', true),
    (v_org_id, 'Mato Grosso do Sul', 'MS', true)
  ON CONFLICT DO NOTHING;

  -- 4) MODALIDADES ────────────────────────────────────────────────────
  INSERT INTO nutrir_modalidades (organization_id, nome, ativo) VALUES
    (v_org_id, 'B2B',             true),
    (v_org_id, 'Grupo de Compra', true),
    (v_org_id, 'Revenda',         true),
    (v_org_id, 'Venda Direta',    true),
    (v_org_id, 'Cooperativa',     true)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed por org concluído para %', v_org_id;
END $$;

-- 5) CULTURAS (tabela GLOBAL — sem organization_id) ─────────────────────
INSERT INTO nutrir_culturas (nome, ciclo_dias, descricao, ativo) VALUES
  ('Soja',            120, 'Anual de verão',              true),
  ('Milho',           135, 'Anual de verão/safrinha',     true),
  ('Algodão',         180, 'Anual',                       true),
  ('Feijão',          90,  'Anual',                       true),
  ('Arroz',           120, 'Anual',                       true),
  ('Trigo',           120, 'Anual de inverno',            true),
  ('Café',            NULL,'Perene',                      true),
  ('Cana-de-açúcar',  NULL,'Semi-perene',                 true),
  ('Citros',          NULL,'Perene',                      true),
  ('Eucalipto',       NULL,'Perene florestal',            true),
  ('Banana',          NULL,'Perene',                      true),
  ('Uva',             NULL,'Perene',                      true),
  ('Mamão',           NULL,'Perene',                      true),
  ('Manga',           NULL,'Perene',                      true)
ON CONFLICT (nome) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────
-- Conferir o que entrou
-- ────────────────────────────────────────────────────────────────────────
SELECT 'embalagens'  AS tabela, count(*) FROM nutrir_embalagens
UNION ALL SELECT 'produtos',    count(*) FROM nutrir_produtos
UNION ALL SELECT 'regionais',   count(*) FROM nutrir_regionais
UNION ALL SELECT 'modalidades', count(*) FROM nutrir_modalidades
UNION ALL SELECT 'culturas',    count(*) FROM nutrir_culturas;
