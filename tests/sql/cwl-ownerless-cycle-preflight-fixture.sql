-- Synthetic PostgreSQL 17 only. NEVER run against live Supabase.
-- This disposable setup intentionally mimics just the involved table shapes.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema if not exists private;
revoke all on schema private from public;
create table public.cwl_clans(
  id uuid primary key, clash_tag text
);
create table public.cwl_cloud_profiles(
  clan_id uuid primary key references public.cwl_clans(id),
  profile_json jsonb not null,
  revision bigint not null
);
create table public.cwl_plan_review_state(
  clan_id uuid primary key references public.cwl_clans(id),
  cycle_id uuid not null,
  season text not null
);
grant select on public.cwl_clans,public.cwl_cloud_profiles,
  public.cwl_plan_review_state to service_role;

create function public.test_cwl_profile(
  p_days int,p_locked int,p_season text
) returns jsonb language sql as $$
select jsonb_build_object(
  'config',jsonb_build_object('days',p_days,'slots',15),
  'archives','[]'::jsonb,
  'members','[]'::jsonb,
  'locks',(
    select jsonb_agg(case when i<=p_locked then
      jsonb_build_object('locked',true,'source','coc-api',
        'season',p_season,'warTag',
        (array['#2PYL','#2PYQ','#2PYR','#2PYG','#2PYC','#2PYV','#2PY0'])[i],
        'lineup','[]'::jsonb)
    else jsonb_build_object('locked',false,'lineup','[]'::jsonb) end order by i)
    from generate_series(1,7) i),
  'cwlLive',jsonb_build_object(
    'season',p_season,'clanTag','#2PYL','warCount',p_days,
    'rounds',(select jsonb_agg(jsonb_build_object('day',i,'warTag',
      (array['#2PYL','#2PYQ','#2PYR','#2PYG','#2PYC','#2PYV','#2PY0'])[i]) order by i)
      from generate_series(1,7) i))
);
$$;

insert into public.cwl_clans(id,clash_tag) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','#2PYL'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','#2PYL'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','#2PYQ');

insert into public.cwl_cloud_profiles(clan_id,profile_json,revision) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',public.test_cwl_profile(7,6,'2026-11'),20),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',public.test_cwl_profile(7,7,'2026-11'),15);
insert into public.cwl_plan_review_state(clan_id,cycle_id,season) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111','2026-11'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '22222222-2222-4222-8222-222222222222','2026-11');

-- The corresponding official group observation is seeded separately AFTER
-- the real stage-1 observation migration has installed its guards.
