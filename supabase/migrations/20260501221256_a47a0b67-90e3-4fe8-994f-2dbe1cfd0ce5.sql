CREATE OR REPLACE FUNCTION public.gerar_cr_e_comissao_do_pedido()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prazo int := 30;
  pct numeric := 0;
  rep_user uuid;
  ja_existe boolean;
BEGIN
  IF NEW.status NOT IN ('confirmado','entregue','faturado') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT COALESCE(prazo_dias, 30) INTO prazo FROM public.nutrir_modalidades WHERE id = NEW.modalidade_id;

  SELECT EXISTS(SELECT 1 FROM public.nutrir_contas_receber WHERE pedido_id = NEW.id) INTO ja_existe;
  IF NOT ja_existe AND NEW.total > 0 THEN
    INSERT INTO public.nutrir_contas_receber
      (organization_id, cliente_id, pedido_id, representante_id, data_emissao, data_vencimento, valor)
    VALUES
      (NEW.organization_id, NEW.cliente_id, NEW.id, NEW.representante_id,
       NEW.data_pedido, NEW.data_pedido + (prazo || ' days')::interval, NEW.total);
  END IF;

  SELECT comissao_percentual, user_id INTO pct, rep_user
  FROM public.nutrir_representantes WHERE id = NEW.representante_id;
  IF pct IS NULL THEN pct := 0; END IF;

  SELECT EXISTS(SELECT 1 FROM public.nutrir_comissoes WHERE pedido_id = NEW.id) INTO ja_existe;
  IF NOT ja_existe AND NEW.representante_id IS NOT NULL AND NEW.total > 0 THEN
    INSERT INTO public.nutrir_comissoes
      (organization_id, representante_id, user_id, pedido_id, cliente_id,
       mes_referencia, base_calculo, percentual, valor)
    VALUES
      (NEW.organization_id, NEW.representante_id, rep_user, NEW.id, NEW.cliente_id,
       date_trunc('month', NEW.data_pedido)::date, NEW.total, pct, NEW.total * pct / 100.0);
  END IF;

  RETURN NEW;
END $$;