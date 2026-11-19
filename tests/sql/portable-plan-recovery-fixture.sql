-- Disposable extension of the synthetic PostgreSQL 17 owner/foreign schema.
-- The shared fixture's minimal example JSON is expanded to the REAL v9 shape.
UPDATE public.cwl_cloud_profiles SET profile_json =
 pg_catalog.jsonb_build_object(
  'id','synthetic-uf-profile',
  'name','United Fighters',
  'members',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','m1','tag','#P8Y2')),
  'archivedMembers','[]'::jsonb,
  'locks',(
    SELECT pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'locked',i=1,'warTag',CASE WHEN i=1 THEN '#P8Y2' ELSE NULL END,
        'lineup','[]'::jsonb,'snapshots','{}'::jsonb))
    FROM pg_catalog.generate_series(1,7) AS i),
  'archives','[]'::jsonb,
  'config','{}'::jsonb,
  'dayGoals','[]'::jsonb,
  'cwlLive',pg_catalog.jsonb_build_object('clanTag','#P8Y2','rounds','[]'::jsonb),
  'updatedAt','2026-11-19T17:05:00Z'
 ) WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid;
UPDATE public.cwl_group_archives SET group_json =
 '{"season":"2026-11","clanTag":"#P8Y2","clans":[{"tag":"#P8Y2"},{"tag":"#QL8P"}],"rounds":[]}'::jsonb
 WHERE clan_id='11111111-1111-4111-8111-111111111111'::uuid;

INSERT INTO public.cwl_plan_review_state (
 clan_id,cycle_id,season,locked,locked_by,locked_at)
 VALUES (
 '11111111-1111-4111-8111-111111111111'::uuid,
 '77777777-7777-4777-8777-777777777777'::uuid,
 '2026-11',true,
 '33333333-3333-4333-8333-333333333333'::uuid,'2026-11-18T12:00:00Z');
INSERT INTO public.cwl_own_lineup_archives (
 clan_id,season,day,war_tag,state,team_size,lineup_json)
 VALUES (
 '11111111-1111-4111-8111-111111111111'::uuid,'2026-11',1,
 '#P8Y2','warEnded',1,
 '{"members":[{"tag":"#P8Y2","attacks":[{"stars":3}]}]}'::jsonb);
