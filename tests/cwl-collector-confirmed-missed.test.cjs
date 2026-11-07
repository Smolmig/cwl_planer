"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {pathToFileURL}=require("node:url");

const root=path.resolve(__dirname,"..");
const dir=path.join(root,"supabase/functions/coc-stats-collector");
const core=()=>import(pathToFileURL(path.join(dir,"collector-core.mjs")).href);
const now=Date.parse("2026-11-07T19:00:00Z");
const digits="0289PYLQGRJCUV";
const tag=(side,i)=>"#"+side+"P"+digits[Math.floor(i/digits.length)]+digits[i%digits.length];

function war(size=15,attackers=[0]){
 const members=Array.from({length:size},(_,i)=>({
   tag:tag("2",i),name:"Own "+i,townhallLevel:18,
   ...(attackers.includes(i)?{attacks:[{
      attackerTag:tag("2",i),defenderTag:tag("Q",i),
      stars:3,destructionPercentage:100
   }]}:{})
 }));
 return {
  state:"warEnded",teamSize:size,
  startTime:"20261105T190000.000Z",endTime:"20261106T190000.000Z",
  clan:{tag:"#2PYL",name:"Own",attacks:attackers.length,members},
  opponent:{tag:"#QPYL",name:"Opp",members:Array.from({length:size},(_,i)=>({
    tag:tag("Q",i),name:"Opp "+i,townhallLevel:18
  }))}
 };
}
const capture=raw=>core().then(({buildWarSnapshot})=>buildWarSnapshot(raw,"#2PYL",{
  warType:"cwl",warTag:"#2PYQ",now
}));

test("ended verified 15v15 and 30v30 CWL distinguish executed from confirmed missed",async()=>{
 for(const slots of [15,30]){
  const raw=war(slots,[0,1,2]);
  const before=JSON.stringify(raw);
  const result=await capture(raw);
  assert.equal(result.war.finalized,true);
  assert.equal(result.war.missed_log_complete,true);
  assert.equal(result.attacks.length,3);
  assert.equal(result.missed.length,slots-3);
  assert.deepEqual(result.missed.map(m=>m.player_tag),
    raw.clan.members.slice(3).map(m=>m.tag));
  assert.ok(result.missed.every(m=>m.missed_count===1&&m.war_key==="cwl:#2PYQ"));
  assert.equal(JSON.stringify(raw),before,"collector must not mutate the upstream snapshot");
 }
});

test("zero confirmed misses is complete, not unknown, only when count matches",async()=>{
 const raw=war(15,Array.from({length:15},(_,i)=>i));
 const x=await capture(raw);
 assert.equal(x.war.missed_log_complete,true);
 assert.deepEqual(x.missed,[]);
});

test("missing, contradictory or partial official attack totals NEVER prove missed attacks",async()=>{
 for(const mutate of [
  x=>{delete x.clan.attacks},
  x=>{x.clan.attacks=0},
  x=>{x.clan.attacks=2},
  x=>{x.clan.attacks=-1},
  x=>{x.clan.attacks="1"},
  x=>{x.state="inWar"}
 ]){
  const raw=war();mutate(raw);
  const x=await capture(raw);
  assert.equal(x.war.missed_log_complete,false);
  assert.deepEqual(x.missed,[]);
 }
 const invalid=war();invalid.opponent.members.pop();
 await assert.rejects(capture(invalid),/incomplete_war_roster/);
 const ordinary=war();
 const {buildWarSnapshot}=await core();
 const normal=buildWarSnapshot(ordinary,"#2PYL",{now,warType:"normal"});
 assert.equal(normal.war.missed_log_complete,false,
  "Normal CW has different allowed attacks per member");
 assert.deepEqual(normal.missed,[]);
 const tooEarly=buildWarSnapshot(war(),"#2PYL",{now:Date.parse("2026-11-06T19:00:30Z"),
   warType:"cwl",warTag:"#2PYQ"});
 assert.equal(tooEarly,null,"Do not finalize before API result is settled");
});

function archiveHarness({alreadyFinal=false,failMissed=false}={}){
 const src=fs.readFileSync(path.join(dir,"index.ts"),"utf8");
 const a=src.indexOf("async function archiveForAppClan(");
 const b=src.indexOf("async function markFailure(",a);
 assert.ok(a>=0&&b>a,"production archive function remains isolated and testable");
 const writes=[];
 const f=vm.runInNewContext(src.slice(a,b)+";archiveForAppClan",{
  Date,Map,encodeURIComponent,
  rest:async()=>[{finalized:alreadyFinal}],
  upsert:async(_cfg,table,rows,conflict)=>{
   writes.push({table,rows:JSON.parse(JSON.stringify(rows)),conflict});
   if(failMissed&&table==="cwl_stat_missed")throw Error("simulated-storage-error");
  },
  saveCollectorHealth:async(_cfg,_id,record)=>{
   writes.push({table:"collector-health",rows:[JSON.parse(JSON.stringify(record))]});
  }
 });
 return {archive:f,writes};
}

test("verified misses are inserted BEFORE finalizing; retries use unique keys",async()=>{
 const snapshot=await capture(war(15,[0,1,2]));
 const before=JSON.stringify(snapshot);
 const h=archiveHarness();
 await h.archive({},"synthetic-tenant",[snapshot],"2026-11-07T19:00:00Z");
 assert.deepEqual(h.writes.map(w=>w.table),[
  "cwl_stat_wars","cwl_stat_attacks","cwl_stat_missed","cwl_stat_wars",
  "collector-health"
 ]);
 assert.equal(h.writes[0].rows[0].finalized,false);
 assert.equal(h.writes[2].rows.length,12);
 assert.equal(h.writes[2].conflict,"clan_id,war_key,player_tag");
 assert.ok(h.writes[2].rows.every(m=>m.clan_id==="synthetic-tenant"));
 assert.equal(h.writes[3].rows[0].finalized,true);
 assert.equal(h.writes[3].rows[0].missed_log_complete,true);
 assert.equal(JSON.stringify(snapshot),before);
 const prior=archiveHarness({alreadyFinal:true});
 await prior.archive({},"synthetic-tenant",[snapshot],"2026-11-07T19:00:00Z");
 assert.ok(!prior.writes.some(w=>w.table==="cwl_stat_missed"),
  "Do not silently rewrite already-finalized historical Missed imports");
});

test("failed Missed storage cannot mark a war finalized or complete",async()=>{
 const snapshot=await capture(war(15,[0,1,2]));
 const h=archiveHarness({failMissed:true});
 await assert.rejects(h.archive({},"synthetic-tenant",[snapshot],
   "2026-11-07T19:00:00Z"),/simulated-storage-error/);
 assert.deepEqual(h.writes.map(w=>w.table),
  ["cwl_stat_wars","cwl_stat_attacks","cwl_stat_missed"]);
 assert.equal(h.writes[0].rows[0].finalized,false);
});

test("unverified totals may finalize observed attacks, but never claim Missed completeness",async()=>{
 const raw=war();delete raw.clan.attacks;
 const snapshot=await capture(raw);
 const h=archiveHarness();
 await h.archive({},"synthetic-tenant",[snapshot],"2026-11-07T19:00:00Z");
 assert.deepEqual(h.writes.map(w=>w.table),
  ["cwl_stat_wars","cwl_stat_attacks","cwl_stat_wars","collector-health"]);
 assert.equal(h.writes[2].rows[0].missed_log_complete,false);
});
