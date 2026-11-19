-- Runs only against synthetic PostgreSQL 17 CI, never productive DB.
SET ROLE authenticated;
SET request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
DO $verify_export$
DECLARE
 v jsonb;
 v_clan jsonb;
 v_table jsonb;
BEGIN
 v := public.cwl_export_owned_backup(
  ARRAY['11111111-1111-4111-8111-111111111111'::uuid]
 );
 IF v->>'kind' <> 'cwl-cloud-app-backup' OR
    (v->>'format_version')::integer <> 1 OR
    v->>'consistency' <> 'server-stable-statement' OR
    v->>'created_at' IS NULL OR
    jsonb_array_length(v->'clans')<>1 THEN
   RAISE EXCEPTION 'missing/incompatible backup envelope';
 END IF;
 v_clan := v->'clans'->0;
 v_table := v_clan->'tables';
 IF v_clan->>'source_clan_id'<>'11111111-1111-4111-8111-111111111111' OR
    v_clan->>'clash_tag'<>'#P8Y2' OR
    v_table IS NULL THEN
   RAISE EXCEPTION 'invalid clan metadata';
 END IF;
 IF (SELECT count(*) FROM jsonb_each(v_table))<>17 THEN
   RAISE EXCEPTION 'not all tables were exported';
 END IF;
 IF jsonb_array_length(v_table->'cwl_cloud_profiles')<>1 OR
    (v_table->'cwl_cloud_profiles'->0->>'revision')::integer<>4 OR
    jsonb_array_length(v_table->'cwl_stat_wars')<>2 OR
    jsonb_array_length(v_table->'cwl_stat_attacks')<>2 OR
    jsonb_array_length(v_table->'cwl_stat_missed')<>1 OR
    jsonb_array_length(v_table->'cwl_group_archives')<>1 OR
    jsonb_array_length(v_table->'cwl_clan_cw_missed_decisions')<>1 OR
    jsonb_array_length(v_table->'cwl_clan_management_rules')<>1 THEN
   RAISE EXCEPTION 'truncated or incomplete snapshot';
 END IF;
 IF (v_table->'cwl_stat_wars')::text LIKE '%foreign%' OR
    v::text LIKE '%Foreign Club%' OR
    v::text LIKE '%22222222-2222-4222-8222-222222222222%' THEN
   RAISE EXCEPTION 'cross-clan data leakage';
 END IF;
 IF v::text LIKE '%secret%' OR v::text LIKE '%short_code_hash%' THEN
   RAISE EXCEPTION 'unexpected credentials exposed';
 END IF;
 -- Wrong owner on the same signed-in database role.
 PERFORM set_config('request.jwt.claim.sub',
  '44444444-4444-4444-8444-444444444444',false);
 BEGIN
   PERFORM public.cwl_export_owned_backup(
     ARRAY['11111111-1111-4111-8111-111111111111'::uuid]
   );
   RAISE EXCEPTION 'export incorrectly accepted foreign owner';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',false);
 BEGIN
   PERFORM public.cwl_export_owned_backup(
     ARRAY['11111111-1111-4111-8111-111111111111'::uuid,
           '22222222-2222-4222-8222-222222222222'::uuid]
   );
   RAISE EXCEPTION 'export incorrectly accepted mixed-owner batch';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM public.cwl_export_owned_backup(
     ARRAY['11111111-1111-4111-8111-111111111111'::uuid,
           '11111111-1111-4111-8111-111111111111'::uuid]
   );
   RAISE EXCEPTION 'export incorrectly accepted duplicated clan';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 BEGIN
   PERFORM public.cwl_export_owned_backup(NULL);
   RAISE EXCEPTION 'export incorrectly accepted null clan selection';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 RAISE NOTICE 'PASS: private stable snapshot returns exactly 17 tables, rejects foreign, mixed, duplicate, null';
END;
$verify_export$;
RESET ROLE;

-- Security metadata is a contract; the function must never become DEFINER or VOLATILE.
DO $check_catalog$
DECLARE v record;
BEGIN
 SELECT provolatile,prosecdef,proconfig INTO v
 FROM pg_proc WHERE oid='public.cwl_export_owned_backup(uuid[])'::regprocedure;
 IF v.provolatile<>'s' OR v.prosecdef OR NOT EXISTS (
   SELECT 1 FROM unnest(v.proconfig) AS setting(value)
   -- PostgreSQL represents an empty search_path as either empty or "".
   WHERE replace(setting.value,'"','') = 'search_path='
 ) THEN
   RAISE EXCEPTION 'RPC volatility / SECURITY INVOKER / search_path guard broken';
 END IF;
 IF has_function_privilege('anon','public.cwl_export_owned_backup(uuid[])','EXECUTE') OR
    NOT has_function_privilege('authenticated','public.cwl_export_owned_backup(uuid[])','EXECUTE') THEN
   RAISE EXCEPTION 'RPC EXECUTE grants are unsafe';
 END IF;
 RAISE NOTICE 'PASS: STABLE SECURITY INVOKER, empty search_path, authenticated-only EXECUTE';
END;
$check_catalog$;
