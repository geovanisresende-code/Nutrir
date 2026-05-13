
-- Helper: add FK only if not exists
DO $$
DECLARE
  fk RECORD;
BEGIN
  -- profiles
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='profiles_default_org_fkey') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_default_org_fkey FOREIGN KEY (default_org_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;

  -- organizations
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='organizations_owner_fkey') THEN
    ALTER TABLE public.organizations ADD CONSTRAINT organizations_owner_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- organization_members
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='org_members_org_fkey') THEN
    ALTER TABLE public.organization_members ADD CONSTRAINT org_members_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='org_members_user_fkey') THEN
    ALTER TABLE public.organization_members ADD CONSTRAINT org_members_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- organization_invites
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='invites_org_fkey') THEN
    ALTER TABLE public.organization_invites ADD CONSTRAINT invites_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  -- farms
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='farms_org_fkey') THEN
    ALTER TABLE public.farms ADD CONSTRAINT farms_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  -- clients
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='clients_org_fkey') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  -- fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fields_org_fkey') THEN
    ALTER TABLE public.fields ADD CONSTRAINT fields_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fields_farm_fkey') THEN
    ALTER TABLE public.fields ADD CONSTRAINT fields_farm_fkey FOREIGN KEY (farm_id) REFERENCES public.farms(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fields_client_fkey') THEN
    ALTER TABLE public.fields ADD CONSTRAINT fields_client_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;

  -- collection_routes
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='routes_org_fkey') THEN
    ALTER TABLE public.collection_routes ADD CONSTRAINT routes_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='routes_field_fkey') THEN
    ALTER TABLE public.collection_routes ADD CONSTRAINT routes_field_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='routes_client_fkey') THEN
    ALTER TABLE public.collection_routes ADD CONSTRAINT routes_client_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;

  -- collection_points
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='points_org_fkey') THEN
    ALTER TABLE public.collection_points ADD CONSTRAINT points_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='points_field_fkey') THEN
    ALTER TABLE public.collection_points ADD CONSTRAINT points_field_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='points_client_fkey') THEN
    ALTER TABLE public.collection_points ADD CONSTRAINT points_client_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='points_route_fkey') THEN
    ALTER TABLE public.collection_points ADD CONSTRAINT points_route_fkey FOREIGN KEY (route_id) REFERENCES public.collection_routes(id) ON DELETE SET NULL;
  END IF;

  -- soil_samples
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='soil_org_fkey') THEN
    ALTER TABLE public.soil_samples ADD CONSTRAINT soil_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='soil_field_fkey') THEN
    ALTER TABLE public.soil_samples ADD CONSTRAINT soil_field_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='soil_client_fkey') THEN
    ALTER TABLE public.soil_samples ADD CONSTRAINT soil_client_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='soil_point_fkey') THEN
    ALTER TABLE public.soil_samples ADD CONSTRAINT soil_point_fkey FOREIGN KEY (point_id) REFERENCES public.collection_points(id) ON DELETE SET NULL;
  END IF;

  -- leaf_samples
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='leaf_org_fkey') THEN
    ALTER TABLE public.leaf_samples ADD CONSTRAINT leaf_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='leaf_field_fkey') THEN
    ALTER TABLE public.leaf_samples ADD CONSTRAINT leaf_field_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='leaf_client_fkey') THEN
    ALTER TABLE public.leaf_samples ADD CONSTRAINT leaf_client_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='leaf_point_fkey') THEN
    ALTER TABLE public.leaf_samples ADD CONSTRAINT leaf_point_fkey FOREIGN KEY (point_id) REFERENCES public.collection_points(id) ON DELETE SET NULL;
  END IF;

  -- ai_recommendations
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='ai_org_fkey') THEN
    ALTER TABLE public.ai_recommendations ADD CONSTRAINT ai_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='ai_field_fkey') THEN
    ALTER TABLE public.ai_recommendations ADD CONSTRAINT ai_field_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE SET NULL;
  END IF;

  -- ai_image_diagnoses
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='diag_org_fkey') THEN
    ALTER TABLE public.ai_image_diagnoses ADD CONSTRAINT diag_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='diag_field_fkey') THEN
    ALTER TABLE public.ai_image_diagnoses ADD CONSTRAINT diag_field_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='diag_client_fkey') THEN
    ALTER TABLE public.ai_image_diagnoses ADD CONSTRAINT diag_client_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;

  -- ai_chat_threads / messages
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='threads_org_fkey') THEN
    ALTER TABLE public.ai_chat_threads ADD CONSTRAINT threads_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='messages_thread_fkey') THEN
    ALTER TABLE public.ai_chat_messages ADD CONSTRAINT messages_thread_fkey FOREIGN KEY (thread_id) REFERENCES public.ai_chat_threads(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='messages_org_fkey') THEN
    ALTER TABLE public.ai_chat_messages ADD CONSTRAINT messages_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  -- ndvi_readings
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='ndvi_org_fkey') THEN
    ALTER TABLE public.ndvi_readings ADD CONSTRAINT ndvi_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='ndvi_field_fkey') THEN
    ALTER TABLE public.ndvi_readings ADD CONSTRAINT ndvi_field_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE CASCADE;
  END IF;

  -- reports
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='reports_org_fkey') THEN
    ALTER TABLE public.reports ADD CONSTRAINT reports_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='reports_field_fkey') THEN
    ALTER TABLE public.reports ADD CONSTRAINT reports_field_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='reports_client_fkey') THEN
    ALTER TABLE public.reports ADD CONSTRAINT reports_client_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;

  -- audit_log
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='audit_org_fkey') THEN
    ALTER TABLE public.audit_log ADD CONSTRAINT audit_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='audit_field_fkey') THEN
    ALTER TABLE public.audit_log ADD CONSTRAINT audit_field_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='audit_client_fkey') THEN
    ALTER TABLE public.audit_log ADD CONSTRAINT audit_client_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;

  -- notifications
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='notif_org_fkey') THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notif_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  -- erp_webhooks
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='erp_org_fkey') THEN
    ALTER TABLE public.erp_webhooks ADD CONSTRAINT erp_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  -- usage_metrics
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='usage_org_fkey') THEN
    ALTER TABLE public.usage_metrics ADD CONSTRAINT usage_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  -- org_subscriptions
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='subs_org_fkey') THEN
    ALTER TABLE public.org_subscriptions ADD CONSTRAINT subs_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Force PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';
