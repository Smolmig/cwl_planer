"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const core=()=>import(pathToFileURL(path.join(root,"cwl-stats-core.mjs")));
const cw=(key,date,kind="normal")=>({
 war_key:key,war_type:kind,started_at:date+"T12:00:00.000Z",source:"import",
 finalized:true,team_size:15,opponent_name:"Test"
});
const attack=(war_key,stars,attacker_th=18,defender_th=18,tag="#PYL")=>({
 war_key,stars,attacker_th,defender_th,attacker_tag:tag,
 attacker_name:"Testperson",attack_order:1,destruction:stars===3?100:55
});
const asOf=Date.parse("2026-11-06T13:00:00Z");
test("raw all-wars scope and explicit last-N choice give honest counts and never inherit another tab filter",async()=>{
 const {describeWarSelection,selectWarDateScope}=await core();
 const wars=[cw("a","2026-06-01"),cw("b","2026-08-02"),
  cw("c","2026-10-29"),cw("d","2026-11-02","cwl"),
  {...cw("prelim","2026-11-04"),source:"api",finalized:false}];
 const all=describeWarSelection(wars,{last:"all",cwlSeasons:"all"});
 assert.equal(all.selectedWars,4);
 assert.equal(all.allNormal,3);
 assert.equal(all.selectedNormal,3);
 assert.equal(all.allCwl,1);
 const capped=describeWarSelection(wars,{type:"normal",last:1});
 assert.equal(capped.selectedNormal,1);
 assert.equal(capped.allNormal,3);
 assert.deepEqual(capped.selected.map(w=>w.war_key),["c"]);
 const recent=selectWarDateScope(wars,{days:30,asOf});
 assert.deepEqual(recent.map(w=>w.war_key),["c","d"]);
 assert.equal(selectWarDateScope(wars,{type:"cwl",days:"all",asOf}).length,1);
});

test("30/90/180-day player form uses all completed clan wars, not selected ten CWs; sample and excluded RH explicit",async()=>{
 const {computePlayerFormWindows,selectStatWars}=await core();
 const wars=[cw("long","2026-06-15"),cw("middle","2026-09-01"),
  cw("recent","2026-11-01"),cw("low","2026-11-02"),
  cw("unknown","2026-11-03")];
 const attacks=[
  attack("long",3),attack("middle",2),attack("recent",3),
  attack("low",3,18,17),attack("unknown",3,18,null)
 ];
 const capped=selectStatWars(wars,{type:"normal",last:1});
 assert.equal(capped.length,1);
 const form=computePlayerFormWindows(wars,attacks,{asOf,memberTags:["#PYL"]});
 const player=form.players.find(p=>p.tag==="#PYL");
 assert.ok(player);
 assert.equal(player.windows[30].attacks,1);
 assert.equal(player.windows[30].hitRate,100);
 assert.equal(player.windows[30].excludedDifferentRH,1);
 assert.equal(player.windows[30].excludedUnknownRH,1);
 assert.equal(player.windows[90].attacks,2);
 assert.equal(player.windows[90].hitRate,50);
 assert.equal(player.windows[180].attacks,3);
 assert.equal(player.windows[180].hitRate,67);
 assert.equal(player.windows[30].normal,1);
 assert.equal(player.windows[180].quality,"wenige Angriffe");
 const noAttacks=computePlayerFormWindows(wars,[attack("low",0,18,17)],{asOf});
 assert.equal(noAttacks.players[0].windows[30].hitRate,null,
  "No equal-TH evidence is not a zero-percent success rate");
});

test("CW/CWL star distribution is factual and sums to attack counts in matchups and player duels",async()=>{
 const {computeThMatchupComparison,computePlayerDuel}=await core();
 const w=[cw("cw","2026-11-01"),cw("league","2026-11-02","cwl")];
 const attacks=[
  attack("cw",3),attack("cw",0,18,18,"#2PYL"),
  attack("league",1),attack("league",2,18,18,"#2PYL"),
  attack("cw",3,18,17,"#8PYL")
 ];
 const match=computeThMatchupComparison(w,attacks,{last:"all",cwlSeasons:"all"});
 const sameCW=match.find(x=>x.type==="normal"&&x.matchup==="same");
 assert.deepEqual(sameCW.starDistribution,[1,0,0,1]);
 assert.equal(sameCW.attacks,2);
 const duel=computePlayerDuel(w,attacks,"#PYL","#2PYL",
  {last:"all",cwlSeasons:"all",sameTH:true});
 assert.deepEqual(duel.players[0].starDistribution,[0,1,0,1]);
 assert.deepEqual(duel.players[1].starDistribution,[1,0,1,0]);
 assert.equal(duel.players[0].starDistribution.reduce((a,b)=>a+b,0),
  duel.players[0].attacks);
});

test("weekly timeline gives more detail than monthly and allows daily CWL points",async()=>{
 const {computeStatsTimeline}=await core();
 const w=[cw("a","2026-10-05"),cw("b","2026-10-15"),cw("c","2026-10-27"),
   cw("d","2026-11-03","cwl")];
 const attacks=[attack("a",3),attack("b",2),attack("c",1),attack("d",3)];
 const monthly=computeStatsTimeline(w,attacks,{last:"all",granularity:"month"});
 const weekly=computeStatsTimeline(w,attacks,{last:"all",granularity:"week"});
 const daily=computeStatsTimeline(w,attacks,{last:"all",granularity:"day"});
 assert.equal(monthly.rows.length,2);
 assert.equal(weekly.rows.length,4);
 assert.equal(daily.rows.length,4);
 assert.equal(daily.granularity,"day");
 assert.equal(weekly.recordedAttacks,4);
});
