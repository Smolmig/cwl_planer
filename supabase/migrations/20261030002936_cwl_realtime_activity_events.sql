-- Applied to connected Supabase. Share new, RLS-protected activity entries in realtime.
alter publication supabase_realtime add table public.cwl_change_events;
