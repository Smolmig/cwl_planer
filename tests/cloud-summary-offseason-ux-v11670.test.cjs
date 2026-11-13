"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright"),{JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const app=read("cloud-app.html");
const staticApp=app.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
 .replace(/<link\b[^>]*>/gi,"");

test("Einsätze shows no old live bars after verified CWL end, yet remains available for a newly prepared league",{timeout:120000},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [width,theme] of [[320,"arena"],[390,"dark"],[430,"light"],[1366,"arena"]]){
   const page=await browser.newPage({viewport:{width,height:880}});
   try{
    await page.setContent(staticApp,{waitUntil:"domcontentloaded"});
    const state=await page.evaluate(theme=>{
     document.documentElement.dataset.theme=theme;
     document.body.classList.add("cloud-mode","cloud-role-viewer");
     document.querySelectorAll(".view.active").forEach(el=>el.classList.remove("active"));
     const summary=document.getElementById("view-summary");
     summary.classList.add("active");
     const plan=document.getElementById("view-plan");
     const active=summary.querySelector(".summary-live-card");
     const empty=summary.querySelector(".summary-offseason");
     const isVisible=node=>getComputedStyle(node).display!=="none"&&
       node.getBoundingClientRect().width>0;
     const snapshot=()=>({
       active:isVisible(active),empty:isVisible(empty),
       chips:isVisible(document.getElementById("summaryCloudFilters")),
       search:isVisible(document.getElementById("summarySearch")),
       text:empty.textContent.replace(/\s+/g," ").trim(),
       pageOverflow:document.documentElement.scrollWidth-innerWidth
     });
     const planning=snapshot();
     plan.classList.add("plan-postseason-mode");
     const ended=snapshot();
     plan.classList.remove("plan-postseason-mode");
     plan.classList.add("plan-between-cwl-mode");
     const between=snapshot();
     plan.classList.remove("plan-between-cwl-mode");
     const newCwl=snapshot();
     document.body.classList.remove("cloud-mode","cloud-role-viewer");
     const offline=snapshot();
     return {planning,ended,between,newCwl,offline};
    },theme);
    const ctx=JSON.stringify({width,theme,state});
    for(const key of ["planning","newCwl","offline"]){
     assert.equal(state[key].active,true,key+" active roster visible: "+ctx);
     assert.equal(state[key].empty,false,key+" empty state hidden: "+ctx);
    }
    for(const key of ["ended","between"]){
     assert.equal(state[key].active,false,key+" old roster must be hidden: "+ctx);
     assert.equal(state[key].empty,true,key+" archive link state visible: "+ctx);
     assert.equal(state[key].search,false,key+" old search must not be focusable: "+ctx);
     assert.match(state[key].text,/Aktuell keine CWL-Einsätze/);
     assert.match(state[key].text,/CWL-Archiv ansehen/);
    }
    for(const row of Object.values(state))assert.ok(row.pageOverflow<=3,ctx);
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});

test("off-season archive button navigates to the real group and plan archives without changing stored data",()=>{
 const start=app.indexOf('document.getElementById("summaryOpenArchive").onclick=()=>{');
 const end=app.indexOf("};",start);
 assert.ok(start>0&&end>start);
 const dom=new JSDOM('<button id="summaryOpenArchive">CWL-Archiv ansehen</button>');
 try{
  const calls=[];
  dom.window.CWLGroupArchive={open:()=>{calls.push("load-archive")}};
  new Function("document","window","showPlannerView",app.slice(start,end+2))(
   dom.window.document,dom.window,view=>calls.push("view:"+view));
  dom.window.document.getElementById("summaryOpenArchive").click();
  assert.deepEqual(calls,["view:archive","load-archive"]);
  const live=read("cwl-live.mjs");
  assert.match(live,/const postseason=ctx\.active&&\(model\.mode==="postseason"\|\|transition\)/);
  assert.match(live,/const between=ctx\.active&&model\.mode==="idle"&&confirmedNoCwl/);
  assert.match(live,/view\.classList\.toggle\("plan-postseason-mode",!!postseason\)/);
  assert.match(live,/view\.classList\.toggle\("plan-between-cwl-mode",!!between\)/);
  assert.match(app,/#view-plan\.plan-postseason-mode ~ #view-summary \.summary-live-card/);
  assert.match(app,/#view-plan\.plan-between-cwl-mode ~ #view-summary \.summary-live-card/);
  assert.match(app,/Einsätze zwischen den CWLs/);
  assert.match(read("cloud-release-history.mjs"),/"version": "v1\.19\.0"/);
  assert.equal(JSON.parse(read("cloud-version.json")).version,"v1.19.0");
  assert.match(read("index.html"),/const APP_VERSION="v1\.0\.2"/);
 }finally{dom.window.close()}
});
