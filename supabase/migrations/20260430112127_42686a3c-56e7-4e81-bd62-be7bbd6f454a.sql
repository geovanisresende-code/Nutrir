
-- 1. Categoria nas culturas globais
ALTER TABLE public.nutrir_culturas
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'Anual';

-- Marcar perenes
UPDATE public.nutrir_culturas SET categoria = 'Perene'
  WHERE nome IN ('Café Arábica','Café Conilon','Cana-de-açúcar','Laranja','Limão','Tangerina','Maçã','Manga','Mamão','Banana','Uva','Abacaxi','Coco','Açaí','Cacau','Eucalipto','Pinus','Seringueira','Erva-mate','Goiaba','Maracujá','Pastagem','Pimenta-do-reino');

UPDATE public.nutrir_culturas SET categoria = 'Cereal'
  WHERE nome IN ('Soja','Milho','Milho Safrinha','Trigo','Arroz','Aveia','Cevada','Centeio','Sorgo','Triticale','Feijão','Algodão','Girassol','Canola','Amendoim','Gergelim','Mamona','Linho','Tabaco');

UPDATE public.nutrir_culturas SET categoria = 'Olerícola'
  WHERE nome IN ('Tomate','Batata','Cenoura','Cebola','Alho','Pimentão','Mandioca');

-- 2. Defaults dos parâmetros de consultoria
ALTER TABLE public.nutrir_parametros_consultoria
  ALTER COLUMN custo_amostra SET DEFAULT 350,
  ALTER COLUMN meta_lucratividade SET DEFAULT 45,
  ALTER COLUMN piso_amostra SET DEFAULT 0,
  ALTER COLUMN piso_hectare SET DEFAULT 0,
  ALTER COLUMN grid_min_cereais SET DEFAULT 50;

-- 3. Caminho do laudo (relatório anexado) — coluna já chamada `report_path` existe; reaproveitar.
-- Apenas garantir que classification possa receber recomendações geradas pela IA
-- Nada a fazer aqui (jsonb já cobre).

-- 4. Catálogo: Complexadores (globais — todos veem)
CREATE TABLE IF NOT EXISTS public.nutrir_complexadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  preco_litro numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrir_complexadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrir_complex_read ON public.nutrir_complexadores FOR SELECT TO authenticated USING (true);
CREATE POLICY nutrir_complex_write ON public.nutrir_complexadores FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Fator complexador × nutriente (por nível: basico, intermediario, avancado)
CREATE TABLE IF NOT EXISTS public.nutrir_complexador_fatores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complexador_id uuid NOT NULL REFERENCES public.nutrir_complexadores(id) ON DELETE CASCADE,
  nutriente_id uuid NOT NULL REFERENCES public.nutrir_nutrientes(id) ON DELETE CASCADE,
  nivel text NOT NULL DEFAULT 'padrao',
  fator_l_kg_sal numeric NOT NULL DEFAULT 0,
  observacao text,
  UNIQUE (complexador_id, nutriente_id, nivel)
);
ALTER TABLE public.nutrir_complexador_fatores ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrir_complex_fat_read ON public.nutrir_complexador_fatores FOR SELECT TO authenticated USING (true);
CREATE POLICY nutrir_complex_fat_write ON public.nutrir_complexador_fatores FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Fórmulas hardcoded (N180, N180_BORO, N32, FOLIAR, NPK_FOLIAR…)
CREATE TABLE IF NOT EXISTS public.nutrir_formula_cabecalho (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_codigo text NOT NULL,
  nivel text NOT NULL DEFAULT 'padrao',
  titulo text NOT NULL,
  descricao text,
  instrucoes_preparo text,
  volume_batida_padrao_l numeric DEFAULT 1000,
  fator_diluicao numeric NOT NULL DEFAULT 1.0,
  auto_ajuste_limite boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'publicada',
  ativa_calculadora boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formula_codigo, nivel)
);
ALTER TABLE public.nutrir_formula_cabecalho ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrir_fcab_read ON public.nutrir_formula_cabecalho FOR SELECT TO authenticated USING (true);
CREATE POLICY nutrir_fcab_write ON public.nutrir_formula_cabecalho FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.nutrir_formula_regra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_codigo text NOT NULL,
  nivel text NOT NULL DEFAULT 'padrao',
  ordem int NOT NULL DEFAULT 0,
  materia_prima_id uuid,
  materia_prima_nome text NOT NULL,
  tipo_calculo text NOT NULL DEFAULT 'PCT_BASE',
  base_calculo text,
  percentual numeric NOT NULL DEFAULT 0,
  dose_valor numeric,
  complexante_nome text,
  fator_complex_l_kg numeric NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'kg',
  fator_diluicao numeric NOT NULL DEFAULT 1.0,
  ativo boolean NOT NULL DEFAULT true
);
ALTER TABLE public.nutrir_formula_regra ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrir_freg_read ON public.nutrir_formula_regra FOR SELECT TO authenticated USING (true);
CREATE POLICY nutrir_freg_write ON public.nutrir_formula_regra FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.nutrir_formula_limite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_codigo text NOT NULL UNIQUE,
  limite_max_kg_por_1000l numeric NOT NULL DEFAULT 400
);
ALTER TABLE public.nutrir_formula_limite ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrir_flim_read ON public.nutrir_formula_limite FOR SELECT TO authenticated USING (true);
CREATE POLICY nutrir_flim_write ON public.nutrir_formula_limite FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.nutrir_formula_nivel_dose (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_codigo text NOT NULL,
  nivel text NOT NULL DEFAULT 'padrao',
  nutriente_id uuid REFERENCES public.nutrir_nutrientes(id) ON DELETE CASCADE,
  parametro text,
  valor numeric NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'g/ha'
);
ALTER TABLE public.nutrir_formula_nivel_dose ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrir_fdose_read ON public.nutrir_formula_nivel_dose FOR SELECT TO authenticated USING (true);
CREATE POLICY nutrir_fdose_write ON public.nutrir_formula_nivel_dose FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Fórmulas custom (por organização)
CREATE TABLE IF NOT EXISTS public.nutrir_formulas_custom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  codigo text NOT NULL,
  nome text NOT NULL,
  descricao text,
  motor text NOT NULL DEFAULT 'por_nutriente',
  complexador_id uuid REFERENCES public.nutrir_complexadores(id) ON DELETE SET NULL,
  nivel text NOT NULL DEFAULT 'padrao',
  volume_batida_padrao_l numeric NOT NULL DEFAULT 1000,
  fator_diluicao_global numeric NOT NULL DEFAULT 4.5,
  limite_sais_pct numeric NOT NULL DEFAULT 40,
  auto_ajuste_limite boolean NOT NULL DEFAULT true,
  enxofre_automatico boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'rascunho',
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrir_formulas_custom ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrir_fcustom_read ON public.nutrir_formulas_custom FOR SELECT TO authenticated USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY nutrir_fcustom_write ON public.nutrir_formulas_custom FOR ALL TO authenticated
  USING (is_org_member(organization_id, auth.uid())) WITH CHECK (is_org_member(organization_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.nutrir_formulas_custom_nutrientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id uuid NOT NULL REFERENCES public.nutrir_formulas_custom(id) ON DELETE CASCADE,
  nutriente_id uuid NOT NULL REFERENCES public.nutrir_nutrientes(id) ON DELETE CASCADE,
  materia_prima_id uuid NOT NULL REFERENCES public.nutrir_materias_primas(id) ON DELETE CASCADE,
  garantia_pct_override numeric,
  step_arredondamento numeric NOT NULL DEFAULT 1,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true
);
ALTER TABLE public.nutrir_formulas_custom_nutrientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrir_fcn_all ON public.nutrir_formulas_custom_nutrientes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM nutrir_formulas_custom f WHERE f.id = formula_id AND is_org_member(f.organization_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM nutrir_formulas_custom f WHERE f.id = formula_id AND is_org_member(f.organization_id, auth.uid())));

-- 8. Regras de cálculo globais
CREATE TABLE IF NOT EXISTS public.nutrir_regras_calculo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor numeric NOT NULL,
  descricao text
);
ALTER TABLE public.nutrir_regras_calculo ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrir_regras_read ON public.nutrir_regras_calculo FOR SELECT TO authenticated USING (true);
CREATE POLICY nutrir_regras_write ON public.nutrir_regras_calculo FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

INSERT INTO public.nutrir_regras_calculo (chave, valor, descricao) VALUES
  ('limite_sais_pct', 40, 'Limite máximo de sais (% do volume da batida)'),
  ('fator_diluicao_padrao', 4.5, 'Fator de diluição global padrão'),
  ('volume_batida_padrao_l', 1000, 'Volume da batida padrão (L)'),
  ('grid_perene_ha', 10, 'Grid padrão para culturas perenes (ha)'),
  ('grid_anual_ha', 50, 'Grid padrão para culturas anuais/cereais (ha)'),
  ('amostragens_perene', 8, 'Número de amostragens para perenes'),
  ('amostragens_anual', 5, 'Número de amostragens para anuais/cereais')
ON CONFLICT (chave) DO NOTHING;

-- Atualiza valores existentes (para orgs já configuradas)
UPDATE public.nutrir_parametros_consultoria
   SET custo_amostra = 350, meta_lucratividade = 45, piso_amostra = 0, piso_hectare = 0, grid_min_cereais = 50
 WHERE custo_amostra <= 60 OR meta_lucratividade <= 30;
