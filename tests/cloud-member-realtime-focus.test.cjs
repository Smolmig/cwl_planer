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
function serve(){
 return http.createServer((req,res)=>{
  const pathname=new URL(req.url||"/","http://localhost").pathname;
  if(pathname==="/cloud-app.html"){res.writeHead(200,{"content-type":"text/html"});res.end(html);return;}
  if(pathname==="/cwl-planning-core.js"){res.writeHead(200,{"content-type":"text/javascript"});res.end(core);return;}
  if(pathname==="/cloud-sync.mjs"){res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};\n");return;}
  res.writeHead(404);res.end("");
 });
}
test("same-clan member updates preserve focused player and position across layouts and Viewer",{
 timeout:150000
},async()=>{
 const server=serve();
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [width,theme,viewer] of [
   [320,"arena",true],[390,"dark",false],[430,"light",true],
   [699,"arena",false],[1366,"dark",false],[1366,"light",true]
  ]){
   const page=await browser.newPage({viewport:{width,height:880},hasTouch:width<700});
   try{
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",{waitUntil:"domcontentloaded"});
    await page.evaluate(({theme,viewer})=>{
     document.documentElement.dataset.theme=theme;
     document.body.classList.add("cloud-mode");
     document.body.classList.toggle("cloud-role-viewer",viewer);
     window.CWLCloud={
      active:true,hasApiClan:()=>false,getActiveClanId:()=>"safe-synthetic-clan",
      isViewer:()=>viewer,onLocalChange:()=>{},afterRender:()=>{},renderLive:()=>{}
     };
     const initial=window.CWLLegacy.getProfile();
     const members=Array.from({length:65},(_,i)=>{
      const m=window.CWLLegacy.newMember("Spieler "+String(i).padStart(3,"0"));
      m.townHall=18;m.participating=true;m.fixed=false;return m;
     });
     window.CWLLegacy.switchToCloud({...initial,id:"synthetic-profile",members});
     window.showPlannerView("members");
    },{theme,viewer});
    await page.waitForTimeout(350);
    await page.evaluate(()=>{
     const search=document.getElementById("memberSearch");
     search.value="Spieler";search.dispatchEvent(new Event("input",{bubbles:true}));
     const filter=document.getElementById("memberFilter");
     filter.value="participating";filter.dispatchEvent(new Event("change",{bubbles:true}));
    });
    await page.waitForTimeout(140);
    const id=await page.evaluate(()=>{
     const row=document.querySelectorAll("#memberList .member")[25];
     row.querySelector(".member-edit-toggle").click();
     return row.dataset.id;
    });
    await page.waitForTimeout(350);
    const result=await page.evaluate(({id,viewer})=>{
     const root=document.getElementById("memberList");
     const row=[...root.querySelectorAll(".member")].find(x=>x.dataset.id===id);
     row.scrollIntoView({block:"center",behavior:"instant"});
     const target=row.querySelector(viewer?".member-edit-toggle":".member-name-edit");
     target.focus({preventScroll:true});
     const before={top:target.getBoundingClientRect().top,
      open:row.classList.contains("member-expanded"),
      search:document.getElementById("memberSearch").value,
      filter:document.getElementById("memberFilter").value,
      count:root.querySelectorAll(".member").length};
     const current=window.CWLLegacy.getProfile();
     const newcomer=window.CWLLegacy.newMember("Spieler neu 000");
     newcomer.townHall=18;newcomer.participating=true;
     window.CWLLegacy.switchToCloud({...current,
      members:[newcomer,...current.members]});
     const replaced=[...root.querySelectorAll(".member")].find(x=>x.dataset.id===id);
     const next=replaced?.querySelector(viewer?".member-edit-toggle":".member-name-edit");
     return {before,after:{
      rowReplaced:replaced!==row,focused:document.activeElement===next,
      top:next?.getBoundingClientRect().top,
      open:replaced?.classList.contains("member-expanded")&&
       !replaced?.querySelector(".member-details")?.classList.contains("hidden"),
      search:document.getElementById("memberSearch").value,
      filter:document.getElementById("memberFilter").value,
      count:root.querySelectorAll(".member").length,
      aria:replaced?.querySelector(".member-edit-toggle")?.getAttribute("aria-expanded"),
      overflow:document.documentElement.scrollWidth-innerWidth
     }};
    },{id,viewer});
    const tag=JSON.stringify({width,theme,viewer,result});
    assert.equal(result.before.open,true,tag);
    assert.equal(result.before.count,65,tag);
    assert.equal(result.after.rowReplaced,true,tag);
    assert.equal(result.after.focused,true,"focused member control lost: "+tag);
    assert.equal(result.after.open,true,tag);
    assert.equal(result.after.aria,"true",tag);
    assert.equal(result.after.count,66,tag);
    assert.equal(result.after.search,result.before.search,tag);
    assert.equal(result.after.filter,result.before.filter,tag);
    assert.ok(Math.abs(result.after.top-result.before.top)<=5,"active player's position changed: "+tag);
    assert.ok(result.after.overflow<=3,"page horizontally overflowed: "+tag);
    assert.deepEqual(errors,[],"browser errors: "+tag);
   }finally{await page.close()}
  }
 }finally{
  await browser.close();
  await new Promise(ok=>server.close(ok));
 }
});
test("member refresh prefers focused anchor without affecting deliberate sorting",()=>{
 const start=html.indexOf("function renderMembers(){");
 const end=html.indexOf("function moveMember(",start);
 const part=html.slice(start,end);
 assert.ok(part.includes('".member-name-edit"'));
 assert.ok(part.includes("keepViewport||Number.isInteger(activeDayRule)"));
 assert.ok(part.includes("memberViewportAnchor&&!anchorFocused"));
 assert.ok(part.includes("focusedReplacement.focus({preventScroll:true})"));
 assert.match(html,/const DATA_VERSION=9;/);
});
