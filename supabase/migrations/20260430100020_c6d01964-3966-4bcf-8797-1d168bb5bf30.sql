-- Triggers de notificação para Programa Nutrir
CREATE OR REPLACE FUNCTION public.notify_on_nutrir_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cliente_nome TEXT;
  admin_user UUID;
BEGIN
  SELECT razao_social INTO cliente_nome FROM public.nutrir_clientes WHERE id = NEW.cliente_id;

  -- Notifica criação
  IF TG_OP = 'INSERT' THEN
    FOR admin_user IN
      SELECT user_id FROM public.organization_members
      WHERE organization_id = NEW.organization_id AND role IN ('owner','admin','manager')
    LOOP
      INSERT INTO public.notifications (organization_id, user_id, type, title, message, link)
      VALUES (
        NEW.organization_id, admin_user, 'success',
        'Novo pedido Nutrir',
        'Pedido para ' || COALESCE(cliente_nome, 'cliente') || ' — R$ ' || to_char(NEW.total, 'FM999G999G990D00'),
        '/app/nutrir/pedidos'
      );
    END LOOP;
  END IF;

  -- Notifica mudança de status
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (organization_id, user_id, type, title, message, link)
    VALUES (
      NEW.organization_id, NULL, 'info',
      'Pedido ' || NEW.status,
      'Pedido de ' || COALESCE(cliente_nome, 'cliente') || ' agora está ' || NEW.status,
      '/app/nutrir/pedidos'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_nutrir_pedido ON public.nutrir_pedidos;
CREATE TRIGGER trg_notify_nutrir_pedido
AFTER INSERT OR UPDATE ON public.nutrir_pedidos
FOR EACH ROW EXECUTE FUNCTION public.notify_on_nutrir_pedido();

CREATE OR REPLACE FUNCTION public.notify_on_nutrir_orcamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cliente_nome TEXT;
BEGIN
  SELECT razao_social INTO cliente_nome FROM public.nutrir_clientes WHERE id = NEW.cliente_id;
  INSERT INTO public.notifications (organization_id, user_id, type, title, message, link)
  VALUES (
    NEW.organization_id, NULL, 'info',
    'Orçamento de consultoria salvo',
    COALESCE(NEW.titulo, 'Orçamento') || ' — ' || COALESCE(cliente_nome, 'sem cliente') ||
    ' (' || to_char(NEW.area_total_ha, 'FM999G990D0') || ' ha · R$ ' || to_char(NEW.total_geral, 'FM999G999G990D00') || ')',
    '/app/nutrir/orcamentos'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_nutrir_orcamento ON public.nutrir_orcamentos;
CREATE TRIGGER trg_notify_nutrir_orcamento
AFTER INSERT ON public.nutrir_orcamentos
FOR EACH ROW EXECUTE FUNCTION public.notify_on_nutrir_orcamento();