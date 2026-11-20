-- Synthetic PG17 fresh-target 17-table full restore test, never deployed.
-- Call after portable-cloud-export-fixture.sql and 3 existing snapshot/
-- witness/write-fixture migrations. No live user information is used.
CREATE TABLE auth.users(id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES
 ('33333333-3333-4333-8333-333333333333'),
 ('44444444-4444-4444-8444-444444444444');
CREATE OR REPLACE FUNCTION public.synthetic_empty_profile(p_name text)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT jsonb_build_object(
  'name',p_name,'members','[]'::jsonb,'archivedMembers','[]'::jsonb,
  'archives','[]'::jsonb,'dayGoals','[]'::jsonb,
  'config','{}'::jsonb,'cwlLive','{"rounds":[],"warCount":0}'::jsonb,
  'locks',(SELECT jsonb_agg('{"locked":false,"lineup":[],"snapshots":{}}'::jsonb)
     FROM pg_catalog.generate_series(1,7)));
$$;
-- The signed backup carries real played locks and an archived CWL,
-- not merely a pristine planning mock.
UPDATE public.cwl_cloud_profiles SET profile_json=jsonb_build_object(
 'name','United Fighters',
 'members','[{"id":"m1","playerTag":"#P8Y2","name":"Veteran","fixed":true}]'::jsonb,
 'archivedMembers','[{"id":"m2","name":"old"}]'::jsonb,
 'archives','[{"season":"2026-10","score":5}]'::jsonb,
 'dayGoals','[{"strength":{},"townHall":{}}]'::jsonb,
 'config','{"slots":15,"days":7,"memberSort":"name"}'::jsonb,
 'cwlLive','{"rounds":[{"day":1,"stars":38}],"warCount":1}'::jsonb,
 'locks',(SELECT jsonb_agg(CASE WHEN n=1
  THEN '{"locked":true,"warTag":"#P8Y2","lineup":["m1"],"snapshots":{"day":1}}'::jsonb
  ELSE '{"locked":false,"lineup":[],"snapshots":{}}'::jsonb END ORDER BY n)
  FROM pg_catalog.generate_series(1,7) n))
 WHERE clan_id='11111111-1111-4111-8111-111111111111';

-- Historical copies in ALL remaining source data categories.
INSERT INTO public.cwl_profile_snapshots(id,clan_id,revision,profile_json,created_at)
 VALUES (301,'11111111-1111-4111-8111-111111111111',3,
 '{"members":[{"id":"m1"}]}'::jsonb,'2026-11-18T10:00Z');
INSERT INTO public.cwl_change_events(id,clan_id,actor_id,revision,event_type,details,created_at)
 VALUES (302,'11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',3,
 'profile_updated','{"historic":true}'::jsonb,'2026-11-18T11:00Z');
INSERT INTO public.cwl_plan_review_state(
 clan_id,cycle_id,season,locked,locked_by,locked_at,updated_at)
 VALUES ('11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11',true,
 '33333333-3333-4333-8333-333333333333',
 '2026-11-18T11:00Z','2026-11-18T12:00Z');
INSERT INTO public.cwl_plan_suggestions(
 id,clan_id,cycle_id,author_id,base_revision,suggested_profile,status,submitted_at)
 VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '33333333-3333-4333-8333-333333333333',
 3,'{"members":[]}'::jsonb,'accepted','2026-11-18T10:00Z');
INSERT INTO public.cwl_own_lineup_archives(
 clan_id,season,day,war_tag,state,team_size,lineup_json)
 VALUES ('11111111-1111-4111-8111-111111111111',
 '2026-11',1,'#P8Y2','warEnded',1,
 '{"members":[{"tag":"#P8Y2","attacks":[{"stars":3}]}]}'::jsonb);
INSERT INTO public.cwl_missed_owner_decisions(id,clan_id,season,war_key,day,
 player_tag,decision,note,actor_id,created_at) VALUES
 (303,'11111111-1111-4111-8111-111111111111','2026-11',
 'cwl:war2',1,'#P8Y2','excused','original decision',
 '33333333-3333-4333-8333-333333333333','2026-11-18T10:00Z');
INSERT INTO public.cwl_clan_member_tenure(
 clan_id,source_clash_tag,player_tag,first_observed_at,last_present_at,
 last_observed_at,state_changed_at,is_present,confirmed_seconds,observed_visits)
 VALUES ('11111111-1111-4111-8111-111111111111','#P8Y2','#P8Y2',
 '2026-10-01T10:00Z','2026-11-18T10:00Z','2026-11-18T10:00Z',
 '2026-10-01T10:00Z',true,86400,4);
INSERT INTO public.cwl_clan_donation_observations(
 clan_id,source_clash_tag,player_tag,observed_at,positive_delta) VALUES
 ('11111111-1111-4111-8111-111111111111','#P8Y2','#P8Y2',
 '2026-11-18T10:00Z',50);
INSERT INTO public.cwl_clan_absence_observations(
 clan_id,source_clash_tag,player_tag,prior_visit_number,leave_observed_at,
 last_absent_observed_at,observed_absent_snapshots,current_streak_seconds,max_streak_seconds)
 VALUES ('11111111-1111-4111-8111-111111111111','#P8Y2','#P8Y2',2,
 '2026-11-02T10:00Z','2026-11-03T10:00Z',2,3600,3600);
INSERT INTO public.cwl_clan_review_decisions(
 clan_id,source_clash_tag,player_tag,review_kind,disposition,evidence_fingerprint,revision,updated_at)
 VALUES ('11111111-1111-4111-8111-111111111111','#P8Y2','#P8Y2',
 'performance','acknowledged','verified-2026',2,'2026-11-18T11:00Z');
UPDATE public.cwl_clan_cw_missed_decisions SET actor_id='33333333-3333-4333-8333-333333333333'
 WHERE clan_id='11111111-1111-4111-8111-111111111111';

-- Representative target clone: same clash tag, new owner-linked UUID and
-- no activity. One competing target has real API evidence and MUST be denied.
INSERT INTO public.cwl_clans VALUES
 ('88888888-8888-4888-8888-888888888888','Replacement 1','#P8Y2','33333333-3333-4333-8333-333333333333'),
 ('99999999-9999-4999-8999-999999999999','Replacement 2','#P8Y2','33333333-3333-4333-8333-333333333333'),
 ('77777777-7777-4777-8777-777777777777','Active target','#P8Y2','33333333-3333-4333-8333-333333333333'),
 ('aaaaaaaa-1111-4111-8111-111111111111','Not owned','#P8Y2','44444444-4444-4444-8444-444444444444');
INSERT INTO public.cwl_clan_memberships VALUES
 ('88888888-8888-4888-8888-888888888888','33333333-3333-4333-8333-333333333333','owner'),
 ('99999999-9999-4999-8999-999999999999','33333333-3333-4333-8333-333333333333','owner'),
 ('77777777-7777-4777-8777-777777777777','33333333-3333-4333-8333-333333333333','owner'),
 ('aaaaaaaa-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444','owner');
INSERT INTO public.cwl_cloud_profiles(clan_id,profile_json,data_version,revision)
 VALUES
 ('88888888-8888-4888-8888-888888888888',public.synthetic_empty_profile('Fresh 1'),9,1),
 ('99999999-9999-4999-8999-999999999999',public.synthetic_empty_profile('Fresh 2'),9,1),
 ('77777777-7777-4777-8777-777777777777',public.synthetic_empty_profile('Active'),9,1),
 ('aaaaaaaa-1111-4111-8111-111111111111',public.synthetic_empty_profile('Foreign'),9,1);
INSERT INTO public.cwl_stat_wars(clan_id,war_key,war_type,started_at,team_size,source,finalized)
 VALUES ('77777777-7777-4777-8777-777777777777','normal:active','normal','2026-11-20T10:00Z',15,'api',true);

-- Add synthetic *realistic* identity PKs/default sequences so source IDs
-- collide globally but imported rows MUST still get fresh destination IDs.
ALTER TABLE public.cwl_change_events ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.cwl_profile_snapshots ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.cwl_missed_owner_decisions ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.cwl_clan_cw_missed_decisions ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.cwl_change_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;
ALTER TABLE public.cwl_profile_snapshots ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;
ALTER TABLE public.cwl_missed_owner_decisions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;
ALTER TABLE public.cwl_clan_cw_missed_decisions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;
ALTER TABLE public.cwl_plan_suggestions ALTER COLUMN id SET DEFAULT pg_catalog.gen_random_uuid();
ALTER TABLE public.cwl_change_events ADD PRIMARY KEY(id);
ALTER TABLE public.cwl_profile_snapshots ADD PRIMARY KEY(id);
ALTER TABLE public.cwl_missed_owner_decisions ADD PRIMARY KEY(id);
ALTER TABLE public.cwl_clan_cw_missed_decisions ADD PRIMARY KEY(id);
SELECT pg_catalog.setval(pg_catalog.pg_get_serial_sequence('public.cwl_change_events','id'),400,true);
SELECT pg_catalog.setval(pg_catalog.pg_get_serial_sequence('public.cwl_profile_snapshots','id'),400,true);
SELECT pg_catalog.setval(pg_catalog.pg_get_serial_sequence('public.cwl_missed_owner_decisions','id'),400,true);
SELECT pg_catalog.setval(pg_catalog.pg_get_serial_sequence('public.cwl_clan_cw_missed_decisions','id'),400,true);
ALTER TABLE public.cwl_plan_suggestions ADD PRIMARY KEY(id);
ALTER TABLE public.cwl_clan_management_rules ADD PRIMARY KEY(clan_id);
ALTER TABLE public.cwl_plan_review_state ADD PRIMARY KEY(clan_id);
ALTER TABLE public.cwl_own_lineup_archives ADD PRIMARY KEY(clan_id,season,day);
ALTER TABLE public.cwl_group_archives ADD PRIMARY KEY(clan_id,season);
ALTER TABLE public.cwl_cloud_profiles ADD PRIMARY KEY(clan_id);

-- Mimic production before/after profile triggers: revision++,
-- audited create/update, and a synthetic auto snapshot that must be removed.
CREATE OR REPLACE FUNCTION public.synthetic_profile_revision() RETURNS trigger
LANGUAGE plpgsql AS $r$
BEGIN NEW.revision:=OLD.revision+1;NEW.updated_at:=pg_catalog.now();RETURN NEW;END$r$;
CREATE TRIGGER synthetic_profile_revision BEFORE UPDATE ON public.cwl_cloud_profiles
 FOR EACH ROW EXECUTE FUNCTION public.synthetic_profile_revision();
CREATE OR REPLACE FUNCTION public.synthetic_auto_snapshot() RETURNS trigger
LANGUAGE plpgsql AS $snap$
BEGIN
 IF OLD.profile_json IS DISTINCT FROM NEW.profile_json THEN
  INSERT INTO public.cwl_profile_snapshots(clan_id,revision,profile_json,created_at)
   VALUES (OLD.clan_id,OLD.revision,OLD.profile_json,pg_catalog.now());
 END IF;
 RETURN NEW;
END$snap$;
CREATE TRIGGER synthetic_auto_snapshot BEFORE UPDATE OF profile_json
 ON public.cwl_cloud_profiles FOR EACH ROW EXECUTE FUNCTION public.synthetic_auto_snapshot();
CREATE OR REPLACE FUNCTION public.synthetic_profile_audit() RETURNS trigger
LANGUAGE plpgsql AS $audit$
BEGIN
 INSERT INTO public.cwl_change_events(
  clan_id,actor_id,revision,event_type,details,created_at)
 VALUES (NEW.clan_id,auth.uid(),NEW.revision,
  CASE WHEN TG_OP='INSERT' THEN 'profile_created' ELSE 'profile_updated' END,
  '{"synthetic_new_target_audit":true}'::jsonb,pg_catalog.now());
 RETURN NEW;
END$audit$;
CREATE TRIGGER synthetic_profile_audit AFTER UPDATE ON public.cwl_cloud_profiles
 FOR EACH ROW EXECUTE FUNCTION public.synthetic_profile_audit();

-- Seed a native new-target creation audit, which is allowed but can never
-- be confused with a signed historical source event.
INSERT INTO public.cwl_change_events(
 clan_id,actor_id,revision,event_type,details)
 VALUES ('88888888-8888-4888-8888-888888888888','33333333-3333-4333-8333-333333333333',1,
 'profile_created','{"synthetic_new_target_audit":true}'::jsonb);
