-- Synthetic owner + outsider, exact five-war group, no real draw.
-- Execute together with the release SQL in BEGIN/ROLLBACK only.
insert into auth.users(id,email) values
 ('f1380000-0000-4000-8000-000000000001','goldpass-owner@example.invalid'),
 ('f1380000-0000-4000-8000-000000000003','goldpass-outsider@example.invalid');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"f1380000-0000-4000-8000-000000000001"}',true);
insert into public.cwl_clans(id,name,clash_tag,owner_user_id)
values('f1380000-0000-4000-8000-000000000002','Goldpass rollback fixture','#2PYL','f1380000-0000-4000-8000-000000000001');
insert into public.cwl_group_archives(clan_id,season,clan_tag,group_json)
select 'f1380000-0000-4000-8000-000000000002','2026-11','#2PYL',
 jsonb_build_object('season','2026-11','clanTag','#2PYL',
 'clans',(select jsonb_agg(jsonb_build_object('tag',tag)) from unnest(array['#2PYL','#8PYL','#Q9QL','#R9QL','#P9QL','#Y9QL']) tag),
 'rounds',jsonb_agg(jsonb_build_object('day',d,'matches',jsonb_build_array(jsonb_build_object(
 'available',true,'state','warEnded','warTag','#2PY'||substr('0289P',d,1),'teamSize',2,
 'clan',jsonb_build_object('tag','#2PYL','attacks',2),'opponent',jsonb_build_object('tag','#8PYL')))) order by d))
 from generate_series(1,5) d;
insert into public.cwl_own_lineup_archives(clan_id,season,day,war_tag,state,team_size,lineup_json)
select 'f1380000-0000-4000-8000-000000000002','2026-11',d,'#2PY'||substr('0289P',d,1),'warEnded',2,
 '{"members":[{"tag":"#G9QL","name":"A","attacks":[{"stars":3,"destructionPercentage":100}]},{"tag":"#J9QL","name":"B","attacks":[{"stars":0,"destructionPercentage":10}]}]}'::jsonb
 from generate_series(1,5) d;
do $$begin
 if has_function_privilege('anon','public.cwl_goldpass_manage(uuid,text,text,bigint,jsonb,jsonb,boolean,text)','EXECUTE') or
 has_table_privilege('authenticated','public.cwl_goldpass_raffles','INSERT,UPDATE,DELETE') or
 has_function_privilege('authenticated','private.cwl_goldpass_evidence(uuid,text,text)','EXECUTE')
 then raise exception 'goldpass grants unsafe';end if;
end$$;
set local role authenticated;
do $$
declare cid uuid:='f1380000-0000-4000-8000-000000000002';
 r jsonb; s jsonb; result jsonb; revision bigint; witness text;
 rule jsonb:='{"minimumType":"none","minimum":0,"base":1,"one":0,"two":0,"three":2,"perStar":0,"requireDiscord":false}';
begin
 r:=public.cwl_goldpass_manage(cid,'2026-11','read');
 if r->>'revision'<>'0' or r->'evidence'->>'complete'<>'true' or r->'preview'->>'total'<>'12'
  then raise exception 'bad default evidence %',r;end if;
 if exists(select 1 from public.cwl_goldpass_raffles where clan_id=cid) then raise exception 'read created draft';end if;
 s:=public.cwl_goldpass_manage(cid,'2026-11','save',0,rule,'{"#J9QL":{"organizer":true}}',true);
 if s->>'revision'<>'1' or s->'preview'->>'total'<>'11' then raise exception 'bad save %',s;end if;
 begin
  perform public.cwl_goldpass_manage(cid,'2026-11','save',0,rule,'{}',true);
  raise exception 'stale save accepted';
 exception when serialization_failure then null;end;
 begin
  perform public.cwl_goldpass_manage(cid,'2026-11','draw',1,p_expected_witness=>'wrong');
  raise exception 'bad witness accepted';
 exception when serialization_failure then null;end;
 begin
  update public.cwl_goldpass_raffles set rules='{}' where clan_id=cid;
  raise exception 'direct update allowed';
 exception when insufficient_privilege then null;end;
 -- Draft rules may exist before the first war; no draw from missing evidence.
 r:=public.cwl_goldpass_manage(cid,'2026-12','save',0,rule,'{}',true);
 if r->'evidence'->>'complete'<>'false' then raise exception 'missing group declared complete';end if;
 begin
  perform public.cwl_goldpass_manage(cid,'2026-12','draw',1,p_expected_witness=>r->>'witness');
  raise exception 'incomplete draw accepted';
 exception when invalid_parameter_value then null;end;
 result:=public.cwl_goldpass_manage(cid,'2026-11','draw',1,p_expected_witness=>s->>'witness');
 if result->'official'->>'winnerTag'<>'#G9QL' or result->>'revision'<>'2' then raise exception 'unexpected draw';end if;
 r:=public.cwl_goldpass_manage(cid,'2026-11','draw',1,p_expected_witness=>s->>'witness');
 if r->'official' is distinct from result->'official' then raise exception 'redraw changed result';end if;
 begin
  perform public.cwl_goldpass_manage(cid,'2026-11','save',2,rule,'{}',true);
  raise exception 'official edit accepted';
 exception when invalid_parameter_value then null;end;
end$$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"f1380000-0000-4000-8000-000000000003"}',true);
do $$begin
 if exists(select 1 from public.cwl_goldpass_raffles where clan_id='f1380000-0000-4000-8000-000000000002') then raise exception 'outsider read';end if;
 begin
  perform public.cwl_goldpass_manage('f1380000-0000-4000-8000-000000000002','2026-11','read');
  raise exception 'outsider rpc accepted';
 exception when insufficient_privilege then null;end;
end$$;
reset role;
-- A later official archive correction does not change an already drawn result.
update public.cwl_group_archives set group_json=jsonb_set(group_json,'{rounds,0,matches,0,clan,attacks}','1')
 where clan_id='f1380000-0000-4000-8000-000000000002' and season='2026-11';
do $$begin
 if private.cwl_goldpass_evidence('f1380000-0000-4000-8000-000000000002','2026-11','#2PYL')->>'complete'<>'false'
 then raise exception 'group and lineup mismatch accepted';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"f1380000-0000-4000-8000-000000000001"}',true);
do $$declare r jsonb;begin
 r:=public.cwl_goldpass_manage('f1380000-0000-4000-8000-000000000002','2026-11','read');
 if r->'official'->>'winnerTag'<>'#G9QL' or r->'official'->'evidence'->>'complete'<>'true'
 then raise exception 'stored result changed with new evidence';end if;
end$$;
reset role;
select 'goldpass fixture passed' result;
