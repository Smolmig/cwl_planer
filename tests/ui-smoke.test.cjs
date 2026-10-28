"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const member=(i)=>({id:"member-"+i,name:"Spieler "+i,playerTag:"",participating:true,fixed:i<2,priority:0,townHall:18,threeStar:"unknown",statuses:Array(7).fill("auto"),firstDay:null,outFromDay:null});
function sample(){
 const p={id:"profile-test",name:"Test-Clan",config:{slots:15,days:7,memberSort:"manual"},
 members:Array.from({length:20},(_,i)=>member(i)),archivedMembers:[],dayGoals:Array.from({length:7},()=>({townHall:{},strength:{high:0,medium:0,low:0,verylow:0}})),locks:Array.from({length:7},()=>({locked:false,lineup:[]})),archives:[]};
 return {version:9,dataVersion:9,profiles:[p],activeProfileId:p.id};
}
function boot(stored,{mobile=true}={}){
 const errors=[],virtualConsole=new VirtualConsole();
 virtualConsole.on("jsdomError",e=>errors.push(e.message));
 virtualConsole.on("error",m=>errors.push(String(m)));
 const dom=new JSDOM(html,{runScripts:"dangerously",url:"https://preview.example.test/cwl_planer/index.html",
   pretendToBeVisual:true,virtualConsole,
   beforeParse(w){
     w.matchMedia=()=>({matches:mobile,media:"(max-width:699px)",addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
     w.HTMLElement.prototype.scrollIntoView=function(){};
     w.scrollTo=function(){};
     if(stored)w.localStorage.setItem("cwl_planer_mobile_v9",JSON.stringify(stored));
     w.addEventListener("error",e=>errors.push(e.message||String(e.error)));
   }
 });
 return {dom,w:dom.window,d:dom.window.document,errors,close(){dom.window.close()}};
}
test("initial boot with a populated profile shows all players, without runtime errors",()=>{
 const c=boot(sample());
 try{
   assert.deepEqual(c.errors,[]);
   assert.equal(c.d.getElementById("profileSelect").value,"profile-test");
   assert.equal(c.d.querySelectorAll("#memberList .member").length,20);
 }finally{c.close()}
});
test("lineup dialog opens, cancel and close buttons work, save locks day and keeps profiles",()=>{
 const c=boot(sample());
 try{
   assert.deepEqual(c.errors,[]);
   c.d.querySelector("#planDays .lock-day").click();
   assert.ok(c.d.getElementById("lineupModal").classList.contains("open"));
   c.d.getElementById("modalClose").click();
   assert.ok(!c.d.getElementById("lineupModal").classList.contains("open"));
   c.d.querySelector("#planDays .lock-day").click();
   c.d.getElementById("modalCancel").click();
   assert.ok(!c.d.getElementById("lineupModal").classList.contains("open"));
   c.d.querySelector("#planDays .lock-day").click();
   assert.equal(c.d.getElementById("modalSave").disabled,false);
   c.d.getElementById("modalSave").click();
   assert.ok(!c.d.getElementById("lineupModal").classList.contains("open"));
   assert.equal(c.d.getElementById("profileSelect").value,"profile-test");
   assert.equal(c.d.querySelectorAll("#memberList .member").length,20);
   const app=JSON.parse(c.w.localStorage.getItem("cwl_planer_mobile_v9"));
   assert.ok(app.profiles[0].locks[0].locked);
   assert.equal(app.profiles[0].locks[0].lineup.length,15);
   assert.deepEqual(c.errors,[]);
 }finally{c.close()}
});
test("member search + filter may show zero results but clearing returns complete list",()=>{
 const c=boot(sample());
 try{
   const input=c.d.getElementById("memberSearch");input.value="nonexistent";
   input.dispatchEvent(new c.w.Event("input",{bubbles:true}));
   assert.equal(c.d.querySelectorAll("#memberList .member").length,0);
   input.value="";input.dispatchEvent(new c.w.Event("input",{bubbles:true}));
   assert.equal(c.d.querySelectorAll("#memberList .member").length,20);
   assert.equal(c.d.getElementById("profileSelect").value,"profile-test");
   assert.deepEqual(c.errors,[]);
 }finally{c.close()}
});
test("reload with saved played day restores profiles and members",()=>{
 const c=boot(sample());
 let stored;
 try{
   c.d.querySelector("#planDays .lock-day").click();
   c.d.getElementById("modalSave").click();
   stored=JSON.parse(c.w.localStorage.getItem("cwl_planer_mobile_v9"));
   assert.deepEqual(c.errors,[]);
 }finally{c.close()}
 const reload=boot(stored);
 try{
   assert.deepEqual(reload.errors,[]);
   assert.equal(reload.d.getElementById("profileSelect").value,"profile-test");
   assert.equal(reload.d.querySelectorAll("#memberList .member").length,20);
   assert.ok(reload.d.querySelector("#planDays .edit-day"));
 }finally{reload.close()}
});

test("mobile RH picker opens a bounded grid from RH19 downward and saves selection",()=>{
 const c=boot(sample());
 try{
   assert.deepEqual(c.errors,[]);
   c.d.querySelector("#memberList .member-edit-toggle").click();
   c.d.querySelector("#memberList .member-th-picker").click();
   const modal=c.d.getElementById("townHallPickerModal");
   assert.ok(modal.classList.contains("open"));
   const choices=Array.from(c.d.querySelectorAll("#townHallPickerGrid .townhall-choice"));
   assert.equal(choices[0].textContent,"RH –");
   assert.equal(choices[1].textContent,"RH 19");
   assert.equal(choices[choices.length-1].textContent,"RH 3");
   assert.ok(!choices.some(button=>button.textContent==="RH 20"));
   c.d.querySelector('#townHallPickerGrid [data-rh="19"]').click();
   assert.ok(!modal.classList.contains("open"));
   assert.equal(c.d.querySelector("#memberList .member-brief-mobile").textContent.includes("RH19"),true);
   const saved=JSON.parse(c.w.localStorage.getItem("cwl_planer_mobile_v9"));
   assert.equal(saved.profiles[0].members[0].townHall,19);
   assert.deepEqual(c.errors,[]);
 }finally{c.close()}
});
test("RH20 already saved remains available without becoming the new first option",()=>{
 const data=sample();data.profiles[0].members[0].townHall=20;
 const c=boot(data);
 try{
   c.d.querySelector("#memberList .member-edit-toggle").click();
   const select=c.d.querySelector("#memberList .member-th");
   assert.equal(select.value,"20");
   c.d.querySelector("#memberList .member-th-picker").click();
   const choices=Array.from(c.d.querySelectorAll("#townHallPickerGrid .townhall-choice"));
   assert.equal(choices[1].textContent,"RH 19");
   assert.equal(choices[choices.length-1].textContent,"RH 20");
   c.d.getElementById("townHallPickerClose").click();
   assert.deepEqual(c.errors,[]);
 }finally{c.close()}
});
test("show lineup on one day expands all days until switched off",()=>{
 const c=boot(sample());
 try{
   assert.equal(c.d.querySelectorAll("#planDays .day-card").length,7);
   c.d.querySelector("#planDays .mobile-lineup-toggle").click();
   assert.equal(c.d.querySelectorAll("#planDays .mobile-lineup-expanded").length,7);
   const dayTabs=c.d.querySelectorAll("#mobileDayTabs button");
   dayTabs[4].click();
   assert.equal(c.d.querySelectorAll("#planDays .mobile-lineup-expanded").length,7);
   assert.equal(c.d.querySelectorAll("#planDays .day-card.mobile-day-hidden").length,6);
   c.d.querySelectorAll("#planDays .mobile-lineup-toggle")[4].click();
   assert.equal(c.d.querySelectorAll("#planDays .mobile-lineup-expanded").length,0);
   assert.deepEqual(c.errors,[]);
 }finally{c.close()}
});
test("simplified planning has no optional day goals or compact mode buttons",()=>{
 const c=boot(sample());
 try{
   assert.equal(c.d.getElementById("goalsModal"),null);
   assert.equal(c.d.querySelector("#planDays .goal-day-btn"),null);
   assert.equal(c.d.getElementById("compactPlanBtn"),null);
   assert.ok(c.d.querySelector("#memberList .member-strength"));
   assert.ok(c.d.querySelector("#memberList .member-th"));
   assert.ok(c.d.querySelector("#helpModal .help-item"));
   assert.deepEqual(c.errors,[]);
 }finally{c.close()}
});


test("desktop starts expanded and can fold/unfold the entire seven-day lineup",()=>{
 const c=boot(sample(),{mobile:false});
 try{
   assert.deepEqual(c.errors,[]);
   assert.equal(c.d.querySelectorAll("#planDays .mobile-lineup-expanded").length,7);
   c.d.querySelectorAll("#planDays .mobile-lineup-toggle")[2].click();
   assert.equal(c.d.querySelectorAll("#planDays .mobile-lineup-expanded").length,0);
   c.d.querySelectorAll("#planDays .mobile-lineup-toggle")[5].click();
   assert.equal(c.d.querySelectorAll("#planDays .mobile-lineup-expanded").length,7);
   assert.deepEqual(c.errors,[]);
 }finally{c.close()}
});
test("mobile priority and three-star pickers have same selectable modal behavior as town hall",()=>{
 const c=boot(sample());
 try{
   assert.deepEqual(c.errors,[]);
   c.d.querySelector("#memberList .member-edit-toggle").click();
   c.d.querySelector("#memberList .member-prio-picker").click();
   assert.equal(c.d.getElementById("townHallPickerTitle").textContent,"Priorität auswählen");
   assert.equal(c.d.querySelectorAll("#townHallPickerGrid .townhall-choice").length,6);
   c.d.querySelector('#townHallPickerGrid [data-choice="5"]').click();
   assert.equal(c.d.querySelector("#memberList .member-brief-mobile").textContent.includes("P5"),true);
   c.d.querySelector("#memberList .member-strength-picker").click();
   assert.equal(c.d.getElementById("townHallPickerTitle").textContent,"3★-Stärke auswählen");
   const options=Array.from(c.d.querySelectorAll("#townHallPickerGrid .townhall-choice"));
   assert.equal(options.length,5);
   const index=options.findIndex(el=>el.textContent==="Oft 3★");
   assert.ok(index>=0);
   options[index].click();
   const saved=JSON.parse(c.w.localStorage.getItem("cwl_planer_mobile_v9"));
   assert.equal(saved.profiles[0].members[0].priority,5);
   assert.equal(saved.profiles[0].members[0].threeStar,"high");
   assert.deepEqual(c.errors,[]);
 }finally{c.close()}
});
test("deployment overview filters, planned/played counters and reset of search",()=>{
 const c=boot(sample());
 try{
   assert.deepEqual(c.errors,[]);
   c.d.querySelector("#planDays .lock-day").click();
   c.d.getElementById("modalSave").click();
   c.d.querySelector('[data-view="summary"]').click();
   const rows=c.d.querySelectorAll("#summaryList .summary-compact-row");
   assert.equal(rows.length,20);
   assert.ok(c.d.querySelector("#summaryList .summary-stat.played"));
   assert.ok(c.d.querySelector("#summaryList .summary-stat.planned"));
   const filter=c.d.getElementById("summaryFilter");
   filter.value="played";filter.dispatchEvent(new c.w.Event("change",{bubbles:true}));
   assert.equal(c.d.querySelectorAll("#summaryList .summary-compact-row").length,15);
   filter.value="zero";filter.dispatchEvent(new c.w.Event("change",{bubbles:true}));
   assert.equal(c.d.querySelectorAll("#summaryList .summary-compact-row").length,0);
   filter.value="all";filter.dispatchEvent(new c.w.Event("change",{bubbles:true}));
   const input=c.d.getElementById("summarySearch");
   input.value="Spieler 19";input.dispatchEvent(new c.w.Event("input",{bubbles:true}));
   assert.equal(c.d.querySelectorAll("#summaryList .summary-compact-row").length,1);
   input.value="";input.dispatchEvent(new c.w.Event("input",{bubbles:true}));
   assert.equal(c.d.querySelectorAll("#summaryList .summary-compact-row").length,20);
   assert.deepEqual(c.errors,[]);
 }finally{c.close()}
});
test("landscape CSS supports two-column members and summaries",()=>{
 const style=html.split("<style>")[1]?.split("</style>")[0]||"";
 assert.ok(style.includes("(orientation:landscape) and (max-height:540px) and (min-width:600px)"));
 assert.ok(style.includes("#memberList{display:grid!important;grid-template-columns:repeat(2"));
 assert.ok(style.includes(".summary-compact-grid{grid-template-columns:repeat(2"));
});


test("new CWL confirmation is a real dialog, can be cancelled, and keeps members after archiving",async()=>{
 const saved=sample(),members=saved.profiles[0].members;
 saved.profiles[0].locks[0]={locked:true,lineup:members.slice(0,15).map(m=>m.id)};
 const c=boot(saved);
 try{
   assert.deepEqual(c.errors,[]);
   c.d.getElementById("manageCwlBtn").click();
   const panel=c.d.getElementById("inlineActionPanel");
   const backdrop=c.d.getElementById("inlineActionBackdrop");
   assert.ok(panel.classList.contains("open"));
   assert.ok(backdrop.classList.contains("open"));
   assert.equal(panel.getAttribute("role"),"dialog");
   assert.equal(panel.getAttribute("aria-modal"),"true");
   assert.match(c.d.getElementById("inlineActionTitle").textContent,/Neue CWL/);
   c.d.querySelector('#inlineActionButtons button:last-child').click();
   await new Promise(resolve=>setImmediate(resolve));
   assert.ok(!panel.classList.contains("open"));
   assert.ok(!backdrop.classList.contains("open"));
   let state=JSON.parse(c.w.localStorage.getItem("cwl_planer_mobile_v9"));
   assert.ok(state.profiles[0].locks[0].locked,"cancel must not reset current CWL");
   c.d.getElementById("manageCwlBtn").click();
   const confirm=c.d.querySelector("#inlineActionButtons button:first-child");
   assert.match(confirm.textContent,/Archivieren/);
   confirm.click();
   await new Promise(resolve=>setImmediate(resolve));
   state=JSON.parse(c.w.localStorage.getItem("cwl_planer_mobile_v9"));
   assert.equal(state.profiles[0].members.length,20);
   assert.equal(state.profiles[0].archives.length,1);
   assert.equal(state.profiles[0].locks[0].locked,false);
   assert.deepEqual(c.errors,[]);
 }finally{c.close()}
});
test("beginner help covers normal CWL workflow and avoids removed settings",()=>{
 const c=boot(sample());
 try{
   c.d.getElementById("helpBtn").click();
   const modal=c.d.getElementById("helpModal");
   assert.ok(modal.classList.contains("open"));
   assert.equal(modal.getAttribute("role"),"dialog");
   assert.equal(c.d.querySelectorAll(".help-steps>div").length,4);
   const content=modal.textContent;
   for(const phrase of ["Dabei / Pause","Priorität","Erst ab","MUSS","RAUS","Speicherung","Backup","tatsächlich"])assert.ok(content.includes(phrase),phrase);
   assert.ok(!content.includes("Tie-Breaker"));
   assert.ok(!content.includes("Kompaktansicht"));
   assert.ok(!content.includes("Tagesziele"));
   c.d.getElementById("helpClose").click();
   assert.ok(!modal.classList.contains("open"));
   assert.deepEqual(c.errors,[]);
 }finally{c.close()}
});
test("landscape styles compact the management panels and center confirmation",()=>{
 const style=html.split("<style>")[1]?.split("</style>")[0]||"";
 for(const selector of [".inline-action-backdrop.open",".inline-action-panel.open","#view-members .list-management-head{display:none!important}","#view-members .member-filters{display:grid!important",
 ".titleblock h1{font-size:17px", "#view-members .member-actionbar{display:grid!important"]){
   assert.ok(style.includes(selector),"CSS missing: "+selector);
 }
});
