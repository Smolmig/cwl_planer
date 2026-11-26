"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const load=()=>import("../supabase/functions/coc-stats-collector/collector-activity-probe.mjs");
const clan="#2PYL",player="#8PYL",group="#Q9QL";
test("Bounded probe reads six allowlisted endpoints and reports only capabilities",async()=>{
 const {probeActivityApi}=await load();
 const calls=[];
 const read=async p=>{
  calls.push(p);
  const responses=[
   {items:[{tag:player,name:"private name"}]},
   {items:[{state:"ended",startTime:"20261120T070000.000Z",endTime:"20261123T070000.000Z",members:[{tag:player,attacks:6,attackLimit:5,bonusAttackLimit:1,capitalResourcesLooted:24000}]}]},
   {tag:player,currentLeagueGroupTag:group,currentLeagueSeasonId:"2026-11-23",achievements:[{name:"Games Champion",value:9000}],attackWins:15},
   [{attack:true,battleType:"RANKED",battleTimestamp:"20261125T090000.000Z",stars:3,destructionPercentage:100}],
   {items:[{seasonId:"2026-11-16",leagueId:42}]},
   {members:[{tag:player}],attackLogs:[],defenseLogs:[]}
  ];
  return {status:200,body:responses[calls.length-1]};
 };
 const r=await probeActivityApi(clan,read);
 assert.equal(r.requests,6);
 assert.deepEqual(calls,["/clans/%232PYL/members?limit=50","/clans/%232PYL/capitalraidseasons?limit=2",
  "/players/%238PYL","/players/%238PYL/battlelog","/players/%238PYL/leaguehistory",
  "/leaguegroup/%23Q9QL/2026-11-23?playerTag=%238PYL"]);
 assert.equal(r.endpoints.raid.hasMemberLimits,true);
 assert.equal(r.endpoints.profile.hasGamesChampion,true);
 assert.equal(r.endpoints.battlelog.hasRankedAttack,true);
 assert.equal(r.endpoints.leaguegroup.hasPlayer,true);
 for(const secret of [clan,player,group,"private name","24000","9000","2026-11-23"])
  assert.equal(JSON.stringify(r).includes(secret),false);
});
test("Missing roster or identity mismatch cannot create player probes or inferred data",async()=>{
 const {probeActivityApi}=await load();
 let count=0;
 const r=await probeActivityApi(clan,async()=>{count++;return {status:403,body:{name:"private"}}});
 assert.equal(count,2);assert.equal(r.playerProbe,"no_observed_player");
 assert.equal(r.endpoints.raid.hasMemberLimits,false);
 count=0;
 const x=await probeActivityApi(clan,async()=>{count++;return {status:200,body:count===1?{items:[{tag:player}]}:count===2?[]:{tag:group}}});
 assert.equal(count,3);assert.equal(x.playerProbe,"profile_not_verified");
 assert.equal(x.endpoints.profile.hasGamesChampion,false);
});
test("Empty successful responses and HTTP failures remain distinct; no guessed league group",async()=>{
 const {probeActivityApi}=await load();
 let count=0;
 const r=await probeActivityApi(clan,async()=>{
  count++;
  if(count===1)return {status:200,body:{items:[{tag:player}]}};
  if(count===2)return {status:200,body:{items:[]}};
  if(count===3)return {status:200,body:{tag:player,currentLeagueGroupTag:"../../private",currentLeagueSeasonId:1}};
  if(count===4)return {status:429,body:{message:"secret upstream error"}};
  throw Error("secret upstream error");
 });
 assert.equal(count,5);assert.equal(r.endpoints.raid.hasSeason,false);
 assert.equal(r.endpoints.battlelog.status,429);
 assert.equal(r.endpoints.leaguehistory.status,"network_error");
 assert.equal(r.endpoints.leaguegroup.status,"no_current_group_or_season");
 assert.doesNotMatch(JSON.stringify(r),/secret upstream error|private/);
 await assert.rejects(probeActivityApi("../",async()=>({status:200})),/invalid_probe_context/);
});
test("Probe mode requires manual signed identity, rejects cron, and exits before collector writes",()=>{
 const root=path.resolve(__dirname,"..");
 const edge=fs.readFileSync(path.join(root,"supabase/functions/coc-stats-collector/index.ts"),"utf8");
 const workflow=fs.readFileSync(path.join(root,".github/workflows/collect-war-stats.yml"),"utf8");
 assert.match(edge,/if\(hasCronHeaders\(request\)\)\{\s*if\(mode!==null\)return response/);
 assert.match(edge,/requiredEvent:mode==="activity-probe"\?"workflow_dispatch":null/);
 const start=edge.indexOf('if(mode==="activity-probe"){');
 const end=edge.indexOf("const count=Math.max",start);
 assert.ok(start>0&&end>start);
 const route=edge.slice(start,end);
 assert.match(route,/return response\(\{ok:true,\.\.\.result\}\)/);
 assert.doesNotMatch(route,/upsert|archiveForAppClan|saveCollectorHealth|rollSeasonForAppClan/);
 assert.match(workflow,/options: \[collect, activity-probe\]/);
 assert.match(workflow,/inputs.mode != 'activity-probe'/);
 assert.match(workflow,/inputs.mode == 'activity-probe'/);
 assert.match(workflow,/x-cwl-collector-mode: activity-probe/);
});
