-- Disposable test extension, applied after the synthetic export fixture.
-- No production database objects are touched by this file.
ALTER TABLE public.cwl_stat_wars ADD PRIMARY KEY (clan_id, war_key);
ALTER TABLE public.cwl_stat_attacks ADD PRIMARY KEY (clan_id, war_key, attacker_tag, attack_order);
ALTER TABLE public.cwl_stat_missed ADD PRIMARY KEY (clan_id, war_key, player_tag);
ALTER TABLE public.cwl_stat_attacks ADD FOREIGN KEY (clan_id,war_key)
 REFERENCES public.cwl_stat_wars(clan_id,war_key) ON DELETE CASCADE;
ALTER TABLE public.cwl_stat_missed ADD FOREIGN KEY (clan_id,war_key)
 REFERENCES public.cwl_stat_wars(clan_id,war_key) ON DELETE CASCADE;
GRANT INSERT ON public.cwl_stat_wars,public.cwl_stat_attacks,public.cwl_stat_missed TO authenticated;
GRANT UPDATE ON public.cwl_cloud_profiles TO authenticated;
CREATE POLICY synthetic_owner_stats_insert ON public.cwl_stat_wars
 FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.cwl_clans c
    WHERE c.id=clan_id AND c.owner_user_id=auth.uid()));
CREATE POLICY synthetic_owner_attacks_insert ON public.cwl_stat_attacks
 FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.cwl_clans c
    WHERE c.id=clan_id AND c.owner_user_id=auth.uid()));
CREATE POLICY synthetic_owner_missed_insert ON public.cwl_stat_missed
 FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.cwl_clans c
    WHERE c.id=clan_id AND c.owner_user_id=auth.uid()));
CREATE POLICY synthetic_owner_profile_lock ON public.cwl_cloud_profiles
 FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.cwl_clans c
    WHERE c.id=clan_id AND c.owner_user_id=auth.uid()))
 WITH CHECK (
  EXISTS (SELECT 1 FROM public.cwl_clans c
    WHERE c.id=clan_id AND c.owner_user_id=auth.uid()));
-- Fake existing API evidence with complete, verified misses. Restoring a new
-- missed player row into this war must be rejected even by an authenticated owner.

-- The real stat_wars schema uses NOT NULL DEFAULT '' for this display field.
-- The shared synthetic export fixture intentionally omitted column defaults.
UPDATE public.cwl_stat_wars SET opponent_name='' WHERE opponent_name IS NULL;
