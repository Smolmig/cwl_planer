"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const core=fs.readFileSync(path.join(root,"cwl-planning-core.js"),"utf8");

const serve=()=>http.createServer((req,res)=>{
 const pathname=new URL(req.url||"/","http://localhost").pathname;
 if(pathname==="/cloud-app.html"){
  res.writeHead(200,{"content-type":"text/html"});res.end(html);return;
 }
 if(pathname==="/cwl-planning-core.js"){
  res.writeHead(200,{"content-type":"text/javascript"});res.end(core);return;
 }
 if(pathname==="/cloud-sync.mjs"){
  res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};\n");return;
 }
 res.writeHead(404);res.end("");
});

test("day-rule AUTO → MUSS → RAUS → AUTO updates the plan without replacing an open member card, losing focus or jumping",{
 timeout:120000
},async()=>{
 const server=serve();
 await new Promise(done=>server.listen(0,"127.0.0.1",done));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [390,1366]){
   const page=await browser.newPage({viewport:{width,height:850},hasTouch:width<700});
   try{
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",{waitUntil:"domcontentloaded"});
    await page.evaluate(()=>{
     window.__ruleSaveCalls=0;
     window.CWLCloud={
      active:true,hasApiClan:()=>false,getActiveClanId:()=>"test-clan",
      onLocalChange:()=>{window.__ruleSaveCalls++;},
      afterRender:()=>{},renderLive:()=>{}
     };
     const profile=window.CWLLegacy.getProfile();
     const members=Array.from({length:65},(_,i)=>{
      const member=window.CWLLegacy.newMember("Spieler "+String(i).padStart(3,"0"));
      member.townHall=18;
      member.participating=true;
      member.fixed=false;
      return member;
     });
     window.CWLLegacy.switchToCloud({...profile,members});
     window.showPlannerView("members");
    });
    // Finish planned navigation/accordion smooth-scrolling before measuring the rule click.
    await page.waitForTimeout(450);
    const result=await page.evaluate(()=>{
     const list=document.getElementById("memberList");
     const row=[...list.querySelectorAll(".member")][24];
     const id=row.dataset.id;
     row.querySelector(".member-edit-toggle").click();
     row.querySelector(".toggle-rules").click();
     return {id};
    });
    await page.evaluate(id=>{
     const row=[...document.querySelectorAll("#memberList .member")].find(r=>r.dataset.id===id);
     row.scrollIntoView({block:"center",behavior:"instant"});
    },result.id);
    await page.waitForTimeout(480);
    const states=await page.evaluate(id=>{
     const list=document.getElementById("memberList");
     const row=[...list.querySelectorAll(".member")].find(r=>r.dataset.id===id);
     const sibling=[...list.querySelectorAll(".member")][30];
     const button=row.querySelector('.rulebtn[data-day="3"]');
     const baselineY=window.scrollY,baselineTop=row.getBoundingClientRect().top;
     button.focus({preventScroll:true});
     const updates=[];
     for(const expected of ["MUSS","RAUS","AUTO"]){
      button.click();
      const saved=window.CWLLegacy.getProfile().members.find(m=>m.id===id);
      updates.push({
       expected,actual:button.textContent.trim().replace(/\\s+/g," "),
       status:saved.statuses[3],
       rowSame:row===list.querySelector('.member[data-id="'+id+'"]'),
       siblingSame:sibling===[...list.querySelectorAll(".member")][30],
       cardOpen:row.classList.contains("member-expanded")&&!row.querySelector(".member-details").classList.contains("hidden"),
       rulesOpen:row.querySelector(".rule-panel").classList.contains("open"),
       focusSame:document.activeElement===button,
       scrollDelta:window.scrollY-baselineY,
       rowDelta:row.getBoundingClientRect().top-baselineTop
      });
     }
     return {updates,saveCalls:window.__ruleSaveCalls,rows:list.querySelectorAll(".member").length};
    },result.id);
    assert.equal(states.rows,65);
    assert.ok(states.saveCalls>=3,"each choice should enter the existing persistence path");
    assert.deepEqual(states.updates.map(x=>x.status),["must","out","auto"]);
    for(const u of states.updates){
     assert.ok(u.actual.includes(u.expected),"button text must reflect the selected status: "+JSON.stringify(u));
     assert.equal(u.rowSame,true,"same player DOM node: "+width);
     assert.equal(u.siblingSame,true,"do not rebuild unrelated players: "+width);
     assert.equal(u.cardOpen,true,"expanded member must remain expanded: "+width);
     assert.equal(u.rulesOpen,true,"day rules must stay open: "+width);
     assert.equal(u.focusSame,true,"keyboard focus must remain on the selected day: "+width);
     assert.ok(Math.abs(u.scrollDelta)<=2,"scroll location must not jump: "+width+" "+JSON.stringify(u));
     assert.ok(Math.abs(u.rowDelta)<=2,"player position must remain stable: "+width+" "+JSON.stringify(u));
    }
    assert.deepEqual(errors,[],"browser errors: "+width);
   }finally{await page.close();}
  }
 }finally{
  await browser.close();
  await new Promise(done=>server.close(done));
 }
});
