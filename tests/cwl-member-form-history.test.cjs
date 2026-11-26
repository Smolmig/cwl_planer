"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const load=()=>import("../cwl-member-form-history.mjs");
const core=()=>import("../cwl-stats-core.mjs");
const player="#PYYY",other="#QPYL";
const war=(key,day,extra={})=>({war_key:key,war_type:"cwl",started_at:"2026-11-"+day+"T12:00:00Z",source:"api",finalized:true,missed_log_complete:true,team_size:15,opponent_tag:"#8PYL",...extra});
const hit=(key,tag,stars=3,th=19)=>({war_key:key,attacker_tag:tag,defender_tag:"#2PYL",attacker_th:th,defender_th:th,stars,destruction:stars===3?100:75,attack_order:1});
test("Linked CWL uses the second clan's same-RH attacks without duplicating war keys",async()=>{
 const {mergeMemberFormClans}=await load(),{computeMemberFormV2}=await core();
 const local={clanTag:"#2PYL",clanName:"Main",wars:[war("same","03")],attacks:[hit("same",other)],missedEvents:[]};
 const linked={clanTag:"#9PYL",clanName:"Second",wars:[war("same","03"),war("next","04"),war("next2","05"),war("next3","06"),war("next4","07")],
  attacks:[hit("same",player),hit("next",player,2),hit("next2",player,3,18)],missedEvents:[{war_key:"next3",player_tag:player,missed_count:1}]};
 const merged=mergeMemberFormClans(local,[linked]);
 assert.equal(merged.wars.length,6);assert.equal(new Set(merged.wars.map(w=>w.war_key)).size,6);
 const m=computeMemberFormV2(merged.wars,merged.attacks,{asOf:"2026-11-26T12:00:00Z",memberTags:[player,other],memberProfiles:[{playerTag:player,townHall:19}],missedEvents:merged.missedEvents}).players.find(p=>p.tag===player);
 assert.equal(m.cwl.attacks,2);assert.equal(m.cwl.currentMissedKnown,1);assert.equal(m.cwl.currentReliability,75);
 assert.deepEqual(m.cwl.sourceClans,["Second"]);assert.equal(m.cwl.warCount,2);
});
test("Duplicate clan profiles and ambiguous overlapping player-war evidence cannot inflate form",async()=>{
 const {mergeMemberFormClans}=await load();
 const local={clanTag:"#2PYL",wars:[war("same","03")],attacks:[hit("same",player)],missedEvents:[]};
 const duplicate={...local,clanName:"Copy"};
 const conflict={clanTag:"#9PYL",wars:[war("same","03"),war("import","05",{source:"import"})],attacks:[hit("same",player),hit("import",player)],missedEvents:[],conflicts:[{importKey:"import"}]};
 const r=mergeMemberFormClans(local,[duplicate,conflict]);
 assert.equal(r.attacks.length,1);assert.equal(r.wars.length,1);assert.equal(r.partial,true);assert.equal(r.excluded,2);
});
test("Cross-clan loader reads only RLS-visible distinct linked clans, including shared clans",async()=>{
 const {loadMemberFormClans}=await load();
 const clans=[{id:"A",clash_tag:"#2PYL",owner_user_id:"u",name:"Main"},
  {id:"B",clash_tag:"#9PYL",owner_user_id:"u",name:"Second"},
  {id:"C",clash_tag:"#8PYL",owner_user_id:"other",name:"Shared"},
  {id:"D",clash_tag:"#2PYL",owner_user_id:"u",name:"Duplicate"}];
 const calls=[];
 const sb={from(table){
  let clan;
  const q={select(){return q},order(){return q},eq(k,v){clan=v;return q},gte(){return q},in(){return q},
   limit:async()=>({data:clans}),range:async()=>{calls.push([table,clan]);return {data:table==="cwl_stat_wars"?[{...war("w","03"),clan_id:clan}]:table==="cwl_stat_attacks"?[{...hit("w",player),clan_id:clan}]:[]}}};
  return q;
 }};
 const r=await loadMemberFormClans(sb,{clanId:"A",clanTag:"#2PYL"},{asOf:Date.parse("2026-11-26")});
 assert.deepEqual(r.sources.map(s=>s.clanId),["B","C"]);assert.ok(calls.every(([,id])=>["B","C"].includes(id)));assert.equal(r.partial,true);
});
