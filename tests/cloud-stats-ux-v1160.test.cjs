"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const ui=fs.readFileSync(path.join(root,"cwl-stats.mjs"),"utf8");
const core=()=>import(pathToFileURL(path.join(root,"cwl-stats-core.mjs")));
const war=(key,kind)=>({war_key:key,war_type:kind,started_at:"2026-11-02T10:00:00Z",source:"import",finalized:true,team_size:15});

test("star distributions show accurate 0/1/2/3 distribution by CW and CWL, not fabricated misses",async()=>{
 const {computeStarDistribution}=await core();
 const wars=[war("a","normal"),war("b","cwl"),war("c","normal")];
 const attacks=[
  {war_key:"a",stars:0},{war_key:"a",stars:2},{war_key:"a",stars:3},
  {war_key:"b",stars:3},{war_key:"b",stars:3},{war_key:"b",stars:1},
  {war_key:"c",stars:3},{war_key:"c",stars:5},
  {war_key:"unselected",stars:0}
 ];
 const d=computeStarDistribution(wars,attacks);
 assert.deepEqual(d.map(x=>x.total),[4,3]);
 assert.deepEqual(d[0].counts,[1,0,1,2]);
 assert.deepEqual(d[1].counts,[0,1,0,2]);
 assert.deepEqual(d[0].shares,[25,0,25,50]);
 const onlyCwl=computeStarDistribution(wars,attacks,{type:"cwl"});
 assert.equal(onlyCwl[0].total,0);
 assert.equal(onlyCwl[1].total,3);
});

test("the fixed 14/30/90-day form has no reference to manually selected wars",()=>{
 assert.match(html,/data-stats-panel="form"/);
 assert.match(html,/id="statsFormRows"/);
 assert.match(html,/stats-percent-track/);
 assert.match(html,/id="statsContextFilter"/);
 assert.match(html,/data-stats-section="form"/);
 assert.match(ui,/inputWars=wars\.filter\(w=>formType==="all"/);
 assert.match(ui,/computeComparableForm\(inputWars,attacks,options\[days\]\)/);
 assert.doesNotMatch(ui,/computeComparableForm\(selection,attacks\)/);
 assert.doesNotMatch(ui,/90-Tage-Trend \$\{form/);
 assert.doesNotMatch(html,/Letzte 50 CWs/);
 assert.match(ui,/\(alle vorhandenen\)/);
 assert.match(ui,/periodBySection/);
 assert.match(ui,/trendGranularity="week"/);
 assert.match(html,/CWL = gestrichelte Linie/);
 assert.match(html,/stats-matchup-track/);
 assert.match(html,/stats-duel-track/);
 assert.match(html,/statsStarDistribution/);
 assert.match(html,/stats-star-stack/);
});
