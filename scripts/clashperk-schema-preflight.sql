-- #269 RELEASE PREFLIGHT: read-only PostgreSQL schema/authorization inspection.
-- No input data, no rows from clan/player tables, no migrations or writes.
-- Run with psql -X -qAt -v ON_ERROR_STOP=1 -v stage=pre|post -f ...
-- The single status line is PASS or FAIL (non-sensitive schema counts).
-- Caller must explicitly require output == PASS; SQL by itself only SELECTs.
\set ON_ERROR_STOP on
\if :{?stage}
\else
\set stage invalid
\endif

with
expected(table_name, col_name) as (values
 ('cwl_clans','id'),('cwl_clans','clash_tag'),
 ('cwl_stat_wars','clan_id'),('cwl_stat_wars','war_key'),
 ('cwl_stat_wars','war_type'),('cwl_stat_wars','started_at'),
 ('cwl_stat_wars','team_size'),('cwl_stat_wars','opponent_tag'),
 ('cwl_stat_wars','opponent_name'),('cwl_stat_wars','source'),
 ('cwl_stat_wars','roster_tags'),('cwl_stat_wars','finalized'),
 ('cwl_stat_wars','missed_log_complete'),
 ('cwl_stat_attacks','clan_id'),('cwl_stat_attacks','war_key'),
 ('cwl_stat_attacks','attacker_tag'),('cwl_stat_attacks','attack_order'),
 ('cwl_stat_attacks','attacker_name'),('cwl_stat_attacks','attacker_th'),
 ('cwl_stat_attacks','defender_tag'),('cwl_stat_attacks','defender_name'),
 ('cwl_stat_attacks','defender_th'),('cwl_stat_attacks','stars'),
 ('cwl_stat_attacks','destruction'),
 ('cwl_stat_missed','clan_id'),('cwl_stat_missed','war_key'),
 ('cwl_stat_missed','player_tag'),('cwl_stat_missed','player_name'),
 ('cwl_stat_missed','missed_count')
),
column_status as (
 select count(*)::int as expected_count, count(c.column_name)::int as actual_count
 from expected e
 left join information_schema.columns c
  on c.table_schema='public'
 and c.table_name=e.table_name and c.column_name=e.col_name
),
required_keys(table_name, columns_pattern) as (values
 ('cwl_stat_wars','(clan_id, war_key)'),
 ('cwl_stat_attacks','(clan_id, war_key, attacker_tag, attack_order)'),
 ('cwl_stat_missed','(clan_id, war_key, player_tag)')
),
key_status as (
 select count(*)::int as present
 from required_keys k where exists (
  select 1 from pg_catalog.pg_index i
  join pg_catalog.pg_class t on t.oid=i.indrelid
  join pg_catalog.pg_namespace n on n.oid=t.relnamespace
  where n.nspname='public' and t.relname=k.table_name
  and i.indisunique and i.indisvalid
  and strpos(pg_catalog.pg_get_indexdef(i.indexrelid),k.columns_pattern)>0
 )
),
rls_status as (
 select count(*)::int as enabled from pg_catalog.pg_class t
 join pg_catalog.pg_namespace n on n.oid=t.relnamespace
 where n.nspname='public' and t.relname in
  ('cwl_stat_wars','cwl_stat_attacks','cwl_stat_missed')
 and t.relkind in ('r','p') and t.relrowsecurity
),
required_policies(table_name, cmd) as (values
 ('cwl_stat_wars','SELECT'),('cwl_stat_wars','INSERT'),('cwl_stat_wars','UPDATE'),
 ('cwl_stat_attacks','SELECT'),('cwl_stat_attacks','INSERT'),('cwl_stat_attacks','UPDATE'),
 ('cwl_stat_missed','SELECT'),('cwl_stat_missed','INSERT'),('cwl_stat_missed','UPDATE')
),
policy_status as (
 select count(*)::int as valid
 from required_policies e where exists (
  select 1 from pg_catalog.pg_policies p
  where p.schemaname='public' and p.tablename=e.table_name
  and p.cmd=e.cmd and 'authenticated'=any(p.roles)
  and p.permissive='PERMISSIVE'
  and (e.cmd='INSERT' and p.with_check is not null
   or e.cmd='SELECT' and p.qual is not null
   or e.cmd='UPDATE' and p.qual is not null and p.with_check is not null)
 )
),
helper_status as (
 select to_regprocedure('auth.uid()') is not null
   and to_regprocedure('private.cwl_can_edit(uuid)') is not null as available
),
rpc_status as (
 select count(*)::int as present,
  coalesce(bool_and(
    not p.prosecdef
    and pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
    and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
  ),false) as grants_ok
 from pg_catalog.pg_proc p
 where p.oid=to_regprocedure('public.cwl_import_clashperk_atomic(uuid,jsonb)')
)
select case when
 :'stage' in ('pre','post')
 and c.expected_count=29 and c.actual_count=29
 and k.present=3 and r.enabled=3 and p.valid=9
 and h.available
 and current_setting('server_version_num')::int >= 170000
 and (:'stage'='pre' and f.present=0 or
      :'stage'='post' and f.present=1 and f.grants_ok)
 then 'PASS'
 else 'FAIL stage='||:'stage'
   ||' columns='||c.actual_count||'/29'
   ||' unique_keys='||k.present||'/3'
   ||' rls='||r.enabled||'/3'
   ||' policies='||p.valid||'/9'
   ||' helpers='||h.available
   ||' rpc_count='||f.present
   ||' rpc_grants='||f.grants_ok
 end as release_schema_preflight
from column_status c cross join key_status k cross join rls_status r
cross join policy_status p cross join helper_status h cross join rpc_status f;
