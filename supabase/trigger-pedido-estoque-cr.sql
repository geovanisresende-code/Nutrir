-- ────────────────────────────────────────────────────────────────────────
-- Triggers: Pedido faturado → Estoque do Cliente + Conta a Receber
-- ────────────────────────────────────────────────────────────────────────
-- Rode em: https://supabase.com/dashboard/project/wkvvgsjunippzwpybaeb/sql/new
--
-- Quando um pedido muda de status pra 'faturado':
--   1) Cada item do pedido vira ENTRADA no nutrir_estoque_cliente (saldo +=)
--   2) O total do pedido vira uma linha em nutrir_contas_receber
--      com data_vencimento = data_pedido + 30 dias (configurável)
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.nutrir_pedido_faturado_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_unidade TEXT;
  v_nome_produto TEXT;
  v_dias_vencimento INT := 30;  -- default 30 dias (pode vir de modalidade.prazo_dias)
  v_prazo_modalidade INT;
BEGIN
  -- Só dispara se mudou para 'faturado'
  IF NEW.status <> 'faturado' OR (TG_OP = 'UPDATE' AND OLD.status = 'faturado') THEN
    RETURN NEW;
  END IF;

  -- Pega prazo da modalidade se houver
  IF NEW.modalidade_id IS NOT NULL THEN
    SELECT prazo_dias INTO v_prazo_modalidade
    FROM nutrir_modalidades WHERE id = NEW.modalidade_id;
    IF v_prazo_modalidade IS NOT NULL THEN
      v_dias_vencimento := v_prazo_modalidade;
    END IF;
  END IF;

  -- 1) ESTOQUE DO CLIENTE — adiciona/atualiza cada item
  IF NEW.cliente_id IS NOT NULL THEN
    FOR v_item IN
      SELECT pi.*, p.nome AS nome_produto, e.unidade AS unidade_emb, e.volume AS volume_emb
      FROM nutrir_pedido_itens pi
      LEFT JOIN nutrir_produtos p ON p.id = pi.produto_id
      LEFT JOIN nutrir_embalagens e ON e.id = pi.embalagem_id
      WHERE pi.pedido_id = NEW.id
    LOOP
      v_unidade := COALESCE(v_item.unidade_emb, 'L');
      v_nome_produto := COALESCE(v_item.nome_produto, 'Produto');

      INSERT INTO nutrir_estoque_cliente (
        organization_id, cliente_id, produto_id, produto_nome, unidade, saldo, ultima_movimentacao
      )
      VALUES (
        NEW.organization_id, NEW.cliente_id, v_item.produto_id,
        v_nome_produto, v_unidade,
        v_item.quantidade * COALESCE(v_item.volume_emb, 1),
        now()
      )
      ON CONFLICT (cliente_id, produto_nome, unidade)
      DO UPDATE SET
        saldo = nutrir_estoque_cliente.saldo + EXCLUDED.saldo,
        ultima_movimentacao = now(),
        updated_at = now();

      -- registra movimentação se existir tabela
      BEGIN
        INSERT INTO nutrir_estoque_movimentacoes (
          organization_id, cliente_id, produto_nome, unidade,
          tipo, quantidade, pedido_id, observacao
        )
        VALUES (
          NEW.organization_id, NEW.cliente_id, v_nome_produto, v_unidade,
          'entrada', v_item.quantidade * COALESCE(v_item.volume_emb, 1),
          NEW.id, 'Entrada automática do pedido ' || COALESCE(NEW.numero, NEW.id::text)
        );
      EXCEPTION WHEN OTHERS THEN
        -- ignora se tabela não existe ou colunas diferentes
        NULL;
      END;
    END LOOP;
  END IF;

  -- 2) CONTAS A RECEBER — cria parcela única (pode ser refinado depois)
  IF NEW.cliente_id IS NOT NULL AND NEW.total > 0 THEN
    INSERT INTO nutrir_contas_receber (
      organization_id, cliente_id, pedido_id, representante_id,
      data_emissao, data_vencimento, valor, status
    )
    VALUES (
      NEW.organization_id, NEW.cliente_id, NEW.id, NEW.representante_id,
      NEW.data_pedido, NEW.data_pedido + (v_dias_vencimento || ' days')::interval,
      NEW.total, 'em_aberto'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ── Cria/recria o trigger ───────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_nutrir_pedido_faturado ON public.nutrir_pedidos;
CREATE TRIGGER trg_nutrir_pedido_faturado
  AFTER INSERT OR UPDATE OF status ON public.nutrir_pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.nutrir_pedido_faturado_trigger();

-- ── Validação rápida ────────────────────────────────────────────────────
SELECT 'trigger criado' AS status,
       'Pedido faturado → Estoque Cliente + Conta a Receber' AS efeito;
