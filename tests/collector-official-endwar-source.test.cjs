"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const dir=path.resolve(__dirname,"../supabase/functions/coc-stats-collector");
const load=async name=>import(pathToFileURL(path.join(dir,name)).href);
const CLAN_ID="11111111-1111-4111-8111-111111111111";
const SECOND_ID="22222222-2222-4222-8222-222222222222";
const GAME_KEY="fixture-server-test-key-123456";
const NOW=Date.parse("2026-11-08T01:00:00.000Z");
const copy=value=>JSON.parse(JSON.stringify(value));
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{
  status,headers:{"content-type":"application/json",...headers}
});

async function fixture(attacked=2,id=CLAN_ID){
  const members=[
    {tag:"#2PYL",name:"Alice",townhallLevel:18},
    {tag:"#2PQL",name:"Bob",townhallLevel:18},
    {tag:"#2PRL",name:"Carol",townhallLevel:18}
  ];
  for(let i=0;i<attacked;i++){
    members[i].attacks=[{
      attackerTag:members[i].tag,
      defenderTag:["#QPYL","#QPRL","#QPRQ"][i],
      stars:3,destructionPercentage:100
    }];
  }
  const war={
    state:"warEnded",teamSize:3,
    startTime:"20261105T190000.000Z",endTime:"20261106T190000.000Z",
    clan:{tag:"#2PYL",attacks:attacked,members},
    opponent:{tag:"#QPYL",members:[
      {tag:"#QPYL",townhallLevel:18,name:"D"},
      {tag:"#QPRL",townhallLevel:18,name:"E"},
      {tag:"#QPRQ",townhallLevel:18,name:"F"}
    ]}
  };
  const group={state:"ended",clans:[{tag:"#2PYL"},{tag:"#QPYL"}],
    rounds:[{warTags:["#2QGL","#0"]}]};
  const source=(await load("collector-core.mjs")).buildWarSnapshot(
    war,"#2PYL",{warType:"cwl",warTag:"#2QGL",now:NOW}
  );
  assert.equal(source.war.missed_log_complete,true);
  const input={
    linkedClan:{id,clash_tag:"#2PYL"},
    storedWar:{...source.war,clan_id:id,missed_log_complete:false,
      updated_at:"2026-11-07T20:00:00.000Z"},
    storedAttacks:source.attacks.map(a=>({...a,clan_id:id})),
    storedMissedRows:[],gameKey:GAME_KEY,now:NOW
  };
  return {input,war,group};
}
function mockFetch(group,war){
  const calls=[];
  const fn=async(url,options)=>{
    calls.push({url,options});
    if(url.includes("leaguegroup"))return json(group);
    if(url.includes("/wars/"))return json(war);
    throw Error("unexpected endpoint");
  };
  return {fn,calls};
}
const read=async x=>(await load("collector-reconciliation-source.mjs"))
  .prepareHistoricalCwlFromServerSource(x);
function assertNoProposal(result,reason){
  assert.equal(result.eligible,false);
  assert.equal(result.reason,reason);
  assert.equal(result.rpcArgs,null);
}

test("server fetches exactly the linked clan's official group and independently listed war",async()=>{
  const {input,war,group}=await fixture(2);
  const {fn,calls}=mockFetch(group,war);
  const original=JSON.stringify(input);
  const result=await read({...input,fetchImpl:fn});
  assert.equal(result.eligible,true);
  assert.equal(result.rpcArgs.p_apply,false);
  assert.equal(result.rpcArgs.p_clan_id,CLAN_ID);
  assert.equal(result.rpcArgs.p_official_attack_counter,2);
  assert.deepEqual(result.rpcArgs.p_confirmed_missed.map(x=>x.player_tag),
    ["#2PRL"]);
  assert.equal(calls.length,2);
  assert.deepEqual(calls.map(x=>x.url),[
    "https://cocproxy.royaleapi.dev/v1/clans/%232PYL/currentwar/leaguegroup",
    "https://cocproxy.royaleapi.dev/v1/clanwarleagues/wars/%232QGL"
  ]);
  for(const c of calls){
    assert.equal(c.options.method,"GET");
    assert.equal(c.options.redirect,"error");
    assert.equal(c.options.cache,"no-store");
    assert.equal(c.options.headers.Authorization,"Bearer "+GAME_KEY);
    assert.equal(c.options.headers.Accept,"application/json");
    assert.ok(c.options.signal);
  }
  assert.equal(JSON.stringify(input),original,"No mutation of inputs");
});
test("a verified official 3/3 supports zero misses, missing official counter does not",async()=>{
  const f=await fixture(3),{fn}=mockFetch(f.group,f.war);
  const success=await read({...f.input,fetchImpl:fn});
  assert.equal(success.eligible,true);
  assert.equal(success.rpcArgs.p_official_attack_counter,3);
  assert.deepEqual(success.rpcArgs.p_confirmed_missed,[]);
  delete f.war.clan.attacks;
  const {fn:missing}=mockFetch(f.group,f.war);
  const result=await read({...f.input,fetchImpl:missing});
  assertNoProposal(result,"official_attack_counter_unverified");
});
test("no valid stored tenant candidate ever causes an outgoing request",async()=>{
  const f=await fixture(2);
  for(const modify of [
    x=>{x.storedWar.source="import"},
    x=>{x.storedWar.finalized=false},
    x=>{x.storedWar.war_key="normal:not-a-league-war"},
    x=>{x.storedWar.war_key=32},
    x=>{x.storedWar.missed_log_complete=true},
    x=>{x.storedMissedRows=[{missed_count:1}]},
    x=>{x.linkedClan.id=SECOND_ID},
    x=>{x.storedAttacks[0].clan_id=SECOND_ID},
    x=>{x.gameKey="bad"}
  ]){
    const input=copy(f.input);modify(input);
    let calls=0;
    const result=await read({...input,fetchImpl:()=>{calls++;throw Error("must not call")}});
    assertNoProposal(result,result.reason);
    assert.equal(calls,0);
  }
});
test("the separately fetched leaguegroup must confirm the real stored war tag exactly once",async()=>{
  const f=await fixture(2);
  for(const modify of [
    g=>{g.clans=[{tag:"#QPYL"},{tag:"#QPRL"}]},
    g=>{g.rounds[0].warTags=["#2PGL","#0"]},
    g=>{g.rounds[0].warTags=["#2QGL","#2QGL"]},
    g=>{g.rounds[0].warTags=["#2QGL","#BAD!"]},
    g=>{g.clans.push({tag:"#2PYL"})},
    g=>{g.rounds=Array.from({length:8},()=>({warTags:[]}))}
  ]){
    const group=copy(f.group);modify(group);
    const {fn,calls}=mockFetch(group,f.war);
    assertNoProposal(await read({...f.input,fetchImpl:fn}),
      "official_leaguegroup_cannot_confirm_war");
    assert.equal(calls.length,1,"Do not fetch a war without independently matched leaguegroup");
  }
});
test("ended-war identity or attacks that disagree with the saved evidence are never approved",async()=>{
  const f=await fixture(2);
  for(const modify of [
    w=>{w.state="inWar"},
    w=>{w.clan.tag="#2Q2L"},
    w=>{w.clan.attacks=3},
    w=>{w.clan.members[0].attacks[0].stars=1},
    w=>{w.opponent.members.pop()},
    w=>{w.startTime="20261103T190000.000Z"}
  ]){
    const war=copy(f.war);modify(war);
    const {fn}=mockFetch(f.group,war);
    const result=await read({...f.input,fetchImpl:fn});
    assert.equal(result.eligible,false);
    assert.equal(result.rpcArgs,null);
  }
});
test("upstream failures return only safe reason codes and never leak API error bodies",async()=>{
  const f=await fixture(2);
  const fake=(res)=>async()=>res;
  for(const [status,reason] of [
    [404,"official_source_not_found"],
    [403,"official_source_forbidden"],
    [429,"official_source_rate_limited"],
    [503,"official_source_unavailable"]
  ]){
    const result=await read({...f.input,fetchImpl:fake(json({
      message:"private-key-or-player-details-DO-NOT-LEAK"
    },status))});
    assertNoProposal(result,reason);
    assert.doesNotMatch(JSON.stringify(result),/private-key|player-details/);
  }
  assertNoProposal(await read({...f.input,fetchImpl:async()=>{throw Error("SECRET")} }),
    "official_source_unavailable");
  const badType=await read({...f.input,fetchImpl:async()=>new Response(
    "<html>secret</html>",{headers:{"content-type":"text/html"}})});
  assertNoProposal(badType,"official_response_invalid");
  const huge=await read({...f.input,fetchImpl:async()=>new Response("{}",
    {headers:{"content-type":"application/json","content-length":"9999999"}})});
  assertNoProposal(huge,"official_response_invalid");
  // Chunked/incorrect Content-Length must not bypass the 1 MiB limit.
  const chunked=await read({...f.input,fetchImpl:async()=>new Response(
    JSON.stringify({padding:"X".repeat(1024*1024)}),
    {headers:{"content-type":"application/json"}})});
  assertNoProposal(chunked,"official_response_invalid");
});
test("the same Clash war still yields strictly distinct payloads for two app clans",async()=>{
  const first=await fixture(2,CLAN_ID),second=await fixture(2,SECOND_ID);
  const a=mockFetch(first.group,first.war),b=mockFetch(second.group,second.war);
  const r1=await read({...first.input,fetchImpl:a.fn});
  const r2=await read({...second.input,fetchImpl:b.fn});
  assert.equal(r1.eligible,true);
  assert.equal(r2.eligible,true);
  assert.equal(r1.rpcArgs.p_clan_id,CLAN_ID);
  assert.equal(r2.rpcArgs.p_clan_id,SECOND_ID);
  assert.notEqual(r1.rpcArgs.p_clan_id,r2.rpcArgs.p_clan_id);
});
test("privileged source reader stays disconnected from the production collector and browsers",()=>{
  const contents=fs.readFileSync(path.join(dir,"collector-reconciliation-source.mjs"),"utf8");
  const edge=fs.readFileSync(path.join(dir,"index.ts"),"utf8");
  assert.doesNotMatch(edge,/collector-reconciliation-source\.mjs/);
  assert.doesNotMatch(contents,/\bDeno\.env\b|\bconsole\.|\bupsert\(|\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
  assert.doesNotMatch(contents,/supabase\.co\/rest\/v1|\.rpc\(/i);
  assert.match(contents,/const GAME="https:\/\/cocproxy\.royaleapi\.dev\/v1"/);
  assert.doesNotMatch(contents,/baseUrl|userProvidedUrl/);
});
