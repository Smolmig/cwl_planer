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
function boot(stored){
 const errors=[],virtualConsole=new VirtualConsole();
 virtualConsole.on("jsdomError",e=>errors.push(e.message));
 virtualConsole.on("error",m=>errors.push(String(m)));
 const dom=new JSDOM(html,{runScripts:"dangerously",url:"https://preview.example.test/cwl_planer/index.html",
   pretendToBeVisual:true,virtualConsole,
   beforeParse(w){
     w.matchMedia=()=>({matches:true,media:"(max-width:699px)",addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
     w.HTMLElement.prototype.scrollIntoView=function(){};
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
