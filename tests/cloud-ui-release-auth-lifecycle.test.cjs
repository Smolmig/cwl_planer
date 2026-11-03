"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const cloud=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const staticHtml=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
const portion=(s,a,b)=>{
 const start=s.indexOf(a),end=s.indexOf(b,start);
 assert.ok(start>=0&&end>start,"Missing source slice: "+a);
 return s.slice(start,end);
};
const nav=portion(html,"function showPlannerView(view){","// v1.5.1: reuse");
const lifecycle=[
 portion(cloud,"function open(){","function inviteFeedback("),
 portion(cloud,"function showSignedIn(){","function cleanTag("),
 portion(cloud,"async function useSession(session){","async function leaveCloud(")
].join("\n");
const harness=[
 'let user=null,recoveryMode=false,forgotOpen=false,pendingRelease=null,accountEpoch=0,inviteCode="";',
 'let clanLoads=0,invites=0,logoutCalls=0;',
 'const $=id=>document.getElementById(id);',
 'function toggle(id,enabled){const e=$(id);if(e)e.hidden=!enabled}',
 'function text(id,value){const e=$(id);if(e)e.textContent=value??""}',
 'function pendingInviteCode(){return inviteCode}',
 'async function listClans(epoch){clanLoads++;return epoch}',
 'async function showInviteDialog(code){invites++;document.getElementById("inviteWelcome").classList.add("open")}',
 'async function leaveCloud(){logoutCalls++;document.querySelector(\'.navbtn[data-view="plan"]\').click()}',
 'function installPendingRelease(){}',
 nav,
 'window.CWLShowAccountPage=()=>showPlannerView("account");',
 'document.querySelectorAll(".navbtn").forEach(b=>b.onclick=()=>showPlannerView(b.dataset.view));',
 'document.getElementById("cloudAccountBack").onclick=()=>showPlannerView("more");',
 lifecycle,
 'window.__accountHarness={open,close,showSignedIn,useSession,',
 ' startRecovery:()=>{recoveryMode=true;showSignedIn();open()},',
 ' setInvite:code=>{inviteCode=code},',
 ' ready:()=>({clanLoads,invites,logoutCalls})',
 '};'
].join("\n");
test("real Cloud session routes explicit login to Account but leaves resumed sessions on current view and recovery in modal",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [390,1366]){
   const page=await browser.newPage({viewport:{width,height:900}});
   try{
    await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
    await page.addScriptTag({content:harness});
    await page.locator('.navbtn[data-view="more"]').click();
    await page.evaluate(()=>window.__accountHarness.open());
    assert.equal(await page.locator("#cloudOverlay.open").count(),1,"guest login stays a dialog");
    await page.evaluate(()=>window.__accountHarness.useSession({user:{id:"synthetic",email:"example.invalid"}}));
    assert.equal(await page.locator("#view-account.active").count(),1,"login routes to Account");
    assert.equal(await page.locator("#cloudOverlay.open").count(),0);
    assert.equal(await page.locator("#cloudAccount").isVisible(),true);
    assert.equal(await page.locator('.navbtn[data-view="more"].active').count(),1);
    await page.locator("#cloudAccountBack").click();
    await page.locator('.navbtn[data-view="members"]').click();
    await page.evaluate(()=>window.__accountHarness.useSession({user:{id:"synthetic",email:"example.invalid"}}));
    assert.equal(await page.locator("#view-members.active").count(),1,"session resume cannot hijack current page");
    assert.equal(await page.locator("#cloudOverlay.open").count(),0);
    await page.evaluate(()=>window.__accountHarness.useSession(null));
    assert.equal(await page.locator("#view-plan.active").count(),1,"logout leaves account area");
    assert.equal(await page.locator("#cloudAccount").isVisible(),false);
    await page.evaluate(()=>window.__accountHarness.startRecovery());
    assert.equal(await page.locator("#cloudRecovery").isVisible(),true);
    assert.equal(await page.locator("#cloudOverlay.open").count(),1,"recovery stays modal");
    assert.equal(await page.locator("#view-account.active").count(),0);
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
test("invitation session uses invitation dialog rather than account page",{
 timeout:90000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  try{
   await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
   await page.addScriptTag({content:harness});
   await page.evaluate(()=>window.__accountHarness.setInvite("synthetic-invite-token"));
   await page.evaluate(()=>window.__accountHarness.open());
   await page.evaluate(()=>window.__accountHarness.useSession({user:{id:"invite",email:"test.invalid"}}));
   assert.equal(await page.locator("#inviteWelcome.open").count(),1);
   assert.equal(await page.locator("#view-account.active").count(),0);
   assert.equal(await page.locator("#cloudOverlay.open").count(),0);
   assert.equal((await page.evaluate(()=>window.__accountHarness.ready())).invites,1);
  }finally{await page.close()}
 }finally{await browser.close()}
});
test("live sign-out and epoch guards remain intact without invoking real auth or Supabase",()=>{
 assert.match(cloud,/async function leaveCloud\(\)\{[\s\S]{0,340}document\.querySelector\('\.navbtn\[data-view="plan"\]'\)\?\.click\(\)/);
 assert.match(cloud,/await listClans\(epoch\);\s*if\(epoch!==accountEpoch\)return;/);
 assert.match(cloud,/if\(code\)\{\s*close\(\);\s*await showInviteDialog\(code\)/);
});
