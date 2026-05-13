-- Adicionar campos para o novo formulário de pedido
ALTER TABLE public.nutrir_pedidos
  ADD COLUMN IF NOT EXISTS tipo_venda text,
  ADD COLUMN IF NOT EXISTS condicao_pagamento text,
  ADD COLUMN IF NOT EXISTS data_vencimento date;

-- Validação leve por trigger (evita CHECK imutável)
CREATE OR REPLACE FUNCTION public.validate_pedido_tipo_venda()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_venda IS NOT NULL AND NEW.tipo_venda NOT IN ('b2b','grupo_compra','revenda','venda_direta') THEN
    RAISE EXCEPTION 'tipo_venda inválido: %', NEW.tipo_venda;
  END IF;
  IF NEW.condicao_pagamento IS NOT NULL AND NEW.condicao_pagamento NOT IN ('a_vista','a_prazo') THEN
    RAISE EXCEPTION 'condicao_pagamento inválido: %', NEW.condicao_pagamento;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_pedido_tipo_venda ON public.nutrir_pedidos;
CREATE TRIGGER trg_validate_pedido_tipo_venda
BEFORE INSERT OR UPDATE ON public.nutrir_pedidos
FOR EACH ROW EXECUTE FUNCTION public.validate_pedido_tipo_venda();