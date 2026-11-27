"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const projection=import("../supabase/functions/coc-cwl-status/strategic-projection.mjs"),holdout=import("../cwl-strategic-holdout.mjs");
const abc="0289PYLQGRJCUV",tag=i=>"#P"+abc[Math.floor(i/13)%13]+abc[i%13],now=Date.UTC(2026,10,26),day=86400000,season="2026-11";
const clanId="11111111-1111-1111-1111-111111111111";
const roster=i=>Array.from({length:15},(_,j)=>({tag:tag(10+i*15+j),townhallLevel:19,mapPosition:j+1,name:"private name"}));
const clans=Array.from({length:6},(_,i)=>({tag:tag(i),members:roster(i)}));
function war(a,b,state="warEnded"){
 const clan={tag:tag(a),stars:3,destructionPercentage:100/15,attacks:1,members:roster(a)},opponent={tag:tag(b),stars:0,destructionPercentage:0,attacks:0,members:roster(b)};
 clan.members[0].attacks=[{attackerTag:clan.members[0].tag,defenderTag:opponent.members[0].tag,stars:3,destructionPercentage:100,order:1}];
 return {state,teamSize:15,attacksPerMember:1,startTime:"20261126T010000.000Z",clan,opponent};
}
function data(){
 const keys=[tag(110),tag(111),tag(112)];
 return {group:{state:"inWar",season:season+"-01",clans,rounds:[{warTags:keys.slice(0,2)},{warTags:[keys[2]]}]},
 results:new Map([[keys[0],war(1,2)],[keys[1],war(3,4)],[keys[2],war(0,1,"preparation")]]),clanTag:tag(0),season,observedAt:now};
}
test("strategic route disabled by default; owner/editor and exact allowlist required",async()=>{
 const {strategicAccess}=await projection;
 assert.equal(strategicAccess({role:"owner",clanId,allowlist:clanId}),false);
 assert.equal(strategicAccess({role:"viewer",clanId,enabled:"true",allowlist:clanId}),false);
 assert.equal(strategicAccess({role:"owner",clanId,enabled:"true",allowlist:"*"}),false);
 assert.equal(strategicAccess({role:"editor",clanId,enabled:"true",allowlist:clanId}),true);
});
test("projection only relevant aggregate opponents, own roster and compact scores",async()=>{
 const {projectStrategicGroup}=await projection,s=data(),frozen=JSON.stringify([...s.results]);
 const x=projectStrategicGroup(s);assert.equal(x.status,"preview_data");assert.equal(x.registered.tags.length,15);
 assert.equal(x.group.upcoming.length,1);assert.ok(x.group.profiles.length>0);
 assert.ok(x.group.profiles.every(p=>p.clanTag===tag(1)||p.clanTag===tag(0)));
 assert.ok(!JSON.stringify(x).includes("private name"));assert.equal(x.group.wars.length,0);
 assert.ok(x.scoreSnapshot.rounds.flatMap(r=>r.matches).every(w=>!w.available||!w.clan.members&&!w.opponent.members));
 assert.equal(x.standings.demotion,"unknown_rules");assert.equal(JSON.stringify([...s.results]),frozen);
});
test("scope, unverified registration and special format fail closed",async()=>{
 const {projectStrategicGroup}=await projection,s=data();
 assert.throws(()=>projectStrategicGroup({...s,clanTag:tag(9)}),/invalid_projection_group/);
 const incomplete={...s,group:{...s.group,clans:s.group.clans.map((c,i)=>i===0?{...c,members:[]}:c)}};
 assert.equal(projectStrategicGroup(incomplete).registered,null);
 s.results.get(tag(110)).attacksPerMember=2;assert.equal(projectStrategicGroup(s).status,"unsupported_or_unknown_format");
});
test("unverified counters do not imply complete own medal evidence",async()=>{
 const {projectStrategicGroup}=await projection,s=data(),w=s.results.get(tag(112));w.state="inWar";w.clan.attacks=2;
 const x=projectStrategicGroup(s);assert.equal(x.quality.unverifiedCounters,1);assert.equal(x.group.ownMedals.complete,false);assert.equal(x.group.ownMedals.stars[0].stars,3);
});
test("holdout refuses current proxy and excludes future-observed and same-war training",async()=>{
 const {evaluateStrategicHoldout}=await holdout,m={id:"p",playerTag:tag(10),townHall:19},f=(key,time,stars,observedAt=time)=>({playerTag:m.playerTag,warKey:key,attackOrder:1,kind:"normal",attackerTh:19,defenderTh:19,stars,destruction:stars===3?100:80,eventAt:time,observedAt});
 const a=f("test1",now+day,3),sameWar={...f("test1",now-day,2),attackOrder:2};
 const input={members:[m],observations:[f("train",now-day,2),sameWar,f("late",now-day,3,now+day),a,a,f("test2",now+2*day,2)],cutoffs:[now,now+day,now+2*day]};
 assert.equal(evaluateStrategicHoldout({...input,provenance:"current_snapshot_war_start_proxy"}).ok,false);
 const x=evaluateStrategicHoldout({...input,provenance:"immutable_observation"});assert.equal(x.predictions,2);assert.equal(x.folds[0].trainingRows,1);assert.equal(x.folds[0].testRows,1);assert.ok(x.mae);assert.equal(x.calibrated,false);
});
test("opt-in route after membership before regular cache and writes",()=>{
 const fs=require("node:fs"),path=require("node:path"),s=fs.readFileSync(path.join(__dirname,"../supabase/functions/coc-cwl-status/index.ts"),"utf8");
 assert.ok(s.indexOf("not_a_member")<s.indexOf("if(body?.strategic===true)"));
 assert.ok(s.indexOf("if(body?.strategic===true)")<s.indexOf("const prior=CACHE.get(clanId)"));
 assert.match(s,/CWL_STRATEGIC_SHADOW_ENABLED/);assert.match(s,/CWL_STRATEGIC_SHADOW_CLANS/);assert.match(s,/loadStatus\(clanTag,key,true,\{/);assert.match(s,/Deno\.env\.get\("CWL_STRATEGIC_REVIEWED_LEAGUE_RULES"\)/);
});

test("strategic read discards response after revocation or failed link check",async()=>{
 const {readStrategicWithRecheck}=await projection;
 let allowed=true,release;
 const pending=readStrategicWithRecheck({read:()=>new Promise(r=>release=r),verify:async()=>allowed});
 allowed=false;release({private:"never returned"});
 assert.equal(await pending,null);
 assert.deepEqual(await readStrategicWithRecheck({read:async()=>({ok:true}),verify:async()=>true}),{ok:true});
});
test("preparation must have a future valid start time, expires by actual start and read age",async()=>{
 const {projectStrategicGroup}=await projection;
 const s=data(),w=s.results.get(tag(112));w.startTime="20261126T000100.000Z";
 const fresh=projectStrategicGroup({...s,readStartedAt:now-1000});assert.equal(fresh.group.upcoming.length,1);assert.equal(fresh.quality.validUntil,now+60000);
 for(const invalid of [undefined,"20261126T000000.000Z","20261131T000100.000Z","20261125T235959.000Z"]){
  w.startTime=invalid;const x=projectStrategicGroup(s);assert.equal(x.group.upcoming.length,0);assert.equal(x.quality.unverifiedPreparation,1);
 }
 assert.throws(()=>projectStrategicGroup({...s,readStartedAt:now-300000}),/invalid_projection_scope/);
});
test("API projection through real daily pilot: incomplete future days frozen and no guessed league rules",async()=>{
 const {projectStrategicGroup}=await projection,{preparePilotInput,buildPilotPreview}=await import("../cwl-strategic-pilot.mjs");
 const s=data(),members=roster(0).map((m,i)=>({id:"p"+i,name:"Player "+i,playerTag:m.tag,townHall:19,participating:true,statuses:[]}));
 const currentPlan=Array.from({length:5},(_,i)=>({day:i+1,lineup:members.map(m=>m.id)}));
 const context={ready:true,phase:"daily",role:"owner",clanTag:s.clanTag,season,slots:15,days:5};
 const input=preparePilotInput({context,profile:{config:{slots:15,days:5},members,locks:[]},currentPlan});
 const history={kind:"current_snapshot_war_start_proxy",asOf:now-1000,facts:[],obligations:[],audit:{}};
 const raw=projectStrategicGroup(s),args={input,history,projection:raw,mode:"performance",planStandard:require("../cwl-planning-core.js").planCwl,now:now+1};
 const x=buildPilotPreview(args);assert.equal(x.canApply,false);assert.deepEqual(x.editableDays,[2]);assert.deepEqual(x.changes,[]);assert.equal(x.display.recommendation,null);assert.match(x.display.tableStatus,/Abstiegsregeln nicht bestätigt/);
 assert.equal(x.expiresAt,now+299000);
 assert.throws(()=>buildPilotPreview({...args,projection:{...raw,quality:{...raw.quality,validUntil:now}}}),/pilot_live_scope/);
});

test("reviewed rules bind exact tenant, clan, cycle, format and observation",async()=>{
 const {projectStrategicGroup}=await projection,s=data();
 const row={clanId,clanTag:s.clanTag,season,teamSize:15,anchorWarTag:tag(112),league:"Master II",fullGroupSize:8,promotionPlaces:2,demotionPlaces:2,source:"in_game_current_group",verifiedAt:new Date(now-1000).toISOString()};
 const run=(records,id=clanId)=>projectStrategicGroup({...s,ruleContext:{clanId:id,records:JSON.stringify(records)}});
 const ok=run([row]);assert.equal(ok.standings.league,"Master II");assert.equal(ok.standings.promotion,"open");assert.equal(ok.standings.demotion,"not_applicable");
 assert.equal(ok.standings.ruleEvidence.verifiedAt,row.verifiedAt);
 for(const rows of [[{...row,season:"2026-10"}],[{...row,anchorWarTag:tag(111)}],[{...row,teamSize:30}],[{...row,clanTag:tag(1)}],
  [{...row,verifiedAt:new Date(now+1).toISOString()}],[{...row,source:"third_party"}],[{...row,league:"Master 2"}],[row,row],
  [{...row,promotionPlaces:7,demotionPlaces:2}],[{...row,league:"Legend League"}]]){
  assert.equal(run(rows).standings.demotion,"unknown_rules");
 }
 assert.equal(run([row],"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb").standings.demotion,"unknown_rules");
});

test("holdout uses only cutoff-visible corrections and treats repeated observations as one attack",async()=>{
 const {evaluateStrategicHoldout}=await holdout,m={id:"p",playerTag:tag(10),townHall:19};
 const f=(key,time,stars,kind="normal",observedAt=time)=>({playerTag:m.playerTag,warKey:key,attackOrder:1,kind,attackerTh:19,defenderTh:19,stars,destruction:stars===3?100:80,eventAt:time,observedAt});
 const train=f("train",now-day,3),first=f("test",now+day,3),later=f("later",now+2*day,2);
 const x=evaluateStrategicHoldout({members:[m],observations:[train,{...train,observedAt:now-1},first,later,{...train,stars:0,observedAt:now+2*day}],
 cutoffs:[now,now+day,now+2*day],provenance:"immutable_observation"});
 assert.equal(x.folds[0].trainingRows,1);assert.equal(x.folds[0].trainingConflicts,0);
 assert.equal(x.folds[1].testConflicts,1);assert.equal(x.predictions,2);
 assert.equal(x.distinctWars,2);assert.equal(x.distinctPlayers,1);assert.equal(x.byKind.normal.predictions,2);assert.equal(x.byKind.cwl.mae,null);
 assert.equal(x.calibrated,false);
});

test("live target projection verifies own outstanding attacks, best stars and end time, no foreign identities",async()=>{
 const {projectStrategicGroup}=await projection,s=data(),w=s.results.get(tag(112));
 w.state="inWar";w.startTime="20261125T120000.000Z";w.endTime="20261126T120000.000Z";
 let x=projectStrategicGroup(s);assert.equal(x.group.liveTargets.length,1);
 const live=x.group.liveTargets[0];assert.equal(live.attackers.length,14);assert.equal(live.targets[0].stars,3);assert.equal(live.targets[0].hits,1);
 assert.ok(live.targets.every(t=>!Object.hasOwn(t,"tag")));assert.ok(!live.attackers.some(m=>m.mapPosition===1));
 const second=w.clan.members[1];second.attacks=[{attackerTag:second.tag,defenderTag:w.opponent.members[0].tag,stars:2,destructionPercentage:80,order:2}];w.clan.attacks=2;
 x=projectStrategicGroup(s);assert.equal(x.group.liveTargets[0].attackers.length,13);assert.equal(x.group.liveTargets[0].targets[0].stars,3);assert.equal(x.group.liveTargets[0].targets[0].hits,2);
 w.clan.attacks=3;assert.equal(projectStrategicGroup(s).group.liveTargets.length,0);w.clan.attacks=2;
 w.endTime="20261125T235959.000Z";assert.equal(projectStrategicGroup(s).group.liveTargets.length,0);
});
test("live cleanup matches only unique unfinished targets and never suggests spent attacks, expires at war end",async()=>{
 const {projectStrategicGroup}=await projection,{previewLiveStrategicTargets}=await import("../cwl-strategic-targets.mjs"),s=data(),w=s.results.get(tag(112));
 w.state="inWar";w.startTime="20261125T120000.000Z";w.endTime="20261126T000100.000Z";
 const group=projectStrategicGroup(s).group,evidence={asOf:now,profiles:[]},args={group,evidence,selectedClanTag:s.clanTag,season,asOf:now,now};
 const before=JSON.stringify(group),[x]=previewLiveStrategicTargets(args);
 assert.equal(x.openAttacks,14);assert.equal(x.suggestions.length,14);assert.equal(x.expiresAt,now+60000);
 assert.equal(new Set(x.suggestions.map(a=>a.targetPosition)).size,14);assert.ok(x.suggestions.every(a=>a.attackerPosition!==1&&a.targetPosition!==1&&a.evidenceN===0));
 assert.equal(JSON.stringify(group),before);assert.deepEqual(previewLiveStrategicTargets({...args,now:now+60000}),[]);
 const modified=structuredClone(group);for(const t of modified.liveTargets[0].targets){t.stars=3;t.destruction=100;t.hits=1}
 const [full]=previewLiveStrategicTargets({...args,group:modified});assert.ok(full.suggestions.every(a=>a.targetPosition===null));
});
test("live recommendations remain available when a future lineup conflicts with actual roster",async()=>{
 const {projectStrategicGroup}=await projection,{preparePilotInput,buildPilotPreview}=await import("../cwl-strategic-pilot.mjs");
 const s=data(),w=s.results.get(tag(112));w.state="inWar";w.startTime="20261125T120000.000Z";w.endTime="20261126T120000.000Z";
 const members=roster(0).map((m,i)=>({id:"p"+i,name:"Player "+i,playerTag:m.tag,townHall:19,participating:true,statuses:[]}));
 members.push({id:"extra",name:"Extra",playerTag:tag(150),townHall:19,participating:true,statuses:[]});
 const currentPlan=Array.from({length:5},(_,i)=>({day:i+1,lineup:members.slice(1).map(m=>m.id)}));
 const context={ready:true,phase:"daily",role:"owner",clanTag:s.clanTag,season,slots:15,days:5};
 const input=preparePilotInput({context,profile:{config:{slots:15,days:5},members,locks:[]},currentPlan});
 const history={kind:"current_snapshot_war_start_proxy",asOf:now-1000,facts:[],obligations:[],audit:{}};
 const result=buildPilotPreview({input,history,projection:projectStrategicGroup(s),mode:"balanced",planStandard:require("../cwl-planning-core.js").planCwl,now:now+1});
 assert.equal(result.rest.ok,false);assert.equal(result.publication,null);assert.equal(result.liveTargets[0].suggestions.length,14);assert.ok(result.liveTargets[0].suggestions.every(a=>!Object.hasOwn(a,"attackerTag")));
});
