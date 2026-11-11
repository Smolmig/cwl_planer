"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {chromium}=require("playwright");
const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const core=fs.readFileSync(path.join(root,"cwl-planning-core.js"),"utf8");
function guestProfile(){
 const ms=[
  ...Array.from({length:14},(_,i)=>({id:"fix"+i,name:"Fix "+i,playerTag:"",
    participating:true,fixed:true,priority:0,rotationWeight:"balanced",
    targetDays:null,threeStar:"unknown",statuses:Array(7).fill("auto"),note:""})),
  {id:"A",name:"Spieler Alpha",playerTag:"#AAA",participating:true,fixed:false,
    priority:0,rotationWeight:"preferred",targetDays:5,threeStar:"unknown",
    statuses:Array(7).fill("auto"),note:"Sicherer Rückkehrer"},
  {id:"B",name:"Spieler Beta",playerTag:"#BBB",participating:true,fixed:false,
    priority:0,rotationWeight:"balanced",targetDays:null,threeStar:"unknown",
    statuses:Array(7).fill("auto"),note:""}
 ];
 const p={id:"browser-test",name:"Test ohne Cloud",config:{slots:15,days:7,memberSort:"manual"},
  members:ms,archivedMembers:[],locks:Array.from({length:7},()=>({locked:false,lineup:[]})),
  dayGoals:Array.from({length:7},()=>({townHall:{},strength:{}})),archives:[]};
 return {version:9,dataVersion:9,activeProfileId:p.id,profiles:[p]};
}
function makeServer(){
 return http.createServer((req,res)=>{
  const pathname=(req.url||"").split("?")[0];
  if(pathname==="/cloud-app.html"){
   res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;
  }
  if(pathname==="/cwl-planning-core.js"){
   res.writeHead(200,{"content-type":"text/javascript; charset=utf-8"});res.end(core);return;
  }
  if(pathname==="/cloud-sync.mjs"){
   // Suppress all real Supabase/Auth calls in this synthetic guest-mode UI test.
   res.writeHead(200,{"content-type":"text/javascript; charset=utf-8"});res.end("export {};");return;
  }
  res.writeHead(404);res.end("");
 });
}
test("Chromium: combined cloud guest cards and notes work on mobile and desktop without Supabase",{timeout:150000},async(t)=>{
 const server=makeServer();await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  for(const size of [{name:"iPhone width",width:390,height:844},{name:"desktop",width:1280,height:800}]){
   await t.test(size.name,async()=>{
    const page=await browser.newPage({viewport:{width:size.width,height:size.height}});
    page.setDefaultTimeout(12000);
    const errors=[];page.on("pageerror",err=>errors.push(err.message));
    try{
     await page.addInitScript(data=>localStorage.setItem("cwl_planer_mobile_v9",JSON.stringify(data)),guestProfile());
     await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",{waitUntil:"domcontentloaded"});
     await page.locator('.navbtn[data-view="members"]').first().click();
     const alpha=page.locator('#memberList .member[data-id="A"]');
     await alpha.waitFor();
     assert.match(await alpha.locator(".member-note-preview").textContent(),/Sicherer Rückkehrer/);
     assert.equal(await page.locator('#memberList .member[data-id="fix0"] .member-note-preview').count(),0);
     await alpha.locator(".member-edit-toggle").click();
     const rotation=alpha.locator(".member-rotation-weight");
     assert.equal(await rotation.inputValue(),"preferred");
     assert.equal(await alpha.locator(".member-target-days").inputValue(),"5");
     assert.equal(await page.locator('#memberList .member[data-id="fix0"] .member-rotation-weight').count(),0);
     await alpha.locator(".member-note-btn").click();
     await page.locator("#inlineActionPanel.open").waitFor();
     const input=page.locator("#inlineActionInput");
     assert.equal(await input.getAttribute("maxlength"),"200");
     await input.fill("Neue Notiz ★ & <kein HTML>");
     await page.locator("#inlineActionButtons .primary").click();
     assert.match(await alpha.locator(".member-note-preview").textContent(),/Neue Notiz/);
     const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("cwl_planer_mobile_v9")));
     const saved=stored.profiles[0].members.find(m=>m.id==="A");
     assert.equal(saved.note,"Neue Notiz ★ & <kein HTML>");
     const scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
     assert.ok(scrollWidth<=size.width+3,"Horizontal overflow: "+scrollWidth+" for "+size.width);
     assert.deepEqual(errors,[],"No runtime errors in guest-mode Cloud HTML");
    }finally{await page.close()}
   });
  }
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
});

test("Chromium: linked Clash roster rejects manual mutations until emergency is confirmed",{timeout:150000},async()=>{
 const server=makeServer();await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.setDefaultTimeout(12000);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  try{
   await page.addInitScript(data=>localStorage.setItem("cwl_planer_mobile_v9",JSON.stringify(data)),guestProfile());
   await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",{waitUntil:"domcontentloaded"});
   await page.locator('.navbtn[data-view="members"]').first().click();
   await page.evaluate(()=>{
    const m=window.CWLLegacy.getProfile().members.find(m=>m.id==="A");
    m.cocOrder=0; m.townHall=19;
    window.CWLCloud={
     active:true,hasApiClan:()=>true,isEmergencyEditing:()=>false,
     afterRender(){},renderLive(){},onLocalChange(){}
    };
    window.CWLLegacy.rerender();
   });
   const alpha=page.locator('#memberList .member[data-id="A"]');
   await alpha.waitFor();
   assert.equal(await alpha.locator(".member-name-edit").count(),0,"API name pencil is hidden");
   await alpha.locator(".member-edit-toggle").click();
   assert.equal(await alpha.locator(".member-th-picker").count(),0,"API TH picker is hidden");
   assert.equal(await alpha.locator(".delete-member").count(),0,"API deletion button is hidden");
   assert.equal(await alpha.locator(".member-note-btn").count(),1,"notes remain editable");
   const res=await page.evaluate(()=>{
    const p=window.CWLLegacy.getProfile(),before=p.members.length;
    const deletion=window.removeMembers(new Set(["A"]));
    const added=window.addMany("ShouldNotAppear");
    return {before,after:p.members.length,deletionBlocked:deletion.blocked,added};
   });
   assert.equal(res.deletionBlocked,true);
   assert.equal(res.added,0);
   assert.equal(res.before,res.after,"API managed member and roster untouched");
   await page.evaluate(()=>{
    window.CWLLegacy.getProfile().members=[];
    window.CWLLegacy.rerender();
   });
   assert.equal(await page.locator("#emptyMultiAdd").count(),0,"linked empty roster must not offer manual bulk import");
   assert.equal(await page.locator("#emptyImport").count(),0);
   assert.match(await page.locator("#memberList").textContent(),/Jetzt abgleichen/);
   await page.evaluate(()=>{
    window.CWLCloud.isEmergencyEditing=()=>true;
    window.CWLLegacy.rerender();
   });
   assert.equal(await page.locator("#emptyMultiAdd").count(),1,"emergency explicitly re-enables manual roster tools");
   assert.deepEqual(errors,[],"no runtime exception");
  }finally{await page.close()}
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
});


test("Einsätze: tapping a player opens played and planned days even with real Clash results",{
 timeout:120000
},async()=>{
 const profile=guestProfile();
 const p=profile.profiles[0];
 p.locks[0]={locked:true,lineup:[
  ...Array.from({length:14},(_,i)=>"fix"+i),"A"
 ]};
 const server=makeServer();
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:850}});
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   try{
    await page.addInitScript(data=>
      localStorage.setItem("cwl_planer_mobile_v9",JSON.stringify(data)),profile);
    await page.goto("http://127.0.0.1:"+server.address().port+
      "/cloud-app.html",{waitUntil:"domcontentloaded"});
    // Force a verified result that previously reached an unbound playerTag
    // inside renderSummary(), but only after a player disclosure was opened.
    await page.evaluate(()=>{
      window.CWLCloud={...(window.CWLCloud||{}),active:false,
       getPlayedAttackResults:()=>({1:{"#AAA":{
        stars:3,percent:100,missed:false
       }}})};
    });
    await page.locator('.navbtn[data-view="summary"]').first().click();
    const button=page.locator(
      '#summaryList .summary-player-toggle[data-member-id="A"]');
    await button.waitFor();
    assert.equal(await button.getAttribute("aria-expanded"),"false");
    await button.click();
    assert.equal(await button.getAttribute("aria-expanded"),"true");
    const detail=page.locator("#summaryList .summary-player-days");
    assert.equal(await detail.count(),1);
    assert.match((await detail.innerText()).replace(/\s+/g," "),/Tag 1.*gespielt.*3★.*100 %/);
    await button.click();
    assert.equal(await button.getAttribute("aria-expanded"),"false");
    assert.equal(await detail.count(),0);
    assert.deepEqual(errors,[],"No JavaScript errors at width "+width+": "+errors);
   }finally{await page.close()}
  }
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
});
