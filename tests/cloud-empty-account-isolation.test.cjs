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
const start=sync.indexOf("function clearClanAccountDetails(){");
const end=sync.indexOf("async function useSession(session){",start);
assert.ok(start>=0&&end>start,"tenant-specific UI clearing helper must exist");
const lifecycle=[
 "const $=id=>document.getElementById(id);",
 "const text=(id,value)=>{if($(id))$(id).textContent=value};",
 "const toggle=(id,show)=>{if($(id))$(id).hidden=!show};",
 sync.slice(start,end),
 "window.__accountUI={clearClanAccountDetails,showClanAccountDetails};"
].join("\n");

test("new account uses generic examples, not the original owner's clan identity",()=>{
 assert.doesNotMatch(html,/placeholder="United Fighters"/);
 assert.doesNotMatch(html,/placeholder="#99JP2RL2"/);
 assert.match(html,/id="cloudClanName" placeholder="z\. B\. Mein Clash-Clan"/);
 assert.match(html,/id="cloudAccessDetails" hidden open/);
 for(const id of ["cloudAliasControls","cloudAccountAuditSection","cloudAccountImportSection"]){
  assert.match(html,new RegExp('id="'+id+'" hidden'));
 }
});

test("unlinked account hides tenant-only controls and clears stale membership and audit DOM",{timeout:90000},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [390,1366]){
   const page=await browser.newPage({viewport:{width,height:900}});
   try{
    await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
    await page.addScriptTag({content:lifecycle});
    await page.evaluate(()=>{
     document.getElementById("cloudAccount").hidden=false;
     document.getElementById("cloudNewClanDetails").open=true;
     for(const id of ["cloudAccessList","cloudPendingList","cloudBlockedList",
      "cloudAudit","cloudActiveMembers"])
       document.getElementById(id).textContent="ALTE DATEN AUS ANDEREM KONTO";
     for(const id of ["cloudAccessCount","cloudPendingCount","cloudBlockedCount"])
       document.getElementById(id).textContent="(12)";
     document.getElementById("cloudAlias").value="Alter Besitzer";
     window.__accountUI.showClanAccountDetails();
    });
    assert.equal(await page.locator("#cloudAccessDetails").isVisible(),true);
    await page.evaluate(()=>window.__accountUI.clearClanAccountDetails());
    for(const id of ["cloudAccessDetails","cloudAliasControls","cloudAccountAuditSection",
     "cloudAccountImportSection","cloudDangerZone","cloudReload","cloudActiveMembers"]){
      assert.equal(await page.locator("#"+id).isVisible(),false,id+" must be hidden");
    }
    assert.equal(await page.locator("#cloudClanName").isVisible(),true,"create-clan control stays available");
    assert.equal(await page.locator("#cloudJoinCode").isVisible(),true,"invite input stays available");
    assert.equal(await page.locator("#cloudAlias").inputValue(),"");
    const values=await page.evaluate(()=>["cloudAccessList","cloudPendingList","cloudBlockedList",
     "cloudAudit","cloudActiveMembers","cloudAccessCount","cloudPendingCount",
     "cloudBlockedCount"].map(id=>document.getElementById(id).textContent));
    assert.ok(values.every(x=>x===""),JSON.stringify(values));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});

test("auth changes, clan switches and delayed responses are guarded",()=>{
 assert.match(sync,/const previousUserId=user\?\.id\|\|null/);
 assert.match(sync,/user=session\?\.user\|\|null;\s*clearClanAccountDetails\(\)/);
 assert.match(sync,/if\(previousUserId&&previousUserId!==user\?\.id&&cloud\.active\)await leaveCloud\(\)/);
 assert.match(sync,/clanId=nextClan;revision=null;role=null;\s*clearClanAccountDetails\(\)/);
 assert.match(sync,/expected!==clanId\|\|expectedEpoch!==accountEpoch\|\|expectedActor!==user\?\.id/);
 assert.match(sync,/await loadAccessList\(clanId\);\s*if\(epoch!==accountEpoch\|\|!user\|\|clanId!==nextClan\)return;\s*showClanAccountDetails\(\)/);
});
