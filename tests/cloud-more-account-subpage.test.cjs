"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const staticHtml=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");

const navStart=html.indexOf("function showPlannerView(view){");
const navEnd=html.indexOf("// v1.5.1: reuse",navStart);
const moreStart=html.indexOf('document.querySelector(".more-menu").addEventListener("click"');
const moreEnd=html.indexOf('document.getElementById("settingsOpen").onclick',moreStart);
const cloudStart=sync.indexOf("function open(){");
const cloudEnd=sync.indexOf("function inviteFeedback(",cloudStart);
assert.ok(navStart>0&&navEnd>navStart&&moreStart>0&&moreEnd>moreStart&&cloudStart>0&&cloudEnd>cloudStart);
const navigationCode=[
 "function closeQuickClan(){}",
 html.slice(navStart,navEnd),
 html.slice(moreStart,moreEnd),
 'document.getElementById("cloudAccountBack").onclick=()=>showPlannerView("more");',
 'document.getElementById("helpClose").onclick=()=>showPlannerView("more");',
 "let user=null,recoveryMode=false,pendingRelease=null;",
 "const $=id=>document.getElementById(id);",
 "const installPendingRelease=()=>{};",
 sync.slice(cloudStart,cloudEnd),
 'window.__simulateLogin=()=>{user={id:"synthetic-only"};document.getElementById("cloudAccount").hidden=false};',
 'window.__simulateLogout=()=>{user=null;document.getElementById("cloudAccount").hidden=true;showPlannerView("plan")};',
 'document.getElementById("cloudOpen").onclick=()=>open();',
 'document.getElementById("cloudClose").onclick=()=>close();'
].join("\n");

test("account management belongs to an actual More subview, not an authentication overlay",()=>{
 assert.match(html,/<section id="view-account" class="view more-subview" aria-labelledby="cloudAccountTitle">/);
 assert.match(html,/<div class="cloud-overlay" id="cloudOverlay" role="dialog"/);
 assert.ok(html.indexOf('id="cloudAccount"')<html.indexOf('id="cloudOverlay"'),"managed controls are outside modal");
 for(const id of ["cloudAccount","cloudClanSelect","cloudRole","cloudAccessList","cloudMakeInvite",
  "cloudBackupPanel","cloudRestoreSnapshot","cloudAudit","cloudLogout","cloudJoin","cloudDeleteBtn"]){
  assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,"single control for "+id);
 }
 assert.match(sync,/if\(user&&!recoveryMode&&typeof window\.CWLShowAccountPage==="function"\)/);
 assert.match(sync,/const wasAuthDialogOpen=\$\("cloudOverlay"\)\.classList\.contains\("open"\)/);
 assert.match(sync,/await listClans\(epoch\)/);
 assert.match(sync,/if\(code\)\{\s*close\(\);\s*await showInviteDialog\(code\);/);
 assert.match(sync,/for\(const id of \["cloudMsg","cloudAccountMessage"\]\)/);
});

test("guest login stays in modal; logged-in Clan & Konto opens responsive page and returns to More",{timeout:120000},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const theme of ["dark","arena"]){
   for(const width of [320,390,768,1366]){
    const page=await browser.newPage({viewport:{width,height:900}});
    try{
     await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
     await page.addScriptTag({content:navigationCode});
     await page.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme);
     await page.locator('.navbtn[data-view="more"]').click();
     await page.locator('[data-more-action="clan"]').click();
     assert.equal(await page.locator("#cloudOverlay.open").count(),1);
     assert.equal(await page.locator("#cloudOverlay").getAttribute("aria-hidden"),"false");
     assert.equal(await page.locator("#view-account.active").count(),0);
     await page.locator("#cloudClose").click();
     assert.equal(await page.locator("#cloudOverlay.open").count(),0);
     await page.evaluate(()=>window.__simulateLogin());
     await page.locator('[data-more-action="clan"]').click();
     assert.equal(await page.locator("#view-account.active").count(),1);
     assert.equal(await page.locator("#cloudOverlay.open").count(),0);
     assert.equal(await page.locator('.navbtn[data-view="more"].active').count(),1);
     assert.equal(await page.locator("#cloudAccount").isVisible(),true);
     assert.equal(await page.locator("#cloudAccessDetails").count(),1);
     assert.equal(await page.locator("#cloudBackupPanel").count(),1);
     assert.equal(await page.locator("#cloudAccountBack").isVisible(),true);
     assert.equal(await page.evaluate(()=>document.body.classList.contains("modal-open")),false);
     const positions=await page.evaluate(()=>({
      viewport:innerWidth,document:document.documentElement.scrollWidth,
      accountRight:document.getElementById("view-account").getBoundingClientRect().right
     }));
     assert.ok(positions.document<=width+2,"horizontal scroll "+JSON.stringify({theme,width,...positions}));
     assert.ok(positions.accountRight<=width+2,"account too wide "+JSON.stringify({theme,width,...positions}));
     await page.locator("#cloudAccountBack").click();
     assert.equal(await page.locator("#view-more.active").count(),1);
     assert.equal(await page.locator('.navbtn[data-view="more"].active').count(),1);
     await page.evaluate(()=>window.__simulateLogout());
     assert.equal(await page.locator("#view-plan.active").count(),1);
    }finally{await page.close()}
   }
  }
 }finally{await browser.close()}
});
test("no account content is cloned and no access form writes during navigation",()=>{
 assert.doesNotMatch(html,/innerHTML\s*=.*cloudAccount/);
 assert.doesNotMatch(html,/cloneNode\(.*cloudAccount/);
 assert.match(html,/window\.CWLShowAccountPage=\(\)=>showPlannerView\("account"\)/);
 assert.match(html,/document\.getElementById\("cloudAccountBack"\)\.onclick=\(\)=>showPlannerView\("more"\)/);
 assert.doesNotMatch(sync,/await sb\.from\("cwl_cloud_profiles"\).*CWLShowAccountPage/);
});
