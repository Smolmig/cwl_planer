-- Synthetic-only clean/dirty target profiles; real data never used.
-- Run AFTER base portable-cloud-export + plan-recovery fixture.
-- The source clan #P8Y2 has a played/locked day, a verified lineup and a
-- verified group archive. Target #P8Y2 copies must NEVER import those.
INSERT INTO public.cwl_clans(id,name,clash_tag,owner_user_id) VALUES
('88888888-8888-4888-8888-888888888888','Clean recovery target','#P8Y2','33333333-3333-4333-8333-333333333333'),
('99999999-9999-4999-8999-999999999999','Rollback recovery target','#P8Y2','33333333-3333-4333-8333-333333333333'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Protected recovery target','#P8Y2','33333333-3333-4333-8333-333333333333'),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Duplicate-tag recovery target','#P8Y2','33333333-3333-4333-8333-333333333333');
INSERT INTO public.cwl_clan_memberships(clan_id,user_id,role) VALUES
('88888888-8888-4888-8888-888888888888','33333333-3333-4333-8333-333333333333','owner'),
('99999999-9999-4999-8999-999999999999','33333333-3333-4333-8333-333333333333','owner'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','owner'),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','33333333-3333-4333-8333-333333333333','owner');

INSERT INTO public.cwl_cloud_profiles(clan_id,profile_json,data_version,revision)
SELECT id,
  pg_catalog.jsonb_build_object(
    'id','target-new-id-'||id::text,
    'name',name,
    'members','[]'::jsonb,
    'archivedMembers','[]'::jsonb,
    'locks',(
      SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'locked',id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid AND i=1,
        'warTag',CASE WHEN id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid AND i=1 THEN '#P8Y2' ELSE NULL END,
        'lineup','[]'::jsonb,'snapshots','{}'::jsonb))
      FROM pg_catalog.generate_series(1,7) AS i
    ),
    'archives','[]'::jsonb,
    'config','{}'::jsonb,
    'dayGoals','[]'::jsonb,
    'cwlLive','{"clanTag":"#P8Y2","rounds":[],"warCount":0}'::jsonb,
    'updatedAt',0)
  ,9,5
FROM public.cwl_clans
WHERE id IN (
 '88888888-8888-4888-8888-888888888888'::uuid,
 '99999999-9999-4999-8999-999999999999'::uuid,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid
);
INSERT INTO public.cwl_plan_review_state(clan_id,cycle_id,season,locked)
VALUES
('88888888-8888-4888-8888-888888888888','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-11',false),
('99999999-9999-4999-8999-999999999999','cccccccc-cccc-4ccc-8ccc-cccccccccccc','2026-11',false),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dddddddd-dddd-4ddd-8ddd-dddddddddddd','2026-11',false),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','ffffffff-ffff-4fff-8fff-ffffffffffff','2026-11',false);

-- Synthetic RLS UPDATE and the same profile revision increment contract
-- as real CWL cloud profiles. Actual PostgreSQL source already has this.
GRANT UPDATE(profile_json) ON public.cwl_cloud_profiles TO authenticated;
CREATE POLICY synthetic_owner_plan_apply_update
 ON public.cwl_cloud_profiles FOR UPDATE TO authenticated
 USING (EXISTS(
   SELECT 1 FROM public.cwl_clans c WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ))
 WITH CHECK (EXISTS(
   SELECT 1 FROM public.cwl_clans c WHERE c.id=clan_id AND c.owner_user_id=auth.uid()
 ));
CREATE FUNCTION public.synthetic_cwl_profile_revision_bump()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $bump$ BEGIN
 NEW.revision:=OLD.revision+1;
 RETURN NEW;
END $bump$;
CREATE TRIGGER synthetic_profile_revision_before_update
BEFORE UPDATE ON public.cwl_cloud_profiles
FOR EACH ROW EXECUTE FUNCTION public.synthetic_cwl_profile_revision_bump();

-- Fail AFTER the checkpoint INSERT but BEFORE changing the profile.
-- Trigger errors must undo the checkpoint and all other effects.
CREATE FUNCTION public.synthetic_force_profile_apply_failure()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fail$ BEGIN
 IF NEW.profile_json->'members'->0->>'id'='FAIL_AFTER_CHECKPOINT' THEN
   RAISE EXCEPTION 'synthetic profile UPDATE failed after before-state checkpoint'
     USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END $fail$;
CREATE TRIGGER synthetic_force_apply_failure
BEFORE UPDATE OF profile_json ON public.cwl_cloud_profiles
FOR EACH ROW EXECUTE FUNCTION public.synthetic_force_profile_apply_failure();
