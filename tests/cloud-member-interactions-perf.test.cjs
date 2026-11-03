"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const cleanHtml=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
const start=html.indexOf("function syncMemberExpandedRow(");
const end=html.indexOf("function moveMember(",start);
assert.ok(start>0&&end>start,"incremental member renderer must be available");
const code=`
const STRENGTH_LABELS={unknown:"Unbekannt",high:"Oft 3★",medium:"Solide",low:"Selten"};
const openMemberDetails=new Set(),openRulePanels=new Set(),openDuplicatePanels=new Set();
const selectedMembers=new Set();let selectionMode=false;
let state={members:[],locks:Array.from({length:7},()=>({locked:false})),config:{days:7,slots:15,memberSort:"manual"}};
let __renderAllCalls=0;
window.CWLCloud={active:false};
function updateBulkBar(){}
function showToast(){}
function manualRosterRestricted(){return false}
function memberById(id){return state.members.find(m=>m.id===id)}
function getVisibleMembers(){return state.members}
function effectiveStatus(m,d){return m.statuses[d]||"auto"}
function duplicateNameKeys(){
 const counts=new Map();
 for(const m of state.members){const n=m.name.toLowerCase();counts.set(n,(counts.get(n)||0)+1)}
 return new Set([...counts].filter(([,n])=>n>1).map(([n])=>n));
}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}
function memberTownHallMarkup(m){return "RH "+(m.townHall||"–")}
function rotationWeightLabel(){return "Ausgewogen"}
function memberCompactPerformance(){return "3★ –"}
function memberPerformance(){return "Noch keine Angriffe erfasst"}
function availabilityLabel(){return ""}
function apiManagedRosterMember(){return false}
function markRosterAbsenceEdit(){}
function editMemberNote(){}
function openTownHallPicker(){}
function openMemberChoicePicker(){}
function openMemberConfigHelp(){}
function renderAll(){__renderAllCalls++}
function setFirstDay(){}
function setOutFromDay(){}
function moveMember(){}
function deleteMember(){}
`+html.slice(start,end)+`
window.__setMembers=(count,duplicates=false)=>{
 state.members=Array.from({length:count},(_,i)=>({
  id:"id"+i,name:duplicates&&i<2?"Duplikat":"Spieler "+i,
  playerTag:"#2PY"+i,participating:true,fixed:i<2,priority:0,
  statuses:Array(7).fill("auto"),townHall:17,threeStar:"unknown",
  note:"",rotationWeight:"balanced",cocSyncState:"active"
 }));
 renderMembers();
 return document.querySelectorAll("#memberList .member").length;
};
window.__memberSets={openMemberDetails,openRulePanels,openDuplicatePanels};
window.__getRenderAllCalls=()=>__renderAllCalls;
`;
test("member cards and rules change locally without rebuilding every row at desktop widths",{timeout:120000},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  try{
   await page.setContent(cleanHtml,{waitUntil:"domcontentloaded"});
   await page.addScriptTag({content:code});
   assert.equal(await page.evaluate(()=>window.__setMembers(120,true)),120);
   const result=await page.evaluate(()=>{
    const root=document.getElementById("memberList");
    const first=root.querySelector(".member[data-id='id0']");
    const last=root.querySelector(".member[data-id='id119']");
    const observer=new MutationObserver(()=>{});
    observer.observe(root,{childList:true});
    const t0=performance.now();
    first.querySelector(".member-edit-toggle").click();
    const t1=performance.now();
    const expanded=first.classList.contains("member-expanded")&&
     !first.querySelector(".member-details").classList.contains("hidden")&&
     first.querySelector(".member-edit-toggle").getAttribute("aria-expanded")==="true";
    first.querySelector(".toggle-rules").click();
    const rulesOpen=first.querySelector(".rule-panel").classList.contains("open")&&
     first.querySelector(".toggle-rules").getAttribute("aria-expanded")==="true";
    first.querySelector(".dup-warning").click();
    const dupOpen=!first.querySelector(".duplicate-panel").classList.contains("hidden");
    first.querySelector(".close-duplicate").click();
    const dupClosed=first.querySelector(".duplicate-panel").classList.contains("hidden");
    for(let i=0;i<20;i++){
      first.querySelector(".member-edit-toggle").click();
      first.querySelector(".toggle-rules").click();
    }
    const elapsed=performance.now()-t0;
    const mutations=observer.takeRecords().length;
    observer.disconnect();
    return {expanded,rulesOpen,dupOpen,dupClosed,elapsed,
     sameFirst:first===root.querySelector(".member[data-id='id0']"),
     sameLast:last===root.querySelector(".member[data-id='id119']"),
     mutations,renderAll:window.__getRenderAllCalls(),
     currentRows:root.querySelectorAll(".member").length};
   });
   assert.equal(result.expanded,true);
   assert.equal(result.rulesOpen,true);
   assert.equal(result.dupOpen,true);
   assert.equal(result.dupClosed,true);
   assert.equal(result.sameFirst,true);
   assert.equal(result.sameLast,true);
   assert.equal(result.mutations,0,"list root must not be replaced for visual toggles");
   assert.equal(result.renderAll,0,"visual toggles must not update the saved CWL plan");
   assert.equal(result.currentRows,120);
   console.log("Measured 120-member card interactions:",result.elapsed.toFixed(1),"ms (synthetic Chromium)");
  }finally{await page.close()}
 }finally{await browser.close()}
});
test("mobile member accordion closes the previous card without recreating DOM",{timeout:90000},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  try{
   await page.setContent(cleanHtml,{waitUntil:"domcontentloaded"});
   await page.addScriptTag({content:code});
   await page.evaluate(()=>window.__setMembers(18));
   const result=await page.evaluate(()=>{
    const a=document.querySelector(".member[data-id='id0']");
    const b=document.querySelector(".member[data-id='id1']");
    a.querySelector(".member-edit-toggle").click();
    const firstOpen=a.classList.contains("member-expanded");
    b.querySelector(".member-edit-toggle").click();
    return {firstOpen,firstClosed:!a.classList.contains("member-expanded"),
     secondOpen:b.classList.contains("member-expanded"),
     firstAria:a.querySelector(".member-edit-toggle").getAttribute("aria-expanded"),
     secondAria:b.querySelector(".member-edit-toggle").getAttribute("aria-expanded"),
     sameNode:a===document.querySelector(".member[data-id='id0']"),
     openCount:window.__memberSets.openMemberDetails.size,
     renderAll:window.__getRenderAllCalls()};
   });
   assert.equal(result.firstOpen,true);
   assert.equal(result.firstClosed,true);
   assert.equal(result.secondOpen,true);
   assert.equal(result.firstAria,"false");
   assert.equal(result.secondAria,"true");
   assert.equal(result.sameNode,true);
   assert.equal(result.openCount,1);
   assert.equal(result.renderAll,0);
  }finally{await page.close()}
 }finally{await browser.close()}
});
test("rendering manual-order members performs one index-map pass instead of a repeated linear findIndex",()=>{
 const section=html.slice(html.indexOf("function renderMembers(){"),html.indexOf("function moveMember("));
 assert.match(section,/orderIndex=new Map\(state\.members\.map\(\(item,i\)=>\[item\.id,i\]\)\)/);
 assert.match(section,/const idx=orderIndex\.get\(m\.id\)/);
 assert.doesNotMatch(section,/const idx=state\.members\.findIndex\(/);
 assert.doesNotMatch(section,/el\.querySelector\("\.member-edit-toggle"\)\.onclick=.*renderMembers\(/s);
});
