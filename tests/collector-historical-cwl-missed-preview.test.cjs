"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");

const dir=path.resolve(__dirname,"../supabase/functions/coc-stats-collector");
const previewModule=()=>import(pathToFileURL(
  path.join(dir,"collector-reconciliation.mjs")).href);
const coreModule=()=>import(pathToFileURL(
  path.join(dir,"collector-core.mjs")).href);
const NOW=Date.parse("2026-11-07T23:00:00Z");
const clanId="11111111-1111-4111-8111-111111111111";
const otherId="22222222-2222-4222-8222-222222222222";
const chars="0289PYLQGRJCUV";
const tag=(prefix,i)=>"#"+prefix+"P"+
  chars[Math.floor(i/chars.length)]+chars[i%chars.length];
const copy=x=>JSON.parse(JSON.stringify(x));

async function fixture(size=15,attacked=size){
  const own=Array.from({length:size},(_,i)=>({
    tag:tag("2",i),name:"Own "+i,townhallLevel:18,
    ...(i<attacked?{attacks:[{
      attackerTag:tag("2",i),defenderTag:tag("Q",i),
      stars:3,destructionPercentage:100
    }]}:{})
  }));
  const officialWar={
    state:"warEnded",teamSize:size,
    startTime:"20261105T190000.000Z",endTime:"20261106T190000.000Z",
    clan:{tag:"#2PYL",name:"Own",attacks:attacked,members:own},
    opponent:{
      tag:"#QPYL",name:"Opp",members:Array.from({length:size},(_,i)=>({
        tag:tag("Q",i),name:"Opp "+i,townhallLevel:18
      }))
    }
  };
  const {buildWarSnapshot}=await coreModule();
  const source=buildWarSnapshot(officialWar,"#2PYL",{
    warType:"cwl",warTag:"#2QGL",now:NOW
  });
  assert.equal(source.war.missed_log_complete,true);
  return {
    linkedClan:{id:clanId,clash_tag:"#2PYL"},
    storedWar:{...source.war,clan_id:clanId,missed_log_complete:false},
    storedAttacks:source.attacks.map(a=>({...a,clan_id:clanId})),
    storedMissedRows:[],
    officialWar,
    fetchedWarTag:"#2QGL",
    now:NOW
  };
}

async function run(f){
  const {previewHistoricalCwlMisses}=await previewModule();
  return previewHistoricalCwlMisses(f);
}
function expectRejected(result,reason){
  assert.equal(result.eligible,false);
  assert.equal(result.reason,reason);
  assert.equal(result.confirmedMissedCount,null,
    "Unknown must never look like a confirmed zero");
  assert.deepEqual(result.missedRows,[]);
}

test("authoritative ended 15/15, 14/15 and 13/15 CWL snapshots yield 0/1/2 confirmed misses only when saved data match",async()=>{
  for(const [count,misses] of [[15,0],[14,1],[13,2]]){
    const f=await fixture(15,count),before=JSON.stringify(f);
    const result=await run(f);
    assert.equal(result.eligible,true);
    assert.equal(result.reason,"official_war_and_saved_attacks_match");
    assert.equal(result.confirmedMissedCount,misses);
    assert.deepEqual(result.missedRows.map(x=>x.player_tag),
      f.officialWar.clan.members.slice(count).map(x=>x.tag));
    assert.ok(result.missedRows.every(x=>x.missed_count===1&&
      x.clan_id===clanId&&x.war_key===f.storedWar.war_key));
    assert.equal(JSON.stringify(f),before,"Preview must not modify input");
  }
});

test("authoritative 0/15 and 29/30 cases are supported without fabricated zero",async()=>{
  for(const [size,attacked] of [[15,0],[30,29]]){
    const f=await fixture(size,attacked),result=await run(f);
    assert.equal(result.eligible,true);
    assert.equal(result.confirmedMissedCount,size-attacked);
    assert.equal(result.missedRows.length,size-attacked);
  }
});

test("unavailable, provisional, unconfirmed or malformed official source cannot confirm a miss",async()=>{
  for(const mutate of [
    x=>{x.officialWar=null},
    x=>{x.officialWar.state="inWar"},
    x=>{x.now=Date.parse("2026-11-06T19:00:30Z")},
    x=>{delete x.officialWar.clan.attacks},
    x=>{x.officialWar.clan.attacks=15},
    x=>{x.officialWar.clan.attacks="14"},
    x=>{x.officialWar.opponent.members.pop()},
    x=>{x.officialWar.clan.members[0].attacks[0].stars=4},
    x=>{x.officialWar.clan.members[0].attacks[0].defenderTag="#2PP2"}
  ]){
    const x=copy(await fixture(15,14));mutate(x);
    const result=await run(x);
    assert.equal(result.eligible,false);
    assert.equal(result.confirmedMissedCount,null);
    assert.equal(result.missedRows.length,0);
  }
});

test("trusted API endpoint war tag is independent from database war key",async()=>{
  const f=await fixture();
  expectRejected(await run({...f,fetchedWarTag:"#2PYQ"}),
    "official_war_tag_disagrees");
  expectRejected(await run({...f,fetchedWarTag:undefined}),
    "official_war_tag_disagrees");
  expectRejected(await run({...f,storedWar:{
    ...f.storedWar,war_key:"cwl:#2PYQ"
  }}),"official_war_tag_disagrees");
  expectRejected(await run({...f,storedWar:{
    ...f.storedWar,war_key:"normal:20261105"
  }}),"invalid_saved_war_key");
});

test("never verify imported, unfinished or already Missed-complete historical records",async()=>{
  const f=await fixture();
  for(const war of [
    {...f.storedWar,source:"import"},
    {...f.storedWar,war_type:"normal"},
    {...f.storedWar,finalized:false},
    {...f.storedWar,missed_log_complete:true}
  ])expectRejected(await run({...f,storedWar:war}),
    "not_an_unverified_final_api_cwl");
  expectRejected(await run({...f,storedMissedRows:[{
    clan_id:clanId,war_key:f.storedWar.war_key,missed_count:1
  }]}),"existing_missed_evidence");
});

test("tenant link and each historical attack must belong to exactly one app clan",async()=>{
  const f=await fixture(15,14);
  expectRejected(await run({...f,linkedClan:{
    ...f.linkedClan,id:otherId
  }}),"tenant_link_invalid");
  expectRejected(await run({...f,linkedClan:{
    ...f.linkedClan,clash_tag:"not-a-clash-tag"
  }}),"tenant_link_invalid");
  const a=copy(f);a.storedAttacks[0].clan_id=otherId;
  expectRejected(await run(a),"stored_attack_scope_invalid");
  const b=copy(f);b.storedAttacks[0].war_key="cwl:#2PYQ";
  expectRejected(await run(b),"stored_attack_scope_invalid");
});

test("saved identity, roster and start-time mismatch prevents any proposed write rows",async()=>{
  const f=await fixture(15,13);
  for(const war of [
    {...f.storedWar,team_size:30},
    {...f.storedWar,opponent_tag:"#2PYQ"},
    {...f.storedWar,started_at:"2026-11-04T19:00:00Z"},
    {...f.storedWar,roster_tags:f.storedWar.roster_tags.slice(1)},
    {...f.storedWar,roster_tags:[...f.storedWar.roster_tags.slice(1),f.storedWar.roster_tags[1]]}
  ]){
    expectRejected(await run({...f,storedWar:war}),
      "saved_war_disagrees_with_official");
  }
});

test("recorded attack data must exactly match official details, count, and unique identities",async()=>{
  const f=await fixture(15,14);
  const missing=copy(f);missing.storedAttacks.pop();
  expectRejected(await run(missing),"stored_attack_count_differs_from_official");
  const extra=copy(f);extra.storedAttacks.push(copy(extra.storedAttacks[0]));
  expectRejected(await run(extra),"stored_attack_count_differs_from_official");
  const duplicate=copy(f);
  duplicate.storedAttacks[1]=copy(duplicate.storedAttacks[0]);
  expectRejected(await run(duplicate),"stored_attack_identity_duplicate");
  for(const modify of [
    a=>{a.stars=0},
    a=>{a.destruction=0},
    a=>{a.attacker_th=17},
    a=>{a.defender_th=17},
    a=>{a.defender_tag="#2PP2"}
  ]){
    const x=copy(f);modify(x.storedAttacks[0]);
    expectRejected(await run(x),"stored_attack_disagrees_with_official");
  }
  const wrongOrder=copy(f);wrongOrder.storedAttacks[0].attack_order=2;
  expectRejected(await run(wrongOrder),"stored_attack_scope_invalid");
});

test("proposal helper is side-effect free and not wired to the live Edge endpoint",()=>{
  const helper=fs.readFileSync(path.join(dir,"collector-reconciliation.mjs"),"utf8");
  const edge=fs.readFileSync(path.join(dir,"index.ts"),"utf8");
  assert.doesNotMatch(helper,/\b(?:fetch|upsert|rest|Deno|console)\s*\(/);
  assert.doesNotMatch(helper,/\b(?:UPDATE|DELETE|INSERT|service_role)\b/i);
  assert.doesNotMatch(edge,/collector-reconciliation\.mjs/);
});
