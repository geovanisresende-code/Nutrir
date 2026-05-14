-- ────────────────────────────────────────────────────────────────────────
-- Trigger: Alerta de Ouvidoria → Notificação pra admin/gerente
-- ────────────────────────────────────────────────────────────────────────
-- Rode em: https://supabase.com/dashboard/project/wkvvgsjunippzwpybaeb/sql/new
--
-- Quando uma nova linha entra em nutrir_ouvidoria:
--   - Se nível for 'muito_urgente' → notification type='error' pra todos
--     os admins/gerentes da org (aparece destacada na bell)
--   - Se for 'ponto_atencao' → type='warning'
--   - Se for 'relato_rotina' → type='info'
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.nutrir_ouvidoria_notify_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notif_type TEXT;
  v_titulo TEXT;
  v_member RECORD;
BEGIN
  -- Tipo de notificação por nível
  v_notif_type := CASE NEW.nivel
    WHEN 'muito_urgente' THEN 'error'
    WHEN 'ponto_atencao' THEN 'warning'
    ELSE 'info'
  END;

  v_titulo := CASE NEW.nivel
    WHEN 'muito_urgente' THEN '🚨 URGENTE — ' || NEW.titulo
    WHEN 'ponto_atencao' THEN '⚠ Atenção — ' || NEW.titulo
    ELSE '📝 ' || NEW.titulo
  END;

  -- Cria uma notificação pra cada admin/owner/manager da org
  FOR v_member IN
    SELECT user_id
    FROM organization_members
    WHERE organization_id = NEW.organization_id
      AND role IN ('owner', 'admin', 'manager')
  LOOP
    INSERT INTO notifications (
      organization_id, user_id, type, title, message, link, metadata
    ) VALUES (
      NEW.organization_id,
      v_member.user_id,
      v_notif_type,
      v_titulo,
      LEFT(NEW.mensagem, 280),
      '/app/gerente/ouvidoria',
      jsonb_build_object(
        'ouvidoria_id', NEW.id,
        'nivel',        NEW.nivel,
        'visita_id',    NEW.visita_id,
        'reporter_id',  NEW.user_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- ── Cria/recria o trigger ───────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_nutrir_ouvidoria_notify ON public.nutrir_ouvidoria;
CREATE TRIGGER trg_nutrir_ouvidoria_notify
  AFTER INSERT ON public.nutrir_ouvidoria
  FOR EACH ROW
  EXECUTE FUNCTION public.nutrir_ouvidoria_notify_trigger();

SELECT 'trigger criado' AS status,
       'Alerta de visita → notification pro admin/gerente' AS efeito;
