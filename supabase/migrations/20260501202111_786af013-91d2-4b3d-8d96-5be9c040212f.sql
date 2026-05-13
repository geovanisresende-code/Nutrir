-- Unique constraints necessárias para upserts idempotentes do seed Nutrir
DO $$ BEGIN
  ALTER TABLE nutrir_nutrientes ADD CONSTRAINT nutrir_nutrientes_simbolo_key UNIQUE (simbolo);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE nutrir_culturas ADD CONSTRAINT nutrir_culturas_nome_key UNIQUE (nome);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE nutrir_complexadores ADD CONSTRAINT nutrir_complexadores_nome_key UNIQUE (nome);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE nutrir_formula_cabecalho ADD CONSTRAINT nutrir_formula_cabecalho_codigo_nivel_key UNIQUE (formula_codigo, nivel);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE nutrir_formula_limite ADD CONSTRAINT nutrir_formula_limite_codigo_key UNIQUE (formula_codigo);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE nutrir_consultoria_culturas ADD CONSTRAINT nutrir_consultoria_culturas_nome_key UNIQUE (nome);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE nutrir_materias_primas ADD CONSTRAINT nutrir_materias_primas_org_nome_key UNIQUE (organization_id, nome);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE nutrir_embalagens ADD CONSTRAINT nutrir_embalagens_org_nome_key UNIQUE (organization_id, nome);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE nutrir_modalidades ADD CONSTRAINT nutrir_modalidades_org_nome_key UNIQUE (organization_id, nome);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;