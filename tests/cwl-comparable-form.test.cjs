"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const core=()=>import(pathToFileURL(path.join(root,"cwl-comparable-form.mjs")).href);
const TIME="2026-11-05T12:00:00.000Z";
const w=(key,type,date,extra={})=>({war_key:key,war_type:type,
 started_at:date,source:"import",finalized:false,...extra});
const a=(war,who,stars,attTh=18,defTh=18,extra={})=>({
 war_key:war,attacker_tag:who,attacker_name:"Spieler "+who,
 attacker_th:attTh,defender_th:defTh,stars,...extra
});

test("30-day form only uses completed same-town-hall CW and CWL attacks",async()=>{
 const {computeComparableForm}=await core();
 const wars=[
  w("r1","normal","2026-11-01T12:00:00Z"),
  w("r2","cwl","2026-10-25T12:00:00Z"),
  w("r3","normal","2026-10-20T12:00:00Z"),
  w("r4","normal","2026-10-19T12:00:00Z"),
  w("r5","normal","2026-10-18T12:00:00Z"),
  w("r6","normal","2026-10-17T12:00:00Z"),
  w("api-working","cwl","2026-11-03T12:00:00Z",{source:"api",finalized:false}),
  w("older","normal","2026-07-04T12:00:00Z"),
  w("future","cwl","2026-11-08T12:00:00Z")
 ];
 const hits=[
  a("r1","#2PYL",3),
  a("r2","#2PYL",2),
  a("r3","#2PYL",3,18,17),
  a("r4","#2PYL",3,18,19),
  a("r5","#2PYL",1,18,null),
  a("r6","#2PYL",3),
  a("api-working","#2PYL",3),
  a("older","#2PYL",3),
  a("future","#2PYL",3)
 ];
 const before=JSON.stringify({wars,hits});
 const result=computeComparableForm(wars,hits,{asOf:TIME});
 const p=result.profiles.get("#2PYL");
 assert.equal(p.last30.attacks,3);
 assert.equal(p.last30.hitRate,67);
 assert.equal(p.last30.averageStars,2.67);
 assert.equal(p.cwl90.attacks,1);
 assert.equal(p.normal90.attacks,2);
 assert.deepEqual(p.excluded,{lower:1,higher:1,unknown:1});
 assert.equal(result.summary.comparableAttacks,3);
 assert.equal(result.summary.lowerThExcluded,1);
 assert.equal(result.summary.higherThExcluded,1);
 assert.equal(result.summary.unknownThExcluded,1);
 assert.equal(JSON.stringify({wars,hits}),before,"No history edits");
 assert.equal(p.mirrorKnown,false);
 assert.equal(p.firstHitKnown,false);
});

test("Older 90-day data is a labelled weighted baseline, not part of 30-day form",async()=>{
 const {computeComparableForm}=await core();
 const wars=[w("r1","normal","2026-11-04T12:00:00Z"),
  w("r2","cwl","2026-09-17T12:00:00Z")];
 const hits=[a("r1","#2PYL",3),a("r2","#2PYL",0)];
 const p=computeComparableForm(wars,hits,{asOf:TIME}).profiles.get("#2PYL");
 assert.equal(p.last30.attacks,1);
 assert.equal(p.last30.hitRate,100);
 assert.equal(p.last90.attacks,2);
 assert.equal(p.last90.hitRate,50);
 assert.ok(p.weighted90.hitRate>50);
 assert.ok(p.weighted90.hitRate<100);
 assert.ok(p.weighted90.effectiveAttacks<2);
 assert.equal(p.quality,"limited","One fresh hit never qualifies as reliable form");
});

test("Exactly 30 and 90 day boundaries are inclusive and future wars excluded",async()=>{
 const {computeComparableForm}=await core();
 const d=days=>new Date(Date.parse(TIME)-days*86400000).toISOString();
 const wars=[w("at30","cwl",d(30)),w("at90","normal",d(90)),
  w("at91","normal",d(91)),w("future","normal",d(-1))];
 const hits=wars.map(war=>a(war.war_key,"#2PYL",2));
 const p=computeComparableForm(wars,hits,{asOf:TIME}).profiles.get("#2PYL");
 assert.equal(p.last30.attacks,1);
 assert.equal(p.last90.attacks,2);
 assert.equal(p.quality,"limited");
});

test("Missing or non-comparable data never creates fake strength, even with many easy bases",async()=>{
 const {computeComparableForm}=await core();
 const wars=[w("easy","normal","2026-11-01T12:00:00Z")];
 const attacks=Array.from({length:10},(_,i)=>a("easy","#2PYL",3,18,17));
 const p=computeComparableForm(wars,attacks,{asOf:TIME}).profiles.get("#2PYL");
 assert.equal(p.last30.attacks,0);
 assert.equal(p.weighted90.hitRate,null);
 assert.equal(p.quality,"none");
 assert.equal(p.excluded.lower,10);
});

test("Different player tags are never collapsed even when display names coincide",async()=>{
 const {computeComparableForm}=await core();
 const wars=[w("r1","normal","2026-11-01T12:00:00Z")];
 const attacks=[a("r1","#2PYL",2),a("r1","#8PY",3)];
 const r=computeComparableForm(wars,attacks,{asOf:TIME});
 assert.equal(r.profiles.has("#2PYL"),true);
 assert.equal(r.profiles.has("#8PY"),true);
 assert.equal(r.profiles.size,2);
});

test("Long history and recency only change evidence level, no invented success probability",async()=>{
 const {computeComparableForm}=await core();
 const wars=Array.from({length:16},(_,i)=>w("w"+i,"normal",new Date(Date.parse(TIME)-(i+1)*86400000).toISOString()));
 const attacks=wars.map((war,i)=>a(war.war_key,"#2PYL",i<10?3:2));
 const p=computeComparableForm(wars,attacks,{asOf:TIME}).profiles.get("#2PYL");
 assert.equal(p.quality,"solid");
 assert.ok(p.weighted90.effectiveAttacks>=12);
 assert.equal(p.last30.attacks,16);
 assert.equal(p.last30.hitRate,63);
 assert.equal("predictedTripleChance" in p,false);
});

test("Malformed model parameters are rejected rather than silently producing NaN",async()=>{
 const {computeComparableForm}=await core();
 for(const options of [{asOf:"invalid"},{windowDays:-1},{recentDays:91},{halfLifeDays:0}]){
  assert.throws(()=>computeComparableForm([],[],options),/Ungültiger Zeitraum/);
 }
});

test("App keeps old 7-hit member badges and solver unchanged while exposing comparable statistics",()=>{
 const ui=fs.readFileSync(path.join(root,"cwl-stats.mjs"),"utf8");
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 const solver=fs.readFileSync(path.join(root,"cwl-planning-core.js"),"utf8");
 assert.match(ui,/computeRecentAttackStats\(wars,attacks,7\)/);
 assert.match(ui,/computeComparableForm\(wars,attacks\)/);
 assert.match(ui,/getComparablePlayerStats/);
 assert.match(html,/statsFormDetails/);
 assert.match(html,/statsFormRows/);
 assert.match(ui,/Mirror-Position/);
 assert.match(html,/const DATA_VERSION=9/);
 assert.ok(solver.length>100);
});

test("Import UI counts missed attacks, not only database rows",()=>{
 const ui=fs.readFileSync(path.join(root,"cwl-stats.mjs"),"utf8");
 assert.match(ui,/parsed\.missed\.reduce\(\(sum,row\)=>sum\+row\.missed_count,0\)/);
 assert.match(ui,/dokumentierte verpasste Angriffe in/);
});
