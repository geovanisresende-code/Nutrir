
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conrelid::regclass::text AS tbl, conname
    FROM pg_constraint
    WHERE contype='f' AND connamespace='public'::regnamespace
      AND conname IN (
        'profiles_default_org_fkey','organizations_owner_fkey',
        'org_members_org_fkey','org_members_user_fkey','invites_org_fkey',
        'farms_org_fkey','clients_org_fkey',
        'fields_org_fkey','fields_farm_fkey','fields_client_fkey',
        'routes_org_fkey','routes_field_fkey','routes_client_fkey',
        'points_org_fkey','points_field_fkey','points_client_fkey','points_route_fkey',
        'soil_org_fkey','soil_field_fkey','soil_client_fkey','soil_point_fkey',
        'leaf_org_fkey','leaf_field_fkey','leaf_client_fkey','leaf_point_fkey',
        'ai_org_fkey','ai_field_fkey',
        'diag_org_fkey','diag_field_fkey','diag_client_fkey',
        'threads_org_fkey','messages_thread_fkey','messages_org_fkey',
        'ndvi_org_fkey','ndvi_field_fkey',
        'reports_org_fkey','reports_field_fkey','reports_client_fkey',
        'audit_org_fkey','audit_field_fkey','audit_client_fkey',
        'notif_org_fkey','erp_org_fkey','usage_org_fkey','subs_org_fkey'
      )
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
