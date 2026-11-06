-- Read-only per-tenant collector health. Browser users cannot spoof collection.
-- Writes are restricted to the trusted service role inside the scheduled Edge Function.
create table if not exists public.cwl_stat_collector_status (
  clan_id uuid primary key references public.cwl_clans(id) on delete cascade,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text check(last_error is null or length(last_error)<=80),
  observed_wars integer not null default 0 check(observed_wars>=0),
  observed_attacks integer not null default 0 check(observed_attacks>=0),
  observed_final_wars integer not null default 0 check(observed_final_wars>=0)
);
alter table public.cwl_stat_collector_status enable row level security;
revoke all on public.cwl_stat_collector_status from PUBLIC, anon, authenticated;
grant select on public.cwl_stat_collector_status to authenticated;
create policy collector_status_clan_read on public.cwl_stat_collector_status
 for select to authenticated
 using(private.cwl_is_member(clan_id));
-- No authenticated INSERT/UPDATE/DELETE policy or grants: service role only.
