-- Read-only production integration test. Execute ONLY after the migration has
-- been installed; this creates no tables and does not touch user data.
-- PASS = 0 rows. Any returned row is a failing fixture.
with cases(name, clan_count, round_count, own_final_day, final_state,
           linked_tag, duplicate_tag, final_perspective, expected) as (
 values
 ('five war own finished',6,5,5,'warEnded','#2PYL',false,'clan',true),
 ('seven war own finished',8,7,7,'warEnded','#2PYL',false,'clan',true),
 ('seven with only round five',8,7,5,'warEnded','#2PYL',false,'clan',false),
 ('five war in progress',6,5,5,'inWar','#2PYL',false,'clan',false),
 ('six clan phantom seven',6,7,5,'warEnded','#2PYL',false,'clan',false),
 ('eight clan incomplete five',8,5,5,'warEnded','#2PYL',false,'clan',false),
 ('duplicate group tags',6,5,5,'warEnded','#2PYL',true,'clan',false),
 ('wrong linked clan',6,5,5,'warEnded','#2PYQ',false,'clan',false),
 ('own member missing',6,5,5,'warEnded','#2PYL',false,'other',false),
 ('no finale match',6,5,0,'warEnded','#2PYL',false,'clan',false),
 ('enemy perspective completed',6,5,5,'warEnded','#2PYL',false,'opponent',true)
), source as (
 select name,expected,linked_tag,
 jsonb_build_object(
  'clanTag','#2PYL',
  'clans',(select jsonb_agg(jsonb_build_object('tag',
    (array['#2PYL','#2PYQ','#2PYR','#2PYG','#2PYC','#2PYV','#2PY0','#2PY9'])[
      case when duplicate_tag and i=2 then 1 else i end
    ]) order by i) from generate_series(1,clan_count) i),
  'rounds',(select jsonb_agg(jsonb_build_object('day',day,
   'matches',case when day=own_final_day then
     jsonb_build_array(jsonb_build_object('available',true,'state',final_state,
       'clan',jsonb_build_object('tag',case when final_perspective='opponent'
         then '#2PYR' when final_perspective='other' then '#2PYR' else '#2PYL' end),
       'opponent',jsonb_build_object('tag',case when final_perspective='opponent'
         then '#2PYL' else '#2PYG' end)))
     else '[]'::jsonb end
   ) order by day) from generate_series(1,round_count) day)
 ) as payload
 from cases
), evaluated as (
 select name,expected,
   private.cwl_review_group_final_ended(payload,linked_tag) as actual
 from source
 union all
 select 'not a json array',false,
   private.cwl_review_group_final_ended('{"clans":{},"rounds":null}'::jsonb,'#2PYL')
)
select name,expected,actual from evaluated
where actual is distinct from expected
order by name;
