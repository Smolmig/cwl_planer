"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const {chromium}=require("playwright");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const sync=fs.readFileSync(path.join(__dirname,"..","cloud-sync.mjs"),"utf8");
const staticHtml=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
function compileLogout(mock={}){
 const begin=sync.indexOf("async function logout(){"),end=sync.indexOf("async function exportCloud(){",begin);
 assert.ok(begin>=0&&end>begin);
 const calls={signedOut:0,leftCloud:0,closed:0,backup:0,confirmed:0,options:null};
 const context={
  changedSerial:mock.changedSerial??null,blocked:!!mock.blocked,saving:false,
  console:{warn(){}},
  ensureSaved:async()=>{if(mock.saveError)throw Error("Could not save Cloud state")},
  sb:{auth:{signOut:async opts=>{calls.signedOut++;calls.options=opts;
   return {error:mock.signOutError||null}}}},
  storage:{
   saveJson:()=>{calls.backup++;if(mock.backupError)throw Error("No disk space")},
   confirmAction:async()=>{calls.confirmed++;return !!mock.confirm}
  },
  useSession:async session=>{assert.equal(session,null);calls.leftCloud++},
  close:()=>{calls.closed++}
 };
 return {logout:vm.runInNewContext(sync.slice(begin,end)+"\nlogout",context),calls};
}
test("expired desktop Supabase session never strands the user when logging out",async()=>{
 const x=compileLogout({signOutError:{message:"Auth session missing!"}});
 await x.logout();
 assert.equal(x.calls.signedOut,1);
 assert.equal(x.calls.options.scope,"local");
 assert.equal(x.calls.leftCloud,1);
 assert.equal(x.calls.closed,1);
});
test("pending Cloud changes require a downloadable JSON backup and explicit confirmation",async()=>{
 const cancelled=compileLogout({changedSerial:"pending",saveError:true,confirm:false});
 await cancelled.logout();
 assert.deepEqual([cancelled.calls.backup,cancelled.calls.confirmed,cancelled.calls.signedOut],[1,1,0]);
 const confirmed=compileLogout({changedSerial:"pending",saveError:true,confirm:true});
 await confirmed.logout();
 assert.deepEqual([confirmed.calls.backup,confirmed.calls.confirmed,confirmed.calls.signedOut,confirmed.calls.leftCloud],[1,1,1,1]);
});
test("logout does not discard unsaved changes when backup fails or session error is unexpected",async()=>{
 const noBackup=compileLogout({changedSerial:"pending",saveError:true,backupError:true,confirm:true});
 await assert.rejects(noBackup.logout(),/Backup konnte nicht erstellt/);
 assert.equal(noBackup.calls.signedOut,0);
 const apiFail=compileLogout({signOutError:{message:"Remote server error"}});
 await assert.rejects(apiFail.logout(),e=>e&&e.message==="Remote server error");
 assert.equal(apiFail.calls.leftCloud,0);
});
test("account icon opens a quick menu with direct logout, including at small mobile widths",{timeout:90000},async()=>{
 const start=sync.indexOf('const accountQuickMenu=$("accountQuickMenu")');
 const end=sync.indexOf('bind("cloudClanSelect"',start);
 assert.ok(start>=0&&end>start);
 const clickWiring=[
  'const $=id=>document.getElementById(id);',
  'let __logout=0,__manage=0;',
  'function bind(id,event,handler){$(id).addEventListener(event,handler)}',
  'async function logout(){__logout++}',
  'function open(){__manage++}',
  sync.slice(start,end),
  'window.__accountCalls=()=>({logout:__logout,manage:__manage});'
 ].join("\n");
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,1366]){
   const page=await browser.newPage({viewport:{width,height:844}});
   try{
    await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
    await page.addScriptTag({content:clickWiring});
    await page.evaluate(()=>document.body.classList.add("cloud-mode"));
    assert.equal(await page.locator("#accountQuickButton").isVisible(),true);
    await page.locator("#accountQuickButton").click();
    assert.equal(await page.locator("#accountQuickMenu").isVisible(),true);
    assert.equal(await page.locator("#accountQuickButton").getAttribute("aria-expanded"),"true");
    await page.locator("#accountQuickManage").click();
    assert.deepEqual(await page.evaluate(()=>window.__accountCalls()),{logout:0,manage:1});
    await page.locator("#accountQuickButton").click();
    await page.locator("#accountQuickLogout").click();
    assert.deepEqual(await page.evaluate(()=>window.__accountCalls()),{logout:1,manage:1});
    assert.equal(await page.locator("#accountQuickMenu").isVisible(),false);
    const info=await page.evaluate(()=>({
      width:document.documentElement.scrollWidth,viewport:innerWidth,
      account:document.getElementById("accountQuickButton").getBoundingClientRect().right
    }));
    assert.ok(info.width<=width+2,JSON.stringify(info));
    assert.ok(info.account<=width+2,JSON.stringify(info));
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
