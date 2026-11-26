"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const load=()=>import("../cwl-goldpass-core.mjs");
const own="#2PYL",a="#G9QL",b="#P9QL",enemy="#8PYL";
function round(day,state="warEnded",stars=3,tag=a){
 return {day,available:true,state,warTag:"#2PY"+["0","2","8","9","P","Y","L"][day-1],teamSize:1,
 clan:{tag:own,members:[{tag,name:"Same display name",attacks:stars===null?[]:[{attackerTag:tag,defenderTag:enemy,stars,destructionPercentage:stars===3?100:30}]}]},
 opponent:{tag:"#Q9QL",members:[{tag:enemy}]}};
}
const snapshot=(rounds,warCount=7)=>({season:"2026-11",clanTag:own,warCount,rounds});
test("Identity by tag, rotation, unknown attacks and duplicate rounds never create extra tickets",async()=>{
 const {collectRaffleEvidence,rafflePreview}=await load();
 const e=collectRaffleEvidence(snapshot([round(1,"warEnded",3,a),round(2,"warEnded",null,a),
  round(3,"inWar",null,b),round(4,"inWar",1,b),round(4,"inWar",1,b)]),own);
 assert.equal(e.players.length,2);
 assert.equal(e.players[0].appearances,2);assert.equal(e.players[0].missed,1);
 assert.equal(e.players[1].unknown,1);assert.equal(e.players[1].attacks,1);
 assert.equal(e.complete,false);assert.equal(rafflePreview(e).readyForReview,false);
 assert.equal(collectRaffleEvidence(snapshot([]),enemy),null);
});
test("No minimum: four attacks with three stars remain eligible, seven triples get more weight",async()=>{
 const {rafflePreview}=await load();
 const p=(tag,appearances,attacks,stars,one,two,three)=>({tag,appearances,attacks,stars,one,two,three});
 const e={complete:true,players:[p(a,4,4,3,1,1,0),p(b,7,7,21,0,0,7)]};
 const out=rafflePreview(e);
 assert.deepEqual(out.rows.map(x=>x.tickets),[1,15]);
 assert.equal(out.total,16);assert.equal(out.rows.reduce((s,x)=>s+x.probability,0),1);
 for(const minimum of [3,4]){
  const o=rafflePreview(e,{minimumType:"triples",minimum});
  assert.deepEqual(o.rows.map(x=>x.tickets),[0,15]);
 }
 const weighted=rafflePreview(e,{base:2,one:3,two:5,three:1,perStar:2});
 assert.deepEqual(weighted.rows.map(x=>x.tickets),[16,51]);
 const discord=rafflePreview(e,{requireDiscord:true},{[a]:{discord:true},[b]:{discord:true,organizer:true}});
 assert.deepEqual(discord.rows.map(x=>x.tickets),[1,0]);
 assert.equal(rafflePreview(e,{requireDiscord:true}).readyForReview,false);
 assert.equal(rafflePreview(e,{base:0,three:0}).total,0);
 assert.throws(()=>rafflePreview(e,{base:-1}),/invalid_weights/);
});
test("Five/seven ended rounds require consistent unique rosters and known attacks",async()=>{
 const {collectRaffleEvidence}=await load();
 for(const n of [5,7]){
  const rs=Array.from({length:n},(_,i)=>round(i+1));
  assert.equal(collectRaffleEvidence(snapshot(rs,n),own).complete,true);
  rs[n-1].clan.members[0].attacks[0].defenderTag="#R9QL";
  assert.equal(collectRaffleEvidence(snapshot(rs,n),own).complete,false);
 }
});
test("Test sampling rejects modulo bias and never chooses zero-ticket entries",async()=>{
 const {sampleRaffle}=await load();
 const preview={total:3,rows:[{tag:a,tickets:0},{tag:b,tickets:1},{tag:enemy,tickets:2}]};
 let calls=0;
 const source={getRandomValues(buf){buf[0]=calls++===0?0xffffffff:1;return buf}};
 assert.deepEqual(sampleRaffle(preview,source),{winnerTag:enemy,ticket:1,total:3});
 assert.equal(calls,2);
 assert.throws(()=>sampleRaffle({...preview,total:0},source),/invalid_draw/);
});

test("Balanced presets reward completed hits, respect rotation and scale to five rounds",async()=>{
 const {rafflePreview,RAFFLE_PRESETS}=await load();
 const p=(tag,appearances,attacks,stars,one,two,three)=>({tag,appearances,attacks,stars,one,two,three});
 const players=[p(a,7,7,21,0,0,7),p(b,7,7,20,0,1,6),p(enemy,5,5,15,0,0,5),p("#J9QL",7,4,12,0,0,4),p("#R9QL",7,0,0,0,0,0)];
 const e={complete:true,warCount:7,players};
 assert.deepEqual(rafflePreview(e,RAFFLE_PRESETS.balanced).rows.map(x=>x.tickets),[16,14,10,8,0]);
 assert.deepEqual(rafflePreview(e,RAFFLE_PRESETS.performance).rows.map(x=>x.tickets),[23,20,15,12,0]);
 assert.deepEqual(rafflePreview(e,RAFFLE_PRESETS.participation).rows.map(x=>x.tickets),[21,20,15,12,0]);
 assert.deepEqual(rafflePreview({...e,warCount:5,players:[players[2]]},RAFFLE_PRESETS.balanced).rows.map(x=>x.tickets),[12]);
 assert.throws(()=>rafflePreview(e,{perAttack:-1}),/invalid_weights/);
});
