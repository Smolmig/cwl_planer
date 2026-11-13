"use strict";
// #269 release gate: a late stats response from Clan A must never keep
// Clan A's figures on screen after switching to Clan B.
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const http=require("node:http");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const serve=()=>http.createServer((req,res)=>{
 const name=new URL(req.url||"/","http://localhost").pathname.slice(1);
 if(name==="cloud-sync.mjs"){
  res.writeHead(200,{"Content-Type":"text/javascript"});res.end("export {};");return;
 }
 if(name==="cloud-app.html"||/^[a-z0-9-]+\.mjs$/.test(name)){
  const file=path.join(root,name);
  if(fs.existsSync(file)){
   res.writeHead(200,{"Content-Type":name.endsWith(".html")?"text/html":"text/javascript"});
   res.end(fs.readFileSync(file));return;
  }
 }
 res.writeHead(404);res.end();
});
test("Switching tenants supersedes an in-flight statistics refresh and never shows old clan results",{
 timeout:120000
},async()=>{
 const server=serve();await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:390,height:850}});
  try{
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",
    {waitUntil:"domcontentloaded"});
   const result=await page.evaluate(async()=>{
    document.body.classList.add("cloud-mode");
    document.querySelectorAll(".view.active").forEach(e=>e.classList.remove("active"));
    document.getElementById("view-stats").classList.add("active");
    const {createCloudStats}=await import("./cwl-stats.mjs?race-release");
    const clanA="11111111-1111-4111-8111-111111111111";
    const clanB="22222222-2222-4222-8222-222222222222";
    const war=(key,stars)=>({
     war_key:key,war_type:"normal",source:"api",finalized:true,
     started_at:"2026-09-01T12:00:00Z",team_size:2,
     opponent_name:key==="clan-a-war"?"Enemy Alpha":"Enemy Beta",
     opponent_tag:"#2PYL",missed_log_complete:false
    });
    const data={
     [clanA]:{cwl_stat_wars:[war("clan-a-war",3)],
       cwl_stat_attacks:[{war_key:"clan-a-war",attacker_tag:"#8PYL",
        attacker_name:"Player Alpha",attack_order:1,stars:3,destruction:100,
        attacker_th:18,defender_th:18}]},
     [clanB]:{cwl_stat_wars:[war("clan-b-war",0)],
       cwl_stat_attacks:[{war_key:"clan-b-war",attacker_tag:"#8PYL",
        attacker_name:"Player Beta",attack_order:1,stars:0,destruction:5,
        attacker_th:18,defender_th:18}]}
    };
    let resolveA,resolveB,blockA=false,blockB=false;
    const waitA=new Promise(r=>resolveA=r),waitB=new Promise(r=>resolveB=r);
    let queryClan=clanA;
    const sb={from(table){
     let target=null;
     return {
      select(){return this},
      eq(key,val){if(key==="clan_id")target=val;return this},
      order(){return this},
      async range(from,to){
       // Only the war metadata query is deferred for the race test.
       if(table==="cwl_stat_wars"&&target===clanA&&blockA)await waitA;
       if(table==="cwl_stat_wars"&&target===clanB&&blockB)await waitB;
       return {data:(data[target]?.[table]||[]).slice(from,to+1),error:null};
      },
      async limit(){return {data:[],error:null}}
     };
    }};
    const ctx={active:true,clanId:clanA,role:"viewer",clanTag:"#99JP2RL2",
     memberTags:["#8PYL"],memberProfiles:[]};
    const stats=createCloudStats({sb,context:()=>ctx,notify:()=>{},
     confirmAction:async()=>false});
    await stats.load();
    const before=document.getElementById("statsSummary").textContent;
    if(!before.includes("100%"))throw Error("Initial Clan A percentage did not render: "+before);
    blockA=true;blockB=true;
    const stale=stats.load(true);
    await Promise.resolve();
    ctx.clanId=clanB;ctx.clanTag="#2JGC2J8VG";
    const next=stats.load();
    await Promise.resolve();
    const during=document.getElementById("statsSummary").textContent;
    if(during.includes("100%")||during.includes("Player Alpha"))
     throw Error("Clan A leaked into Clan B during the waiting state");
    resolveB();await next;
    const afterB=document.getElementById("statsSummary").textContent;
    if(!afterB.includes("0%"))throw Error("Clan B was blocked by Clan A loading: "+afterB);
    resolveA();await stale;
    const afterLate=document.getElementById("statsSummary").textContent;
    if(afterLate!==afterB)throw Error("Late response from Clan A changed Clan B");
    blockA=false;blockB=false;
    ctx.clanId=clanA;ctx.clanTag="#99JP2RL2";
    await stats.load();
    const returnA=document.getElementById("statsSummary").textContent;
    if(!returnA.includes("100%"))throw Error("Returning to Clan A failed");
    return {before,during,afterB,afterLate,returnA};
   });
   assert.match(result.before,/100%/);
   assert.doesNotMatch(result.during,/100%/);
   assert.match(result.afterB,/0%/);
   assert.equal(result.afterLate,result.afterB);
   assert.match(result.returnA,/100%/);
   assert.deepEqual(errors,[]);
  }finally{await page.close()}
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});
