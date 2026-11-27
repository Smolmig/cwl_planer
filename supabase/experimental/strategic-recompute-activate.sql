-- Separate opt-in activation, AFTER derived assignment migration + collector deploy
-- and local/hosted smoke. Never run on an isolated test or unreviewed production.
-- Reuse existing internal Cron signer. No dispatch when no changed active input.
select cron.schedule('cwl-strategic-recompute-pending','* * * * *',$job$
 with pending as (
  select 1 from public.cwl_cloud_profiles p join public.cwl_plan_review_state r on r.clan_id=p.clan_id
  join public.cwl_clans c on c.id=p.clan_id
  left join public.cwl_strategic_assignments a on a.clan_id=p.clan_id
  left join public.cwl_strategic_recompute_claims q on q.clan_id=p.clan_id
  where r.season=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM')
   and c.clash_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'
   and exists(select 1 from public.cwl_clan_memberships m where m.clan_id=c.id and m.user_id=c.owner_user_id and m.role='owner')
   and p.profile_json#>>'{cwlLive,season}'=r.season and p.profile_json#>>'{cwlLive,clanTag}'=c.clash_tag
   and p.profile_json#>'{config,strategicAuto}'='true'::jsonb
   and p.profile_json#>>'{config,strategicMode}' in ('balanced','performance','development')
   and p.profile_json->>'cwlLiveIgnoredSeason' is distinct from r.season
   and coalesce(p.profile_json#>'{cocManualEmergency,pending}','false'::jsonb)<>'true'::jsonb
   and (a.clan_id is null or a.base_revision<>p.revision or a.cycle_id<>r.cycle_id)
   and (q.clan_id is null or q.claimed_at<clock_timestamp()-interval '5 minutes'
    or ((q.base_revision<>p.revision or q.cycle_id<>r.cycle_id) and q.claimed_at<clock_timestamp()-interval '1 minute'))
  limit 1
 ), signing as (
  select floor(extract(epoch from now()))::bigint as at_utc,decrypted_secret as secret_hex
  from vault.decrypted_secrets where name='cwl_collector_cron_hmac_v1' and exists(select 1 from pending)
 )
 select net.http_post(
  url:='https://yjldnvfwposfwmzmcsow.supabase.co/functions/v1/coc-stats-collector',
  headers:=jsonb_build_object('Content-Type','application/json','X-CWL-Collector-Cron-At',at_utc::text,
   'X-CWL-Collector-Cron-Signature',encode(extensions.hmac((at_utc::text||':cwl:collector:cron:v1')::bytea,decode(secret_hex,'hex'),'sha256'),'hex')),
  body:='{"strategicPending":true}'::jsonb,timeout_milliseconds:=125000)
 from signing;
$job$);
-- Rollback: select cron.unschedule('cwl-strategic-recompute-pending');
