-- ============ SOIL SAMPLES: add crop + report ============
ALTER TABLE public.soil_samples
  ADD COLUMN IF NOT EXISTS crop text,
  ADD COLUMN IF NOT EXISTS report_path text;

-- ============ LEAF SAMPLES ============
CREATE TABLE IF NOT EXISTS public.leaf_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  client_id uuid,
  field_id uuid,
  point_id uuid,
  crop text,
  collected_at date NOT NULL DEFAULT CURRENT_DATE,
  -- macro
  n numeric, p numeric, k numeric, ca numeric, mg numeric, s numeric,
  -- micro
  b numeric, cu numeric, fe numeric, mn numeric, zn numeric,
  classification jsonb,
  raw jsonb,
  report_path text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leaf_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY leaf_org_all ON public.leaf_samples
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_leaf_samples_org ON public.leaf_samples(organization_id);
CREATE INDEX IF NOT EXISTS idx_leaf_samples_field ON public.leaf_samples(field_id);

-- ============ CROP NUTRIENT RANGES ============
CREATE TABLE IF NOT EXISTS public.crop_nutrient_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crop text NOT NULL,
  analysis_type text NOT NULL CHECK (analysis_type IN ('soil','leaf')),
  nutrient text NOT NULL,
  unit text,
  low_max numeric,        -- valores <= low_max => baixo
  medium_max numeric,     -- (low_max, medium_max] => médio
  adequate_max numeric,   -- (medium_max, adequate_max] => adequado
  -- acima de adequate_max => alto
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (crop, analysis_type, nutrient)
);

ALTER TABLE public.crop_nutrient_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY ranges_read_all ON public.crop_nutrient_ranges
  FOR SELECT TO authenticated USING (true);

-- ============ STORAGE BUCKET (private) ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('lab-reports', 'lab-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: path structure {org_id}/{filename}
CREATE POLICY "lab_reports_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'lab-reports'
    AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "lab_reports_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lab-reports'
    AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "lab_reports_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'lab-reports'
    AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "lab_reports_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'lab-reports'
    AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

-- ============ SEED CROP RANGES ============
-- Faixas baseadas em referências CFSEMG, IAC, Embrapa (genéricas, didáticas).
-- SOLO (unidades comuns): pH (CaCl2), MO (g/kg), P (mg/dm3, Mehlich), K (mg/dm3),
-- Ca/Mg (cmolc/dm3), S (mg/dm3), CTC (cmolc/dm3), V (%).
INSERT INTO public.crop_nutrient_ranges (crop, analysis_type, nutrient, unit, low_max, medium_max, adequate_max) VALUES
-- SOJA - solo
('soja','soil','ph','',5.0,5.5,6.5),
('soja','soil','organic_matter','g/kg',15,25,40),
('soja','soil','phosphorus','mg/dm³',8,15,30),
('soja','soil','potassium','mg/dm³',40,80,150),
('soja','soil','calcium','cmolc/dm³',1.5,3.0,6.0),
('soja','soil','magnesium','cmolc/dm³',0.5,1.0,2.0),
('soja','soil','sulfur','mg/dm³',5,10,20),
('soja','soil','cec','cmolc/dm³',4,8,15),
-- SOJA - foliar
('soja','leaf','n','g/kg',35,40,55),
('soja','leaf','p','g/kg',2.0,2.6,5.0),
('soja','leaf','k','g/kg',15,17,25),
('soja','leaf','ca','g/kg',4,6,20),
('soja','leaf','mg','g/kg',2.5,3.0,10),
('soja','leaf','s','g/kg',1.5,2.0,4.0),
('soja','leaf','b','mg/kg',20,25,55),
('soja','leaf','cu','mg/kg',5,8,30),
('soja','leaf','fe','mg/kg',40,51,350),
('soja','leaf','mn','mg/kg',15,21,100),
('soja','leaf','zn','mg/kg',15,21,50),
-- MILHO
('milho','soil','ph','',5.0,5.5,6.2),
('milho','soil','organic_matter','g/kg',15,25,40),
('milho','soil','phosphorus','mg/dm³',10,18,35),
('milho','soil','potassium','mg/dm³',50,100,180),
('milho','soil','calcium','cmolc/dm³',1.5,3.0,6.0),
('milho','soil','magnesium','cmolc/dm³',0.5,1.0,2.0),
('milho','soil','sulfur','mg/dm³',5,10,20),
('milho','soil','cec','cmolc/dm³',4,8,15),
('milho','leaf','n','g/kg',25,30,35),
('milho','leaf','p','g/kg',2.0,2.5,3.5),
('milho','leaf','k','g/kg',15,18,25),
('milho','leaf','ca','g/kg',2.5,3.0,8),
('milho','leaf','mg','g/kg',1.5,2.0,5),
('milho','leaf','s','g/kg',1.5,2.0,3),
-- CAFÉ
('cafe','soil','ph','',5.0,5.5,6.2),
('cafe','soil','organic_matter','g/kg',20,30,50),
('cafe','soil','phosphorus','mg/dm³',8,15,30),
('cafe','soil','potassium','mg/dm³',60,120,200),
('cafe','soil','calcium','cmolc/dm³',1.5,2.5,5.0),
('cafe','soil','magnesium','cmolc/dm³',0.5,0.9,1.8),
('cafe','soil','sulfur','mg/dm³',5,10,20),
('cafe','soil','cec','cmolc/dm³',4,8,15),
('cafe','leaf','n','g/kg',25,28,33),
('cafe','leaf','p','g/kg',1.0,1.4,2.0),
('cafe','leaf','k','g/kg',18,21,27),
('cafe','leaf','ca','g/kg',8,11,17),
('cafe','leaf','mg','g/kg',3.0,3.5,5.0),
('cafe','leaf','s','g/kg',1.2,1.6,2.5),
-- SORGO
('sorgo','soil','ph','',5.0,5.5,6.2),
('sorgo','soil','organic_matter','g/kg',15,25,40),
('sorgo','soil','phosphorus','mg/dm³',8,15,25),
('sorgo','soil','potassium','mg/dm³',40,80,150),
('sorgo','soil','calcium','cmolc/dm³',1.5,3.0,6.0),
('sorgo','soil','magnesium','cmolc/dm³',0.5,1.0,2.0),
('sorgo','soil','cec','cmolc/dm³',4,8,15),
('sorgo','leaf','n','g/kg',25,30,40),
('sorgo','leaf','p','g/kg',2.0,2.5,3.5),
('sorgo','leaf','k','g/kg',15,18,25),
-- CANA
('cana','soil','ph','',5.0,5.5,6.2),
('cana','soil','organic_matter','g/kg',15,25,40),
('cana','soil','phosphorus','mg/dm³',10,18,30),
('cana','soil','potassium','mg/dm³',50,100,180),
('cana','soil','calcium','cmolc/dm³',2.0,3.5,7.0),
('cana','soil','magnesium','cmolc/dm³',0.5,1.0,2.0),
('cana','soil','cec','cmolc/dm³',5,10,18),
('cana','leaf','n','g/kg',18,21,26),
('cana','leaf','p','g/kg',1.5,1.9,2.5),
('cana','leaf','k','g/kg',11,13,17),
-- ALGODAO
('algodao','soil','ph','',5.5,6.0,6.5),
('algodao','soil','organic_matter','g/kg',15,25,40),
('algodao','soil','phosphorus','mg/dm³',12,20,35),
('algodao','soil','potassium','mg/dm³',60,120,200),
('algodao','soil','calcium','cmolc/dm³',2.0,3.5,7.0),
('algodao','soil','magnesium','cmolc/dm³',0.5,1.0,2.0),
('algodao','leaf','n','g/kg',35,40,50),
('algodao','leaf','p','g/kg',2.5,3.0,5.0),
('algodao','leaf','k','g/kg',15,17,25),
-- TRIGO
('trigo','soil','ph','',5.0,5.5,6.2),
('trigo','soil','organic_matter','g/kg',15,25,40),
('trigo','soil','phosphorus','mg/dm³',8,15,25),
('trigo','soil','potassium','mg/dm³',40,80,150),
('trigo','leaf','n','g/kg',25,30,40),
('trigo','leaf','p','g/kg',2.0,2.5,3.5),
('trigo','leaf','k','g/kg',15,18,25),
-- CITRUS
('citrus','soil','ph','',5.5,6.0,6.5),
('citrus','soil','organic_matter','g/kg',15,25,40),
('citrus','soil','phosphorus','mg/dm³',10,18,30),
('citrus','soil','potassium','mg/dm³',60,120,200),
('citrus','soil','calcium','cmolc/dm³',2.0,3.5,7.0),
('citrus','soil','magnesium','cmolc/dm³',0.5,1.0,2.0),
('citrus','leaf','n','g/kg',23,27,35),
('citrus','leaf','p','g/kg',1.2,1.5,3.0),
('citrus','leaf','k','g/kg',10,14,20),
('citrus','leaf','ca','g/kg',30,40,55),
('citrus','leaf','mg','g/kg',2.5,3.5,6.0),
-- PASTAGEM
('pastagem','soil','ph','',4.8,5.3,6.0),
('pastagem','soil','organic_matter','g/kg',15,25,40),
('pastagem','soil','phosphorus','mg/dm³',5,10,20),
('pastagem','soil','potassium','mg/dm³',30,60,120),
('pastagem','soil','calcium','cmolc/dm³',1.0,2.0,4.0),
('pastagem','soil','magnesium','cmolc/dm³',0.4,0.8,1.5),
('pastagem','leaf','n','g/kg',15,20,28),
('pastagem','leaf','p','g/kg',1.5,2.0,3.0),
('pastagem','leaf','k','g/kg',12,15,22),
-- GIRASSOL
('girassol','soil','ph','',5.5,6.0,6.5),
('girassol','soil','organic_matter','g/kg',15,25,40),
('girassol','soil','phosphorus','mg/dm³',10,18,30),
('girassol','soil','potassium','mg/dm³',50,100,180),
('girassol','leaf','n','g/kg',30,35,50),
('girassol','leaf','p','g/kg',2.5,3.5,5.0),
('girassol','leaf','k','g/kg',20,25,40)
ON CONFLICT (crop, analysis_type, nutrient) DO NOTHING;