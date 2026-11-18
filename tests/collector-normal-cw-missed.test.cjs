"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {pathToFileURL}=require("node:url");
const path=require("node:path");
const fs=require("node:fs");
const root=path.join(__dirname,"..");
const alph="0289PYLQGRJCUV";
const player=(prefix,i)=>"#"+prefix+alph[Math.floor(i/alph.length)]+alph[i%alph.length];
const start="20261114T180000.000Z";
function war(size=15){
 const ours=Array.from({length:size},(_,i)=>({
  tag:player("2P",i),name:"Own "+i,townhallLevel:19,
  ...(i===0?{attacks:[0,1].map(n=>({
   attackerTag:player("2P",i),defenderTag:player("QP",n),stars:3,
   destructionPercentage:100
  }))}:i===1?{attacks:[{
   attackerTag:player("2P",i),defenderTag:player("QP",i),stars:2,
   destructionPercentage:83
  }]}:{})
 }));
 return {type:"random",state:"warEnded",teamSize:size,attacksPerMember:2,
  startTime:start,endTime:"20261115T180000.000Z",
  clan:{tag:"#2PYL",members:ours,attacks:3},
  opponent:{tag:"#QPYL",members:Array.from({length:size},(_,i)=>({
   tag:player("QP",i),name:"Opp "+i,townhallLevel:19
  }))}};
}
const capture=async raw=>{
 const {buildWarSnapshot}=await import(pathToFileURL(path.join(root,
  "supabase/functions/coc-stats-collector/collector-core.mjs")).href);
 return buildWarSnapshot(raw,"#2PYL",{warType:"normal",
  now:Date.parse("2026-11-16T12:00:00Z")});
};

test("verified 5/15/30 normal CW computes 0/2, 1/2 and 2/2 only after warEnded",async()=>{
 for(const size of [5,15,30]){
  const raw=war(size),original=JSON.stringify(raw),result=await capture(raw);
  assert.equal(result.war.source_clash_tag,"#2PYL");
  assert.equal(result.war.missed_log_complete,true);
  assert.equal(result.war.finalized,true);
  assert.equal(result.attacks.length,3);
  assert.equal(result.missed.length,size-1);
  assert.deepEqual(result.missed.map(r=>r.missed_count),[1,...Array(size-2).fill(2)]);
  assert.equal(result.missed.reduce((a,b)=>a+b.missed_count,0),size*2-3);
  assert.equal(JSON.stringify(raw),original);
 }
});

test("confirmed all attacks or zero attacks give complete coverage without fake extras",async()=>{
 const raw=war(5);
 for(let i=0;i<5;i++){
  raw.clan.members[i].attacks=[0,1].map(n=>({
   attackerTag:player("2P",i),defenderTag:player("QP",n),stars:1,
   destructionPercentage:33
  }));
 }
 raw.clan.attacks=10;
 let result=await capture(raw);
 assert.equal(result.war.missed_log_complete,true);
 assert.deepEqual(result.missed,[]);
 raw.clan.attacks=0;
 for(const member of raw.clan.members)delete member.attacks;
 result=await capture(raw);
 assert.equal(result.war.missed_log_complete,true);
 assert.ok(result.missed.every(x=>x.missed_count===2));
});

test("missing or contradictory data never marks normal-CW misses as complete",async()=>{
 for(const change of [
  w=>delete w.clan.attacks,
  w=>w.clan.attacks=0,
  w=>w.clan.attacks=4,
  w=>w.clan.attacks=-1,
  w=>w.clan.attacks="3",
  w=>w.attacksPerMember=1,
  w=>w.attacksPerMember="2",
  w=>w.state="inWar"
 ]){
  const x=war();change(x);const result=await capture(x);
  assert.equal(result.war.missed_log_complete,false);
  assert.deepEqual(result.missed,[]);
 }
 const invalid=war();invalid.clan.members.pop();
 await assert.rejects(capture(invalid),/incomplete_war_roster/);
 const extra=war();extra.clan.members[0].attacks.push(extra.clan.members[0].attacks[0]);
 await assert.rejects(capture(extra),/invalid_attacks_count/);
 const tooSoon=war();
 const {buildWarSnapshot}=await import(pathToFileURL(path.join(root,
  "supabase/functions/coc-stats-collector/collector-core.mjs")).href);
 assert.equal(buildWarSnapshot(tooSoon,"#2PYL",{warType:"normal",
  now:Date.parse("2026-11-15T18:00:30Z")}),null);
});
test("regular collector persists missed rows before finalized and ignores previously finalized legacy imports",async()=>{
 const src=fs.readFileSync(path.join(root,"supabase/functions/coc-stats-collector/index.ts"),"utf8");
 assert.match(src,/snapshot\.missed\.slice\(i,i\+80\)/);
 assert.ok(src.indexOf('"cwl_stat_missed"')<src.indexOf('missed_log_complete:completeMissed'));
 assert.match(src,/alreadyFinal/);
 assert.match(src,/if\(completeMissed&&snapshot\.missed\.length\)/);
 const sql=fs.readFileSync(path.join(root,
  "supabase/migrations/20261118074000_cwl_normal_cw_review_audit.sql"),"utf8");
 assert.match(sql,/ADD COLUMN IF NOT EXISTS source_clash_tag/);
 assert.match(sql,/CREATE TABLE public\.cwl_clan_cw_missed_decisions/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/private\.cwl_is_owner\(clan_id\)/);
 assert.match(sql,/actor_id=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/w\.source_clash_tag=c\.clash_tag/);
 assert.match(sql,/w\.source='api'/);
 assert.match(sql,/w\.missed_log_complete IS TRUE/);
 assert.match(sql,/GRANT INSERT \(clan_id,source_clash_tag,war_key,player_tag,decision,note\)/);
 assert.doesNotMatch(sql,/GRANT (?:UPDATE|DELETE)[^;]+TO authenticated/);
});
