"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {planCwl}=require("../cwl-planning-core.js");
const root=path.resolve(__dirname,"..");
const loadCore=()=>import(pathToFileURL(path.join(root,"cwl-verified-pause.mjs")).href);
const loadMedal=()=>import(pathToFileURL(path.join(root,"cwl-medal-goals.mjs")).href);
const sql=fs.readFileSync(path.join(root,"supabase/migrations/20261109192000_cwl_apply_verified_missed_pause.sql"),"utf8");
const lockOrderSql=fs.readFileSync(path.join(root,
 "supabase/migrations/20261109192100_cwl_apply_verified_missed_pause_lock_order.sql"),"utf8");
const clock=ms=>new Date(ms).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,".000Z");
const now=Date.UTC(2026,10,9,20,0);
const member=(id,tag,fixed=false,weight="balanced")=>({
 id,name:id,playerTag:tag,participating:true,fixed,statuses:Array(7).fill("auto"),
 targetDays:null,rotationWeight:weight
});
const round=(day,state,warTag,players,begin)=>({
 day,available:true,state,warTag,
 startTime:clock(begin),endTime:clock(begin+24*3600000),teamSize:2,
 clan:{tag:"#2PQ",members:players.map(p=>({
  tag:p,name:p,townHallLevel:18,attacks:p==="#2PYL"?
   [{attackerTag:p,defenderTag:"#Q2V",stars:3,destructionPercentage:100}]:
   p==="#CPR"&&day===2?
   [{attackerTag:p,defenderTag:"#Q2V",stars:3,destructionPercentage:100}]:[]
 }))},
 opponent:{tag:"#JQV",members:[
  {tag:"#Q2V",townHallLevel:18,attacks:[]},
  {tag:"#8PY",townHallLevel:18,attacks:[]}
 ]}
});
function fixture(){
 const a=member("a","#2PYL",true);
 const b=member("b","#JRC",false,"preferred");
 const c=member("c","#CPR",false,"less");
 const profile={
  config:{days:3,slots:2},
  members:[a,b,c],archivedMembers:[],
  locks:[{locked:true,lineup:["a","b"]},{locked:false,lineup:[]},{locked:false,lineup:[]}],
  cwlLive:{season:"2026-11",clanTag:"#2PQ"}
 };
 const snapshot={season:"2026-11",clanTag:"#2PQ",rounds:[
  round(1,"warEnded","#PLQ",["#2PYL","#JRC"],now-48*3600000),
  round(2,"inWar","#PPQ",["#2PYL","#CPR"],now-4*3600000),
  round(3,"preparation","#PYL",["#2PYL","#JRC"],now+4*3600000)
 ]};
 // Ensure the current inWar roster is fixed in the live planner.
 const locks=[profile.locks[0],{locked:true,lineup:["a","c"]},profile.locks[2]];
 const before=planCwl({...profile.config,members:profile.members,
  archivedMembers:[],locks});
 const review={
  day:1,warTag:"#PLQ",tag:"#JRC",name:"b",memberId:"b",
  plannedDays:[3],reviewable:[{day:3,stage:"Vorbereitung"}],protectedDays:[]
 };
 return {profile,snapshot,review,dayPlans:before.dayPlans};
}
test("Server transaction is role + collector proof + revision gated; only one nested status path is writable",()=>{
 assert.ok(sql.length<11000,"unexpected duplicated SQL migration");
 for(const source of [sql,lockOrderSql]){
  const reviewLock=source.indexOf("perform 1 from public.cwl_plan_review_state");
  const profileLock=source.indexOf("select * into v_profile from public.cwl_cloud_profiles");
  assert.ok(reviewLock>0&&profileLock>reviewLock,
   "owner pause must lock review state before profile, avoiding approval deadlocks");
 }
 assert.equal((sql.match(/\$fn\$/g)||[]).length,2,"exactly one RPC body");
 assert.match(sql,/or p_war_key is null or p_war_key !~ '\^cwl:/);
 assert.match(sql,/or p_player_tag is null or p_player_tag !~ '\^#/);
 assert.match(sql,/security definer set search_path=''/);
 assert.match(sql,/private\.cwl_is_owner\(p_clan\)/);
 assert.match(sql,/cwl_stat_wars w/);
 assert.match(sql,/cwl_stat_missed m/);
 assert.match(sql,/w\.missed_log_complete is true/);
 assert.match(sql,/w\.finalized is true/);
 assert.match(sql,/v_latest is distinct from 'review_pause'/);
 assert.match(sql,/v_profile\.revision<>p_expected_revision/);
 assert.match(sql,/v_future->>'state' is distinct from 'preparation'/);
 assert.match(sql,/interval '30 minutes'/);
 assert.match(sql,/v_player->>'fixed' is distinct from 'false'/);
 assert.match(sql,/v_player->'statuses'->>\(p_target_day-1\) is distinct from 'auto'/);
 assert.match(sql,/jsonb_set\(v_profile\.profile_json/);
 assert.match(sql,/v_next=jsonb_set\([\s\S]*?'statuses',\(p_target_day-1\)::text/);
 assert.match(sql,/insert into public\.cwl_missed_owner_decisions\(/);
 assert.match(sql,/decision<>'applied_pause'/);
 assert.match(sql,/revoke all on function public\.cwl_apply_verified_missed_pause/);
 assert.match(sql,/grant execute on function public\.cwl_apply_verified_missed_pause/);
 assert.doesNotMatch(sql,/p_profile jsonb|p_draft jsonb/);
});
test("Verified CWL pause preflight returns only a future preparation-day AUTO-to-RAUS draft",async()=>{
 const {previewVerifiedCwlPause}=await loadCore();
 const {evaluateEightStarGoals}=await loadMedal();
 const f=fixture();
 const before=JSON.stringify(f);
 const r=previewVerifiedCwlPause({...f,targetDay:3,planningFn:planCwl,
  medalFn:evaluateEightStarGoals,now});
 assert.equal(r.ok,true,r.reason);
 assert.equal(r.day,3);
 assert.equal(r.draft.members.find(x=>x.id==="b").statuses[2],"out");
 assert.equal(f.profile.members.find(x=>x.id==="b").statuses[2],"auto");
 assert.deepEqual(r.changed.map(x=>x.day),[3]);
 assert.deepEqual(r.changed[0].out,["b"]);
 assert.equal(r.changed[0].incoming.length,1);
 assert.deepEqual(r.impact.countsChanged,[
  {id:"b",name:"b",before:2,after:1},
  {id:"c",name:"c",before:1,after:2}
 ]);
 assert.deepEqual(r.impact.rotationSpread,{before:1,after:1});
 assert.equal(r.impact.rotationPlayers,2);
 assert.equal(JSON.stringify(f),before,"preview must be completely immutable");
 assert.deepEqual(r.draft.locks,f.profile.locks,"no new played-day locks");
});
test("Pause preflight fails closed on hard goals, started/stale rounds and insufficient preparation time",async()=>{
 const {previewVerifiedCwlPause}=await loadCore();
 const {evaluateEightStarGoals}=await loadMedal();
 const inspect=(f,extra={})=>previewVerifiedCwlPause({...f,targetDay:3,planningFn:planCwl,
  medalFn:evaluateEightStarGoals,now,...extra});
 for(const mutate of [
  f=>{f.profile.members[1].fixed=true},
  f=>{f.profile.members[1].targetDays=2},
  f=>{f.profile.members[1].statuses[2]="must"},
  f=>{f.profile.locks[2].locked=true},
  f=>{f.snapshot.rounds[2].state="inWar"},
  f=>{f.snapshot.rounds[2].startTime=clock(now+20*60000)},
  f=>{f.snapshot.rounds[1].clan.members=[]},
  f=>{f.profile.members[1].playerTag="#2PYL"}
 ]){
  const f=fixture();mutate(f);
  const r=inspect(f);
  assert.equal(r.ok,false,JSON.stringify(r));
 }
 assert.equal(inspect(fixture(),{staleDays:[3]}).ok,false);
 assert.equal(inspect(fixture(),{staleDays:[1]}).ok,false);
 assert.equal(inspect(fixture(),{targetDay:2}).ok,false);
 assert.equal(inspect(fixture(),{planningFn:null}).ok,false);
 const f=fixture();f.review.reviewable=[];
 assert.equal(inspect(f).ok,false);
});
test("Pause preflight blocks newly unreachable 8★ bonus and newly invalid solver targets",async()=>{
 const {previewVerifiedCwlPause}=await loadCore();
 const f=fixture();let medalCall=0;
 const medalFn=()=>{
  medalCall++;
  return {rows:[{playerTag:"#JRC",name:"b",stars:0,
   potentialMax:medalCall===1?8:5,unknown:false}]};
 };
 const x=previewVerifiedCwlPause({...f,targetDay:3,planningFn:planCwl,
  medalFn,now});
 assert.equal(x.ok,false);
 assert.match(x.reason,/8★/);
 // No alternative free slot after forcing the replacement out of T3.
 const other=fixture();
 other.profile.members[2].statuses[2]="out";
 const y=previewVerifiedCwlPause({...other,targetDay:3,planningFn:planCwl,
  medalFn:()=>({rows:[]}),now});
 assert.equal(y.ok,false);
});

test("Pause impact fails closed on incomplete solver attendance counts",async()=>{
 const {previewVerifiedCwlPause}=await loadCore();
 const {evaluateEightStarGoals}=await loadMedal();
 const f=fixture();
 const broken=(params)=>{
  const plan=planCwl(params);
  if(params.members.find(x=>x.id==="b")?.statuses[2]==="out")
   delete plan.counts.c;
  return plan;
 };
 const result=previewVerifiedCwlPause({...f,targetDay:3,planningFn:broken,
  medalFn:evaluateEightStarGoals,now});
 assert.equal(result.ok,false);
 assert.match(result.reason,/Einsatzverteilung/);
 assert.equal(f.profile.members[1].statuses[2],"auto");
});
