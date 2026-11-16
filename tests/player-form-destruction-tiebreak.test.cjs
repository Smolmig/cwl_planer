"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const core=()=>import(pathToFileURL(path.join(__dirname,"..","cwl-stats-core.mjs")).href);
const asOf="2026-11-15T16:00:00Z";
const war=(key,type="normal")=>({
 war_key:key,war_type:type,started_at:"2026-11-12T12:00:00Z",
 finalized:true,source:"import",team_size:5,
 missed_log_complete:true,roster_tags:[]
});
const attack=(warKey,tag,stars,destruction,order,thA=18,thD=18)=>({
 war_key:warKey,attacker_tag:tag,attacker_name:tag,attack_order:order,
 defender_tag:"#8QPY",attacker_th:thA,defender_th:thD,stars,destruction
});
const bucket=(rows,tag)=>rows.players.find(p=>p.tag===tag).windows[30];
test("when form score and average stars tie, higher documented destruction breaks the tie",async()=>{
 const {computePlayerFormWindows,sortPlayerFormRows}=await core();
 const events=[
  attack("w","#PYYY",3,100,1),attack("w","#PYYY",1,60,2),
  attack("w","#PQLV",3,100,1),attack("w","#PQLV",1,95,2)
 ];
 const data=computePlayerFormWindows([war("w")],events,{asOf,windows:[30]});
 const a=bucket(data,"#PYYY"),b=bucket(data,"#PQLV");
 assert.equal(a.formIndex,b.formIndex);
 assert.equal(a.averageStars,b.averageStars);
 assert.equal(a.averageDestruction,80);
 assert.equal(b.averageDestruction,97.5);
 assert.equal(a.destructionSamples,2);
 assert.equal(b.destructionComplete,true);
 assert.deepEqual(sortPlayerFormRows(data.players,30,"evidence").map(p=>p.tag),["#PQLV","#PYYY"]);
 assert.deepEqual(sortPlayerFormRows(data.players,30,"hitRate").map(p=>p.tag),["#PQLV","#PYYY"]);
});
test("stars and existing primary form score always outrank damage percentage",async()=>{
 const {computePlayerFormWindows,sortPlayerFormRows}=await core();
 const stars=[
  attack("w","#PYYY",3,100,1),attack("w","#PYYY",2,52,2),
  attack("w","#PQLV",3,100,1),attack("w","#PQLV",1,99,2)
 ];
 const withStars=computePlayerFormWindows([war("w")],stars,{asOf,windows:[30]});
 assert.equal(bucket(withStars,"#PYYY").formIndex,bucket(withStars,"#PQLV").formIndex);
 assert.equal(sortPlayerFormRows(withStars.players,30)[0].tag,"#PYYY");
 const rates=[
  attack("w","#PYYY",3,100,1),attack("w","#PYYY",3,100,2),
  attack("w","#PQLV",3,100,1),attack("w","#PQLV",2,99,2)
 ];
 const withRates=computePlayerFormWindows([war("w")],rates,{asOf,windows:[30]});
 assert.ok(bucket(withRates,"#PYYY").formIndex>bucket(withRates,"#PQLV").formIndex);
 assert.equal(sortPlayerFormRows(withRates.players,30)[0].tag,"#PYYY");
});
test("missing percent stays unknown, never a fabricated 0 percent",async()=>{
 const {computePlayerFormWindows,sortPlayerFormRows}=await core();
 const rows=[
  attack("w","#PYYY",3,100,1),attack("w","#PYYY",1,null,2),
  attack("w","#PQLV",3,100,1),attack("w","#PQLV",1,70,2)
 ];
 const data=computePlayerFormWindows([war("w")],rows,{asOf,windows:[30]});
 const incomplete=bucket(data,"#PYYY"),complete=bucket(data,"#PQLV");
 assert.equal(incomplete.averageDestruction,100);
 assert.equal(incomplete.destructionSamples,1);
 assert.equal(incomplete.destructionComplete,false);
 assert.equal(complete.averageDestruction,85);
 assert.equal(complete.destructionComplete,true);
 // With equal stars, scores and sample sizes the existing name fallback wins.
 assert.deepEqual(sortPlayerFormRows(data.players,30).map(p=>p.tag),
  ["#PQLV","#PYYY"].sort((a,b)=>a.localeCompare(b,"de")));
});
test("0 percent is a real observation and different-town-hall attacks are excluded",async()=>{
 const {computePlayerFormWindows}=await core();
 const rows=[
  attack("w","#PYYY",0,0,1),attack("w","#PYYY",2,92,2),
  attack("w","#PYYY",3,100,3,18,17)
 ];
 const b=bucket(computePlayerFormWindows([war("w")],rows,{asOf,windows:[30]}),"#PYYY");
 assert.equal(b.attacks,2);
 assert.equal(b.averageStars,1);
 assert.equal(b.destructionSamples,2);
 assert.equal(b.averageDestruction,46);
 assert.equal(b.excludedDifferentRH,1);
 assert.equal(b.performed,3);
});
test("CWL-only and member form use the same scoped destruction evidence",async()=>{
 const {computePlayerFormWindows,computeMemberFormSummary}=await core();
 const wars=[war("cw","normal"),war("cwl","cwl")];
 const rows=[attack("cw","#PYYY",2,75,1),attack("cwl","#PYYY",1,90,1)];
 const cwl=computePlayerFormWindows(wars,rows,{asOf,windows:[30],warType:"cwl"});
 assert.equal(bucket(cwl,"#PYYY").averageDestruction,90);
 const combined=computePlayerFormWindows(wars,rows,{asOf,windows:[30],warType:"all"});
 assert.equal(bucket(combined,"#PYYY").averageDestruction,82.5);
 const members=computeMemberFormSummary(wars,rows,{asOf,memberTags:["#PYYY"]});
 const p=members.players[0];
 assert.equal(p.preferred.averageDestruction,90);
 assert.equal(p.cw.averageDestruction,75);
 assert.equal(p.cwl.averageDestruction,90);
});
