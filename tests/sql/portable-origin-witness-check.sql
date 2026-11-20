-- Synthetic PostgreSQL-17 UAT for genuine full-17-table source receipts.
-- Run after portable-cloud-export-fixture.sql, then owner snapshot RPC and
-- origin-witness migration. No live credentials, production data or URLs.
INSERT INTO public.cwl_clans(id,name,clash_tag,owner_user_id) VALUES
 ('88888888-8888-4888-8888-888888888888','Owner recovery target','#P8Y2','33333333-3333-4333-8333-333333333333'),
 ('99999999-9999-4999-8999-999999999999','Wrong Clan identity','#8PYL','33333333-3333-4333-8333-333333333333');
INSERT INTO public.cwl_clan_memberships(clan_id,user_id,role) VALUES
 ('88888888-8888-4888-8888-888888888888','33333333-3333-4333-8333-333333333333','owner'),
 ('99999999-9999-4999-8999-999999999999','33333333-3333-4333-8333-333333333333','owner');
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $test_origin$
DECLARE
 v_export jsonb;
 v_snapshot jsonb;
 v_receipt jsonb;
 v_row_count integer;
 v_proven jsonb;
 v_repeat jsonb;
 v_tampered jsonb;
 v_reordered jsonb;
 v_wrong_actor jsonb;
 v_original_rows integer;
BEGIN
 v_export:=public.cwl_issue_owned_backup_witness(
  ARRAY['11111111-1111-4111-8111-111111111111'::uuid]);
 v_snapshot:=v_export->'snapshot';
 v_receipt:=v_export->'server_receipt';
 IF v_snapshot->>'consistency'<>'server-stable-statement' OR
    v_snapshot->>'kind'<>'cwl-cloud-app-backup' OR
    (SELECT count(*) FROM pg_catalog.jsonb_object_keys(
      v_snapshot->'clans'->0->'tables'))<>17 OR
    v_snapshot->'clans'->0->'tables'->'cwl_stat_attacks'->0->>'stars'<>'3' OR
    v_receipt->>'owner_user_id'<>'33333333-3333-4333-8333-333333333333' OR
    length(v_receipt->>'payload_sha256')<>64 THEN
   RAISE EXCEPTION 'Witness issuance missed a genuine 17-table snapshot';
 END IF;
 v_proven:=public.cwl_verify_owned_backup_witness(
   (v_receipt->>'id')::uuid,v_snapshot,
   ARRAY['88888888-8888-4888-8888-888888888888'::uuid]);
 IF v_proven->>'verified'<>'true' OR
    v_proven->>'scope'<>'server-origin-17-table-snapshot' OR
    v_proven->>'payload_sha256'<>v_receipt->>'payload_sha256' THEN
   RAISE EXCEPTION 'Original 17-table witness was not confirmed';
 END IF;
 v_repeat:=public.cwl_issue_owned_backup_witness(
  ARRAY['11111111-1111-4111-8111-111111111111'::uuid]);
 IF v_repeat->'server_receipt'->>'id'<>v_receipt->>'id' THEN
   RAISE EXCEPTION 'Same transaction created duplicate export witness';
 END IF;
 -- The JS serializer may order numeric IDs differently from PostgreSQL.
 -- The server witness proves exact row contents, NOT array presentation order.
 v_reordered:=pg_catalog.jsonb_set(v_snapshot,
  '{clans,0,tables,cwl_stat_attacks}',
  pg_catalog.jsonb_build_array(
   v_snapshot#>'{clans,0,tables,cwl_stat_attacks,1}',
   v_snapshot#>'{clans,0,tables,cwl_stat_attacks,0}'));
 v_proven:=public.cwl_verify_owned_backup_witness(
  (v_receipt->>'id')::uuid,v_reordered,
  ARRAY['88888888-8888-4888-8888-888888888888'::uuid]);
 IF v_proven->>'verified'<>'true' THEN
   RAISE EXCEPTION 'A harmless JSON row reorder invalidated server witness';
 END IF;
 -- A legitimate JSON edit, with a fully recalculated browser SHA, still
 -- cannot change the protected server witness for the original SQL data.
 v_tampered:=pg_catalog.jsonb_set(v_snapshot,
  '{clans,0,tables,cwl_stat_attacks,0,stars}','0'::jsonb);
 BEGIN
   PERFORM public.cwl_verify_owned_backup_witness(
      (v_receipt->>'id')::uuid,v_tampered,
      ARRAY['88888888-8888-4888-8888-888888888888'::uuid]);
   RAISE EXCEPTION 'Tampered stars retained original witness';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 BEGIN
   PERFORM public.cwl_verify_owned_backup_witness(
      (v_receipt->>'id')::uuid,v_snapshot,
      ARRAY['99999999-9999-4999-8999-999999999999'::uuid]);
   RAISE EXCEPTION 'Mismatched Clash tag retained proof';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM public.cwl_verify_owned_backup_witness(
      (v_receipt->>'id')::uuid,v_snapshot,
      ARRAY['22222222-2222-4222-8222-222222222222'::uuid]);
   RAISE EXCEPTION 'Foreign-owner target accepted source witness';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM public.cwl_issue_owned_backup_witness(
      ARRAY['11111111-1111-4111-8111-111111111111'::uuid,
            '22222222-2222-4222-8222-222222222222'::uuid]);
   RAISE EXCEPTION 'Partial multi-clan owner export succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM public.cwl_issue_owned_backup_witness(
      ARRAY['11111111-1111-4111-8111-111111111111'::uuid,
            '11111111-1111-4111-8111-111111111111'::uuid]);
   RAISE EXCEPTION 'Duplicate tenant allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 -- Even if a user can reach the private schema through a SQL client,
 -- RLS validates the submitted digest against an independently queried
 -- complete server snapshot, so a fabricated origin is impossible.
 BEGIN
   INSERT INTO private.cwl_portable_backup_witnesses(
     owner_user_id,source_clan_ids,source_clash_tags,payload_sha256,snapshot_at)
   VALUES (
     '33333333-3333-4333-8333-333333333333'::uuid,
     ARRAY['11111111-1111-4111-8111-111111111111'::uuid],
     '["#P8Y2"]'::jsonb,repeat('0',64),v_snapshot->>'created_at');
   RAISE EXCEPTION 'Forged witness accepted by the RLS INSERT policy';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 -- Private schema privileges are asserted below as the test superuser.
 -- Note: no profile, archive, owner decision or historical fact is altered.
 RAISE NOTICE 'PASS: owner 17-table origin receipt and tag-bound verification; forged stars/foreign owner/duplicate clans denied';
END
$test_origin$;

SET request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
DO $foreign_actor$
BEGIN
 BEGIN
   PERFORM public.cwl_issue_owned_backup_witness(
     ARRAY['11111111-1111-4111-8111-111111111111'::uuid]);
   RAISE EXCEPTION 'Another user issued owner witness';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 -- The other user owns #QL8P but not #P8Y2.
 BEGIN
   PERFORM public.cwl_verify_owned_backup_witness(
     '00000000-0000-4000-8000-000000000001'::uuid,
     '{}'::jsonb,
     ARRAY['88888888-8888-4888-8888-888888888888'::uuid]);
   RAISE EXCEPTION 'Unknown witness accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 RAISE NOTICE 'PASS: foreign actor cannot mint or validate another owner receipt';
END
$foreign_actor$;
RESET ROLE;
-- An anonymous role must not get EXECUTE despite PostgreSQL's default
-- function privileges. This also verifies the private table stays RLS-on.
DO $security_contract$
DECLARE v integer;
BEGIN
 IF NOT has_column_privilege('authenticated','private.cwl_portable_backup_witnesses','payload_sha256','INSERT')
    OR NOT has_table_privilege('authenticated','private.cwl_portable_backup_witnesses','SELECT')
    OR NOT has_schema_privilege('authenticated','private','USAGE')
    OR has_table_privilege('authenticated','private.cwl_portable_backup_witnesses','UPDATE')
    OR has_table_privilege('authenticated','private.cwl_portable_backup_witnesses','DELETE')
    OR has_column_privilege('authenticated','private.cwl_portable_backup_witnesses','id','INSERT')
    OR has_column_privilege('authenticated','private.cwl_portable_backup_witnesses','created_at','INSERT')
    OR has_column_privilege('authenticated','private.cwl_portable_backup_witnesses','created_at','UPDATE')
    OR has_table_privilege('anon','private.cwl_portable_backup_witnesses','INSERT')
    OR has_table_privilege('anon','private.cwl_portable_backup_witnesses','SELECT')
 THEN RAISE EXCEPTION 'Private witness column grants or RLS are unsafe'; END IF;
 IF has_function_privilege('anon',
   'public.cwl_issue_owned_backup_witness(uuid[])','EXECUTE') OR
    has_function_privilege('anon',
   'public.cwl_verify_owned_backup_witness(uuid,jsonb,uuid[])','EXECUTE') OR
    NOT has_function_privilege('authenticated',
   'public.cwl_issue_owned_backup_witness(uuid[])','EXECUTE') OR
    NOT has_function_privilege('authenticated',
   'public.cwl_verify_owned_backup_witness(uuid,jsonb,uuid[])','EXECUTE') OR
    NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
     WHERE oid='private.cwl_portable_backup_witnesses'::regclass) OR
    NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc
      WHERE oid='public.cwl_issue_owned_backup_witness(uuid[])'::regprocedure
        AND NOT prosecdef AND provolatile='v'
        AND EXISTS(SELECT 1 FROM pg_catalog.unnest(proconfig) sp(v)
          WHERE pg_catalog.replace(sp.v,'"','')='search_path=')) OR
    NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc
      WHERE oid='public.cwl_verify_owned_backup_witness(uuid,jsonb,uuid[])'::regprocedure
        AND NOT prosecdef AND provolatile='s'
        AND EXISTS(SELECT 1 FROM pg_catalog.unnest(proconfig) sp(v)
          WHERE pg_catalog.replace(sp.v,'"','')='search_path='))
 THEN RAISE EXCEPTION 'Source-witness RPC/table privileges or search_path unsafe';END IF;
 SELECT count(*) INTO v FROM private.cwl_portable_backup_witnesses;
 IF v<>1 THEN RAISE EXCEPTION 'Repeat export minted unexpected receipt rows %',v;END IF;
 RAISE NOTICE 'PASS: anon denied; public SQL functions owner scoped and schema hardened; one protected receipt';
END
$security_contract$;
