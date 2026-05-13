ALTER TABLE public.nutrir_pedidos
  ADD COLUMN IF NOT EXISTS orcamento_origem_id UUID
  REFERENCES public.nutrir_orcamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nutrir_pedidos_orcamento_origem
  ON public.nutrir_pedidos(orcamento_origem_id);