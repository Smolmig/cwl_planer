"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const core=require("../clan-management-core.js");
const root=path.resolve(__dirname,"..");
const member=(tag,name,role)=>({tag,name,role,townHallLevel:18});

test("Clash rank normalization accepts actual API admin alias but never conflates app roles",()=>{
 assert.equal(core.normalizeRank("member"),"member");
 assert.equal(core.normalizeRank("admin"),"elder");
 assert.equal(core.normalizeRank("elder"),"elder");
 assert.equal(core.normalizeRank("coLeader"),"coLeader");
 assert.equal(core.normalizeRank("leader"),"leader");
 for(const raw of ["editor","owner","viewer","moderator",null,""]){
  assert.equal(core.normalizeRank(raw),"unknown");
 }
});
test("Eligible rank preview excludes both co-leaders and leaders with no recommendations or join age",()=>{
 const people=[
  member("#2PYL","Zelda","member"),member("#2PYQ","Anna","admin"),
  member("#2PYR","Vizzy","coLeader"),member("#2PYJ","Boss","leader")
 ];
 const result=core.buildPreview(people);
 assert.equal(result.ok,true);
 assert.deepEqual(result.counts,{member:1,elder:1,coLeader:1,leader:1,unknown:0});
 assert.deepEqual(result.rows.map(x=>x.name),["Zelda","Anna"]);
 assert.equal(result.eligibleForRecommendation,0);
 assert.ok(result.rows.every(x=>x.status==="Nachweise fehlen"));
 assert.match(result.observation,/keinen historischen Eintritt/);
 assert.match(result.observation,/keinen letzten Login/);
});
test("Incomplete roster, duplicate tags, invalid names fail closed instead of mass recommendations",()=>{
 for(const rows of [[],null,
  [member("#2PYL","One","member"),member("#2pyl","Duplicate","elder")],
  [member("#BAD!","Invalid","member")],
  [{tag:"#2PYL",name:"",role:"member"}],
  Array.from({length:51},(_,i)=>member("#2PYL","A"+i,"member"))]){
  const result=core.buildPreview(rows);
  assert.equal(result.ok,false);
  assert.equal(result.rows.length,0);
 }
});
test("Unknown Clash rank stays uncertain; arbitrary text is only data",()=>{
 const result=core.buildPreview([member("#2PYL","<script>alert(1)</script>","futureRole")]);
 assert.equal(result.ok,true);
 assert.equal(result.rows[0].rank,"unknown");
 assert.equal(result.rows[0].status,"Rang prüfen");
 assert.equal(result.eligibleForRecommendation,0);
});
test("Owner-only read path cannot trigger roster apply, profile save or rank writes",()=>{
 const cloud=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
 const start=cloud.indexOf("async fetchManagementRoster(){");
 const end=cloud.indexOf("isEmergencyEditing:",start);
 assert.ok(start>=0&&end>start);
 const code=cloud.slice(start,end);
 assert.match(code,/role!=="owner"/);
 assert.match(code,/accountEpoch/);
 assert.match(code,/clanId/);
 assert.match(code,/sb\.functions\.invoke\("coc-clan-members"/);
 assert.doesNotMatch(code,/\b(?:applyRoster|ensureSaved|writeCloud|upsert|update|insert|delete|onLocalChange)\s*\(/i);
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 assert.match(html,/data-more-action="management" hidden/);
 assert.match(html,/id="view-clan-management"/);
 assert.match(html,/Mehr → Clanverwaltung/);
 assert.match(html,/clan-management-core\.js\?v=1\.16\.69/);
 assert.doesNotMatch(html,/<button[^>]*id="clanManagement(?:Promote|Demote|Kick)"/i);
});
