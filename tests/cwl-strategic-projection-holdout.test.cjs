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
 return {state,teamSize:15,attacksPerMember:1,clan,opponent};
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
 assert.match(s,/CWL_STRATEGIC_SHADOW_ENABLED/);assert.match(s,/CWL_STRATEGIC_SHADOW_CLANS/);assert.match(s,/loadStatus\(clanTag,key,true\)/);
});
