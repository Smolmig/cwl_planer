"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {pathToFileURL}=require("node:url");
const path=require("node:path");
const core=()=>import(pathToFileURL(path.resolve(__dirname,"..","cwl-stats-core.mjs")));

const day=(date,index,prefix="cwl")=>({
  war_key:prefix+":"+date+":"+index,war_type:"cwl",
  started_at:date+"T19:00:00Z",source:"import",team_size:15,
  opponent_name:"Test-Gegner",finalized:true
});
const war=(key,date,war_type="normal")=>({
  war_key:key,war_type,started_at:date+"T18:00:00Z",
  source:"import",team_size:15,finalized:true
});
const atk=(w,tag,stars,a=18,d=18)=>({
  war_key:w.war_key,attacker_tag:tag,attacker_th:a,defender_th:d,
  attacker_name:tag,attack_order:1,stars,destruction:stars===3?100:76
});
const dates=(month,from,count)=>Array.from({length:count},(_,i)=>{
 const d=new Date(month+"-"+String(from).padStart(2,"0")+"T19:00:00Z");
 d.setUTCDate(d.getUTCDate()+i);
 return d.toISOString().slice(0,10);
});

test("June 2026 contains two separate real CWL runs, even with the same calendar month",async()=>{
 const {groupCwlRuns,selectStatWars,computeWarStats}=await core();
 const first=dates("2026-06",4,7).map((date,i)=>day(date,i,"first"));
 const second=dates("2026-06",19,7).map((date,i)=>day(date,i,"second"));
 const wars=[...first,...second];
 const runs=groupCwlRuns(wars);
 assert.equal(runs.length,2,"Two separate seven-day leagues in one calendar month");
 assert.deepEqual(runs.map(r=>[r.from,r.to,r.days]),[
  ["2026-06-19","2026-06-25",7],["2026-06-04","2026-06-10",7]
 ]);
 assert.ok(runs.every(r=>r.season==="2026-06"&&r.inferred));
 const one=selectStatWars(wars,{type:"cwl",cwlSeasons:1});
 assert.equal(one.length,7);
 assert.ok(one.every(w=>w.war_key.startsWith("second:")));
 const two=computeWarStats(wars,[],{type:"cwl",cwlSeasons:2});
 assert.equal(two.totalCwlSeasons,2);
 assert.equal(two.totalCwlDays,14);
 assert.equal(two.wars,14);
 assert.deepEqual(two.cwlSeasonBreakdown.map(x=>[x.from,x.days]),
  [["2026-06-04",7],["2026-06-19",7]]);
});

test("a run across month end stays together; incomplete November remains incomplete",async()=>{
 const {groupCwlRuns,selectStatWars}=await core();
 const crossing=dates("2026-10",29,7).map((date,i)=>day(date,i,"cross"));
 const nov=dates("2026-11",18,2).map((date,i)=>day(date,i,"nov"));
 const runs=groupCwlRuns([...crossing,...nov]);
 assert.equal(runs.length,2);
 assert.deepEqual(runs.map(x=>[x.from,x.to,x.days]),[
  ["2026-11-18","2026-11-19",2],["2026-10-29","2026-11-04",7]
 ]);
 assert.equal(runs[0].inferred,true);
 assert.equal(selectStatWars([...crossing,...nov],{type:"cwl",cwlSeasons:1}).length,2);
 assert.equal(selectStatWars([...crossing,...nov],{type:"cwl",cwlSeasons:"all"}).length,9);
});

test("source-provided run IDs can join a documented run; unrelated explicit groups stay apart",async()=>{
 const {groupCwlRuns}=await core();
 const wars=[day("2026-06-04",1),day("2026-06-09",2),day("2026-06-12",3)].map(w=>({...w,league_run_id:"official-run-1"}));
 const separate={...day("2026-06-13",4),league_run_id:"official-run-2"};
 const runs=groupCwlRuns([...wars,separate]);
 assert.equal(runs.length,2);
 assert.equal(runs[0].id,"league:official-run-2");
 assert.equal(runs[1].days,3);
 assert.equal(runs[1].inferred,false);
});

test("selected CW and CWL attacks are placed in monthly and weekly trend groups with real denominators",async()=>{
 const {computeStatsTimeline}=await core();
 const cw1=war("cw:1","2026-10-26"),cw2=war("cw:2","2026-11-03"),
  cwl1=war("cwl:1","2026-11-04","cwl");
 const wars=[cw1,cw2,cwl1];
 const attacks=[atk(cw1,"#PYL",3),atk(cw1,"#2PYL",2),
  atk(cw2,"#PYL",0),atk(cwl1,"#PYL",3),atk(cwl1,"#2PYL",3)];
 const monthly=computeStatsTimeline(wars,attacks,{granularity:"month"});
 assert.deepEqual(monthly.rows.map(r=>r.key),["2026-10-01","2026-11-01"]);
 assert.equal(monthly.rows[0].normal.attacks,2);
 assert.equal(monthly.rows[0].normal.hitRate,50);
 assert.equal(monthly.rows[0].cwl.attacks,0);
 assert.equal(monthly.rows[0].cwl.hitRate,null);
 assert.equal(monthly.rows[1].normal.hitRate,0);
 assert.equal(monthly.rows[1].cwl.hitRate,100);
 assert.equal(monthly.rows[1].cwl.averageStars,3);
 assert.equal(monthly.recordedAttacks,5);
 const weekly=computeStatsTimeline(wars,attacks,{granularity:"week"});
 assert.deepEqual(weekly.rows.map(r=>r.key),["2026-10-26","2026-11-02"]);
 assert.equal(computeStatsTimeline(wars,attacks,{type:"cwl"}).recordedAttacks,2);
});

test("duels respect exactly the same war window, clan-local attack records and RH comparability",async()=>{
 const {computePlayerDuel}=await core();
 const cw=war("cw:x","2026-10-20"),cwl=war("cwl:y","2026-11-05","cwl");
 const wars=[cw,cwl],a="#PYL",b="#2PYL";
 const attacks=[atk(cw,a,3,18,18),atk(cw,b,0,18,17),
  atk(cwl,a,1,18,18),atk(cwl,b,3,18,18)];
 const same=computePlayerDuel(wars,attacks,a,b);
 assert.equal(same.sameTH,true);
 assert.equal(same.players[0].attacks,2);
 assert.equal(same.players[0].hitRate,50);
 assert.equal(same.players[0].averageStars,2);
 assert.equal(same.players[1].attacks,1);
 assert.equal(same.players[1].hitRate,100);
 assert.equal(same.players[1].normal.attacks,0);
 const mixed=computePlayerDuel(wars,attacks,a,b,{sameTH:false});
 assert.equal(mixed.players[1].attacks,2);
 assert.equal(mixed.players[1].hitRate,50);
 assert.equal(mixed.players[1].normal.hitRate,0);
 const onlyCwl=computePlayerDuel(wars,attacks,a,b,{type:"cwl"});
 assert.equal(onlyCwl.selectedWars,1);
 assert.deepEqual(onlyCwl.players.map(x=>x.attacks),[1,1]);
});
