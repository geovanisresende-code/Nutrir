-- ════════════════════════════════════════════════════════════════
-- SEED: Fertagro — Dados Mestres
-- Regionais (8), Embalagens (7), Modalidades (4),
-- Produtos (68), Precos calculados, Culturas (51), Estágios (346)
-- Rodar no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════════

DO $$
DECLARE
  org_id uuid;
  reg_1 uuid;
  reg_2 uuid;
  reg_3 uuid;
  reg_4 uuid;
  reg_5 uuid;
  reg_6 uuid;
  reg_7 uuid;
  reg_8 uuid;
  emb_1l uuid;
  emb_5l uuid;
  emb_10l uuid;
  emb_20l uuid;
  emb_25l uuid;
  emb_50l uuid;
  emb_1000l uuid;
  mod_grupo_compra uuid;
  mod_revenda uuid;
  mod_agenciamento uuid;
  mod_venda_direta uuid;
BEGIN
  org_id := 'ca1d95bb-bcf7-46af-a529-5a089e519324'::uuid;  -- Monjolo (org Cristiano)

  -- REGIONAIS
  INSERT INTO public.nutrir_regionais (organization_id, nome, descricao, custo_adicional_litro)
    VALUES (org_id, 'REGIONAL AM/SM', 'Alta Mogiana e Sul de Minas', 0.5)
    ON CONFLICT (organization_id, nome) DO UPDATE SET custo_adicional_litro = EXCLUDED.custo_adicional_litro
    RETURNING id INTO reg_1;
  IF reg_1 IS NULL THEN SELECT id INTO reg_1 FROM public.nutrir_regionais WHERE organization_id = org_id AND nome = 'REGIONAL AM/SM'; END IF;
  INSERT INTO public.nutrir_regionais (organization_id, nome, descricao, custo_adicional_litro)
    VALUES (org_id, 'REGIONAL TRIÂNGULO NORTE', 'Triângulo Mineiro Norte', 0.5)
    ON CONFLICT (organization_id, nome) DO UPDATE SET custo_adicional_litro = EXCLUDED.custo_adicional_litro
    RETURNING id INTO reg_2;
  IF reg_2 IS NULL THEN SELECT id INTO reg_2 FROM public.nutrir_regionais WHERE organization_id = org_id AND nome = 'REGIONAL TRIÂNGULO NORTE'; END IF;
  INSERT INTO public.nutrir_regionais (organization_id, nome, descricao, custo_adicional_litro)
    VALUES (org_id, 'REGIONAL TRIÂNGULO SUL', 'Triângulo Mineiro Sul', 0.5)
    ON CONFLICT (organization_id, nome) DO UPDATE SET custo_adicional_litro = EXCLUDED.custo_adicional_litro
    RETURNING id INTO reg_3;
  IF reg_3 IS NULL THEN SELECT id INTO reg_3 FROM public.nutrir_regionais WHERE organization_id = org_id AND nome = 'REGIONAL TRIÂNGULO SUL'; END IF;
  INSERT INTO public.nutrir_regionais (organization_id, nome, descricao, custo_adicional_litro)
    VALUES (org_id, 'REGIONAL ALTO PARANAÍBA', 'Alto Paranaíba', 0.5)
    ON CONFLICT (organization_id, nome) DO UPDATE SET custo_adicional_litro = EXCLUDED.custo_adicional_litro
    RETURNING id INTO reg_4;
  IF reg_4 IS NULL THEN SELECT id INTO reg_4 FROM public.nutrir_regionais WHERE organization_id = org_id AND nome = 'REGIONAL ALTO PARANAÍBA'; END IF;
  INSERT INTO public.nutrir_regionais (organization_id, nome, descricao, custo_adicional_litro)
    VALUES (org_id, 'REGIONAL ITUMBIARA', 'Itumbiara e Região', 0.75)
    ON CONFLICT (organization_id, nome) DO UPDATE SET custo_adicional_litro = EXCLUDED.custo_adicional_litro
    RETURNING id INTO reg_5;
  IF reg_5 IS NULL THEN SELECT id INTO reg_5 FROM public.nutrir_regionais WHERE organization_id = org_id AND nome = 'REGIONAL ITUMBIARA'; END IF;
  INSERT INTO public.nutrir_regionais (organization_id, nome, descricao, custo_adicional_litro)
    VALUES (org_id, 'REGIONAL RIO VERDE', 'Rio Verde e Região', 0.75)
    ON CONFLICT (organization_id, nome) DO UPDATE SET custo_adicional_litro = EXCLUDED.custo_adicional_litro
    RETURNING id INTO reg_6;
  IF reg_6 IS NULL THEN SELECT id INTO reg_6 FROM public.nutrir_regionais WHERE organization_id = org_id AND nome = 'REGIONAL RIO VERDE'; END IF;
  INSERT INTO public.nutrir_regionais (organization_id, nome, descricao, custo_adicional_litro)
    VALUES (org_id, 'REGIONAL FORMOSA', 'Formosa e DF', 0.75)
    ON CONFLICT (organization_id, nome) DO UPDATE SET custo_adicional_litro = EXCLUDED.custo_adicional_litro
    RETURNING id INTO reg_7;
  IF reg_7 IS NULL THEN SELECT id INTO reg_7 FROM public.nutrir_regionais WHERE organization_id = org_id AND nome = 'REGIONAL FORMOSA'; END IF;
  INSERT INTO public.nutrir_regionais (organization_id, nome, descricao, custo_adicional_litro)
    VALUES (org_id, 'REGIONAL BALSAS', 'Balsas e Região', 1.25)
    ON CONFLICT (organization_id, nome) DO UPDATE SET custo_adicional_litro = EXCLUDED.custo_adicional_litro
    RETURNING id INTO reg_8;
  IF reg_8 IS NULL THEN SELECT id INTO reg_8 FROM public.nutrir_regionais WHERE organization_id = org_id AND nome = 'REGIONAL BALSAS'; END IF;

  -- EMBALAGENS
  INSERT INTO public.nutrir_embalagens (organization_id, nome, volume, unidade, custo_adicional_litro, descricao)
    VALUES (org_id, '1L', 1.0, 'L', 6.75, 'Cx 12x1L')
    ON CONFLICT DO NOTHING RETURNING id INTO emb_1l;
  IF emb_1l IS NULL THEN SELECT id INTO emb_1l FROM public.nutrir_embalagens WHERE organization_id = org_id AND nome = '1L'; END IF;
  INSERT INTO public.nutrir_embalagens (organization_id, nome, volume, unidade, custo_adicional_litro, descricao)
    VALUES (org_id, '5L', 5.0, 'L', 1.75, 'Cx 4x5L')
    ON CONFLICT DO NOTHING RETURNING id INTO emb_5l;
  IF emb_5l IS NULL THEN SELECT id INTO emb_5l FROM public.nutrir_embalagens WHERE organization_id = org_id AND nome = '5L'; END IF;
  INSERT INTO public.nutrir_embalagens (organization_id, nome, volume, unidade, custo_adicional_litro, descricao)
    VALUES (org_id, '10L', 10.0, 'L', 1.5, 'Bombona 10L')
    ON CONFLICT DO NOTHING RETURNING id INTO emb_10l;
  IF emb_10l IS NULL THEN SELECT id INTO emb_10l FROM public.nutrir_embalagens WHERE organization_id = org_id AND nome = '10L'; END IF;
  INSERT INTO public.nutrir_embalagens (organization_id, nome, volume, unidade, custo_adicional_litro, descricao)
    VALUES (org_id, '20L', 20.0, 'L', 1.25, 'Bombona 20L')
    ON CONFLICT DO NOTHING RETURNING id INTO emb_20l;
  IF emb_20l IS NULL THEN SELECT id INTO emb_20l FROM public.nutrir_embalagens WHERE organization_id = org_id AND nome = '20L'; END IF;
  INSERT INTO public.nutrir_embalagens (organization_id, nome, volume, unidade, custo_adicional_litro, descricao)
    VALUES (org_id, '25L', 25.0, 'L', 1.15, 'Bombona 25L')
    ON CONFLICT DO NOTHING RETURNING id INTO emb_25l;
  IF emb_25l IS NULL THEN SELECT id INTO emb_25l FROM public.nutrir_embalagens WHERE organization_id = org_id AND nome = '25L'; END IF;
  INSERT INTO public.nutrir_embalagens (organization_id, nome, volume, unidade, custo_adicional_litro, descricao)
    VALUES (org_id, '50L', 50.0, 'L', 0.75, 'Tambor 50L')
    ON CONFLICT DO NOTHING RETURNING id INTO emb_50l;
  IF emb_50l IS NULL THEN SELECT id INTO emb_50l FROM public.nutrir_embalagens WHERE organization_id = org_id AND nome = '50L'; END IF;
  INSERT INTO public.nutrir_embalagens (organization_id, nome, volume, unidade, custo_adicional_litro, descricao)
    VALUES (org_id, '1000L', 1000.0, 'L', 0.5, 'IBC 1000L')
    ON CONFLICT DO NOTHING RETURNING id INTO emb_1000l;
  IF emb_1000l IS NULL THEN SELECT id INTO emb_1000l FROM public.nutrir_embalagens WHERE organization_id = org_id AND nome = '1000L'; END IF;

  -- MODALIDADES
  INSERT INTO public.nutrir_modalidades (organization_id, nome, tipo, margens_por_categoria)
    VALUES (org_id, 'Grupo de Compra', 'grupo_compra', '{"DIAMANTE": 0.4,"OURO": 0.3,"PRATA": 0.2,"BRONZE": 0.15}'::jsonb)
    ON CONFLICT (organization_id, nome) DO UPDATE SET margens_por_categoria = EXCLUDED.margens_por_categoria
    RETURNING id INTO mod_grupo_compra;
  IF mod_grupo_compra IS NULL THEN SELECT id INTO mod_grupo_compra FROM public.nutrir_modalidades WHERE organization_id = org_id AND nome = 'Grupo de Compra'; END IF;
  INSERT INTO public.nutrir_modalidades (organization_id, nome, tipo, margens_por_categoria)
    VALUES (org_id, 'Revenda', 'revenda', '{"DIAMANTE": 0.5,"OURO": 0.35,"PRATA": 0.25,"BRONZE": 0.17}'::jsonb)
    ON CONFLICT (organization_id, nome) DO UPDATE SET margens_por_categoria = EXCLUDED.margens_por_categoria
    RETURNING id INTO mod_revenda;
  IF mod_revenda IS NULL THEN SELECT id INTO mod_revenda FROM public.nutrir_modalidades WHERE organization_id = org_id AND nome = 'Revenda'; END IF;
  INSERT INTO public.nutrir_modalidades (organization_id, nome, tipo, margens_por_categoria)
    VALUES (org_id, 'Agenciamento', 'agenciamento', '{"DIAMANTE": 0.65,"OURO": 0.43,"PRATA": 0.33,"BRONZE": 0.28}'::jsonb)
    ON CONFLICT (organization_id, nome) DO UPDATE SET margens_por_categoria = EXCLUDED.margens_por_categoria
    RETURNING id INTO mod_agenciamento;
  IF mod_agenciamento IS NULL THEN SELECT id INTO mod_agenciamento FROM public.nutrir_modalidades WHERE organization_id = org_id AND nome = 'Agenciamento'; END IF;
  INSERT INTO public.nutrir_modalidades (organization_id, nome, tipo, margens_por_categoria)
    VALUES (org_id, 'Venda Direta', 'venda_direta', '{"DIAMANTE": 0.62,"OURO": 0.45,"PRATA": 0.3,"BRONZE": 0.25}'::jsonb)
    ON CONFLICT (organization_id, nome) DO UPDATE SET margens_por_categoria = EXCLUDED.margens_por_categoria
    RETURNING id INTO mod_venda_direta;
  IF mod_venda_direta IS NULL THEN SELECT id INTO mod_venda_direta FROM public.nutrir_modalidades WHERE organization_id = org_id AND nome = 'Venda Direta'; END IF;

  -- PRODUTOS (68)
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD001', 'Carbo Alga', 'BIOREGULATOR', 'DIAMANTE', 'BIOREGULATOR', '90% Aschophyllum nodosun, 10% Kappaphicus alvarezi', 17.7)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD002', 'Estimull', 'BIOREGULATOR', 'DIAMANTE', 'BIOREGULATOR', 'Geberelina, Citocinina, Auxina', 28.73)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD003', 'Raiz', 'BIOREGULATOR', 'DIAMANTE', 'BIOREGULATOR', 'Enraizador para sulco de plantio', 6.77)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD004', 'Amino +', 'BIOREGULATOR', 'PRATA', 'BIOREGULATOR', 'Hidrolisado de Derma Bovino, aminoácido puro', 13.95)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD005', 'Fert Amino Super', 'BIOREGULATOR', 'PRATA', 'BIOREGULATOR', 'Aminoácido + enraizador', 14.75)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD006', 'GRAMINE', 'BIOREGULATOR', 'PRATA', 'BIOREGULATOR', 'Bioestimulante para gramíneas', 22.42)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD007', 'Grow Force', 'BIOREGULATOR', 'PRATA', 'BIOREGULATOR', 'Citocinina para enchimento de grão', 12.3)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD008', 'RAIZ PLUS', 'BIOREGULATOR', 'PRATA', 'BIOREGULATOR', 'Enraizador para sulco de plantio', 21.75)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD009', 'Life Alga', 'BIOREGULATOR', 'BRONZE', 'BIOREGULATOR', 'Carbo Alga', 17.7)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD010', 'BOR', 'COMPLEX', 'OURO', 'COMPLEX', 'Complexador de Boro', 12.07)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD011', 'LEG', 'COMPLEX', 'OURO', 'COMPLEX', 'Complexador de Nutrientes para folha', 15.47)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD012', 'ÍON', 'COMPLEX', 'OURO', 'COMPLEX', 'Complexador e Quelato Organico para foliar', 23.2)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD013', 'TSH', 'COMPLEX', 'BRONZE', 'COMPLEX', 'Complexador de Nutrientes para solo', 8.0)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD014', 'FK HF', 'LIFE SOIL', 'PRATA', 'LIFE SOIL', 'Ácido humico, condicionador de solo', 7.6)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD015', 'Fúlvic', 'LIFE SOIL', 'PRATA', 'LIFE SOIL', 'Ácido Fulvico, condicionador de solo', 9.8)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD016', 'Fúlvic +', 'LIFE SOIL', 'PRATA', 'LIFE SOIL', 'Ácido Fulvico, + carbono', 10.2)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD017', 'Húmic', 'LIFE SOIL', 'PRATA', 'LIFE SOIL', 'Ácido humico, condicionador de solo', 7.6)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD018', 'Húmic +', 'LIFE SOIL', 'PRATA', 'LIFE SOIL', 'Ácido humico + carbono', 8.9)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD019', 'LIFE GROW PLUS', 'LIFE SOIL', 'PRATA', 'LIFE SOIL', 'Ácido humico, ácido fulvico, solução nutritiva para biológicos e enraizador concentrado', 22.0)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD020', 'Life Grow', 'LIFE SOIL', 'PRATA', 'LIFE SOIL', 'Ácido humico, ácido fulvico, solução nutritiva para biológicos e enraizador', 11.97)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD021', 'AEGIS PRIME', 'PROTECTION', 'DIAMANTE', 'PROTECTION', 'Indutor de Resistência', 32.0)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD022', 'AS200', 'PROTECTION', 'DIAMANTE', 'PROTECTION', 'Ácido Salicílico', 34.75)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD023', 'Biosulfre', 'PROTECTION', 'DIAMANTE', 'PROTECTION', 'Desalojante', 8.42)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD024', 'Protector', 'PROTECTION', 'DIAMANTE', 'PROTECTION', 'Controle enzimático de nematoides', 9.27)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD025', 'ALSAT 800', 'PROTECTION', 'OURO', 'PROTECTION', 'Óleo de alho puro', 476.0)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD026', 'Darck', 'PROTECTION', 'OURO', 'PROTECTION', 'Protetor Solar', 34.7)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD027', 'Fusion', 'PROTECTION', 'OURO', 'PROTECTION', 'Controle enzimatico de fusariose', 14.6)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD028', 'TRACTUS', 'PROTECTION', 'OURO', 'PROTECTION', 'Sanitizante foliar (fungicida, bactericida)', 38.3)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD029', 'FERT CoMoNi FOL (0,5-10-4,0)', 'NUTRI', 'BRONZE', 'NUTRI', 'CoMoNi foliar', 86.0)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD030', 'FERT CoMoNi TS (0,5-10-0,5)', 'NUTRI', 'BRONZE', 'NUTRI', 'CoMoNi para TS', 76.0)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD031', 'FERT FULL', 'NUTRI', 'BRONZE', 'NUTRI', 'Aminácido puro + micros', 14.37)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD032', 'FERT K 630', 'NUTRI', 'BRONZE', 'NUTRI', 'Formiato de Potássio - 634gr/L', 33.55)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD033', 'FERT MIX', 'NUTRI', 'BRONZE', 'NUTRI', 'Complexo de macro e micronutrientes', 12.3)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD034', 'FERT MUSA', 'NUTRI', 'BRONZE', 'NUTRI', 'Mix nutricional para banana', 12.85)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD035', 'FLORAÇÃO', 'NUTRI', 'BRONZE', 'NUTRI', 'Mix nutricional para florescimento', 10.17)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD036', 'Fert Ca 10', 'NUTRI', 'BRONZE', 'NUTRI', 'Cálcio foliar 10%', 6.27)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD037', 'Fert CaMgB', 'NUTRI', 'BRONZE', 'NUTRI', 'Cálcio, Magnésio e Boro', 10.17)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD038', 'Fert Café', 'NUTRI', 'BRONZE', 'NUTRI', 'Mix Nutricional para café alta mogiana', 11.2)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD039', 'Fert Café Cerrado', 'NUTRI', 'BRONZE', 'NUTRI', 'Mix Nutricional para café do cerrado', 10.8)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD040', 'Fert Café Sul de Minas', 'NUTRI', 'BRONZE', 'NUTRI', 'Mix Nutricional para café de montanha', 10.2)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD041', 'Fert Cobre', 'NUTRI', 'BRONZE', 'NUTRI', 'Cobre quelato organico', 12.2)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD042', 'Fert Ferro', 'NUTRI', 'BRONZE', 'NUTRI', 'Ferro 10% + aminoácidos', 7.55)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD043', 'Fert Full Gramineas', 'NUTRI', 'BRONZE', 'NUTRI', 'Mix Nutrcional + aminoácidos para gramineas em geral', 9.75)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD044', 'Fert K 32', 'NUTRI', 'BRONZE', 'NUTRI', 'Formiato de Potássio - 320gr/L', 21.75)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD045', 'Fert Mg 8', 'NUTRI', 'BRONZE', 'NUTRI', 'Magnésio + aminoácidos 8%', 11.7)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD046', 'Fert Mn', 'NUTRI', 'BRONZE', 'NUTRI', 'Manganês 10% + aminoácidos', 6.72)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD047', 'Fert MoB', 'NUTRI', 'BRONZE', 'NUTRI', 'Molibneio + Boro', 38.9)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD048', 'Fert Se 10', 'NUTRI', 'BRONZE', 'NUTRI', 'Selênio 10%', 47.87)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD049', 'Fert Zn 10', 'NUTRI', 'BRONZE', 'NUTRI', 'Zinco 10% + aminoácidos', 9.92)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD050', 'N 380', 'NUTRI', 'BRONZE', 'NUTRI', 'Fonte Nítrica, Amidica e Amoniacal', 9.7)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD051', 'NITROMOL', 'NUTRI', 'BRONZE', 'NUTRI', 'Nitrogenio + Molibdenio + aminoácidos', 8.3)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD052', 'PASTAGEM', 'NUTRI', 'BRONZE', 'NUTRI', 'Mix nutricional para pastagem', 11.2)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD053', 'Solubor', 'NUTRI', 'BRONZE', 'NUTRI', 'Boro MEA + Poliois - 134gr/l', 17.59)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD054', 'ADJUV ATM', 'Tecnologia de Aplicação', 'OURO', 'Tecnologia de Aplicação', 'Condicionador de calda', 28.7)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD055', 'ADJUV TRP OIL', 'Tecnologia de Aplicação', 'PRATA', 'Tecnologia de Aplicação', 'Óleo de laranja', 25.0)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD056', 'ADJUV-FERT', 'Tecnologia de Aplicação', 'BRONZE', 'Tecnologia de Aplicação', 'Redutor de pH + antideriva', 29.78)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD057', 'ADJUV-MAX', 'Tecnologia de Aplicação', 'BRONZE', 'Tecnologia de Aplicação', 'Óleo Metilado de Soja + antideriva + antiespuma + condicionador de calda + espalhante adesivo', 47.3)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD058', 'Aid Oil', 'Tecnologia de Aplicação', 'BRONZE', 'Tecnologia de Aplicação', 'Óleo Metilado de Soja', 15.22)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD059', 'Clean Machine', 'Tecnologia de Aplicação', 'BRONZE', 'Tecnologia de Aplicação', 'Limpa tanque', 26.13)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD060', 'CLAYNM', 'BIOMAXI', 'PRATA', 'BIOMAXI', 'B. amyloliquefaciens DC81; B. subtilis DC31; B. velezensis DC88; B. megaterium DC87; B. licheniformis DC40 - 3x10⁸ ufc/ml', 70.0)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD061', 'GLADIUS TRY Oil', 'BIOMAXI', 'PRATA', 'BIOMAXI', 'Trichoderma harzianum IB19/17 -  7,2x10⁹ ufc/ml', 100.0)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD062', 'HUNTER KURS', 'BIOMAXI', 'PRATA', 'BIOMAXI', 'Bacillus thuringiensis kurstaki - 2,5x10⁹ ufc/ml', 32.0)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD063', 'LAUNCHER PHOS', 'BIOMAXI', 'PRATA', 'BIOMAXI', 'Bacillus megaterium DC48; Bacillus velezensis DC74; Bacillus velezensis DC63 - 5x10⁸ ufc/ml', 80.0)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD064', 'POSEIDON', 'BIOMAXI', 'PRATA', 'BIOMAXI', 'Bacillus pumillus DC61; Bacillus velezensis (DC81, DC88) - 3x10⁸ ufc/ml', 42.0)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD065', 'RESIST', 'BIOMAXI', 'PRATA', 'BIOMAXI', 'Bacillus Aryabhathai(DC26, DC81); Bacillus Velezensis DC74 - 5x10⁸ ufc/ml', 85.0)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD066', 'TSAR Oil', 'BIOMAXI', 'PRATA', 'BIOMAXI', 'Beauveria bassiana IBCB66 -  7,2x10⁹ ufc/ml', 150.0)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD067', 'ACTION', 'ORGANO COMPOSTO', 'BRONZE', 'ORGANO COMPOSTO', 'Bioativador de Compostagem', 3.35)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.nutrir_produtos (organization_id, codigo, nome, classificacao, categoria, linha, descricao, custo_industria)
    VALUES (org_id, 'PROD068', 'SUPER', 'ORGANO COMPOSTO', 'BRONZE', 'ORGANO COMPOSTO', 'Acelerador de compostogem', 4.55)
    ON CONFLICT DO NOTHING;

END $$;

-- PREÇOS calculados automaticamente
-- Fórmula: (custo + emb_custo_l) / (1 - margem) + frete_regional
INSERT INTO public.nutrir_precos
  (organization_id, produto_id, embalagem_id, regional_id, modalidade_id, preco, vigencia_inicio)
SELECT
  p.organization_id, p.id, e.id, r.id, m.id,
  ROUND(
    (p.custo_industria + e.custo_adicional_litro)
    / NULLIF(1 - COALESCE((m.margens_por_categoria ->> p.categoria)::numeric, 0.3), 0)
    + r.custo_adicional_litro,
  4),
  CURRENT_DATE
FROM public.nutrir_produtos p
JOIN public.nutrir_embalagens e ON e.organization_id = p.organization_id
JOIN public.nutrir_regionais r ON r.organization_id = p.organization_id
JOIN public.nutrir_modalidades m ON m.organization_id = p.organization_id
WHERE p.custo_industria IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.nutrir_precos x
    WHERE x.organization_id = p.organization_id
      AND x.produto_id = p.id
      AND x.embalagem_id = e.id
      AND x.regional_id = r.id
      AND x.modalidade_id = m.id
  );

-- CULTURAS (51) — global
INSERT INTO public.nutrir_culturas (nome) VALUES ('Abacaxi') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Algodão') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Alho') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Amendoim') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Arroz') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Aveia') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Açaí') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Banana') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Batata') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Batata-doce') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Cacau') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Café Arábica') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Café Conilon') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Cana-de-açúcar') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Canola') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Cebola') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Cenoura') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Centeio') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Cevada') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Coco') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Dendê') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Erva-mate') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Eucalipto') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Feijão') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Gergelim') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Girassol') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Goiaba') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Guaraná') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Laranja') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Limão') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Mamona') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Mamão') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Mandioca') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Manga') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Maracujá') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Maçã') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Melancia') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Melão') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Milheto') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Milho') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Pastagem') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Pimenta-do-reino') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Pinus') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Seringueira') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Soja') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Sorgo') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Tabaco') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Tomate') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Trigo') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Triticale') ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.nutrir_culturas (nome) VALUES ('Uva') ON CONFLICT (nome) DO NOTHING;

-- ESTÁDIOS FENOLÓGICOS (346)
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V1 — Plantio', 1, 'Plantio da muda' FROM public.nutrir_culturas WHERE nome = 'Abacaxi' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V2 — Desenvolvimento vegetativo', 2, 'Crescimento das folhas e do sistema radicular' FROM public.nutrir_culturas WHERE nome = 'Abacaxi' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R1 — Indução floral', 3, 'Diferenciação do meristema apical em inflorescência' FROM public.nutrir_culturas WHERE nome = 'Abacaxi' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R2 — Florescimento', 4, 'Abertura das flores' FROM public.nutrir_culturas WHERE nome = 'Abacaxi' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R3 — Frutificação', 5, 'Desenvolvimento do fruto' FROM public.nutrir_culturas WHERE nome = 'Abacaxi' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R4 — Maturação', 6, 'Maturação e colheita do fruto' FROM public.nutrir_culturas WHERE nome = 'Abacaxi' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V0 — Emergência', 1, 'Emergência da plântula até 2,5 cm da primeira folha verdadeira' FROM public.nutrir_culturas WHERE nome = 'Algodão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V1 — Primeira folha verdadeira', 2, 'Primeira folha verdadeira com 2,5 cm' FROM public.nutrir_culturas WHERE nome = 'Algodão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V2 — Segunda folha verdadeira', 3, 'Segunda folha verdadeira com 2,5 cm' FROM public.nutrir_culturas WHERE nome = 'Algodão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Vn — N-ésima folha verdadeira', 4, 'N-ésima folha verdadeira' FROM public.nutrir_culturas WHERE nome = 'Algodão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'B1 — Primeiro botão floral', 5, 'Surgimento do primeiro botão floral' FROM public.nutrir_culturas WHERE nome = 'Algodão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'F1 — Primeira flor', 6, 'Abertura do primeiro botão floral, início da floração' FROM public.nutrir_culturas WHERE nome = 'Algodão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'C1 — Primeiro capulho aberto', 7, 'Rompimento da primeira maçã em capulho' FROM public.nutrir_culturas WHERE nome = 'Algodão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'S0-S1 — Dormência/Brotação', 1, 'Bulbilhos dormentes até início da brotação' FROM public.nutrir_culturas WHERE nome = 'Alho' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'EM — Emergência', 2, 'Desenvolvimento dos primórdios das primeiras folhas' FROM public.nutrir_culturas WHERE nome = 'Alho' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V2-Vn — Desenvolvimento vegetativo', 3, 'Surgimento das folhas verdadeiras (V2 a Vn)' FROM public.nutrir_culturas WHERE nome = 'Alho' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R1 — Diferenciação', 4, 'Diferenciação do bulbo em novos bulbilhos' FROM public.nutrir_culturas WHERE nome = 'Alho' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R2-R3 — Crescimento reprodutivo', 5, 'Crescimento dos bulbilhos (25-50% da área do bulbo)' FROM public.nutrir_culturas WHERE nome = 'Alho' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R4-R5 — Maturação', 6, 'Bulbilhos ocupando 75-100% do bulbo, ponto de colheita' FROM public.nutrir_culturas WHERE nome = 'Alho' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'VE — Emergência', 1, 'Emergência da plântula' FROM public.nutrir_culturas WHERE nome = 'Amendoim' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V1-Vn — Desenvolvimento vegetativo', 2, 'Formação de folhas compostas' FROM public.nutrir_culturas WHERE nome = 'Amendoim' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R1 — Início do florescimento', 3, 'Primeira flor aberta' FROM public.nutrir_culturas WHERE nome = 'Amendoim' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R2 — Formação do ginóforo', 4, 'Ginóforo penetra no solo' FROM public.nutrir_culturas WHERE nome = 'Amendoim' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R3 — Formação da vagem', 5, 'Início da formação da vagem' FROM public.nutrir_culturas WHERE nome = 'Amendoim' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R4 — Vagem plena', 6, 'Vagem completamente formada' FROM public.nutrir_culturas WHERE nome = 'Amendoim' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R5 — Início da maturação', 7, 'Início da maturação das sementes' FROM public.nutrir_culturas WHERE nome = 'Amendoim' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R6 — Maturação plena', 8, 'Sementes maduras' FROM public.nutrir_culturas WHERE nome = 'Amendoim' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V1 — Formação do colar da 1ª folha', 1, 'Formação do colar da 1ª folha no colmo principal' FROM public.nutrir_culturas WHERE nome = 'Arroz' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V2 — Formação do colar da 2ª folha', 2, 'Formação do colar da 2ª folha no colmo principal' FROM public.nutrir_culturas WHERE nome = 'Arroz' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Vn — Formação da n-ésima folha', 3, 'Formação da folha-bandeira no colmo principal' FROM public.nutrir_culturas WHERE nome = 'Arroz' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R0 — Início do desenvolvimento da panícula', 4, 'Início do desenvolvimento da panícula' FROM public.nutrir_culturas WHERE nome = 'Arroz' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R1 — Diferenciação da panícula', 5, 'Diferenciação da panícula' FROM public.nutrir_culturas WHERE nome = 'Arroz' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R2 — Formação do colar da folha-bandeira', 6, 'Formação do colar da folha-bandeira' FROM public.nutrir_culturas WHERE nome = 'Arroz' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R3 — Emissão da panícula', 7, 'Emissão da panícula na bainha' FROM public.nutrir_culturas WHERE nome = 'Arroz' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R4 — Antese', 8, 'Um ou mais floretes da panícula em antese' FROM public.nutrir_culturas WHERE nome = 'Arroz' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R5 — Expansão do grão (comprimento)', 9, 'Cariopse da panícula apresenta alongamento' FROM public.nutrir_culturas WHERE nome = 'Arroz' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R6 — Expansão do grão (espessura)', 10, 'Cariopse preencheu completamente a casca' FROM public.nutrir_culturas WHERE nome = 'Arroz' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R7 — Secamento do grão', 11, 'Grão com pericarpo amarelo' FROM public.nutrir_culturas WHERE nome = 'Arroz' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R8 — Maturação do grão', 12, 'Grão com pericarpo marrom' FROM public.nutrir_culturas WHERE nome = 'Arroz' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R9 — Completa maturidade', 13, 'Todos os grãos com pericarpo marrom' FROM public.nutrir_culturas WHERE nome = 'Arroz' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 00-09 — Germinação', 1, 'Da semente seca à emergência' FROM public.nutrir_culturas WHERE nome = 'Aveia' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 10-19 — Desenvolvimento da folha', 2, 'Desenvolvimento das folhas' FROM public.nutrir_culturas WHERE nome = 'Aveia' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 20-29 — Afilhamento', 3, 'Formação dos afilhos' FROM public.nutrir_culturas WHERE nome = 'Aveia' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 30-39 — Alongamento do colmo', 4, 'Alongamento dos entrenós' FROM public.nutrir_culturas WHERE nome = 'Aveia' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 40-49 — Emborrachamento', 5, 'Bainha da folha bandeira se estende' FROM public.nutrir_culturas WHERE nome = 'Aveia' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 50-59 — Espigamento', 6, 'Emergência da panícula' FROM public.nutrir_culturas WHERE nome = 'Aveia' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 60-69 — Florescimento', 7, 'Início até florescimento completo' FROM public.nutrir_culturas WHERE nome = 'Aveia' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 70-79 — Grão leitoso', 8, 'Desenvolvimento do grão' FROM public.nutrir_culturas WHERE nome = 'Aveia' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 80-89 — Grão pastoso/farináceo', 9, 'Maturação do grão' FROM public.nutrir_culturas WHERE nome = 'Aveia' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 90-99 — Maturação/Colheita', 10, 'Maturação completa dos grãos' FROM public.nutrir_culturas WHERE nome = 'Aveia' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'ES — Emissão de espata', 1, 'Lançamento das espatas que protegem as inflorescências' FROM public.nutrir_culturas WHERE nome = 'Açaí' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'FL — Floração', 2, 'Abertura das flores (antese)' FROM public.nutrir_culturas WHERE nome = 'Açaí' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'FV — Frutos verdes', 3, 'Desenvolvimento inicial dos frutos' FROM public.nutrir_culturas WHERE nome = 'Açaí' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'FM — Frutos maduros', 4, 'Maturação e colheita dos frutos' FROM public.nutrir_culturas WHERE nome = 'Açaí' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'VEG — Desenvolvimento vegetativo', 1, 'Crescimento do pseudocaule e folhas' FROM public.nutrir_culturas WHERE nome = 'Banana' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'FLO — Florescimento', 2, 'Emissão da inflorescência (coração)' FROM public.nutrir_culturas WHERE nome = 'Banana' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'FRU — Frutificação', 3, 'Desenvolvimento dos frutos (pencas)' FROM public.nutrir_culturas WHERE nome = 'Banana' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'MAT — Maturação/Colheita', 4, 'Maturação dos frutos e colheita do cacho' FROM public.nutrir_culturas WHERE nome = 'Banana' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '00-09 — Germinação/Brotação', 1, 'Tubérculo-semente em dormência até brotos visíveis' FROM public.nutrir_culturas WHERE nome = 'Batata' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '10-19 — Desenvolvimento das folhas', 2, 'Emergência e expansão das folhas' FROM public.nutrir_culturas WHERE nome = 'Batata' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '21-29 — Formação de brotos laterais', 3, 'Brotos laterais basais visíveis' FROM public.nutrir_culturas WHERE nome = 'Batata' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '31-39 — Cobertura do solo', 4, 'De 10% a 90% de cobertura do solo' FROM public.nutrir_culturas WHERE nome = 'Batata' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '40-49 — Formação dos tubérculos', 5, 'Início da formação até massa máxima de tubérculos' FROM public.nutrir_culturas WHERE nome = 'Batata' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '51-69 — Floração', 6, 'Botões florais visíveis até fim da floração' FROM public.nutrir_culturas WHERE nome = 'Batata' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '91-99 — Senescência/Colheita', 7, 'Início da senescência até colheita' FROM public.nutrir_culturas WHERE nome = 'Batata' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'I — Estabelecimento', 1, 'Do plantio das ramas ao enraizamento' FROM public.nutrir_culturas WHERE nome = 'Batata-doce' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'II — Desenvolvimento vegetativo', 2, 'Crescimento das ramas e folhas' FROM public.nutrir_culturas WHERE nome = 'Batata-doce' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'III — Tuberização', 3, 'Formação e enchimento das raízes tuberosas' FROM public.nutrir_culturas WHERE nome = 'Batata-doce' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'IV — Maturação', 4, 'Maturação das raízes tuberosas' FROM public.nutrir_culturas WHERE nome = 'Batata-doce' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '0 — Germinação', 1, 'Início da germinação da semente' FROM public.nutrir_culturas WHERE nome = 'Cacau' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '1 — Crescimento vegetativo', 2, 'Desenvolvimento de folhas e ramos (juvenil)' FROM public.nutrir_culturas WHERE nome = 'Cacau' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '5 — Florescimento', 3, 'Aparecimento das primeiras flores' FROM public.nutrir_culturas WHERE nome = 'Cacau' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '6 — Frutificação', 4, 'Desenvolvimento dos frutos (cherelles)' FROM public.nutrir_culturas WHERE nome = 'Cacau' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '8 — Maturação', 5, 'Maturação e colheita dos frutos' FROM public.nutrir_culturas WHERE nome = 'Cacau' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '0 — Gemas dormentes', 1, 'Gemas dormentes nos nós dos ramos plagiotrópicos' FROM public.nutrir_culturas WHERE nome = 'Café Arábica' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '1 — Gemas entumecidas', 2, 'Aumento do potencial hídrico nas gemas florais' FROM public.nutrir_culturas WHERE nome = 'Café Arábica' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '2 — Botões florais', 3, 'Botões florais crescem com mobilização de água e nutrientes' FROM public.nutrir_culturas WHERE nome = 'Café Arábica' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '3 — Abertura das flores', 4, 'Extensão dos botões florais até a abertura das flores' FROM public.nutrir_culturas WHERE nome = 'Café Arábica' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '4 — Queda das pétalas', 5, 'Queda das pétalas após a abertura das flores' FROM public.nutrir_culturas WHERE nome = 'Café Arábica' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '5 — Chumbinho', 6, 'Início da formação dos frutos, sem crescimento visível' FROM public.nutrir_culturas WHERE nome = 'Café Arábica' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '6 — Expansão dos frutos', 7, 'Rápida expansão dos frutos' FROM public.nutrir_culturas WHERE nome = 'Café Arábica' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '7 — Grão verde (Granação)', 8, 'Formação do endosperma e granação dos frutos' FROM public.nutrir_culturas WHERE nome = 'Café Arábica' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '8 — Verde cana', 9, 'Início da maturação, frutos começam a mudar de cor' FROM public.nutrir_culturas WHERE nome = 'Café Arábica' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '9 — Cereja', 10, 'Frutos atingem coloração vermelha ou amarela' FROM public.nutrir_culturas WHERE nome = 'Café Arábica' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '10 — Início da seca', 11, 'Frutos começam a secar' FROM public.nutrir_culturas WHERE nome = 'Café Arábica' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '11 — Seco', 12, 'Frutos atingem o estádio de seco' FROM public.nutrir_culturas WHERE nome = 'Café Arábica' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '0 — Gemas dormentes', 1, 'Gemas dormentes nos nós dos ramos' FROM public.nutrir_culturas WHERE nome = 'Café Conilon' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '1 — Gemas entumecidas', 2, 'Aumento do potencial hídrico nas gemas florais' FROM public.nutrir_culturas WHERE nome = 'Café Conilon' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '2 — Botões florais', 3, 'Botões florais crescem' FROM public.nutrir_culturas WHERE nome = 'Café Conilon' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '3 — Abertura das flores', 4, 'Abertura das flores' FROM public.nutrir_culturas WHERE nome = 'Café Conilon' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '4 — Queda das pétalas', 5, 'Queda das pétalas' FROM public.nutrir_culturas WHERE nome = 'Café Conilon' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '5 — Chumbinho', 6, 'Início da formação dos frutos' FROM public.nutrir_culturas WHERE nome = 'Café Conilon' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '6 — Expansão dos frutos', 7, 'Rápida expansão dos frutos' FROM public.nutrir_culturas WHERE nome = 'Café Conilon' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '7 — Grão verde (Granação)', 8, 'Formação do endosperma' FROM public.nutrir_culturas WHERE nome = 'Café Conilon' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '8 — Verde cana', 9, 'Início da maturação' FROM public.nutrir_culturas WHERE nome = 'Café Conilon' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '9 — Cereja', 10, 'Frutos maduros' FROM public.nutrir_culturas WHERE nome = 'Café Conilon' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '1 — Brotação e emergência', 1, 'Broto rompe as folhas da gema e se desenvolve em direção à superfície do solo' FROM public.nutrir_culturas WHERE nome = 'Cana-de-açúcar' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '2 — Perfilhamento', 2, 'Emissão de colmos por uma mesma planta (perfilhos)' FROM public.nutrir_culturas WHERE nome = 'Cana-de-açúcar' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '3 — Crescimento dos colmos', 3, 'Colmos sobreviventes continuam crescimento, ganhando altura e acumulando açúcar' FROM public.nutrir_culturas WHERE nome = 'Cana-de-açúcar' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '4 — Maturação dos colmos', 4, 'Maturação inicia-se com acúmulo de açúcar na base de cada colmo' FROM public.nutrir_culturas WHERE nome = 'Cana-de-açúcar' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 00-09 — Germinação', 1, 'Da semente seca à emergência' FROM public.nutrir_culturas WHERE nome = 'Canola' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 10-19 — Desenvolvimento da folha', 2, 'Desenvolvimento das folhas em roseta' FROM public.nutrir_culturas WHERE nome = 'Canola' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 30-39 — Alongamento do caule', 3, 'Alongamento do caule principal' FROM public.nutrir_culturas WHERE nome = 'Canola' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 50-59 — Emergência da inflorescência', 4, 'Botões florais visíveis' FROM public.nutrir_culturas WHERE nome = 'Canola' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 60-69 — Florescimento', 5, 'Abertura das flores' FROM public.nutrir_culturas WHERE nome = 'Canola' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 70-79 — Desenvolvimento das síliquas', 6, 'Formação e enchimento das síliquas' FROM public.nutrir_culturas WHERE nome = 'Canola' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 80-89 — Maturação', 7, 'Maturação das síliquas e sementes' FROM public.nutrir_culturas WHERE nome = 'Canola' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Fase I — Estabelecimento', 1, 'Da emergência ao início da bulbificação' FROM public.nutrir_culturas WHERE nome = 'Cebola' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Fase II — Desenvolvimento vegetativo', 2, 'Crescimento das folhas' FROM public.nutrir_culturas WHERE nome = 'Cebola' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Fase III — Bulbificação', 3, 'Formação e enchimento do bulbo' FROM public.nutrir_culturas WHERE nome = 'Cebola' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Fase IV — Maturação', 4, 'Tombamento das folhas e maturação' FROM public.nutrir_culturas WHERE nome = 'Cebola' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'I — Inicial', 1, 'Da semeadura ao estabelecimento inicial das plantas' FROM public.nutrir_culturas WHERE nome = 'Cenoura' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'II — Vegetativo', 2, 'Do estabelecimento ao início do engrossamento de raízes' FROM public.nutrir_culturas WHERE nome = 'Cenoura' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'III — Engrossamento de raiz', 3, 'Crescimento rápido em diâmetro da raiz de armazenamento' FROM public.nutrir_culturas WHERE nome = 'Cenoura' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'IV — Maturação', 4, 'Início da maturação até a colheita' FROM public.nutrir_culturas WHERE nome = 'Cenoura' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 00-09 — Germinação', 1, 'Da semente seca à emergência' FROM public.nutrir_culturas WHERE nome = 'Centeio' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 10-19 — Desenvolvimento da folha', 2, 'Desenvolvimento das folhas' FROM public.nutrir_culturas WHERE nome = 'Centeio' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 20-29 — Afilhamento', 3, 'Formação dos afilhos' FROM public.nutrir_culturas WHERE nome = 'Centeio' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 30-39 — Alongamento do colmo', 4, 'Alongamento dos entrenós' FROM public.nutrir_culturas WHERE nome = 'Centeio' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 40-49 — Emborrachamento', 5, 'Bainha da folha bandeira se estende' FROM public.nutrir_culturas WHERE nome = 'Centeio' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 50-59 — Espigamento', 6, 'Emergência da espiga' FROM public.nutrir_culturas WHERE nome = 'Centeio' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 60-69 — Florescimento', 7, 'Início até florescimento completo' FROM public.nutrir_culturas WHERE nome = 'Centeio' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 70-79 — Grão leitoso', 8, 'Desenvolvimento do grão' FROM public.nutrir_culturas WHERE nome = 'Centeio' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 80-89 — Grão pastoso/farináceo', 9, 'Maturação do grão' FROM public.nutrir_culturas WHERE nome = 'Centeio' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 90-99 — Maturação/Colheita', 10, 'Maturação completa dos grãos' FROM public.nutrir_culturas WHERE nome = 'Centeio' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 00-09 — Germinação', 1, 'Da semente seca à emergência' FROM public.nutrir_culturas WHERE nome = 'Cevada' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 10-19 — Desenvolvimento da folha', 2, 'Desenvolvimento das folhas' FROM public.nutrir_culturas WHERE nome = 'Cevada' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 20-29 — Afilhamento', 3, 'Formação dos afilhos' FROM public.nutrir_culturas WHERE nome = 'Cevada' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 30-39 — Alongamento do colmo', 4, 'Alongamento dos entrenós' FROM public.nutrir_culturas WHERE nome = 'Cevada' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 40-49 — Emborrachamento', 5, 'Bainha da folha bandeira se estende' FROM public.nutrir_culturas WHERE nome = 'Cevada' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 50-59 — Espigamento', 6, 'Emergência da espiga' FROM public.nutrir_culturas WHERE nome = 'Cevada' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 60-69 — Florescimento', 7, 'Início até florescimento completo' FROM public.nutrir_culturas WHERE nome = 'Cevada' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 70-79 — Grão leitoso', 8, 'Desenvolvimento do grão' FROM public.nutrir_culturas WHERE nome = 'Cevada' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 80-89 — Grão pastoso/farináceo', 9, 'Maturação do grão' FROM public.nutrir_culturas WHERE nome = 'Cevada' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BBCH 90-99 — Maturação/Colheita', 10, 'Maturação completa dos grãos' FROM public.nutrir_culturas WHERE nome = 'Cevada' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'JUV — Juvenil', 1, 'Fase juvenil sem produção' FROM public.nutrir_culturas WHERE nome = 'Coco' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'FLO — Florescimento', 2, 'Emissão das inflorescências' FROM public.nutrir_culturas WHERE nome = 'Coco' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'FRU — Frutificação', 3, 'Desenvolvimento dos frutos' FROM public.nutrir_culturas WHERE nome = 'Coco' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'MAT — Maturação', 4, 'Maturação e colheita' FROM public.nutrir_culturas WHERE nome = 'Coco' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'JUV — Juvenil', 1, 'Fase juvenil sem produção' FROM public.nutrir_culturas WHERE nome = 'Dendê' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'FLO — Florescimento', 2, 'Emissão das inflorescências' FROM public.nutrir_culturas WHERE nome = 'Dendê' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'FRU — Frutificação', 3, 'Desenvolvimento dos cachos de frutos' FROM public.nutrir_culturas WHERE nome = 'Dendê' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'MAT — Maturação', 4, 'Maturação e colheita dos cachos' FROM public.nutrir_culturas WHERE nome = 'Dendê' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'BF — Botão floral', 1, 'Diferenciação e desenvolvimento dos botões florais' FROM public.nutrir_culturas WHERE nome = 'Erva-mate' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'FL — Florescimento (Antese)', 2, 'Abertura das flores' FROM public.nutrir_culturas WHERE nome = 'Erva-mate' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'FR — Frutificação', 3, 'Início e desenvolvimento dos frutos' FROM public.nutrir_culturas WHERE nome = 'Erva-mate' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'MF — Maturação dos frutos', 4, 'Desenvolvimento final e maturação dos frutos' FROM public.nutrir_culturas WHERE nome = 'Erva-mate' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'IMP — Implantação', 1, 'Plantio e estabelecimento das mudas' FROM public.nutrir_culturas WHERE nome = 'Eucalipto' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'CRE — Crescimento juvenil', 2, 'Crescimento rápido em altura e diâmetro' FROM public.nutrir_culturas WHERE nome = 'Eucalipto' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'DES — Desenvolvimento pleno', 3, 'Máximo incremento em volume de madeira' FROM public.nutrir_culturas WHERE nome = 'Eucalipto' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'MAT — Maturação', 4, 'Redução do crescimento e maturação da madeira' FROM public.nutrir_culturas WHERE nome = 'Eucalipto' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'COL — Colheita', 5, 'Corte e colheita da madeira' FROM public.nutrir_culturas WHERE nome = 'Eucalipto' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V0 — Germinação', 1, 'Semente absorve água, incha e inicia a germinação' FROM public.nutrir_culturas WHERE nome = 'Feijão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V1 — Emergência', 2, '50% dos cotilédones visíveis' FROM public.nutrir_culturas WHERE nome = 'Feijão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V2 — Folhas primárias', 3, 'Abertura e crescimento das folhas primárias' FROM public.nutrir_culturas WHERE nome = 'Feijão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V3 — Primeira folha composta', 4, 'Primeira folha trifoliolada completamente aberta' FROM public.nutrir_culturas WHERE nome = 'Feijão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V4 — Terceira folha trifoliolada', 5, 'Terceira folha trifoliolada completamente aberta' FROM public.nutrir_culturas WHERE nome = 'Feijão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R5 — Pré-floração', 6, 'Primeiros botões florais visíveis' FROM public.nutrir_culturas WHERE nome = 'Feijão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R6 — Floração', 7, 'Abertura das flores' FROM public.nutrir_culturas WHERE nome = 'Feijão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R7 — Formação das vagens', 8, 'Formação das primeiras vagens (canivetes)' FROM public.nutrir_culturas WHERE nome = 'Feijão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R8 — Enchimento das vagens', 9, 'Enchimento dos grãos e aumento do volume' FROM public.nutrir_culturas WHERE nome = 'Feijão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R9 — Maturação', 10, 'Vagens perdem a cor e começam a secar' FROM public.nutrir_culturas WHERE nome = 'Feijão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'VE — Emergência', 1, 'Emergência da plântula' FROM public.nutrir_culturas WHERE nome = 'Gergelim' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V1-Vn — Desenvolvimento vegetativo', 2, 'Formação de folhas e ramificações' FROM public.nutrir_culturas WHERE nome = 'Gergelim' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R1 — Início do florescimento', 3, 'Abertura das primeiras flores' FROM public.nutrir_culturas WHERE nome = 'Gergelim' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R2 — Florescimento pleno', 4, 'Florescimento em toda a planta' FROM public.nutrir_culturas WHERE nome = 'Gergelim' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R3 — Formação das cápsulas', 5, 'Desenvolvimento das cápsulas' FROM public.nutrir_culturas WHERE nome = 'Gergelim' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R4 — Maturação', 6, 'Maturação e deiscência das cápsulas' FROM public.nutrir_culturas WHERE nome = 'Gergelim' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'VE — Emergência', 1, 'Aparecimento da primeira folha com hipocótilo elevado' FROM public.nutrir_culturas WHERE nome = 'Girassol' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V1-Vn — Formação de folhas', 2, 'Formação de folhas com mais de 4cm de comprimento' FROM public.nutrir_culturas WHERE nome = 'Girassol' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R1 — Broto floral', 3, 'Pequeno broto floral com brácteas semelhantes a uma estrela' FROM public.nutrir_culturas WHERE nome = 'Girassol' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R2 — Alongamento do broto floral', 4, 'Broto floral se distancia 0,5-2,0cm da última folha' FROM public.nutrir_culturas WHERE nome = 'Girassol' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R3 — Alongamento avançado', 5, 'Broto floral a mais de 2,0cm acima da última folha' FROM public.nutrir_culturas WHERE nome = 'Girassol' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R4 — Abertura da inflorescência', 6, 'Início da abertura da inflorescência' FROM public.nutrir_culturas WHERE nome = 'Girassol' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R5 — Florescimento', 7, 'Início do florescimento' FROM public.nutrir_culturas WHERE nome = 'Girassol' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R6 — Fim do florescimento', 8, 'Florescimento completo' FROM public.nutrir_culturas WHERE nome = 'Girassol' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R7 — Enchimento de grãos', 9, 'Início do enchimento de grãos' FROM public.nutrir_culturas WHERE nome = 'Girassol' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R8 — Maturação fisiológica', 10, 'Dorso do capítulo amarelo, brácteas verdes' FROM public.nutrir_culturas WHERE nome = 'Girassol' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R9 — Maturação completa', 11, 'Brácteas marrons, capítulo seco' FROM public.nutrir_culturas WHERE nome = 'Girassol' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'F1 — Brotação', 1, 'Início da brotação após a poda' FROM public.nutrir_culturas WHERE nome = 'Goiaba' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'F2 — Crescimento dos ramos', 2, 'Desenvolvimento dos ramos e folhas' FROM public.nutrir_culturas WHERE nome = 'Goiaba' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'F3 — Florescimento', 3, 'Abertura das flores' FROM public.nutrir_culturas WHERE nome = 'Goiaba' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'F4 — Frutificação', 4, 'Desenvolvimento dos frutos' FROM public.nutrir_culturas WHERE nome = 'Goiaba' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'F5 — Maturação', 5, 'Maturação e colheita dos frutos' FROM public.nutrir_culturas WHERE nome = 'Goiaba' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'REP — Repouso', 1, 'Período de repouso da planta, após a colheita' FROM public.nutrir_culturas WHERE nome = 'Guaraná' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'FLO — Florada', 2, 'Início da floração do guaranazeiro' FROM public.nutrir_culturas WHERE nome = 'Guaraná' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'FRU — Frutificação', 3, 'Desenvolvimento e colheita dos frutos' FROM public.nutrir_culturas WHERE nome = 'Guaraná' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '0 — Botão floral dormente', 1, 'Gema ou botão floral dormente' FROM public.nutrir_culturas WHERE nome = 'Laranja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '1 — Botão floral visível', 2, 'Botão floral visível' FROM public.nutrir_culturas WHERE nome = 'Laranja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '2 — Flor completa', 3, 'Flor completa com pétalas fechadas' FROM public.nutrir_culturas WHERE nome = 'Laranja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '3 — Abertura da flor', 4, 'Abertura da flor (antese)' FROM public.nutrir_culturas WHERE nome = 'Laranja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '4 — Pétalas secas', 5, 'Pétalas secas com estilete' FROM public.nutrir_culturas WHERE nome = 'Laranja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '5 — Queda de pétalas', 6, 'Sem pétalas e sem estilete' FROM public.nutrir_culturas WHERE nome = 'Laranja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '6 — Bola de gude', 7, 'Fruto com ~3,8 cm de diâmetro' FROM public.nutrir_culturas WHERE nome = 'Laranja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '7 — Bola de pingue-pongue', 8, 'Fruto com ~5,8 cm' FROM public.nutrir_culturas WHERE nome = 'Laranja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '8 — Fruto verde', 9, 'Fruto verde próximo ao tamanho final' FROM public.nutrir_culturas WHERE nome = 'Laranja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '9 — Mudança de cor', 10, 'Fruto na mudança de cor verde para amarela' FROM public.nutrir_culturas WHERE nome = 'Laranja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '10 — Maturação', 11, 'Ratio > 12, fruto maduro' FROM public.nutrir_culturas WHERE nome = 'Laranja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '0-3 — Florescimento', 1, 'Do botão floral à abertura da flor' FROM public.nutrir_culturas WHERE nome = 'Limão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '4-5 — Queda de pétalas/Chumbinho', 2, 'Queda de pétalas e início da formação do fruto' FROM public.nutrir_culturas WHERE nome = 'Limão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '6-7 — Crescimento do fruto', 3, 'Expansão do fruto' FROM public.nutrir_culturas WHERE nome = 'Limão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '8-9 — Maturação', 4, 'Mudança de cor e maturação' FROM public.nutrir_culturas WHERE nome = 'Limão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'VE — Emergência', 1, 'Emergência da plântula' FROM public.nutrir_culturas WHERE nome = 'Mamona' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V1-Vn — Desenvolvimento vegetativo', 2, 'Formação de folhas' FROM public.nutrir_culturas WHERE nome = 'Mamona' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R1 — Emissão do 1º racemo', 3, 'Aparecimento do primeiro racemo' FROM public.nutrir_culturas WHERE nome = 'Mamona' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R2 — Florescimento', 4, 'Abertura das flores' FROM public.nutrir_culturas WHERE nome = 'Mamona' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R3 — Frutificação', 5, 'Desenvolvimento dos frutos' FROM public.nutrir_culturas WHERE nome = 'Mamona' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R4 — Maturação', 6, 'Maturação e colheita' FROM public.nutrir_culturas WHERE nome = 'Mamona' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'VEG — Vegetativo', 1, 'Crescimento do caule e folhas' FROM public.nutrir_culturas WHERE nome = 'Mamão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'FLO — Florescimento', 2, 'Emissão das flores' FROM public.nutrir_culturas WHERE nome = 'Mamão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'FRU — Frutificação', 3, 'Desenvolvimento dos frutos' FROM public.nutrir_culturas WHERE nome = 'Mamão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'MAT — Maturação', 4, 'Maturação e colheita dos frutos' FROM public.nutrir_culturas WHERE nome = 'Mamão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'E — Emergência', 1, 'Surgimento das primeiras raízes adventícias e brotos' FROM public.nutrir_culturas WHERE nome = 'Mandioca' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'DF/FSR — Desenvolvimento foliar / Formação do sistema radicular', 2, 'Expansão das folhas verdadeiras e formação das raízes de reserva' FROM public.nutrir_culturas WHERE nome = 'Mandioca' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'DRF — Desenvolvimento dos ramos e folhas', 3, 'Máxima interceptação de luz e crescimento vegetativo ativo' FROM public.nutrir_culturas WHERE nome = 'Mandioca' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'TCR — Translocação de carboidratos para raízes', 4, 'Aceleração da tuberização e acumulação de matéria seca nas raízes' FROM public.nutrir_culturas WHERE nome = 'Mandioca' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'D — Dormência', 5, 'Redução drástica do crescimento vegetativo, queda das folhas' FROM public.nutrir_culturas WHERE nome = 'Mandioca' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '0 — Repouso vegetativo', 1, 'Período de dormência' FROM public.nutrir_culturas WHERE nome = 'Manga' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '1 — Brotação', 2, 'Emissão de novos fluxos vegetativos' FROM public.nutrir_culturas WHERE nome = 'Manga' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '2 — Indução floral', 3, 'Indução e diferenciação floral' FROM public.nutrir_culturas WHERE nome = 'Manga' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '3 — Florescimento', 4, 'Abertura das flores' FROM public.nutrir_culturas WHERE nome = 'Manga' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '4 — Frutificação', 5, 'Pegamento e desenvolvimento dos frutos' FROM public.nutrir_culturas WHERE nome = 'Manga' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '5 — Maturação', 6, 'Maturação e colheita dos frutos' FROM public.nutrir_culturas WHERE nome = 'Manga' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'S-GF — Semeadura à primeira gema floral', 1, 'Da semeadura ao surgimento da primeira gema floral' FROM public.nutrir_culturas WHERE nome = 'Maracujá' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'GF-AT — Gema floral à antese', 2, 'Do surgimento da gema floral à antese' FROM public.nutrir_culturas WHERE nome = 'Maracujá' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'AT-MF — Antese à maturação fisiológica', 3, 'Da antese à maturação fisiológica do fruto' FROM public.nutrir_culturas WHERE nome = 'Maracujá' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'A — Gema dormente', 1, 'Gema em dormência invernal' FROM public.nutrir_culturas WHERE nome = 'Maçã' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'B — Ponta de prata', 2, 'Gema inchada com escamas prateadas' FROM public.nutrir_culturas WHERE nome = 'Maçã' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'C — Ponta verde', 3, 'Aparecimento da ponta verde' FROM public.nutrir_culturas WHERE nome = 'Maçã' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'D — Orelha de rato', 4, 'Saída das primeiras folhas' FROM public.nutrir_culturas WHERE nome = 'Maçã' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'E — Botão rosado', 5, 'Botões florais rosados visíveis' FROM public.nutrir_culturas WHERE nome = 'Maçã' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'F — Florescimento', 6, 'Abertura das flores' FROM public.nutrir_culturas WHERE nome = 'Maçã' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'G — Queda de pétalas', 7, 'Queda das pétalas' FROM public.nutrir_culturas WHERE nome = 'Maçã' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'H — Frutificação', 8, 'Desenvolvimento dos frutos' FROM public.nutrir_culturas WHERE nome = 'Maçã' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'I — Maturação', 9, 'Maturação e colheita' FROM public.nutrir_culturas WHERE nome = 'Maçã' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'I — Inicial', 1, 'Da semeadura à 4ª folha definitiva' FROM public.nutrir_culturas WHERE nome = 'Melancia' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'II — Desenvolvimento vegetativo', 2, 'Da 4ª folha ao início do florescimento' FROM public.nutrir_culturas WHERE nome = 'Melancia' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'III — Florescimento/Frutificação', 3, 'Do florescimento ao início da maturação' FROM public.nutrir_culturas WHERE nome = 'Melancia' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'IV — Maturação/Colheita', 4, 'Da maturação à colheita' FROM public.nutrir_culturas WHERE nome = 'Melancia' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'F1 — Inicial', 1, 'Da semeadura até a emissão da 4ª folha definitiva' FROM public.nutrir_culturas WHERE nome = 'Melão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'F2 — Desenvolvimento vegetativo', 2, 'Da 4ª folha até o início do florescimento' FROM public.nutrir_culturas WHERE nome = 'Melão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'F3 — Florescimento e Frutificação', 3, 'Do início do florescimento ao início da maturação' FROM public.nutrir_culturas WHERE nome = 'Melão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'F4 — Maturação e Colheita', 4, 'Da maturação dos frutos até a colheita' FROM public.nutrir_culturas WHERE nome = 'Melão' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'ED0 — Emergência', 1, 'Emergência do coleóptilo da superfície do solo' FROM public.nutrir_culturas WHERE nome = 'Milheto' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'ED1 — Três folhas', 2, 'Visibilidade da lâmina da terceira folha' FROM public.nutrir_culturas WHERE nome = 'Milheto' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'ED2 — Cinco folhas', 3, 'Lâmina da quinta folha é visível' FROM public.nutrir_culturas WHERE nome = 'Milheto' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'ED3 — Iniciação da panícula', 4, 'Mudança do ponto de crescimento para reprodutivo' FROM public.nutrir_culturas WHERE nome = 'Milheto' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'ED4 — Folha bandeira', 5, 'Não há mais folhas com lâminas enroladas' FROM public.nutrir_culturas WHERE nome = 'Milheto' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'ED5 — Emborrachamento', 6, 'Panícula na bainha da folha bandeira' FROM public.nutrir_culturas WHERE nome = 'Milheto' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'ED6 — 50% florescimento', 7, 'Emergência do estigma atinge o meio da panícula' FROM public.nutrir_culturas WHERE nome = 'Milheto' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'ED7 — Leitoso', 8, 'Os grãos tornam-se visíveis no florete' FROM public.nutrir_culturas WHERE nome = 'Milheto' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'ED8 — Pastoso/Farináceo', 9, 'Fluido leitoso muda de semissólido para sólido' FROM public.nutrir_culturas WHERE nome = 'Milheto' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'ED9 — Maturidade fisiológica', 10, 'Formação da camada preta no hilo' FROM public.nutrir_culturas WHERE nome = 'Milheto' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'VE — Emergência', 1, 'A plântula emerge do solo' FROM public.nutrir_culturas WHERE nome = 'Milho' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V1 — Primeira folha', 2, 'Primeira folha com colar visível' FROM public.nutrir_culturas WHERE nome = 'Milho' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V2 — Segunda folha', 3, 'Segunda folha com colar visível' FROM public.nutrir_culturas WHERE nome = 'Milho' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V3 — Terceira folha', 4, 'Terceira folha com colar visível' FROM public.nutrir_culturas WHERE nome = 'Milho' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Vn — N-ésima folha', 5, 'N-ésima folha com colar visível' FROM public.nutrir_culturas WHERE nome = 'Milho' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'VT — Pendoamento', 6, 'Último ramo do pendão completamente visível' FROM public.nutrir_culturas WHERE nome = 'Milho' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R1 — Embonecamento', 7, 'Estilos-estigmas (cabelos) visíveis fora da espiga' FROM public.nutrir_culturas WHERE nome = 'Milho' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R2 — Grão bolha d''água', 8, 'Grãos pequenos e brancos, com fluido transparente' FROM public.nutrir_culturas WHERE nome = 'Milho' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R3 — Grão leitoso', 9, 'Grãos amarelos com fluido leitoso e doce' FROM public.nutrir_culturas WHERE nome = 'Milho' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R4 — Grão pastoso', 10, 'Fluido dos grãos com consistência pastosa' FROM public.nutrir_culturas WHERE nome = 'Milho' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R5 — Grão farináceo (dentado)', 11, 'Grãos com consistência farinácea, formando o dente' FROM public.nutrir_culturas WHERE nome = 'Milho' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R6 — Maturidade fisiológica', 12, 'Camada preta formada na base do grão' FROM public.nutrir_culturas WHERE nome = 'Milho' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'VEG — Crescimento vegetativo', 1, 'Fase de estabelecimento e crescimento ativo da pastagem' FROM public.nutrir_culturas WHERE nome = 'Pastagem' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'PER — Perfilhamento', 2, 'Emissão de novos perfilhos' FROM public.nutrir_culturas WHERE nome = 'Pastagem' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'ALO — Alongamento', 3, 'Alongamento do colmo e folhas' FROM public.nutrir_culturas WHERE nome = 'Pastagem' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'FLO — Florescimento', 4, 'Início do florescimento da pastagem' FROM public.nutrir_culturas WHERE nome = 'Pastagem' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'MAT — Maturação', 5, 'Maturação fisiológica da pastagem' FROM public.nutrir_culturas WHERE nome = 'Pastagem' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'SEN — Senescência', 6, 'Envelhecimento e morte das folhas' FROM public.nutrir_culturas WHERE nome = 'Pastagem' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'GER — Germinação', 1, 'Período de germinação das sementes' FROM public.nutrir_culturas WHERE nome = 'Pimenta-do-reino' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'VEG — Crescimento vegetativo', 2, 'Desenvolvimento da planta, emissão de folhas e ramos' FROM public.nutrir_culturas WHERE nome = 'Pimenta-do-reino' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'FLO — Florescimento', 3, 'Emissão das inflorescências (espigas)' FROM public.nutrir_culturas WHERE nome = 'Pimenta-do-reino' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'FRU — Frutificação', 4, 'Desenvolvimento e maturação dos frutos' FROM public.nutrir_culturas WHERE nome = 'Pimenta-do-reino' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'IMP — Implantação', 1, 'Plantio e estabelecimento das mudas' FROM public.nutrir_culturas WHERE nome = 'Pinus' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'CRE — Crescimento juvenil', 2, 'Crescimento em altura e diâmetro' FROM public.nutrir_culturas WHERE nome = 'Pinus' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'DES — Desenvolvimento pleno', 3, 'Incremento em volume de madeira' FROM public.nutrir_culturas WHERE nome = 'Pinus' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'MAT — Maturação', 4, 'Maturação da madeira' FROM public.nutrir_culturas WHERE nome = 'Pinus' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'COL — Colheita', 5, 'Corte e colheita da madeira' FROM public.nutrir_culturas WHERE nome = 'Pinus' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'IMP — Implantação', 1, 'Plantio e estabelecimento das mudas' FROM public.nutrir_culturas WHERE nome = 'Seringueira' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'CRE — Crescimento juvenil', 2, 'Crescimento até atingir diâmetro de sangria' FROM public.nutrir_culturas WHERE nome = 'Seringueira' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'SAN — Início da sangria', 3, 'Início da exploração do látex' FROM public.nutrir_culturas WHERE nome = 'Seringueira' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'PRO — Produção plena', 4, 'Produção plena de látex' FROM public.nutrir_culturas WHERE nome = 'Seringueira' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'DEC — Declínio', 5, 'Redução da produção de látex' FROM public.nutrir_culturas WHERE nome = 'Seringueira' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'VE — Emergência', 1, 'Cotilédones acima da superfície do solo' FROM public.nutrir_culturas WHERE nome = 'Soja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'VC — Cotilédone', 2, 'Folhas unifolioladas completamente desenvolvidas' FROM public.nutrir_culturas WHERE nome = 'Soja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V1 — Primeiro nó', 3, 'Primeira folha trifoliolada completamente desenvolvida' FROM public.nutrir_culturas WHERE nome = 'Soja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V2 — Segundo nó', 4, 'Segunda folha trifoliolada completamente desenvolvida' FROM public.nutrir_culturas WHERE nome = 'Soja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'V3 — Terceiro nó', 5, 'Terceira folha trifoliolada completamente desenvolvida' FROM public.nutrir_culturas WHERE nome = 'Soja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Vn — N-ésimo nó', 6, 'N-ésima folha trifoliolada completamente desenvolvida' FROM public.nutrir_culturas WHERE nome = 'Soja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R1 — Início do florescimento', 7, 'Uma flor aberta em qualquer nó do caule principal' FROM public.nutrir_culturas WHERE nome = 'Soja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R2 — Florescimento pleno', 8, 'Uma flor aberta em um dos dois últimos nós com folha desenvolvida' FROM public.nutrir_culturas WHERE nome = 'Soja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R3 — Início da formação da vagem', 9, 'Vagem com 5 mm em um dos quatro últimos nós' FROM public.nutrir_culturas WHERE nome = 'Soja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R4 — Formação completa da vagem', 10, 'Vagem com 2 cm em um dos quatro últimos nós' FROM public.nutrir_culturas WHERE nome = 'Soja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R5 — Início do enchimento do grão', 11, 'Grãos com 3 mm de comprimento' FROM public.nutrir_culturas WHERE nome = 'Soja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R6 — Grão pleno', 12, 'Vagem contendo grãos verdes que preenchem a cavidade' FROM public.nutrir_culturas WHERE nome = 'Soja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R7 — Início da maturação', 13, 'Uma vagem com coloração de maturação' FROM public.nutrir_culturas WHERE nome = 'Soja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'R8 — Maturação plena', 14, '95% das vagens com coloração de maturação' FROM public.nutrir_culturas WHERE nome = 'Soja' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '0 — Emergência', 1, 'Surgimento do coleóptilo na superfície do solo' FROM public.nutrir_culturas WHERE nome = 'Sorgo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '1 — Lígula da 3ª folha visível', 2, 'Ocorre ~10 dias após a emergência' FROM public.nutrir_culturas WHERE nome = 'Sorgo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '2 — Lígula da 5ª folha visível', 3, 'Ocorre ~3 semanas após a emergência' FROM public.nutrir_culturas WHERE nome = 'Sorgo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '3 — Diferenciação do ponto de crescimento', 4, 'Mudança do ponto de crescimento de vegetativo para reprodutivo' FROM public.nutrir_culturas WHERE nome = 'Sorgo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '4 — Folha bandeira visível', 5, 'Rápido alongamento do colmo' FROM public.nutrir_culturas WHERE nome = 'Sorgo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '5 — Emborrachamento', 6, 'Máxima área foliar, panícula na bainha da folha bandeira' FROM public.nutrir_culturas WHERE nome = 'Sorgo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '6 — 50% de floração', 7, '50% das plantas em floração' FROM public.nutrir_culturas WHERE nome = 'Sorgo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '7 — Grão leitoso', 8, '~50% da matéria seca dos grãos acumulada' FROM public.nutrir_culturas WHERE nome = 'Sorgo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '8 — Grão pastoso', 9, '~75% da matéria seca dos grãos acumulada' FROM public.nutrir_culturas WHERE nome = 'Sorgo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '9 — Maturidade fisiológica', 10, 'Grãos com 22-23% de umidade' FROM public.nutrir_culturas WHERE nome = 'Sorgo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Fase I — Inicial', 1, 'Do transplantio até 10% de cobertura do solo' FROM public.nutrir_culturas WHERE nome = 'Tabaco' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Fase II — Desenvolvimento', 2, 'De 10% de cobertura do solo até a cobertura total' FROM public.nutrir_culturas WHERE nome = 'Tabaco' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Fase III — Intermediária', 3, 'Da cobertura total até o início da maturação das folhas' FROM public.nutrir_culturas WHERE nome = 'Tabaco' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Fase IV — Final', 4, 'Do início da maturação até a colheita das últimas folhas' FROM public.nutrir_culturas WHERE nome = 'Tabaco' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Fase I — Inicial (Muda)', 1, 'Da semeadura ao transplantio' FROM public.nutrir_culturas WHERE nome = 'Tomate' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Fase II — Vegetativo', 2, 'Do transplantio ao início do florescimento' FROM public.nutrir_culturas WHERE nome = 'Tomate' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Fase III — Florescimento/Frutificação', 3, 'Do florescimento ao início da maturação' FROM public.nutrir_culturas WHERE nome = 'Tomate' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Fase IV — Maturação/Colheita', 4, 'Da maturação à colheita' FROM public.nutrir_culturas WHERE nome = 'Tomate' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Z0 — Germinação', 1, 'Início da germinação' FROM public.nutrir_culturas WHERE nome = 'Trigo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Z1 — Desenvolvimento da folha', 2, 'Emergência da primeira folha' FROM public.nutrir_culturas WHERE nome = 'Trigo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Z2 — Afilhamento', 3, 'Início do afilhamento' FROM public.nutrir_culturas WHERE nome = 'Trigo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Z3 — Alongamento do colmo', 4, 'Início do alongamento do colmo' FROM public.nutrir_culturas WHERE nome = 'Trigo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Z4 — Emborrachamento', 5, 'Bainha da folha bandeira se estende' FROM public.nutrir_culturas WHERE nome = 'Trigo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Z5 — Emergência da inflorescência', 6, 'Inflorescência emerge da bainha' FROM public.nutrir_culturas WHERE nome = 'Trigo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Z6 — Florescimento (Antese)', 7, 'Início da floração' FROM public.nutrir_culturas WHERE nome = 'Trigo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Z7 — Desenvolvimento dos grãos', 8, 'Início do desenvolvimento dos grãos' FROM public.nutrir_culturas WHERE nome = 'Trigo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Z8 — Maturação', 9, 'Início da maturação dos grãos' FROM public.nutrir_culturas WHERE nome = 'Trigo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'Z9 — Senescência', 10, 'Planta completamente senescente' FROM public.nutrir_culturas WHERE nome = 'Trigo' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '00-09 — Germinação', 1, 'Da semente seca à emergência da primeira folha' FROM public.nutrir_culturas WHERE nome = 'Triticale' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '10-19 — Crescimento da plântula', 2, 'Desenvolvimento da primeira até a nona folha' FROM public.nutrir_culturas WHERE nome = 'Triticale' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '20-29 — Afilhamento', 3, 'Do colmo principal até formação de 9+ afilhos' FROM public.nutrir_culturas WHERE nome = 'Triticale' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '30-39 — Alongamento do colmo', 4, 'Do pseudocolmo ereto até a lígula da folha bandeira' FROM public.nutrir_culturas WHERE nome = 'Triticale' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '40-49 — Emborrachamento', 5, 'Bainha da folha bandeira se estendendo' FROM public.nutrir_culturas WHERE nome = 'Triticale' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '50-59 — Espigamento', 6, 'Das primeiras espiguetas visíveis à espiga completamente emergida' FROM public.nutrir_culturas WHERE nome = 'Triticale' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '60-69 — Florescimento', 7, 'Do início ao florescimento completo' FROM public.nutrir_culturas WHERE nome = 'Triticale' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '70-79 — Grão leitoso', 8, 'Do grão aquoso ao estado leitoso completo' FROM public.nutrir_culturas WHERE nome = 'Triticale' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '80-89 — Grão pastoso', 9, 'Do grão em massa mole ao grão em massa dura' FROM public.nutrir_culturas WHERE nome = 'Triticale' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, '90-99 — Maturação', 10, 'Da cariopse dura à senescência completa' FROM public.nutrir_culturas WHERE nome = 'Triticale' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'A — Gema dormente', 1, 'Gema em dormência' FROM public.nutrir_culturas WHERE nome = 'Uva' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'B — Gema algodão', 2, 'Gema inchada com proteção lanosa' FROM public.nutrir_culturas WHERE nome = 'Uva' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'C — Ponta verde', 3, 'Aparecimento da ponta verde' FROM public.nutrir_culturas WHERE nome = 'Uva' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'D — Saída das folhas', 4, 'Saída das primeiras folhas' FROM public.nutrir_culturas WHERE nome = 'Uva' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'E-F — Cachos visíveis/separados', 5, 'Cachos visíveis e separados' FROM public.nutrir_culturas WHERE nome = 'Uva' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'G-H — Botões florais/Florescimento', 6, 'Botões florais separados até florescimento' FROM public.nutrir_culturas WHERE nome = 'Uva' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'I — Grão ervilha', 7, 'Bagas com tamanho de ervilha' FROM public.nutrir_culturas WHERE nome = 'Uva' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'J-K — Compactação/Pintor', 8, 'Compactação do cacho e início da maturação' FROM public.nutrir_culturas WHERE nome = 'Uva' ON CONFLICT (cultura_id, nome) DO NOTHING;
INSERT INTO public.nutrir_estagios (cultura_id, nome, ordem, descricao) SELECT id, 'L-M — Maturação/Colheita', 9, 'Maturação e colheita' FROM public.nutrir_culturas WHERE nome = 'Uva' ON CONFLICT (cultura_id, nome) DO NOTHING;

-- ════ FIM DO SEED ════