"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {JSDOM}=require("jsdom");
const read=f=>fs.readFileSync(path.resolve(__dirname,"..",f),"utf8");
const sync=read("cloud-sync.mjs"),live=read("cwl-live.mjs"),html=read("cloud-app.html");

function compareFixture(mode){
 const a=sync.indexOf("const existing=storage.getProfile().members;");
 const b=sync.indexOf("const updated=[...rosterMap.values()]",a);
 assert.ok(a>0&&b>a,"derive classification from real roster comparison");
 const source=sync.slice(a,b)+";({critical,normalDeparted,unusuallyManyDeparted})";
 const members=Array.from({length:10},(_,i)=>({
  id:"player-"+i,name:"CWL-Gast "+i,playerTag:"#2PY"+i,participating:true
 }));
 const rosterMap=new Map([["#2PY0",{tag:"#2PY0"}]]);
 const known=Array.from({length:7},(_,i)=>({day:i+1,lineup:members.map(m=>m.id)}));
 let planningCalled=0;
 const ctx={
  storage:{getProfile:()=>({members}),getPlannedLineups:()=>{
   planningCalled++;return known;
  }},
  rosterMap,live:{getLifecycle:()=>({mode})},
  normalizeTag:x=>String(x||"").trim().toUpperCase()
 };
 const res=vm.runInNewContext(source,ctx);
 return {res,members,planningCalled};
}

test("UF 2 after CWL: departed temporary guests are not flagged as seven future deployments",()=>{
 for(const mode of ["postseason","idle","transition"]){
  const {res,members,planningCalled}=compareFixture(mode);
  assert.equal(res.critical.length,0,"no keep/remove dropdowns after CWL");
  assert.equal(res.normalDeparted.length,9);
  assert.equal(res.unusuallyManyDeparted,true,
   "large roster churn still requires human review; never bulk-remove automatically");
  assert.equal(planningCalled,0,"do not invoke the hypothetical 7-day planner offseason");
  assert.equal(members.every(m=>m.participating),true,"read-only preview never changes historic roster");
 }
});
test("During an actual CWL departing players in scheduled days still require a human decision",()=>{
 const {res,planningCalled}=compareFixture("planning");
 assert.equal(res.critical.length,9);
 assert.equal(res.critical[0].days.length,7);
 assert.equal(res.normalDeparted.length,0);
 assert.equal(planningCalled,1);
});

function recapFixture(){
 const start=live.indexOf("function renderPostseason(){");
 const end=live.indexOf("// One delegated handler",start);
 assert.ok(start>0&&end>start,"use production recap render source");
 const dom=new JSDOM('<main id="view-plan"><details id="planCwlPostseason" hidden open>'+
  '<summary id="planCwlPostseasonSummary">Letzte CWL</summary>'+
  '<div id="planCwlPostseasonContent"></div></details></main>');
 const profile={id:"test"};
 const model={mode:"postseason",season:"2026-11",savedDays:7,
  verifiedAll:true,snapshot:{season:"2026-11",clanTag:"#2PYL",rounds:[]}};
 const ctx={
  document:dom.window.document,context:()=>({active:true,clanId:"clan-a",profile}),
  getLifecycle:()=>model,
  current:{currentWar:{state:"preparation"}},
  confirmedNoCwl:true,
  lastKnownGroup:null,postseasonTabByScope:new Map(),
  onPhaseApplied:()=>{},
  renderInlineCwlPostseason:()=>'<article id="fullCwlResults">CWL-Ergebnisse</article>'
 };
 const render=vm.runInNewContext(live.slice(start,end)+";renderPostseason",ctx);
 const host=dom.window.document.getElementById("planCwlPostseason");
 const summary=dom.window.document.getElementById("planCwlPostseasonSummary");
 return {dom,ctx,model,render,host,summary};
}
test("With no normal CW / in CW preparation the last CWL occupies Plan and cannot be folded into emptiness",()=>{
 const f=recapFixture();
 try{
  assert.equal(f.render(),true);
  assert.equal(f.host.open,true);
  assert.equal(f.summary.hidden,true);
  assert.ok(f.dom.window.document.querySelector("#fullCwlResults"));
  f.host.open=false; // simulate stale user/DOM choice
  f.render();
  assert.equal(f.host.open,true,"no empty page while no active normal CW");
  assert.match(html,/#planCwlPostseason>summary\[hidden\]\{display:none!important\}/);
 }finally{f.dom.window.close()}
});
test("During normal CW battle/finished-war view the prior CWL becomes an optional disclosure",()=>{
 const f=recapFixture();
 try{
  f.render();
  f.ctx.current={currentWar:{state:"inWar"}};
  f.render();
  assert.equal(f.summary.hidden,false);
  assert.equal(f.host.open,false);
  f.host.open=true;f.render();
  assert.equal(f.host.open,true,"manual CWL expansion while war runs is respected");
  f.ctx.current={currentWar:{state:"warEnded"}};
  f.render();
  assert.equal(f.summary.hidden,false);
  f.ctx.current={currentWar:null};
  f.render();
  assert.equal(f.summary.hidden,true);
  assert.equal(f.host.open,true,"when normal CW disappears, show substantive recap");
 }finally{f.dom.window.close()}
});
test("When CWL is idle with no saved postseason, even the pause information cannot vanish",()=>{
 const f=recapFixture();
 try{
  f.ctx.getLifecycle=()=>({mode:"idle"});
  assert.equal(f.render(),true);
  assert.equal(f.host.open,true);
  assert.equal(f.summary.hidden,true);
  f.host.open=false;f.render();
  assert.equal(f.host.open,true);
 }finally{f.dom.window.close()}
});
test("Historical import sits in the visible overview, not behind player statistics",()=>{
 const overview=html.slice(html.indexOf('<section class="card stats-overview-card"'),
    html.indexOf('<section class="card stats-table-card"'));
 const players=html.slice(html.indexOf('<section class="card stats-table-card"'),
    html.indexOf('<section class="card stats-form-card"'));
 assert.match(overview,/id="statsImportEntry"/);
 assert.match(overview,/id="statsImportButton"/);
 assert.match(overview,/id="statsFeedback"/);
 assert.match(overview,/accept="[^"]*\.xlsx[^"]*\.json[^"]*"/);
 assert.match(overview,/Excel-Übernahme ist noch nicht verfügbar/);
 assert.doesNotMatch(players,/id="statsImportButton"/);
 const stats=read("cwl-stats.mjs");
 assert.match(stats,/const canImport=enabled&&\(ctx\.role==="owner"\|\|ctx\.role==="editor"\)/);
 assert.match(stats,/entry\.hidden=!canImport/);
});
