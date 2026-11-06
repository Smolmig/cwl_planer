"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const importCore=()=>import(pathToFileURL(path.join(root,"cwl-medal-goals.mjs")).href);
const page=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const live=fs.readFileSync(path.join(root,"cwl-live.mjs"),"utf8");
const staticHtml=page.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
const member=(id,extra={})=>({id,name:id,playerTag:"#"+id,participating:true,
 fixed:false,targetDays:null,statuses:Array(7).fill("auto"),...extra});
const attack=(id,stars,defender)=>({attackerTag:"#"+id,defenderTag:"#"+defender,stars,destructionPercentage:stars===3?100:stars===2?70:49});
const war=(day,attackRows,state="warEnded")=>({
 day,available:true,teamSize:2,state,
 clan:{members:["A","B"].map(id=>({tag:"#"+id,name:id,
  attacks:(attackRows[id]||[]).map(a=>attack(id,...a))}))}
});
const base=()=>({
 snapshot:{season:"2026-11",rounds:[
  war(1,{A:[[3,"X"],],B:[[2,"Y"]]}),
  war(2,{A:[[3,"X"]],B:[[2,"Y"]]}),
  war(3,{A:[[2,"X"]],B:[[2,"Y"]]}),
  war(4,{},"preparation")
 ]},
 profile:{config:{days:4,slots:2},members:[member("A"),member("B"),member("C")],archivedMembers:[]},
 dayPlans:[1,2,3].map(day=>({day,lineup:["A","B"],locked:true})).concat([{day:4,lineup:["A","C"],locked:false,warnings:[]}])
});

test("Eight actual CWL attack stars reach 100% normal medal share; remaining opportunities are mathematical, not predictive",async()=>{
 const {evaluateEightStarGoals,MEDAL_GOAL_STARS,findReadOnlyMedalSwap}=await importCore();
 assert.equal(MEDAL_GOAL_STARS,8);
 const data=base(),original=JSON.stringify(data);
 const result=evaluateEightStarGoals(data);
 const a=result.rows.find(r=>r.id==="A"),b=result.rows.find(r=>r.id==="B");
 assert.deepEqual({aStars:a.stars,aState:a.status,aShare:a.guaranteedShare},{
  aStars:8,aState:"reached",aShare:100});
 assert.equal(a.futureAttacks,1);
 assert.equal(b.stars,6);
 assert.equal(b.status,"not-reachable");
 assert.equal(b.guaranteedShare,80);
 assert.equal(b.potentialMax,6);
 const hint=findReadOnlyMedalSwap({...data,assessment:result});
 assert.deepEqual({day:hint.day,inId:hint.inId,outId:hint.outId},{day:4,inId:"B",outId:"A"});
 assert.equal(JSON.stringify(data),original,"No source profile, lineup or attack may be changed");
});

test("A player with 6 stars and a planned final attack is still mathematically able to reach 8",async()=>{
 const {evaluateEightStarGoals,findReadOnlyMedalSwap}=await importCore();
 const data=base();
 data.dayPlans[3].lineup=["B","C"];
 const result=evaluateEightStarGoals(data);
 const b=result.rows.find(r=>r.id==="B");
 assert.equal(b.futureAttacks,1);assert.equal(b.potentialMax,9);
 assert.equal(b.status,"possible");assert.equal(findReadOnlyMedalSwap({...data,assessment:result}),null);
});

test("Duplicate target attacks and missing completed rounds must never count as confirmed medals",async()=>{
 const {evaluateEightStarGoals}=await importCore();
 const data=base();
 data.snapshot.rounds[0].clan.members[1].attacks[0].defenderTag="#X";
 data.snapshot.rounds[1]={day:2,available:false};
 const result=evaluateEightStarGoals(data),a=result.rows.find(r=>r.id==="A");
 assert.equal(a.stars,2,"Only the unambiguous third-round attack is confirmed");
 assert.ok(a.uncertainStars>=3,"Duplicate target cannot be counted blindly");
 assert.equal(a.status,"uncertain");
 data.dayPlans[1].lineup=["A","B"];
 const again=evaluateEightStarGoals(data).rows.find(r=>r.id==="A");
 assert.equal(again.stars,2,"Locked day without API details is not a fake zero-star round");
 assert.equal(again.unknownDays,1);
});

test("Started/finished days, fixed players, target days and mandatory availability prohibit unvalidated exchange hints",async()=>{
 const {evaluateEightStarGoals,findReadOnlyMedalSwap}=await importCore();
 const variants=[
  d=>{d.profile.members[0].fixed=true},
  d=>{d.profile.members[1].targetDays=3},
  d=>{d.profile.members[0].statuses[3]="must"},
  d=>{d.profile.members[1].statuses[3]="out"},
  d=>{d.dayPlans[3].locked=true},
  d=>{d.snapshot.rounds[3]=war(4,{},"inWar")},
  d=>{d.snapshot.rounds[3]={day:4,available:false}},
  d=>{d.dayPlans[3].warnings=["Widerspruch"]},
  d=>{d.dayPlans[3].lineup=["A"]}
 ];
 for(const mutate of variants){
  const data=base();mutate(data);
  const result=evaluateEightStarGoals(data);
  const hint=findReadOnlyMedalSwap({...data,assessment:result});
  assert.equal(hint,null,JSON.stringify(data));
 }
});

test("No active league results, no roster tags or incomplete plans cannot produce fabricated recommendations",async()=>{
 const {evaluateEightStarGoals,findReadOnlyMedalSwap}=await importCore();
 const data=base();
 data.profile.members[0].playerTag="";
 assert.equal(evaluateEightStarGoals(data).rows.length,2);
 data.profile.members=[];
 assert.equal(evaluateEightStarGoals(data).rows.length,0);
 const none={...base(),snapshot:{season:"2026-11",rounds:[]},dayPlans:[]};
 const read=evaluateEightStarGoals(none);
 assert.equal(read.hasResults,false);
 assert.equal(read.rows.every(x=>x.status==="uncertain"),true);
 assert.equal(findReadOnlyMedalSwap({...none,assessment:read}),null);
});

test("CWL medal progress and rescue guidance move to deployment without changing solver",()=>{
 assert.match(live,/evaluateEightStarGoals/);
 assert.match(live,/findReadOnlyMedalSwap/);
 assert.match(live,/getMedalOverview/);
 assert.match(page,/summaryMedalOverview/);
 assert.match(page,/Mögliche 8★-Reserve/);
 assert.doesNotMatch(live,/updateMedalTarget|applyMedalSwap|persistMedalSwap/);
 assert.match(page,/#view-account #cloudAccountBack/);
});

test("Account back stays top-right on phones and desktop without overlapping content",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const theme of ["arena","cyber","light","dark"]){
   for(const width of [320,390,430,699,1366]){
    const session=await browser.newPage({viewport:{width,height:890}});
    try{
     await session.setContent(staticHtml,{waitUntil:"domcontentloaded"});
     const result=await session.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
      document.querySelectorAll(".view.active").forEach(e=>e.classList.remove("active"));
      document.getElementById("view-account").classList.add("active");
      const head=document.getElementById("cloudAccountTitle").getBoundingClientRect();
      const back=document.getElementById("cloudAccountBack").getBoundingClientRect();
      return {head:{left:head.left,right:head.right,bottom:head.bottom},
       back:{left:back.left,top:back.top,height:back.height},
       scroll:document.documentElement.scrollWidth};
     },theme);
     assert.ok(result.scroll<=width+2,JSON.stringify({width,theme,result}));
     assert.ok(result.back.top<result.head.bottom,
      "Back button must be on the headline row "+JSON.stringify({theme,width,result}));
     assert.ok(result.back.left>result.head.left+50,
      "Back button must stay on the right "+JSON.stringify({theme,width,result}));
     if(width<=699)assert.ok(result.back.height>=43,
      "Touch target must be at least 44px "+JSON.stringify({theme,width,result}));
    }finally{await session.close()}
   }
  }
 }finally{await browser.close()}
});
