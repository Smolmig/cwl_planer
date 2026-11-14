-- #292 read-only pre/postflight for API <-> ClashPerk overlaps.
-- Execute as an authorized administrator. No table mutations, no raw player
-- tags/names in the output. App-Tenants are NEVER merged, even when their
-- actual Clash Clan tag is identical.
with signatures as (
 select clan_id,war_key,count(*) as attack_count,
  jsonb_agg(
   jsonb_build_array(upper(attacker_tag),upper(defender_tag),stars,destruction)
   order by upper(attacker_tag),upper(defender_tag),stars,destruction
  ) as attack_signature
 from public.cwl_stat_attacks
 group by clan_id,war_key
), candidates as (
 select a.clan_id,a.war_key api_key,i.war_key imported_key,a.war_type,
  a.missed_log_complete api_covered,i.missed_log_complete imported_covered,
  s1.attack_count api_attacks,s2.attack_count import_attacks,
  s1.attack_count>=2 and s1.attack_count=s2.attack_count
   and s1.attack_signature=s2.attack_signature as verified,
  extract(epoch from(i.started_at-a.started_at))/3600 as offset_hours
 from public.cwl_stat_wars a
 join public.cwl_stat_wars i on a.clan_id=i.clan_id
  and a.source='api' and i.source='import'
  and a.finalized and i.finalized and a.war_type=i.war_type
  and upper(a.opponent_tag)=upper(i.opponent_tag)
  and a.team_size=i.team_size
  and abs(extract(epoch from(i.started_at-a.started_at)))<=36*3600
 left join signatures s1 on s1.clan_id=a.clan_id and s1.war_key=a.war_key
 left join signatures s2 on s2.clan_id=i.clan_id and s2.war_key=i.war_key
)
select c.name as app_clan,c.clash_tag as clash_clan_tag,
 count(*) as nearby_api_import_pairs,
 count(*) filter (where p.verified) as verified_same_war_pairs,
 coalesce(sum(p.import_attacks) filter (where p.verified),0) as repeated_attack_rows,
 count(*) filter (where p.verified is not true) as require_manual_review,
 count(*) filter (where p.verified and p.api_covered is false and p.imported_covered) as improved_missed_coverage
from candidates p
join public.cwl_clans c on c.id=p.clan_id
group by c.id,c.name,c.clash_tag
order by c.name;
