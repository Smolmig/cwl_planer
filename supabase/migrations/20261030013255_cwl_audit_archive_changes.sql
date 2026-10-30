-- Already applied to Supabase; report archived CWL changes in the audit feed.
CREATE OR REPLACE FUNCTION private.cwl_audit_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_old_members jsonb := '[]'::jsonb;
  v_new_members jsonb := '[]'::jsonb;
  v_player jsonb;
  v_old jsonb;
  v_changes jsonb;
  v_events jsonb := '[]'::jsonb;
  v_field text;
  v_plan_changed boolean := false;
  v_config_changed boolean := false;
  v_archive_changed boolean := false;
  v_total int := 0;
begin
  if tg_op='UPDATE' then
    v_old_members := case when jsonb_typeof(old.profile_json->'members')='array' then old.profile_json->'members' else '[]'::jsonb end;
    v_plan_changed := old.profile_json->'locks' is distinct from new.profile_json->'locks';
    v_config_changed := old.profile_json->'config' is distinct from new.profile_json->'config';
    v_archive_changed := old.profile_json->'archives' is distinct from new.profile_json->'archives';
  end if;
  v_new_members := case when jsonb_typeof(new.profile_json->'members')='array' then new.profile_json->'members' else '[]'::jsonb end;
  for v_player in select value from jsonb_array_elements(v_new_members) loop
    select value into v_old from jsonb_array_elements(v_old_members) where value->>'id'=v_player->>'id' limit 1;
    if v_old is null then
      v_changes := jsonb_build_object('hinzugefuegt',true);
    else
      v_changes := '{}'::jsonb;
      foreach v_field in array array['name','participating','fixed','priority','townHall','threeStar','statuses','firstDay','outFromDay'] loop
        if v_old->v_field is distinct from v_player->v_field then
          v_changes := v_changes || jsonb_build_object(v_field,jsonb_build_array(v_old->v_field,v_player->v_field));
        end if;
      end loop;
    end if;
    if v_changes <> '{}'::jsonb then
      v_total := v_total + 1;
      if v_total<=25 then
        v_events := v_events || jsonb_build_array(jsonb_build_object('name',left(coalesce(v_player->>'name','Unbekannt'),60),'felder',v_changes));
      end if;
    end if;
  end loop;
  for v_player in select value from jsonb_array_elements(v_old_members) loop
    if not exists(select 1 from jsonb_array_elements(v_new_members) n where n->>'id'=v_player->>'id') then
      v_total:=v_total+1;
      if v_total<=25 then
        v_events:=v_events||jsonb_build_array(jsonb_build_object('name',left(coalesce(v_player->>'name','Unbekannt'),60),'felder',jsonb_build_object('entfernt',true)));
      end if;
    end if;
  end loop;
  insert into public.cwl_change_events(clan_id,actor_id,revision,event_type,details)
  values(new.clan_id,auth.uid(),new.revision,
    case when tg_op='INSERT' then 'profile_created' else 'profile_updated' end,
    jsonb_build_object(
      'mitglieder',jsonb_array_length(v_new_members),
      'spieleraenderungen',v_events,
      'weitere_spieler',greatest(v_total-25,0),
      'plan_geaendert',v_plan_changed,
      'config_geaendert',v_config_changed,
      'archiv_geaendert',v_archive_changed
    ));
  return new;
end;
$function$
