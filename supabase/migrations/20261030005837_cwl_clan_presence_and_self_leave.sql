-- Already applied to connected Supabase. Do not re-apply manually to that project.
-- Approximate activity: a user may only mark their OWN presence in a clan of which they are a member.
create table public.cwl_clan_presence (
 clan_id uuid not null,
 user_id uuid not null,
 seen_at timestamptz not null default now(),
 primary key (clan_id, user_id),
 foreign key (clan_id,user_id) references public.cwl_clan_memberships (clan_id,user_id) on delete cascade
);
create index cwl_presence_recent on public.cwl_clan_presence(clan_id,seen_at desc);
alter table public.cwl_clan_presence enable row level security;
create policy cwl_presence_read on public.cwl_clan_presence for select to authenticated
 using (private.cwl_is_member(clan_id));
create policy cwl_presence_insert on public.cwl_clan_presence for insert to authenticated
 with check (user_id = (select auth.uid()) and private.cwl_is_member(clan_id));
create policy cwl_presence_update on public.cwl_clan_presence for update to authenticated
 using (user_id = (select auth.uid()) and private.cwl_is_member(clan_id))
 with check (user_id = (select auth.uid()) and private.cwl_is_member(clan_id));
create policy cwl_presence_delete on public.cwl_clan_presence for delete to authenticated
 using (user_id = (select auth.uid()) and private.cwl_is_member(clan_id));
revoke all on public.cwl_clan_presence from anon,authenticated;
grant select on public.cwl_clan_presence to authenticated;
grant insert (clan_id,user_id) on public.cwl_clan_presence to authenticated;
grant update (seen_at) on public.cwl_clan_presence to authenticated;
grant delete on public.cwl_clan_presence to authenticated;

-- Timestamps originate from the database, never from a participant's clock.
create function private.cwl_presence_stamp()
returns trigger language plpgsql set search_path = ''
as $$begin new.seen_at=now(); return new; end$$;
revoke all on function private.cwl_presence_stamp() from public;
create trigger cwl_presence_stamp before insert or update on public.cwl_clan_presence
 for each row execute function private.cwl_presence_stamp();

-- A Vize / Beobachter may leave on their own, without affecting the clan.
create policy cwl_members_self_leave on public.cwl_clan_memberships
 for delete to authenticated
 using (user_id = (select auth.uid()) and role <> 'owner');

-- Only the owner may permanently delete the whole cloud-clan. Cascades remove all
-- attached profile/audit/invite/membership data; client MUST ask for explicit confirmation.
create policy cwl_clans_owner_delete on public.cwl_clans
 for delete to authenticated
 using (owner_user_id = (select auth.uid()));
grant delete on public.cwl_clans to authenticated;
