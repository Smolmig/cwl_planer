"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const start=html.indexOf("function buildFullPlanText(){");
const end=html.indexOf("async function copyText(",start);
function build(apiLinked){
 assert.ok(start>=0&&end>start,"full plan formatter exists");
 const members={a:{name:"Alpha"},b:{name:"Bravo"},c:{name:"Charlie"}};
 const run=vm.runInNewContext(html.slice(start,end)+";buildFullPlanText",{
  state:{name:"United Fighters",config:{slots:2},locks:[{locked:true},{}]},
  lastPlan:{dayPlans:[
   {day:1,locked:true,lineup:["a","b"],rein:[],raus:[]},
   {day:2,locked:false,lineup:["b","c"],rein:["c"],raus:["a"]}
  ]},
  window:{CWLCloud:{active:apiLinked,hasApiClan:()=>apiLinked}},
  lineupPlayer:id=>members[id],
  sortIdsByMemberOrder:ids=>ids,
  displayMemberName:m=>m?.name||"Unbekannt"
 });
 return run();
}
test("full-plan export remains separate, legible and contains each day only once",()=>{
 const result=build(true);
 assert.match(html,/id="copyFullPlanBtn">Gesamtplan kopieren/);
 assert.match(result,/CWL-Gesamtplan · United Fighters/);
 assert.match(result,/2 Kriegstage · 2 Spieler pro Krieg/);
 assert.match(result,/Tag 1 · Gespielt · 2\/2 Spieler/);
 assert.match(result,/Tag 2 · Geplant · 2\/2 Spieler/);
 assert.match(result,/01\. Alpha\n02\. Bravo/);
 assert.match(result,/01\. Bravo\n02\. Charlie/);
 assert.equal((result.match(/Hinweis:/g)||[]).length,1,"one clear Clash caveat, not every day");
 assert.doesNotMatch(result,/@Charlie|3★|Hitrate/);
});
test("offline full-plan export keeps explicitly planned day-to-day transitions",()=>{
 const result=build(false);
 assert.match(result,/Wechsel zum Vortag: Raus Alpha · Rein Charlie/);
 assert.doesNotMatch(result,/Hinweis: Änderungen in Clash/);
});
