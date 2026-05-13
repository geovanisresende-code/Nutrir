ALTER TABLE public.nutrir_rdv
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS combustivel_tipo text,
  ADD COLUMN IF NOT EXISTS litros numeric,
  ADD COLUMN IF NOT EXISTS preco_litro numeric,
  ADD COLUMN IF NOT EXISTS hotel_nome text;