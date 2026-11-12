-- Synthetic seed AFTER the stage-1 observation migration was applied.
insert into public.cwl_verified_league_observations
 (clan_id,season,clan_tag,group_tags,war_count,rounds_count,group_state)
values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-12','#2PYL',
  '["#2PY0","#2PY9","#2PYC","#2PYG","#2PYL","#2PYQ","#2PYR","#2PYV"]'::jsonb,
  7,0,'preparation');
