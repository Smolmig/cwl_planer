"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {pathToFileURL}=require("node:url");
const path=require("node:path");
const fs=require("node:fs");
const root=path.resolve(__dirname,"..");
const moduleUrl=pathToFileURL(path.join(root,"cwl-player-linked-history.mjs")).href;
const load=()=>import(moduleUrl);
const tag="#PPYQG";
const war=(clan,warKey,date,source="api")=>({
 clan_id:clan,war_key:warKey,war_type:"normal",source,finalized:true,
 started_at:date
});
const hit=(clan,key,stars,th=18)=>({
 clan_id:clan,war_key:key,attack_order:1,attacker_tag:tag,
 attacker_th:th,stars
});
test("Player-Tag joins across authorized clans only; old Rathaus is labeled as evidence",async()=>{
 const {summarizeAccessiblePlayerHistory}=await load();
 const clans=[
  {id:"allowedA",name:"United Fighters",clash_tag:"#ABCD"},
  {id:"allowedB",name:"UF 2",clash_tag:"#PQRY"}
 ];
 const out=summarizeAccessiblePlayerHistory(clans,[
  hit("allowedA","api1",3,18),hit("allowedB","import1",2,17),
  hit("forbidden","unknown",3,20)
 ],[
  war("allowedA","api1","2026-11-13T12:00:00Z"),
  war("allowedB","import1","2026-07-13T12:00:00Z","import"),
  war("forbidden","unknown","2026-11-14T12:00:00Z")
 ]);
 assert.equal(out.length,2);
 assert.equal(out[0].clanName,"United Fighters");
 assert.equal(out[0].latestDocumentedTh,18);
 assert.equal(out[0].rawThreeStarRate,100);
 assert.equal(out[1].latestDocumentedTh,17);
 assert.equal(out[1].rawThreeStarRate,0);
 assert.deepEqual(out.map(x=>x.clanId),["allowedA","allowedB"]);
});
test("Incomplete war data does not become a fake completed war or a global total",async()=>{
 const {summarizeAccessiblePlayerHistory}=await load();
 const c=[{id:"allowedA",name:"Clan A",clash_tag:"#ABCD"}];
 const out=summarizeAccessiblePlayerHistory(c,[hit("allowedA","ongoing",3),hit("allowedA","ok",0)],[
  {...war("allowedA","ongoing","2026-11-13T12:00:00Z"),finalized:false},
  war("allowedA","ok","2026-11-12T12:00:00Z")
 ]);
 assert.equal(out.length,1);
 assert.equal(out[0].recordedAttacks,1);
 assert.equal(out[0].rawThreeStarRate,0);
});
function fakeSb({loggedIn=true,available=[],attacks=[],wars=[]}={}){
 const calls=[];
 const sb={
  auth:{getUser:async()=>({data:{user:loggedIn?{id:"authenticated-user"}:null},error:null})},
  from(table){
   const query={table,criteria:[]};
   const chain={
    select(cols){query.columns=cols;return this;},
    neq(key,val){query.criteria.push(["neq",key,val]);return this;},
    in(key,values){query.criteria.push(["in",key,values]);return this;},
    eq(key,val){query.criteria.push(["eq",key,val]);return this;},
    order(){return this;},
    limit(){calls.push(query);return Promise.resolve({data:available,error:null});},
    range(from,to){calls.push(query);return Promise.resolve({
      data:table==="cwl_stat_attacks"?attacks:wars,error:null
    });}
   };
   return chain;
  }
 };
 return {sb,calls};
}
test("Without sign-in no clan or statistic query is performed",async()=>{
 const {loadAccessiblePlayerHistory}=await load();
 const {sb,calls}=fakeSb({loggedIn:false});
 await assert.rejects(()=>loadAccessiblePlayerHistory(sb,tag,"current"),/Bitte anmelden/);
 assert.equal(calls.length,0);
});
test("Only previously accessible RLS clan IDs may reach attack and war SELECTs",async()=>{
 const {loadAccessiblePlayerHistory}=await load();
 const {sb,calls}=fakeSb({
  available:[{id:"allowed",name:"Other clan",clash_tag:"#ABCD"}],
  attacks:[hit("allowed","war-A",3)],wars:[war("allowed","war-A","2026-11-14T12:00:00Z")]
 });
 const result=await loadAccessiblePlayerHistory(sb,tag,"current");
 assert.equal(result.clans.length,1);
 assert.equal(result.clans[0].clanName,"Other clan");
 assert.deepEqual(calls.map(q=>q.table),[
   "cwl_clans","cwl_stat_attacks","cwl_stat_wars"
 ]);
 const att=calls[1];
 assert.deepEqual(att.criteria.find(x=>x[1]==="clan_id"),["in","clan_id",["allowed"]]);
 assert.deepEqual(att.criteria.find(x=>x[1]==="attacker_tag"),["eq","attacker_tag",tag]);
 assert.equal(calls[1].columns.includes("player_note"),false);
 assert.equal(calls[0].criteria[0][1],"id");
 assert.equal(calls[0].criteria[0][2],"current");
});
test("Invalid Player-Tag is rejected before reading authorized clans",async()=>{
 const {loadAccessiblePlayerHistory}=await load();
 const {sb,calls}=fakeSb();
 await assert.rejects(()=>loadAccessiblePlayerHistory(sb,"#INVALID","current"),/Ungültiges/);
 assert.equal(calls.length,0);
});
test("UI keeps sort metric prominent and moves historical details behind disclosure",()=>{
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 const js=fs.readFileSync(path.join(root,"cwl-stats.mjs"),"utf8");
 assert.match(html,/stats-form-primary/);
 assert.match(js,/class='stats-form-primary'/);
 assert.match(js,/Zuverlässigkeit nicht vollständig belegbar/);
 assert.doesNotMatch(js,/Leistung "\+b\.performanceIndex\+"\/100 · Zuverlässigkeit offen"/);
 assert.match(js,/data-linked-player/);
 assert.match(js,/class='stats-form-player-details'/);
 assert.match(html,/stats-scope-details/);
 assert.doesNotMatch(html,/<option value="attacks">Angriffe auf gleiches RH<\/option>/);
 assert.match(html,/data-form-window="30"[^>]*>30 Tage <small>Kurzfristig/);
});
