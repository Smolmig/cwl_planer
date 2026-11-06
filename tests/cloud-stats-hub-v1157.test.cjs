"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const script=fs.readFileSync(path.join(root,"cwl-stats.mjs"),"utf8");

const war=(war_key,war_type,started_at)=>({
 war_key,war_type,started_at,source:"import",finalized:true,team_size:15
});
const attack=(war_key,attacker_th,defender_th,stars)=>({war_key,attacker_th,defender_th,stars});

test("relative RH comparison counts CW and CWL separately, including missing RH",async()=>{
 const {computeThMatchupComparison}=await import(pathToFileURL(path.join(root,"cwl-stats-core.mjs")));
 const wars=[
  war("w1","normal","2026-08-01T10:00:00Z"),
  war("w2","normal","2026-08-05T10:00:00Z"),
  war("l1","cwl","2026-08-06T10:00:00Z")
 ];
 const attacks=[
  attack("w1",18,17,3),attack("w1",18,18,2),
  attack("w2",18,19,3),attack("w2",18,null,0),
  attack("l1",18,18,3),attack("l1",18,18,3),attack("l1",17,18,2)
 ];
 const all=computeThMatchupComparison(wars,attacks,{cwlSeasons:"all"});
 const get=(kind,matchup)=>all.find(g=>g.type===kind&&g.matchup===matchup);
 assert.equal(all.length,8);
 assert.deepEqual(
  ["lower","same","higher","unknown"].map(k=>get("normal",k).attacks),
  [1,1,1,1]
 );
 assert.equal(get("normal","lower").hitRate,100);
 assert.equal(get("normal","same").hitRate,0);
 assert.equal(get("normal","unknown").hitRate,0);
 assert.equal(get("cwl","same").attacks,2);
 assert.equal(get("cwl","same").hitRate,100);
 assert.equal(get("cwl","same").averageStars,3);
 assert.equal(get("cwl","higher").hitRate,0);
 assert.equal(get("cwl","lower").hitRate,null);
 const onlyCwl=computeThMatchupComparison(wars,attacks,{type:"cwl",cwlSeasons:"all"});
 assert.equal(onlyCwl.filter(g=>g.type==="normal").reduce((n,g)=>n+g.attacks,0),0);
 assert.equal(onlyCwl.filter(g=>g.type==="cwl").reduce((n,g)=>n+g.attacks,0),3);
 const recentNormal=computeThMatchupComparison(wars,attacks,{type:"normal",last:1});
 assert.equal(recentNormal.filter(g=>g.type==="normal").reduce((n,g)=>n+g.attacks,0),2);
});

test("form, list position and selected wars are explicitly separate from the seven recent member attacks",()=>{
 assert.match(script,/cwlSeasons="all"/);
 assert.match(script,/Diese Tabelle berücksichtigt ausschließlich /);
 assert.match(script,/formWindow\+" Kalendertage/);
 assert.doesNotMatch(script,/Letzte 10 Kriege = zehn jüngste ausgewählte Kriege/);
 assert.match(script,/Listenposition /);
 assert.match(html,/Alle gespeicherten CWL-Durchgänge/);
 assert.match(html,/data-stats-section="overview"/);
 for(const section of ["players","form","compare","history"])
  assert.match(html,new RegExp('data-stats-panel="'+section+'"'));
 assert.match(html,/statsMatchupComparison/);
 assert.match(html,/Nr\. · Spieler/);
 assert.match(html,/Nur für Spielerstatistik|Kriege für Auswertung/);
 assert.doesNotMatch(html,/50 CWs \+ 3 CWLs/);
});

test("deployment overview labels availability and counted assignments, not unknown manual three-star strength",()=>{
 const render=html.slice(html.indexOf("function renderSummary(){"),html.indexOf("function renderArchives",html.indexOf("function renderSummary(){")));
 assert.match(render,/Tage ohne RAUS/);
 assert.match(render,/Gespielt \$\{x\.played\}/);
 assert.match(render,/Geplant \$\{Math\.max/);
 assert.match(render,/\$\{x\.count\} gesamt/);
 assert.doesNotMatch(render,/STRENGTH_SHORT/);
 assert.match(html,/Grün = bereits gespielt/);
 assert.match(html,/Gold = noch geplant/);
 assert.match(html,/Grau = kein Einsatz/);
});
