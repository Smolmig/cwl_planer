"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");

const root=path.resolve(__dirname,"..");
const dir=path.join(root,"supabase/functions/coc-stats-collector");
const sql=fs.readFileSync(path.join(root,
  "scripts/DRAFT_cwl_historical_missed_atomic_rpc.sql"),"utf8");
const source=fs.readFileSync(path.join(dir,"index.ts"),"utf8");
const prepare=async()=>(
  await import(pathToFileURL(path.join(dir,"collector-reconciliation.mjs")).href)
).prepareHistoricalCwlMissedRpc;
const snapshot=async()=>(
  await import(pathToFileURL(path.join(dir,"collector-core.mjs")).href)
).buildWarSnapshot;
const NOW=Date.parse("2026-11-07T23:00:00Z");
const CLAN="11111111-1111-4111-8111-111111111111";
const alphabet="0289PYLQGRJCUV";
const tag=(side,i)=>"#"+side+"P"+alphabet[Math.floor(i/alphabet.length)]+
  alphabet[i%alphabet.length];
const clone=x=>JSON.parse(JSON.stringify(x));

async function fixture(size=15,attacked=14){
  const officialWar={
    state:"warEnded",teamSize:size,
    startTime:"20261105T190000.000Z",endTime:"20261106T190000.000Z",
    clan:{
      tag:"#2PYL",name:"Own",attacks:attacked,
      members:Array.from({length:size},(_,i)=>({
        tag:tag("2",i),name:"Own "+i,townhallLevel:18,
        ...(i<attacked?{attacks:[{
          attackerTag:tag("2",i),defenderTag:tag("Q",i),
          stars:3,destructionPercentage:100
        }]}:{})
      }))
    },
    opponent:{
      tag:"#QPYL",name:"Opponent",
      members:Array.from({length:size},(_,i)=>({
        tag:tag("Q",i),name:"Opp "+i,townhallLevel:18
      }))
    }
  };
  const original=(await snapshot())(officialWar,"#2PYL",{
    warType:"cwl",warTag:"#2QGL",now:NOW
  });
  assert.equal(original.war.missed_log_complete,true);
  return {
    linkedClan:{id:CLAN,clash_tag:"#2PYL"},
    storedWar:{
      ...original.war,clan_id:CLAN,missed_log_complete:false,
      updated_at:"2026-11-07T20:00:00.000Z"
    },
    storedAttacks:original.attacks.map(a=>({...a,clan_id:CLAN})),
    storedMissedRows:[],officialWar,fetchedWarTag:"#2QGL",now:NOW
  };
}

test("service-role SQL draft has no live migration, RPC/Edge import or browser exposure",()=>{
  assert.match(sql,/^-- DRAFT ONLY/);
  assert.match(sql,/\bbegin\s*;/i);
  assert.match(sql,/\bcommit\s*;\s*$/i);
  assert.match(sql,/\bsecurity\s+invoker\b/i);
  assert.match(sql,/\bcurrent_user\s*<>\s*'service_role'/i);
  assert.match(sql,/\brevoke\s+all\s+on\s+function[\s\S]*?from\s+public,anon,authenticated\s*;/i);
  assert.match(sql,/\bgrant\s+execute\s+on\s+function[\s\S]*?to\s+service_role\s*;/i);
  assert.doesNotMatch(sql,/\bsecurity\s+definer\b/i);
  assert.doesNotMatch(source,/cwl_commit_verified_historical_missed|collector-reconciliation\.mjs/);
  assert.doesNotMatch(fs.readdirSync(path.join(root,"supabase/migrations")).join(" "),
    /historical_missed_atomic_rpc/i);
});

test("RPC SQL uses one bounded transaction, locks all changing tables and checks identity/versions",()=>{
  assert.match(sql,/p_apply\s+boolean\s+default\s+false/i);
  assert.match(sql,/\bif\s+p_apply\s*=\s*false\s+then[\s\S]*?\breturn\s+jsonb_build_object/i);
  assert.match(sql,/set\s+lock_timeout\s*=\s*'1s'/i);
  assert.match(sql,/set\s+statement_timeout\s*=\s*'5s'/i);
  for(const name of ["cwl_clans","cwl_stat_wars","cwl_stat_attacks","cwl_stat_missed"])
    assert.match(sql,new RegExp("public\\."+name,"i"));
  assert.match(sql,/lock\s+table\s+public\.cwl_clans,\s*public\.cwl_stat_wars,\s*public\.cwl_stat_attacks,\s*public\.cwl_stat_missed\s+in\s+share\s+row\s+exclusive\s+mode/i);
  assert.match(sql,/v_war\.updated_at\s+is\s+distinct\s+from\s+p_expected_updated_at/i);
  assert.match(sql,/v_war\.roster_tags\s+is\s+distinct\s+from\s+p_expected_roster/i);
  assert.match(sql,/v_attacks\s+is\s+distinct\s+from\s+p_expected_attacks/i);
  assert.match(sql,/v_attack_count\s*<>\s*p_official_attack_counter/i);
  assert.match(sql,/v_existing_missed\s*<>\s*0/i);
  assert.match(sql,/v_offered_missing\s+is\s+distinct\s+from\s+v_expected_missing/i);
  assert.match(sql,/v_unique_attackers\s*<>\s*v_attack_count/i);
  assert.match(sql,/v_unique_missed\s*<>\s*v_missed_count/i);
  assert.match(sql,/v_invalid_attack\s*<>\s*0/i);
  assert.match(sql,/v_invalid_missed\s*<>\s*0/i);
  const insert=sql.indexOf("insert into public.cwl_stat_missed");
  const update=sql.indexOf("update public.cwl_stat_wars");
  assert.ok(insert>0 && update>insert,"Missed rows first; finalized flag last");
  assert.match(sql,/get\s+diagnostics\s+v_changed\s*=\s*row_count/i);
  assert.doesNotMatch(sql,/\bon\s+conflict\s+do\s+nothing\b/i);
});

test("the pure payload always defaults to dry-run, with exact canonical evidence",async()=>{
  const make=await prepare();
  for(const [attacked,misses] of [[15,0],[14,1],[13,2]]){
    const input=await fixture(15,attacked);
    const before=JSON.stringify(input);
    input.storedAttacks.reverse();
    const inputCopy=JSON.stringify(input);
    const result=make(input);
    assert.equal(result.eligible,true);
    assert.equal(result.reason,"verified_rpc_dry_run_only");
    assert.equal(result.rpcArgs.p_apply,false);
    assert.equal(result.rpcArgs.p_clan_id,CLAN);
    assert.equal(result.rpcArgs.p_war_key,"cwl:#2QGL");
    assert.equal(result.rpcArgs.p_expected_clash_tag,"#2PYL");
    assert.equal(result.rpcArgs.p_expected_updated_at,input.storedWar.updated_at);
    assert.deepEqual(result.rpcArgs.p_expected_roster,input.storedWar.roster_tags);
    assert.equal(result.rpcArgs.p_official_attack_counter,attacked);
    assert.equal(result.rpcArgs.p_expected_attacks.length,attacked);
    assert.equal(result.rpcArgs.p_confirmed_missed.length,misses);
    assert.ok(result.rpcArgs.p_confirmed_missed.every(x=>
      Object.keys(x).sort().join(",")==="missed_count,player_name,player_tag"&&
      x.missed_count===1));
    assert.ok(result.rpcArgs.p_expected_attacks.every(x=>
      Object.keys(x).sort().join(",")===
        "attack_order,attacker_tag,attacker_th,defender_tag,defender_th,destruction,stars"));
    assert.deepEqual(result.rpcArgs.p_expected_attacks,
      [...result.rpcArgs.p_expected_attacks].sort((a,b)=>
        (a.attacker_tag<b.attacker_tag?-1:a.attacker_tag>b.attacker_tag?1:0)||
          a.attack_order-b.attack_order));
    assert.equal(JSON.stringify(input),inputCopy,"Input unchanged by pure preparation");
    assert.notEqual(before.length,0);
  }
});

test("large CWL and genuinely zero recorded attacks require official evidence",async()=>{
  const make=await prepare();
  for(const [size,attacked] of [[30,29],[15,0]]){
    const input=await fixture(size,attacked);
    const result=make(input);
    assert.equal(result.eligible,true);
    assert.equal(result.rpcArgs.p_apply,false);
    assert.equal(result.rpcArgs.p_confirmed_missed.length,size-attacked);
    assert.equal(result.rpcArgs.p_official_attack_counter,attacked);
  }
});

test("incomplete or contradictory official evidence cannot produce any write envelope",async()=>{
  const make=await prepare();
  for(const change of [
    x=>{x.officialWar=null},
    x=>{delete x.officialWar.clan.attacks},
    x=>{x.officialWar.clan.attacks=15},
    x=>{x.officialWar.state="inWar"},
    x=>{x.fetchedWarTag="#2PGL"},
    x=>{x.storedAttacks[0].stars=0},
    x=>{x.storedAttacks[0].clan_id="22222222-2222-4222-8222-222222222222"},
    x=>{x.storedWar.source="import"},
    x=>{x.storedWar.missed_log_complete=true},
    x=>{x.storedMissedRows.push({player_tag:tag("2",14),missed_count:1})}
  ]){
    const input=clone(await fixture());change(input);
    const result=make(input);
    assert.equal(result.eligible,false);
    assert.equal(result.rpcArgs,null);
  }
});

test("missing version timestamp is rejected even after official snapshot matches",async()=>{
  const make=await prepare();
  const input=await fixture();
  delete input.storedWar.updated_at;
  const result=make(input);
  assert.equal(result.eligible,false);
  assert.equal(result.reason,"stored_version_missing");
  assert.equal(result.rpcArgs,null);
});
