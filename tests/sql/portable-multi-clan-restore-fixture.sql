-- Synthetic extension for a SINGLE signed, two-clan original backup.
-- Run after 17-table export/restore fixtures, origin witness, and
-- portable-pristine-clan-restore-fixture.sql. Never on live project.
-- Original A: #P8Y2 / United Fighters from existing signed test fixture.
-- Original B: #QL8P / UF2; two independently owned replacement slots.
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
UPDATE public.cwl_cloud_profiles
 SET profile_json=pg_catalog.jsonb_build_object(
   'name','UF2','members','[{"id":"u2","playerTag":"#QL8P"}]'::jsonb,
   'archivedMembers','[]'::jsonb,
   'archives','[{"season":"2026-10","score":6}]'::jsonb,
   'dayGoals','[{"strength":{},"townHall":{}}]'::jsonb,
   'config','{"slots":15,"days":7,"memberSort":"name"}'::jsonb,
   'cwlLive','{"rounds":[{"day":2,"stars":35}],"warCount":1}'::jsonb,
   'locks',(SELECT pg_catalog.jsonb_agg(
     CASE WHEN d=2 THEN
       '{"locked":true,"warTag":"#QL8P","lineup":["u2"],"snapshots":{"day":2}}'::jsonb
     ELSE '{"locked":false,"lineup":[],"snapshots":{}}'::jsonb END ORDER BY d)
     FROM pg_catalog.generate_series(1,7) d))
 WHERE clan_id='55555555-5555-4555-8555-555555555555';
RESET request.jwt.claim.sub;
INSERT INTO public.cwl_stat_wars(clan_id,war_key,war_type,started_at,team_size,
 opponent_name,source,finalized,missed_log_complete,source_clash_tag)
VALUES ('55555555-5555-4555-8555-555555555555','normal:uf2-war','normal',
 '2026-11-10T10:00Z',15,'Rival 2','api',true,true,'#QL8P');
INSERT INTO public.cwl_stat_attacks(clan_id,war_key,attacker_tag,attack_order,
 stars,destruction,created_at) VALUES
 ('55555555-5555-4555-8555-555555555555','normal:uf2-war','#QL8P',1,3,100,
 '2026-11-10T11:00Z');
INSERT INTO public.cwl_stat_missed(clan_id,war_key,player_tag,missed_count)
VALUES ('55555555-5555-4555-8555-555555555555','normal:uf2-war','#QL8P',0);
INSERT INTO public.cwl_group_archives(clan_id,season,clan_tag,group_json)
VALUES ('55555555-5555-4555-8555-555555555555','2026-11','#QL8P',
 '{"season":"2026-11","clans":[],"rounds":[]}'::jsonb);
INSERT INTO public.cwl_own_lineup_archives(
 clan_id,season,day,war_tag,state,team_size,lineup_json)
VALUES ('55555555-5555-4555-8555-555555555555','2026-11',2,'#QL8P',
 'warEnded',1,'{"members":[{"tag":"#QL8P","attacks":[{"stars":3}]}]}'::jsonb);
INSERT INTO public.cwl_plan_review_state(clan_id,cycle_id,season,locked,locked_by,
 locked_at,updated_at)
VALUES ('55555555-5555-4555-8555-555555555555',
 'bbbbbbbb-1111-4111-8111-111111111111','2026-11',true,
 '33333333-3333-4333-8333-333333333333','2026-11-12T11:00Z','2026-11-12T12:00Z');
INSERT INTO public.cwl_clan_management_rules(
 clan_id,performance_enabled,revision)
VALUES ('55555555-5555-4555-8555-555555555555',true,4);
INSERT INTO public.cwl_clan_member_tenure(
 clan_id,source_clash_tag,player_tag,first_observed_at,last_present_at,
 last_observed_at,state_changed_at,is_present,confirmed_seconds,observed_visits)
VALUES ('55555555-5555-4555-8555-555555555555','#QL8P','#QL8P',
 '2026-10-01T10:00Z','2026-11-12T10:00Z','2026-11-12T10:00Z',
 '2026-10-01T10:00Z',true,7200,3);
INSERT INTO public.cwl_clan_cw_missed_decisions(id,clan_id,source_clash_tag,
 war_key,player_tag,decision,note,actor_id)
OVERRIDING SYSTEM VALUE VALUES(501,
 '55555555-5555-4555-8555-555555555555','#QL8P','normal:uf2-war',
 '#QL8P','acknowledged','separate UF2 owner decision',
 '33333333-3333-4333-8333-333333333333');

-- Two currently empty owner-linked fresh replacement targets for #QL8P.
INSERT INTO public.cwl_clans(id,name,clash_tag,owner_user_id) VALUES
 ('abababab-abab-4bab-8bab-abababababab','UF2 clean target 1','#QL8P',
  '33333333-3333-4333-8333-333333333333'),
 ('bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc','UF2 clean target 2','#QL8P',
  '33333333-3333-4333-8333-333333333333'),
 ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd','UF2 busy target','#QL8P',
  '33333333-3333-4333-8333-333333333333'),
 ('dededede-dede-4ede-8ede-dededededede','UF2 foreign target','#QL8P',
  '44444444-4444-4444-8444-444444444444');
INSERT INTO public.cwl_clan_memberships(clan_id,user_id,role) VALUES
 ('abababab-abab-4bab-8bab-abababababab',
  '33333333-3333-4333-8333-333333333333','owner'),
 ('bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc',
  '33333333-3333-4333-8333-333333333333','owner'),
 ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',
  '33333333-3333-4333-8333-333333333333','owner'),
 ('dededede-dede-4ede-8ede-dededededede',
  '44444444-4444-4444-8444-444444444444','owner');
INSERT INTO public.cwl_cloud_profiles(clan_id,profile_json,data_version,revision)
VALUES
 ('abababab-abab-4bab-8bab-abababababab',
  public.synthetic_empty_profile('UF2 clean 1'),9,1),
 ('bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc',
  public.synthetic_empty_profile('UF2 clean 2'),9,1),
 ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',
  public.synthetic_empty_profile('UF2 active'),9,1),
 ('dededede-dede-4ede-8ede-dededededede',
  public.synthetic_empty_profile('UF2 foreign'),9,1);
INSERT INTO public.cwl_stat_wars(clan_id,war_key,war_type,started_at,team_size,
 source,finalized)
VALUES ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',
 'normal:uf2-active','normal','2026-11-20T12:00Z',15,'api',true);
