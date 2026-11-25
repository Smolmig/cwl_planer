"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {JSDOM}=require("jsdom");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const {planCwl}=require("../cwl-planning-core.js");
const {previewCwlRuleChange:preview}=require("../cwl-plan-whatif.js");
const member=(id,{fixed=false,targetDays=null,statuses=[],participating=true}={})=>({
 id,name:"Spieler "+id,participating,fixed,targetDays,
 statuses:Array.from({length:7},(_,i)=>statuses[i]||"auto"),rotationWeight:"balanced"
});
const setup=()=>({
 members:[member("f1",{fixed:true}),member("f2",{fixed:true}),
  member("r1"),member("r2"),member("r3"),member("r4")],
 archivedMembers:[],locks:Array.from({length:7},()=>({locked:false,lineup:[]})),
 slots:5,days:7
});
function freeze(obj){
 if(obj&&typeof obj==="object"&&!Object.isFrozen(obj)){
  Object.freeze(obj);for(const item of Object.values(obj))freeze(item);
 }
 return obj;
}
test("dry-run is identical to production solver and never modifies current plan, locks or members",()=>{
 const input=setup();const baseline=planCwl(input);
 const player=baseline.dayPlans[4].lineup.find(x=>x.startsWith("r"));
 assert.ok(player);
 const old=JSON.stringify(input);
 freeze(input);
 const result=preview({...input,memberId:player,dayIndex:4,nextStatus:"out",solver:planCwl});
 assert.equal(result.ready,true,JSON.stringify(result));
 assert.equal(result.fromStatus,"auto");
 assert.equal(result.toStatus,"out");
 assert.ok(result.changed);
 assert.ok(result.changedDays.some(x=>x.day===5&&x.leaving.includes(player)));
 assert.equal(JSON.stringify(input),old);
 assert.deepEqual(planCwl(input),baseline);
 assert.equal(result.focus.before,baseline.counts[player]);
 assert.equal(result.affected.some(x=>x.id===player),result.focus.after!==result.focus.before,
  "a tactical RAUS may be compensated on another day without changing the total");
 assert.ok(result.changedDays.every(x=>x.day>=1&&x.day<=7));
 assert.ok(result.simulatedOnly);
});
test("locked war cannot be changed, including official started Clash rosters",()=>{
 const input=setup();
 input.locks[0]={locked:true,lineup:["f1","f2","r1","r2","r3"]};
 let calls=0;
 const result=preview({...input,memberId:"r1",dayIndex:0,nextStatus:"out",
  solver:args=>{calls++;return planCwl(args)}});
 assert.equal(result.ready,false);assert.match(result.reason,/fixiert/);
 assert.equal(calls,0,"no solver or write for locked day");
});
test("hard constraints are not overridden when an excluded member leaves too few available seats",()=>{
 const input=setup();input.members=input.members.slice(0,5);
 const result=preview({...input,memberId:"r1",dayIndex:2,nextStatus:"out",solver:planCwl});
 assert.equal(result.ready,false);
 assert.match(result.reason,/nicht vereinbar/);
 assert.match(result.conflicts.join(" "),/Nur 4 von 5/);
 assert.equal(input.members.find(m=>m.id==="r1").statuses[2],"auto");
});
test("exact targets remain hard when a new MUST would exceed a pre-existing target",()=>{
 const input=setup();
 input.members[2].targetDays=1;
 input.members[2].statuses[1]="must";
 const base=planCwl(input);assert.equal(base.ok,true);
 const result=preview({...input,memberId:"r1",dayIndex:3,nextStatus:"must",solver:planCwl});
 assert.equal(result.ready,false);
 assert.match(result.conflicts.join(" "),/überschreiten Ziel 1/);
});
test("five-day CWL, unchanged fixed lineup and empty selected status are not false recommendations",()=>{
 const input=setup();input.days=5;input.members=input.members.slice(0,5);
 input.members[0].statuses[2]="auto";
 const result=preview({...input,memberId:"f1",dayIndex:2,nextStatus:"must",solver:planCwl});
 assert.equal(result.ready,true,JSON.stringify(result));
 assert.equal(result.changed,false);
 assert.equal(result.changedDays.length,0);
 assert.equal(result.fairnessBefore,result.fairnessAfter);
});
test("bad ids, already selected rules and invalid periods fail before calling the solver",()=>{
 let calls=0;const solve=x=>{calls++;return planCwl(x)},input=setup();
 for(const extra of [
  {memberId:"missing",dayIndex:0,nextStatus:"out"},
  {memberId:"r1",dayIndex:9,nextStatus:"out"},
  {memberId:"r1",dayIndex:2,nextStatus:"invalid"},
  {memberId:"r1",dayIndex:2,nextStatus:"auto"}
 ]){
  const result=preview({...input,...extra,solver:solve});
  assert.equal(result.ready,false,result.reason);
 }
 assert.equal(calls,0);
});
test("simulator never fetches statistics, invents opponent data or stores anything",()=>{
 const text=fs.readFileSync(path.join(root,"cwl-plan-whatif.js"),"utf8");
 assert.match(text,/same immutable server-confirmed day locks/);
 assert.doesNotMatch(text,/\bfetch\(|\bsupabase\b|\bsb\.from\(|localStorage\.|\.insert\(|\.upsert\(|\.update\(/i);
 assert.doesNotMatch(text,/hitRate|performanceIndex|winProbability|opponentTh/);
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 assert.match(html,/id="whyWhatIf"/);
 assert.match(html,/id="whyWhatIfRun"/);
 assert.match(html,/src="\.\/cwl-plan-whatif\.js\?v=1\.32\.0"/);
 assert.match(html,/function renderWhyWhatIf\(/);
 assert.match(html,/Es wurde nichts geändert oder gespeichert/);
});
test("real why-day dialog can simulate and display explicit before/after without writes",()=>{
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 const start=html.indexOf("function openWhyModal(day){"),end=html.indexOf("function renderModalList(){",start);
 assert.ok(start>0&&end>start);
 const body=html.slice(start,end);
 const doc=new JSDOM('<div id="whyModal"></div>'+
  '<h3 id="whyTitle"></h3><div id="whyExplanation"></div>'+
  '<div id="whyRoster"></div><details id="whyWhatIf"><summary>Probe</summary></details>'+
  '<select id="whyWhatIfPlayer"></select><select id="whyWhatIfStatus">'+
  '<option value="auto">AUTO</option><option value="must">MUSS</option>'+
  '<option value="out">RAUS</option></select>'+
  '<button id="whyWhatIfRun"></button><div id="whyWhatIfResult"></div>',{
   url:"https://example.test"
  });
 const input=setup(),lastPlan=planCwl(input),original=JSON.stringify(input);
 const context={
  document:doc.window.document,Option:doc.window.Option,
  state:{...input,config:{slots:input.slots,days:input.days}},
  lastPlan,
  window:{CWLPlanningCore:{planCwl},CWLPlanWhatIf:{previewCwlRuleChange:preview}},
  effectiveStatus:(m,d)=>m.statuses[d]||"auto",
  lineupPlayer:id=>input.members.find(m=>m.id===id),
  futureEligibilityCount:()=>6,rotationWeightLabel:()=>"Ausgewogen",
  displayMemberName:m=>m?.name||"Unbekannt",allKnownMembers:()=>input.members,
  confirmedCwlPlanningLocks:()=>input.locks,
  esc:s=>String(s).replace(/[&<>"]/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[x])),
  openModal:()=>{}
 };
 vm.createContext(context);vm.runInContext(body+";globalThis.openWhy=openWhyModal;",context);
 context.openWhy(3);
 const dropdown=doc.window.document.getElementById("whyWhatIfPlayer"),
  status=doc.window.document.getElementById("whyWhatIfStatus"),
  run=doc.window.document.getElementById("whyWhatIfRun"),
  result=doc.window.document.getElementById("whyWhatIfResult");
 dropdown.value=lastPlan.dayPlans[3].lineup.find(x=>x.startsWith("r"));
 dropdown.dispatchEvent(new doc.window.Event("change"));
 assert.equal(status.value,"out");
 run.click();
 assert.match(result.textContent,/geplante Gesamteinsätze/);
 assert.match(result.textContent,/Nur Simulation/);
 assert.match(result.textContent,/Tag 4/);
 assert.equal(JSON.stringify(input),original);
 doc.window.close();
});
test("mobile what-if controls fit 320, 390, 430px and desktop",{
 timeout:120000
},async()=>{
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
  .replace(/<link\b[^>]*>/gi,"");
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1366]){
   const page=await browser.newPage({viewport:{width,height:880}});
   try{
    await page.setContent(html,{waitUntil:"domcontentloaded"});
    const metrics=await page.evaluate(()=>{
     document.getElementById("whyModal").classList.add("open");
     document.getElementById("whyWhatIf").open=true;
     const select=document.getElementById("whyWhatIfPlayer");
     select.add(new Option("Spieler mit extra langem Namen eines Rotationsmitglieds", "a"));
     document.getElementById("whyWhatIfResult").textContent="Tag 3: rein Mitglieder mit langen Namen · raus andere Mitglieder";
     const element=document.querySelector("#whyModal .modalbox"),
       controls=document.querySelector("#whyModal .why-whatif-controls");
     return {docWidth:document.documentElement.scrollWidth,
      modalWidth:element.getBoundingClientRect().width,
      controlWidth:controls.getBoundingClientRect().width};
    });
    assert.ok(metrics.docWidth<=width+3,JSON.stringify({width,metrics}));
    assert.ok(metrics.controlWidth<=metrics.modalWidth+2,JSON.stringify({width,metrics}));
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
