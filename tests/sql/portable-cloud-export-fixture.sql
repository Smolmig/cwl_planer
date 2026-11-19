-- Synthetic isolated PG17 fixture; NEVER applied to the hosted database.
CREATE SCHEMA auth;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE SET search_path=''
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated,anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
CREATE TABLE public.cwl_clans(
 id uuid PRIMARY KEY, name text NOT NULL,
 clash_tag text, owner_user_id uuid NOT NULL
);
CREATE TABLE public.cwl_clan_memberships(
 clan_id uuid NOT NULL,user_id uuid NOT NULL,role text NOT NULL,
 PRIMARY KEY(clan_id,user_id)
);
CREATE TABLE public.cwl_cloud_profiles (
 clan_id uuid,
 profile_json jsonb,
 data_version bigint,
 revision bigint,
 created_at timestamptz,
 updated_at timestamptz
);
CREATE TABLE public.cwl_profile_snapshots (
 id bigint,
 clan_id uuid,
 revision bigint,
 profile_json jsonb,
 created_at timestamptz
);
CREATE TABLE public.cwl_change_events (
 id bigint,
 clan_id uuid,
 actor_id uuid,
 revision bigint,
 event_type text,
 details jsonb,
 created_at timestamptz
);
CREATE TABLE public.cwl_stat_wars (
 clan_id uuid,
 war_key text,
 war_type text,
 started_at timestamptz,
 team_size bigint,
 opponent_tag text,
 opponent_name text,
 source text,
 roster_tags jsonb,
 finalized boolean,
 updated_at timestamptz,
 missed_log_complete boolean,
 source_clash_tag text
);
CREATE TABLE public.cwl_stat_attacks (
 clan_id uuid,
 war_key text,
 attacker_tag text,
 attack_order bigint,
 attacker_name text,
 attacker_th bigint,
 defender_tag text,
 defender_name text,
 defender_th bigint,
 stars bigint,
 destruction bigint,
 created_at timestamptz
);
CREATE TABLE public.cwl_stat_missed (
 clan_id uuid,
 war_key text,
 player_tag text,
 player_name text,
 missed_count bigint,
 created_at timestamptz
);
CREATE TABLE public.cwl_plan_review_state (
 clan_id uuid,
 cycle_id uuid,
 season text,
 locked boolean,
 locked_by uuid,
 locked_at timestamptz,
 updated_at timestamptz
);
CREATE TABLE public.cwl_plan_suggestions (
 id uuid,
 clan_id uuid,
 cycle_id uuid,
 author_id uuid,
 base_revision bigint,
 suggested_profile jsonb,
 status text,
 submitted_at timestamptz,
 decided_at timestamptz,
 decided_by uuid
);
CREATE TABLE public.cwl_group_archives (
 clan_id uuid,
 season text,
 clan_tag text,
 group_json jsonb,
 created_at timestamptz,
 updated_at timestamptz
);
CREATE TABLE public.cwl_own_lineup_archives (
 clan_id uuid,
 season text,
 day bigint,
 war_tag text,
 state text,
 team_size bigint,
 lineup_json jsonb,
 created_at timestamptz,
 updated_at timestamptz
);
CREATE TABLE public.cwl_missed_owner_decisions (
 id bigint,
 clan_id uuid,
 season text,
 war_key text,
 day bigint,
 target_day bigint,
 player_tag text,
 decision text,
 note text,
 actor_id uuid,
 created_at timestamptz
);
CREATE TABLE public.cwl_clan_member_tenure (
 clan_id uuid,
 source_clash_tag text,
 player_tag text,
 first_observed_at timestamptz,
 last_present_at timestamptz,
 last_observed_at timestamptz,
 state_changed_at timestamptz,
 is_present boolean,
 confirmed_seconds bigint,
 observed_visits bigint,
 last_clash_rank text,
 last_clash_rank_at timestamptz,
 rank_before_leave text,
 rank_before_leave_at timestamptz,
 last_donations bigint,
 last_donations_at timestamptz,
 last_donation_increase_at timestamptz,
 last_donation_increase_by bigint
);
CREATE TABLE public.cwl_clan_management_rules (
 clan_id uuid,
 performance_enabled boolean,
 performance_min_days bigint,
 performance_min_attacks bigint,
 performance_three_star_percent bigint,
 performance_lookback_days bigint,
 loyalty_min_days bigint,
 absence_reset_days bigint,
 revision bigint,
 updated_at timestamptz,
 loyalty_enabled boolean,
 loyalty_min_donations bigint,
 loyalty_min_active_days bigint,
 loyalty_lookback_days bigint
);
CREATE TABLE public.cwl_clan_donation_observations (
 clan_id uuid,
 source_clash_tag text,
 player_tag text,
 observed_at timestamptz,
 positive_delta bigint
);
CREATE TABLE public.cwl_clan_absence_observations (
 clan_id uuid,
 source_clash_tag text,
 player_tag text,
 prior_visit_number bigint,
 leave_observed_at timestamptz,
 last_absent_observed_at timestamptz,
 return_observed_at timestamptz,
 observed_absent_snapshots bigint,
 current_streak_seconds bigint,
 max_streak_seconds bigint
);
CREATE TABLE public.cwl_clan_review_decisions (
 clan_id uuid,
 source_clash_tag text,
 player_tag text,
 review_kind text,
 disposition text,
 evidence_fingerprint text,
 revision bigint,
 updated_at timestamptz
);
CREATE TABLE public.cwl_clan_cw_missed_decisions (
 id bigint,
 clan_id uuid,
 source_clash_tag text,
 war_key text,
 player_tag text,
 decision text,
 note text,
 actor_id uuid,
 created_at timestamptz
);
ALTER TABLE public.cwl_clans ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_owner_clans ON public.cwl_clans FOR SELECT TO authenticated
 USING(owner_user_id=auth.uid());
ALTER TABLE public.cwl_clan_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_self_memberships ON public.cwl_clan_memberships FOR SELECT TO authenticated
 USING(user_id=auth.uid());
GRANT SELECT ON public.cwl_clans,public.cwl_clan_memberships TO authenticated;
ALTER TABLE public.cwl_cloud_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_read_cwl_cloud_profiles ON public.cwl_cloud_profiles FOR SELECT TO authenticated
 USING(EXISTS(
  SELECT 1 FROM public.cwl_clans c
  WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ));
GRANT SELECT ON public.cwl_cloud_profiles TO authenticated;
ALTER TABLE public.cwl_profile_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_read_cwl_profile_snapshots ON public.cwl_profile_snapshots FOR SELECT TO authenticated
 USING(EXISTS(
  SELECT 1 FROM public.cwl_clans c
  WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ));
GRANT SELECT ON public.cwl_profile_snapshots TO authenticated;
ALTER TABLE public.cwl_change_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_read_cwl_change_events ON public.cwl_change_events FOR SELECT TO authenticated
 USING(EXISTS(
  SELECT 1 FROM public.cwl_clans c
  WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ));
GRANT SELECT ON public.cwl_change_events TO authenticated;
ALTER TABLE public.cwl_stat_wars ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_read_cwl_stat_wars ON public.cwl_stat_wars FOR SELECT TO authenticated
 USING(EXISTS(
  SELECT 1 FROM public.cwl_clans c
  WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ));
GRANT SELECT ON public.cwl_stat_wars TO authenticated;
ALTER TABLE public.cwl_stat_attacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_read_cwl_stat_attacks ON public.cwl_stat_attacks FOR SELECT TO authenticated
 USING(EXISTS(
  SELECT 1 FROM public.cwl_clans c
  WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ));
GRANT SELECT ON public.cwl_stat_attacks TO authenticated;
ALTER TABLE public.cwl_stat_missed ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_read_cwl_stat_missed ON public.cwl_stat_missed FOR SELECT TO authenticated
 USING(EXISTS(
  SELECT 1 FROM public.cwl_clans c
  WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ));
GRANT SELECT ON public.cwl_stat_missed TO authenticated;
ALTER TABLE public.cwl_plan_review_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_read_cwl_plan_review_state ON public.cwl_plan_review_state FOR SELECT TO authenticated
 USING(EXISTS(
  SELECT 1 FROM public.cwl_clans c
  WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ));
GRANT SELECT ON public.cwl_plan_review_state TO authenticated;
ALTER TABLE public.cwl_plan_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_read_cwl_plan_suggestions ON public.cwl_plan_suggestions FOR SELECT TO authenticated
 USING(EXISTS(
  SELECT 1 FROM public.cwl_clans c
  WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ));
GRANT SELECT ON public.cwl_plan_suggestions TO authenticated;
ALTER TABLE public.cwl_group_archives ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_read_cwl_group_archives ON public.cwl_group_archives FOR SELECT TO authenticated
 USING(EXISTS(
  SELECT 1 FROM public.cwl_clans c
  WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ));
GRANT SELECT ON public.cwl_group_archives TO authenticated;
ALTER TABLE public.cwl_own_lineup_archives ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_read_cwl_own_lineup_archives ON public.cwl_own_lineup_archives FOR SELECT TO authenticated
 USING(EXISTS(
  SELECT 1 FROM public.cwl_clans c
  WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ));
GRANT SELECT ON public.cwl_own_lineup_archives TO authenticated;
ALTER TABLE public.cwl_missed_owner_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_read_cwl_missed_owner_decisions ON public.cwl_missed_owner_decisions FOR SELECT TO authenticated
 USING(EXISTS(
  SELECT 1 FROM public.cwl_clans c
  WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ));
GRANT SELECT ON public.cwl_missed_owner_decisions TO authenticated;
ALTER TABLE public.cwl_clan_member_tenure ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_read_cwl_clan_member_tenure ON public.cwl_clan_member_tenure FOR SELECT TO authenticated
 USING(EXISTS(
  SELECT 1 FROM public.cwl_clans c
  WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ));
GRANT SELECT ON public.cwl_clan_member_tenure TO authenticated;
ALTER TABLE public.cwl_clan_management_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_read_cwl_clan_management_rules ON public.cwl_clan_management_rules FOR SELECT TO authenticated
 USING(EXISTS(
  SELECT 1 FROM public.cwl_clans c
  WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ));
GRANT SELECT ON public.cwl_clan_management_rules TO authenticated;
ALTER TABLE public.cwl_clan_donation_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_read_cwl_clan_donation_observations ON public.cwl_clan_donation_observations FOR SELECT TO authenticated
 USING(EXISTS(
  SELECT 1 FROM public.cwl_clans c
  WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ));
GRANT SELECT ON public.cwl_clan_donation_observations TO authenticated;
ALTER TABLE public.cwl_clan_absence_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_read_cwl_clan_absence_observations ON public.cwl_clan_absence_observations FOR SELECT TO authenticated
 USING(EXISTS(
  SELECT 1 FROM public.cwl_clans c
  WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ));
GRANT SELECT ON public.cwl_clan_absence_observations TO authenticated;
ALTER TABLE public.cwl_clan_review_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_read_cwl_clan_review_decisions ON public.cwl_clan_review_decisions FOR SELECT TO authenticated
 USING(EXISTS(
  SELECT 1 FROM public.cwl_clans c
  WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ));
GRANT SELECT ON public.cwl_clan_review_decisions TO authenticated;
ALTER TABLE public.cwl_clan_cw_missed_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_read_cwl_clan_cw_missed_decisions ON public.cwl_clan_cw_missed_decisions FOR SELECT TO authenticated
 USING(EXISTS(
  SELECT 1 FROM public.cwl_clans c
  WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ));
GRANT SELECT ON public.cwl_clan_cw_missed_decisions TO authenticated;

-- Fake owner, fake foreign clan: these identifiers are not real user data.
INSERT INTO public.cwl_clans VALUES
 ('11111111-1111-4111-8111-111111111111','United Fighters','#P8Y2','33333333-3333-4333-8333-333333333333'),
 ('22222222-2222-4222-8222-222222222222','Foreign Club','#QL8P','44444444-4444-4444-8444-444444444444');
INSERT INTO public.cwl_clan_memberships VALUES
 ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','owner'),
 ('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','owner');
INSERT INTO public.cwl_cloud_profiles(clan_id,profile_json,data_version,revision) VALUES
 ('11111111-1111-4111-8111-111111111111','{"name":"United Fighters","members":[{"id":"a","playerTag":"#P8Y2"}],"locks":[{"locked":false,"lineup":[]}],"archives":[]}'::jsonb,9,4),
 ('22222222-2222-4222-8222-222222222222','{"name":"Foreign","members":[],"locks":[],"archives":[]}'::jsonb,9,1);
INSERT INTO public.cwl_stat_wars(clan_id,war_key,war_type,started_at,team_size,source,finalized,missed_log_complete,source_clash_tag) VALUES
 ('11111111-1111-4111-8111-111111111111','normal:war1','normal','2026-11-17T12:00:00Z',15,'api',true,true,'#P8Y2'),
 ('11111111-1111-4111-8111-111111111111','cwl:war2','cwl','2026-11-03T12:00:00Z',15,'import',true,false,'#P8Y2'),
 ('22222222-2222-4222-8222-222222222222','normal:foreign','normal','2026-11-17T12:00:00Z',15,'api',true,true,'#QL8P');
INSERT INTO public.cwl_stat_attacks(clan_id,war_key,attacker_tag,attack_order,stars,destruction) VALUES
 ('11111111-1111-4111-8111-111111111111','normal:war1','#P8Y2',1,3,100),
 ('11111111-1111-4111-8111-111111111111','normal:war1','#P8Y2',2,2,90),
 ('22222222-2222-4222-8222-222222222222','normal:foreign','#QL8P',1,3,100);
INSERT INTO public.cwl_stat_missed(clan_id,war_key,player_tag,missed_count) VALUES
 ('11111111-1111-4111-8111-111111111111','normal:war1','#P8Y2',1);
INSERT INTO public.cwl_group_archives(clan_id,season,clan_tag,group_json) VALUES
 ('11111111-1111-4111-8111-111111111111','2026-11','#P8Y2','{"season":"2026-11","clans":[],"rounds":[]}'::jsonb);
INSERT INTO public.cwl_clan_cw_missed_decisions(id,clan_id,source_clash_tag,war_key,player_tag,decision,note) VALUES
 (1,'11111111-1111-4111-8111-111111111111','#P8Y2','normal:war1','#P8Y2','acknowledged','private owner decision');
INSERT INTO public.cwl_clan_management_rules(clan_id,performance_enabled,revision) VALUES
 ('11111111-1111-4111-8111-111111111111',true,2);
