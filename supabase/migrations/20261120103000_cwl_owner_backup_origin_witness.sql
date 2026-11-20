-- #178 – owner-bound witness for an unmodified, genuine SQL snapshot.
-- A plain SHA-256 in a user file is NOT proof of collector origin; an owner
-- could edit the JSON and recalculate it. This receipt is issued ONLY after
-- the server reads all 17 tables itself with owner + membership checks.
--
-- Security boundary: receives no user-provided historical rows for issuance;
-- refuses anonymous/foreign-member calls; no direct Data API access to the
-- private receipt table; never changes CWL plans, archives or observed facts.
-- Receipts survive loss of an individual clan and may be included in the
-- separately encrypted full database disaster-recovery backup. A total DB
-- loss *without* the receipt cannot validate this origin – fail closed.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE TABLE private.cwl_portable_backup_witnesses (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 owner_user_id uuid NOT NULL,
 source_clan_ids uuid[] NOT NULL,
 source_clash_tags jsonb NOT NULL CHECK (pg_catalog.jsonb_typeof(source_clash_tags)='array'),
 payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
 snapshot_at text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 CONSTRAINT cwl_portable_witness_owner_digest UNIQUE (owner_user_id,payload_sha256)
);
CREATE INDEX cwl_portable_witness_owner_created
 ON private.cwl_portable_backup_witnesses(owner_user_id,created_at DESC);
ALTER TABLE private.cwl_portable_backup_witnesses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.cwl_portable_backup_witnesses FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE private.cwl_portable_backup_witnesses IS
 'Server-produced SHA256 witness of 17-table owner backup snapshot; not a session credential or a public signature; no client INSERT/UPDATE/DELETE.';

-- JSONB preserves object key semantics, but the client sorts rows by their
-- composite keys while the SQL exporter orders some rows numerically.
-- A genuine file must not fail proof merely because row array order differs.
-- Hash a canonicalized bag of COMPLETE rows for every dataset, preserving
-- multiplicity, all fields, timestamps, owner metadata and 17 table names.
CREATE OR REPLACE FUNCTION private.cwl_canonical_backup_payload(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=''
AS $canonical_backup$
DECLARE
 v_clan jsonb;
 v_key text;
 v_raw jsonb;
 v_arr jsonb;
 v_tables jsonb;
 v_clans jsonb:='[]'::jsonb;
BEGIN
 IF pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR
    pg_catalog.jsonb_typeof(p_payload->'clans') IS DISTINCT FROM 'array' OR
    pg_catalog.jsonb_array_length(p_payload->'clans') NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'Invalid canonical backup envelope'
      USING ERRCODE='22023';
 END IF;
 FOR v_clan IN
    SELECT c.value FROM pg_catalog.jsonb_array_elements(p_payload->'clans') c(value)
      ORDER BY c.value->>'source_clan_id'
 LOOP
   IF pg_catalog.jsonb_typeof(v_clan->'tables') IS DISTINCT FROM 'object' OR
      (SELECT count(*) FROM pg_catalog.jsonb_object_keys(v_clan->'tables'))<>17 THEN
      RAISE EXCEPTION 'A witnessed source requires exactly 17 datasets'
        USING ERRCODE='22023';
   END IF;
   v_tables:='{}'::jsonb;
   FOR v_key,v_raw IN SELECT key,value FROM pg_catalog.jsonb_each(v_clan->'tables')
   LOOP
     IF pg_catalog.jsonb_typeof(v_raw) IS DISTINCT FROM 'array' OR
        pg_catalog.jsonb_array_length(v_raw)>100000 THEN
       RAISE EXCEPTION 'Witness dataset is missing, malformed or too large'
         USING ERRCODE='22023';
     END IF;
     SELECT coalesce(pg_catalog.jsonb_agg(row_data ORDER BY row_data::text),'[]'::jsonb)
       INTO v_arr
     FROM pg_catalog.jsonb_array_elements(v_raw) r(row_data);
     v_tables:=v_tables||pg_catalog.jsonb_build_object(v_key,v_arr);
   END LOOP;
   v_clans:=v_clans||pg_catalog.jsonb_build_array(
     pg_catalog.jsonb_set(v_clan,'{tables}',v_tables));
 END LOOP;
 RETURN pg_catalog.jsonb_set(p_payload,'{clans}',v_clans);
END;
$canonical_backup$;
REVOKE ALL ON FUNCTION private.cwl_canonical_backup_payload(jsonb)
 FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.cwl_issue_owned_backup_witness(
 p_clan_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=''
AS $issue_backup_witness$
DECLARE
 v_actor uuid:=auth.uid();
 v_ids uuid[];
 v_owned_count integer;
 v_snapshot jsonb;
 v_digest text;
 v_existing private.cwl_portable_backup_witnesses%rowtype;
 v_tags jsonb;
 v_bytes integer;
BEGIN
 IF v_actor IS NULL OR p_clan_ids IS NULL OR
    pg_catalog.cardinality(p_clan_ids) NOT BETWEEN 1 AND 30 OR
    EXISTS(SELECT 1 FROM pg_catalog.unnest(p_clan_ids) x(id) WHERE x.id IS NULL) OR
    (SELECT count(DISTINCT x.id) FROM pg_catalog.unnest(p_clan_ids) x(id))
      <>pg_catalog.cardinality(p_clan_ids) THEN
   RAISE EXCEPTION 'Authenticated distinct owner clans required for witnessed export'
    USING ERRCODE='42501';
 END IF;
 SELECT pg_catalog.array_agg(x.id ORDER BY x.id) INTO v_ids
 FROM pg_catalog.unnest(p_clan_ids) x(id);
 SELECT count(*) INTO v_owned_count
 FROM public.cwl_clans c
 JOIN public.cwl_clan_memberships m
   ON m.clan_id=c.id AND m.user_id=v_actor AND m.role='owner'
 WHERE c.id=ANY(v_ids) AND c.owner_user_id=v_actor;
 IF v_owned_count<>pg_catalog.cardinality(v_ids) THEN
   RAISE EXCEPTION 'Not the owner of every source clan'
    USING ERRCODE='42501';
 END IF;
 -- This STABLE function checks the same ownership and uses explicit
 -- field-by-field projections of ALL 17 tables. Single SQL transaction.
 v_snapshot:=public.cwl_export_owned_backup(v_ids);
 IF v_snapshot->>'kind' IS DISTINCT FROM 'cwl-cloud-app-backup'
  OR v_snapshot->>'format_version' IS DISTINCT FROM '1'
  OR v_snapshot->>'consistency' IS DISTINCT FROM 'server-stable-statement'
  OR pg_catalog.jsonb_typeof(v_snapshot->'clans') IS DISTINCT FROM 'array'
  OR pg_catalog.jsonb_array_length(v_snapshot->'clans')<>pg_catalog.cardinality(v_ids)
 THEN
   RAISE EXCEPTION 'Not a complete server-origin Cloud backup'
    USING ERRCODE='22023';
 END IF;
 v_bytes:=pg_catalog.octet_length(v_snapshot::text);
 IF v_bytes>67108864 THEN
   RAISE EXCEPTION 'Backup exceeds 64 MiB server memory safety bound'
    USING ERRCODE='54000';
 END IF;
 v_tags:=(SELECT pg_catalog.jsonb_agg(c->'clash_tag')
         FROM pg_catalog.jsonb_array_elements(v_snapshot->'clans') c);
 IF pg_catalog.jsonb_array_length(v_tags)<>pg_catalog.cardinality(v_ids)
  OR EXISTS(
   SELECT 1 FROM pg_catalog.jsonb_array_elements_text(v_tags) tags(tag)
   WHERE tags.tag IS NULL OR tags.tag !~ '^#[0289PYLQGRJCUV]{3,15}$'
  ) THEN
   RAISE EXCEPTION 'Missing or invalid original Clash clan tags'
    USING ERRCODE='22023';
 END IF;
 -- pg_catalog.sha256 is built in on PostgreSQL 17 (no pgcrypto secret).
 -- We do not call this a cryptographic SIGNATURE: the protected database
 -- receipt makes it verifiable only while this receipt exists.
 v_digest:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
   private.cwl_canonical_backup_payload(v_snapshot)::text,'UTF8')),'hex');
 INSERT INTO private.cwl_portable_backup_witnesses(
   owner_user_id,source_clan_ids,source_clash_tags,payload_sha256,snapshot_at)
 VALUES (v_actor,v_ids,v_tags,v_digest,v_snapshot->>'created_at')
 ON CONFLICT (owner_user_id,payload_sha256) DO NOTHING;
 SELECT * INTO v_existing FROM private.cwl_portable_backup_witnesses
  WHERE owner_user_id=v_actor AND payload_sha256=v_digest;
 IF NOT FOUND OR v_existing.source_clan_ids IS DISTINCT FROM v_ids
  OR v_existing.source_clash_tags IS DISTINCT FROM v_tags
  OR v_existing.snapshot_at IS DISTINCT FROM v_snapshot->>'created_at' THEN
   RAISE EXCEPTION 'Conflicting source witness for this owner'
    USING ERRCODE='40001';
 END IF;
 RETURN pg_catalog.jsonb_build_object(
   'snapshot',v_snapshot,
   'server_receipt',pg_catalog.jsonb_build_object(
     'id',v_existing.id,
     'payload_sha256',v_digest,
     'owner_user_id',v_actor,
     'snapshot_at',v_existing.snapshot_at
   )
 );
END;
$issue_backup_witness$;

CREATE OR REPLACE FUNCTION public.cwl_verify_owned_backup_witness(
 p_receipt_id uuid, p_payload jsonb, p_target_clan_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=''
AS $verify_backup_witness$
DECLARE
 v_actor uuid:=auth.uid();
 v_row private.cwl_portable_backup_witnesses%rowtype;
 v_digest text;
 v_clans jsonb;
 v_count integer;
 v_i integer;
 v_tag text;
 v_actual_tag text;
BEGIN
 IF v_actor IS NULL OR p_receipt_id IS NULL OR
   p_payload IS NULL OR
   pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR
   pg_catalog.octet_length(p_payload::text)>67108864 THEN
   RAISE EXCEPTION 'Authenticated complete witnessed payload required'
    USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_row FROM private.cwl_portable_backup_witnesses
 WHERE id=p_receipt_id AND owner_user_id=v_actor;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'No original server witness for owner'
    USING ERRCODE='42501';
 END IF;
 v_digest:=pg_catalog.encode(pg_catalog.sha256(
   pg_catalog.convert_to(private.cwl_canonical_backup_payload(p_payload)::text,'UTF8')),'hex');
 v_clans:=p_payload->'clans';
 v_count:=pg_catalog.jsonb_array_length(v_row.source_clash_tags);
 IF v_digest IS DISTINCT FROM v_row.payload_sha256 OR
   p_payload->>'created_at' IS DISTINCT FROM v_row.snapshot_at OR
   p_payload->>'kind' IS DISTINCT FROM 'cwl-cloud-app-backup' OR
   p_payload->>'format_version' IS DISTINCT FROM '1' OR
   p_payload->>'consistency' IS DISTINCT FROM 'server-stable-statement' OR
   pg_catalog.jsonb_typeof(v_clans) IS DISTINCT FROM 'array' OR
   pg_catalog.jsonb_array_length(v_clans)<>v_count OR
   p_target_clan_ids IS NULL OR
   pg_catalog.cardinality(p_target_clan_ids)<>v_count OR
   (SELECT count(DISTINCT x.id)
    FROM pg_catalog.unnest(p_target_clan_ids) x(id))<>v_count THEN
    RAISE EXCEPTION 'Witness, snapshot or target count conflict'
      USING ERRCODE='22023';
 END IF;
 FOR v_i IN 0..v_count-1 LOOP
   v_tag:=v_row.source_clash_tags->>v_i;
   IF v_clans->v_i->>'source_clan_id' IS DISTINCT FROM
        v_row.source_clan_ids[v_i+1]::text OR
      v_clans->v_i->>'clash_tag' IS DISTINCT FROM v_tag THEN
       RAISE EXCEPTION 'Witness source identity mismatch'
         USING ERRCODE='22023';
   END IF;
   SELECT c.clash_tag INTO v_actual_tag
   FROM public.cwl_clans c
   JOIN public.cwl_clan_memberships m
     ON m.clan_id=c.id AND m.user_id=v_actor AND m.role='owner'
   WHERE c.id=p_target_clan_ids[v_i+1] AND c.owner_user_id=v_actor;
   IF NOT FOUND OR v_actual_tag IS DISTINCT FROM v_tag THEN
     RAISE EXCEPTION 'Target clan ownership/Clash tag mismatch'
       USING ERRCODE='42501';
   END IF;
 END LOOP;
 RETURN pg_catalog.jsonb_build_object(
   'verified',true,'scope','server-origin-17-table-snapshot',
   'receipt_id',v_row.id,'payload_sha256',v_digest,
   'source_clan_count',v_count,
   'target_clan_ids',pg_catalog.to_jsonb(p_target_clan_ids),
   'owner_user_id',v_actor
 );
END;
$verify_backup_witness$;
REVOKE ALL ON FUNCTION public.cwl_issue_owned_backup_witness(uuid[])
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cwl_issue_owned_backup_witness(uuid[])
 TO authenticated;
REVOKE ALL ON FUNCTION public.cwl_verify_owned_backup_witness(uuid,jsonb,uuid[])
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cwl_verify_owned_backup_witness(uuid,jsonb,uuid[])
 TO authenticated;
COMMENT ON FUNCTION public.cwl_issue_owned_backup_witness(uuid[]) IS
 'Creates database-retained proof that all 17 exported datasets really came from an owner-authorized SQL snapshot; source/target data unchanged.';
COMMENT ON FUNCTION public.cwl_verify_owned_backup_witness(uuid,jsonb,uuid[]) IS
 'Fail-closed origin/owner/target identity validation; read-only, NOT permission to restore verified collector archives yet.';

  ) THEN
   RAISE EXCEPTION 'Missing or invalid original Clash clan tags'
    USING ERRCODE='22023';
 END IF;
 -- pg_catalog.sha256 is built in on PostgreSQL 17 (no pgcrypto secret).
 -- We do not call this a cryptographic SIGNATURE: the protected database
 -- receipt makes it verifiable only while this receipt exists.
 v_digest:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
   v_snapshot::text,'UTF8')),'hex');
 INSERT INTO private.cwl_portable_backup_witnesses(
   owner_user_id,source_clan_ids,source_clash_tags,payload_sha256,snapshot_at)
 VALUES (v_actor,v_ids,v_tags,v_digest,v_snapshot->>'created_at')
 ON CONFLICT (owner_user_id,payload_sha256) DO NOTHING;
 SELECT * INTO v_existing FROM private.cwl_portable_backup_witnesses
  WHERE owner_user_id=v_actor AND payload_sha256=v_digest;
 IF NOT FOUND OR v_existing.source_clan_ids IS DISTINCT FROM v_ids
  OR v_existing.source_clash_tags IS DISTINCT FROM v_tags
  OR v_existing.snapshot_at IS DISTINCT FROM v_snapshot->>'created_at' THEN
   RAISE EXCEPTION 'Conflicting source witness for this owner'
    USING ERRCODE='40001';
 END IF;
 RETURN pg_catalog.jsonb_build_object(
   'snapshot',v_snapshot,
   'server_receipt',pg_catalog.jsonb_build_object(
     'id',v_existing.id,
     'payload_sha256',v_digest,
     'owner_user_id',v_actor,
     'snapshot_at',v_existing.snapshot_at
   )
 );
END;
$issue_backup_witness$;

CREATE OR REPLACE FUNCTION public.cwl_verify_owned_backup_witness(
 p_receipt_id uuid, p_payload jsonb, p_target_clan_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=''
AS $verify_backup_witness$
DECLARE
 v_actor uuid:=auth.uid();
 v_row private.cwl_portable_backup_witnesses%rowtype;
 v_digest text;
 v_clans jsonb;
 v_count integer;
 v_i integer;
 v_tag text;
 v_actual_tag text;
BEGIN
 IF v_actor IS NULL OR p_receipt_id IS NULL OR
   p_payload IS NULL OR
   pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR
   pg_catalog.octet_length(p_payload::text)>67108864 THEN
   RAISE EXCEPTION 'Authenticated complete witnessed payload required'
    USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_row FROM private.cwl_portable_backup_witnesses
 WHERE id=p_receipt_id AND owner_user_id=v_actor;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'No original server witness for owner'
    USING ERRCODE='42501';
 END IF;
 v_digest:=pg_catalog.encode(pg_catalog.sha256(
   pg_catalog.convert_to(p_payload::text,'UTF8')),'hex');
 v_clans:=p_payload->'clans';
 v_count:=pg_catalog.jsonb_array_length(v_row.source_clash_tags);
 IF v_digest IS DISTINCT FROM v_row.payload_sha256 OR
   p_payload->>'created_at' IS DISTINCT FROM v_row.snapshot_at OR
   p_payload->>'kind' IS DISTINCT FROM 'cwl-cloud-app-backup' OR
   p_payload->>'format_version' IS DISTINCT FROM '1' OR
   p_payload->>'consistency' IS DISTINCT FROM 'server-stable-statement' OR
   pg_catalog.jsonb_typeof(v_clans) IS DISTINCT FROM 'array' OR
   pg_catalog.jsonb_array_length(v_clans)<>v_count OR
   p_target_clan_ids IS NULL OR
   pg_catalog.cardinality(p_target_clan_ids)<>v_count OR
   (SELECT count(DISTINCT x.id)
    FROM pg_catalog.unnest(p_target_clan_ids) x(id))<>v_count THEN
    RAISE EXCEPTION 'Witness, snapshot or target count conflict'
      USING ERRCODE='22023';
 END IF;
 FOR v_i IN 0..v_count-1 LOOP
   v_tag:=v_row.source_clash_tags->>v_i;
   IF v_clans->v_i->>'source_clan_id' IS DISTINCT FROM
        v_row.source_clan_ids[v_i+1]::text OR
      v_clans->v_i->>'clash_tag' IS DISTINCT FROM v_tag THEN
       RAISE EXCEPTION 'Witness source identity mismatch'
         USING ERRCODE='22023';
   END IF;
   SELECT c.clash_tag INTO v_actual_tag
   FROM public.cwl_clans c
   JOIN public.cwl_clan_memberships m
     ON m.clan_id=c.id AND m.user_id=v_actor AND m.role='owner'
   WHERE c.id=p_target_clan_ids[v_i+1] AND c.owner_user_id=v_actor;
   IF NOT FOUND OR v_actual_tag IS DISTINCT FROM v_tag THEN
     RAISE EXCEPTION 'Target clan ownership/Clash tag mismatch'
       USING ERRCODE='42501';
   END IF;
 END LOOP;
 RETURN pg_catalog.jsonb_build_object(
   'verified',true,'scope','server-origin-17-table-snapshot',
   'receipt_id',v_row.id,'payload_sha256',v_digest,
   'source_clan_count',v_count,
   'target_clan_ids',pg_catalog.to_jsonb(p_target_clan_ids),
   'owner_user_id',v_actor
 );
END;
$verify_backup_witness$;
REVOKE ALL ON FUNCTION public.cwl_issue_owned_backup_witness(uuid[])
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cwl_issue_owned_backup_witness(uuid[])
 TO authenticated;
REVOKE ALL ON FUNCTION public.cwl_verify_owned_backup_witness(uuid,jsonb,uuid[])
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cwl_verify_owned_backup_witness(uuid,jsonb,uuid[])
 TO authenticated;
COMMENT ON FUNCTION public.cwl_issue_owned_backup_witness(uuid[]) IS
 'Creates database-retained proof that all 17 exported datasets really came from an owner-authorized SQL snapshot; source/target data unchanged.';
COMMENT ON FUNCTION public.cwl_verify_owned_backup_witness(uuid,jsonb,uuid[]) IS
 'Fail-closed origin/owner/target identity validation; read-only, NOT permission to restore verified collector archives yet.';
