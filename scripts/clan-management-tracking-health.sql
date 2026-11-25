-- Operator-only, read-only tracking audit. Never infer missed attacks from age.
-- 72h since recorded start is a conservative investigation trigger, not finality.
select c.name as clan,
 count(*) filter (where w.finalized and w.missed_log_complete) as confirmed_wars,
 count(*) filter (where w.finalized and not w.missed_log_complete) as finalized_misses_unknown,
 count(*) filter (where not w.finalized and w.started_at < now()-interval '72 hours') as stale_unfinalized,
 count(*) filter (where not w.finalized and w.started_at >= now()-interval '72 hours') as recent_unfinalized,
 count(*) filter (where w.source_clash_tag is distinct from c.clash_tag) as missing_or_different_source
from public.cwl_clans c
join public.cwl_stat_wars w on w.clan_id=c.id
where w.source='api' and w.war_type='normal' and w.started_at>=now()-interval '90 days'
group by c.id,c.name order by c.name;

-- Stale records to reconcile against an independently exported completed war.
select c.name as clan,w.war_key,w.opponent_tag,w.started_at,w.updated_at,w.team_size,
 w.source_clash_tag,w.finalized,w.missed_log_complete,
 (select count(*) from public.cwl_stat_attacks a where a.clan_id=w.clan_id and a.war_key=w.war_key) as captured_attacks
from public.cwl_clans c join public.cwl_stat_wars w on w.clan_id=c.id
where w.source='api' and w.war_type='normal' and w.started_at>=now()-interval '90 days'
 and ((not w.finalized and w.started_at<now()-interval '72 hours') or (w.finalized and not w.missed_log_complete))
order by c.name,w.started_at;

-- Elapsed since first observation is NOT guaranteed membership time.
-- Delta includes absences and missed polling gaps; it must never be added to tenure.
select c.name as clan,count(*) filter(where t.is_present) as present,
 max(t.last_observed_at) as latest_roster,
 count(*) filter(where t.is_present and t.last_observed_at<now()-interval '24 hours') as stale_present,
 count(*) filter(where t.is_present and t.last_clash_rank is null) as no_rank,
 count(*) filter(where t.is_present and t.last_donations is null) as no_donations,
 round(max(t.confirmed_seconds) filter(where t.is_present)/86400.0,2) as max_confirmed_days,
 round(max(extract(epoch from t.last_observed_at-t.first_observed_at)) filter(where t.is_present)/86400.0,2) as max_elapsed_days
from public.cwl_clans c join public.cwl_clan_member_tenure t on t.clan_id=c.id
group by c.id,c.name order by c.name;
