"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const mod=import("../cwl-strategic-presentation.mjs"),at=Date.UTC(2026,10,26),season="2026-11",own="#P02";
const members=[{id:"a",name:"Spieler A",townHall:19},{id:"b",name:"Spieler B",townHall:19}];
test("roster presentation puts review first, separates null from zero and uses current names",async()=>{
 const {presentRosterRows}=await mod;
 const scenario={plan:{ok:true,evidence:{profiles:[{id:"a",n:10},{id:"b",n:0}]},rows:[{id:"a",participation:"confirmed",standardAppearances:2,scenarioAppearances:3},{id:"b",participation:"unknown",standardAppearances:null,scenarioAppearances:0,recommendation:"manual_review"}]}};
 const input={scenario,members,filter:"review"},before=JSON.stringify(input),p=presentRosterRows(input);
 assert.equal(p.rows[0].id,"b");assert.equal(p.shown.length,1);assert.equal(p.shown[0].standard,null);assert.equal(p.shown[0].proposed,0);assert.equal(p.shown[0].reason,"Teilnahme offen");assert.equal(JSON.stringify(input),before);
});
function input(role="owner"){
 const scope={season,selectedClanTag:own,asOf:at,observedAt:at};
 return {members,role,asOf:at,season,selectedClanTag:own,group:scope,standings:{...scope,quality:"schedule_known",invalid:0,confirmedRank:5,confirmedRankWorst:5,bounds:{best:2,worst:6},demotion:"open",teams:Array.from({length:6},()=>({completed:2}))},
 preview:{ok:true,season,selectedClanTag:own,asOf:at,observedAt:at,role,canApply:false,medalCoverageComplete:false,players:[{id:"a",observedStarsLowerBound:4,confirmedPreparationAppearances:1,medalStatus:"unknown"},{id:"b",observedStarsLowerBound:0,confirmedPreparationAppearances:0,medalStatus:"unknown"}],
 modeRecommendation:{requiresOwnerConfirmation:true,reason:"observed_relegation_zone_and_better_comparable_plan",medalOpportunitiesBefore:null,medalOpportunitiesAfter:null},alternate:{changes:[{day:3,removed:["a"],added:["b"]}]}}};
}
test("daily presentation renders actual values, partial medal evidence and no viewer action",async()=>{
 const {presentDailyStrategy}=await mod,s=input("viewer"),x=presentDailyStrategy(s);
 assert.match(x.tableStatus,/Platz 5 \/ 6/);assert.match(x.tableStatus,/Klassenerhalt offen/);assert.match(x.dataStatus,/Sternedaten unvollständig/);
 assert.match(presentDailyStrategy({...s,standings:{...s.standings,confirmedRankWorst:6}}).tableStatus,/Platz 5–6 \/ 6/);
 assert.equal(x.medals[0].stars,"Mind. 4 ★");assert.equal(x.medals[1].stars,"Unbekannt");assert.equal(x.recommendation.canDismiss,false);assert.deepEqual(x.recommendation.changes[0].added,["Spieler B"]);
 const partial={...s,standings:{...s.standings,quality:"partial",demotion:"unknown_rules"}};
 assert.match(presentDailyStrategy(partial).tableStatus,/Bestätigter Platz nicht verfügbar.*Abstiegsregeln nicht bestätigt/);
});
test("presentation scope mismatch rejects stale/foreign data and unsafe apply",async()=>{
 const {presentDailyStrategy}=await mod,s=input();
 assert.throws(()=>presentDailyStrategy({...s,group:{...s.group,selectedClanTag:"#P08"}}),/invalid_daily_presentation_scope/);
 assert.throws(()=>presentDailyStrategy({...s,standings:{...s.standings,observedAt:at-1}}),/invalid_daily_presentation_scope/);
 assert.throws(()=>presentDailyStrategy({...s,preview:{...s.preview,selectedClanTag:"#P08"}}),/invalid_daily_presentation_scope/);
 assert.throws(()=>presentDailyStrategy({...s,preview:{...s.preview,canApply:true}}),/invalid_daily_presentation_scope/);
});
