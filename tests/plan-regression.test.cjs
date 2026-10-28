"use strict";
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const {test}=require("node:test");

const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const inline=html.split("<script>")[1]?.split("</script>")[0];
assert.ok(inline,"Inline-JavaScript exists");
new Function(inline);

function extract(name){
  const start=html.indexOf("function "+name+"(");
  assert.ok(start>=0,"function "+name+" found");
  const end=html.indexOf("\nfunction ",start+12);
  return html.slice(start,end<0?html.length:end).trim();
}
const names=["memberById","allKnownMembers","effectiveStatus","emptyDayGoal",
  "futureEligibilityCount","fairnessCandidateScore","calculatePlan",
  "playerSnapshot","normalizeSnapshot","normalizeSnapshots","lineupPlayer","normalizeArchive",
  "archiveCurrentCwl","removeMembers","usedInLockedDay","normalizePlayerTag",
  "normalizeMember","normalizeProfile"];
const code=names.map(extract).join("\n");
const strengths={high:"Oft 3★",medium:"Solide",low:"Selten",verylow:"Normal kein",unknown:"Unbekannt"};
function member(id,rest={}){
  return{id,name:id,playerTag:"",participating:true,fixed:false,priority:0,
    townHall:18,threeStar:"unknown",statuses:Array(7).fill("auto"),
    firstDay:null,outFromDay:null,...rest};
}
function goal(){return{townHall:{},strength:{high:0,medium:0,low:0,verylow:0}}}
function profile(members,{slots=2,days=7,goals,locks}={}){
  return{config:{slots,days,memberSort:"manual"},members,archivedMembers:[],
    locks:Array.from({length:7},(_,i)=>locks?.[i]||{locked:false,lineup:[]}),
    dayGoals:Array.from({length:7},(_,i)=>goals?.[i]||goal()),archives:[]};
}
function context(state){
  const c=vm.createContext({state,STRENGTH_LABELS:strengths,uid:()=>"test-id",
    openRulePanels:new Set(),selectedMembers:new Set()});
  vm.runInContext(code,c,{timeout:5000});
  return c;
}

test("legacy RH and 3-star day goals no longer affect the planner",()=>{
  const m=[member("fix",{fixed:true}),member("high",{threeStar:"high"}),member("b"),member("c")];
  const g=Array.from({length:7},()=>({...goal(),strength:{high:1,medium:0,low:0,verylow:0}}));
  const p=context(profile(m,{goals:g})).calculatePlan();
  const withoutGoals=context(profile(m)).calculatePlan();
  assert.equal(JSON.stringify(p.dayPlans.map(d=>d.lineup)),JSON.stringify(withoutGoals.dayPlans.map(d=>d.lineup)));
  assert.ok(p.counts.b>=2&&p.counts.c>=2,JSON.stringify(p.counts));
  assert.equal(p.counts.fix,7);
});
test("player available only on the first day is included before always-available player",()=>{
  const p=context(profile([member("fix",{fixed:true}),member("always"),member("rare",{outFromDay:2})])).calculatePlan();
  assert.ok(p.dayPlans[0].lineup.includes("rare"));
  assert.equal(p.counts.rare,1);
});
test("confirmed actual lineup is kept and future day recalculated",()=>{
  const p=context(profile([member("fix",{fixed:true}),member("a"),member("b"),member("c")],
    {locks:[{locked:true,lineup:["fix","b"]}]})).calculatePlan();
  assert.ok(p.dayPlans[1].lineup.includes("a"));
  assert.equal(p.playedCounts.a,0);
  assert.equal(p.playedCounts.b,1);
  assert.equal(p.dayPlans[0].locked,true);
});
test("hard must/fix/out constraints hold in 15 and 30 slot formats",()=>{
  for(const slots of [15,30]){
    const m=Array.from({length:slots+8},(_,i)=>member("p"+i,{
      fixed:i===0,statuses:Array.from({length:7},(_,d)=>i===1&&d===1?"must":i===2&&d===2?"out":"auto")
    }));
    const p=context(profile(m,{slots})).calculatePlan();
    for(const [d,day] of p.dayPlans.entries()){
      const lineup=Array.from(day.lineup);
      assert.equal(lineup.length,slots);
      assert.equal(new Set(lineup).size,slots);
      assert.ok(lineup.includes("p0"));
      if(d===1)assert.ok(lineup.includes("p1"));
      if(d===2)assert.ok(!lineup.includes("p2"));
    }
  }
});
test("past lineup snapshot does not change after live player rename",()=>{
  const f=member("f",{fixed:true,name:"Renamed"});
  const locks=[{locked:true,lineup:["f","b"],snapshots:{f:{
    id:"f",name:"Original",fixed:true,threeStar:"unknown",townHall:18,playerTag:""}}}];
  const st=profile([f,member("b"),member("zero")],{locks});
  const c=context(st);
  assert.equal(c.lineupPlayer("f",0).name,"Original");
  c.removeMembers(new Set(["f"]));
  assert.equal(st.archivedMembers[0].fixed,true);
  assert.equal(c.lineupPlayer("f",0).name,"Original");
  const archived=c.archiveCurrentCwl();
  assert.equal(archived.counts.zero,0);
  assert.equal(archived.lineups[0].snapshots.f.name,"Original");
  assert.equal(c.normalizeArchive(archived).counts.zero,0);
});
test("old profile data without day snapshots remains compatible",()=>{
  const c=context(profile([member("a"),member("b")],{locks:[{locked:true,lineup:["a","b"]}]}));
  const normalized=c.normalizeProfile(JSON.parse(JSON.stringify(c.state)));
  assert.deepEqual(Object.keys(normalized.locks[0].snapshots),[]);
  assert.equal(normalized.locks[0].lineup.length,2);
});
test("saved backup quota issue does not prevent primary save",()=>{
  const written={};
  const c=vm.createContext({STORAGE_KEY:"main",RECOVERY_KEY:"recovery",DATA_VERSION:9,
    app:{profiles:[]},state:{},suspendWrites:false,startupStorageIssue:null,
    safeParse:JSON.parse,document:{getElementById(){return{textContent:"",className:""}}},
    localStorage:{getItem(){return '{"previous":true}'},setItem(key,value){
      if(key==="recovery")throw new Error("Recovery storage full");
      written[key]=value;
    }},
    renderRecoveryBanner(){}});
  vm.runInContext(extract("saveApp"),c);
  vm.runInContext("saveApp()",c);
  assert.ok(written.main);
  assert.equal(c.suspendWrites,false);
});
test("failed primary save pauses further writes and flags emergency export",()=>{
  const c=vm.createContext({STORAGE_KEY:"main",RECOVERY_KEY:"recovery",DATA_VERSION:9,
    app:{profiles:[]},state:{},suspendWrites:false,startupStorageIssue:null,
    safeParse:JSON.parse,document:{getElementById(){return{textContent:"",className:""}}},
    localStorage:{getItem(){return null},setItem(){throw new Error("Quota exceeded")}},
    renderRecoveryBanner(){}});
  vm.runInContext(extract("saveApp"),c);
  vm.runInContext("saveApp()",c);
  assert.equal(c.suspendWrites,true);
  assert.equal(c.startupStorageIssue,"save");
});
