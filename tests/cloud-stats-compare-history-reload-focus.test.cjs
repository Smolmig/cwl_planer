"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const serve=()=>http.createServer((req,res)=>{
 const name=new URL(req.url||"/","http://localhost").pathname.slice(1);
 if(name==="cloud-sync.mjs"){
   res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};");return;
 }
 if(name==="cloud-app.html"||name==="cwl-planning-core.js"||
   /^[a-z0-9-]+\.mjs$/.test(name)){
   if(fs.existsSync(path.join(root,name))){
     res.writeHead(200,{"content-type":name.endsWith(".html")?"text/html":"text/javascript"});
     res.end(read(name));return;
   }
 }
 res.writeHead(404);res.end("");
});
const widths=[[320,"arena"],[390,"dark"],[430,"light"],[1366,"arena"]];

test("Duel details keep focus, open state, selected players and scroll on new attack data",{
 timeout:120000
},async()=>{
 const server=serve();await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [width,theme] of widths){
   const page=await browser.newPage({viewport:{width,height:850}});
   try{
    const jsErrors=[];page.on("pageerror",err=>jsErrors.push(err.message));
    await page.goto("http://127.0.0.1:"+server.address().port+
      "/cloud-app.html",{waitUntil:"domcontentloaded"});
    const result=await page.evaluate(async theme=>{
      document.documentElement.dataset.theme=theme;
      document.documentElement.style.scrollBehavior="auto";
      document.body.classList.add("cloud-mode");
      document.querySelectorAll(".view.active").forEach(e=>e.classList.remove("active"));
      document.querySelector("#view-stats").classList.add("active");
      const {createCloudStats}=await import("./cwl-stats.mjs");
      const wars=Array.from({length:16},(_,i)=>({
       war_key:"normal:duel"+i,war_type:i%3===0?"cwl":"normal",
       started_at:new Date(Date.UTC(2026,9,20+i)).toISOString(),
       team_size:15,finalized:true,source:"api",opponent_name:"Opponent"
      }));
      const attacks=wars.flatMap(w=>[
       {war_key:w.war_key,attacker_tag:"#2PYL",attacker_name:"Alpha",
        attacker_th:18,defender_th:18,stars:3,destruction:100,attack_order:1},
       {war_key:w.war_key,attacker_tag:"#2PQL",attacker_name:"Beta",
        attacker_th:18,defender_th:18,stars:2,destruction:85,attack_order:1}
      ]);
      const sb={from(name){
       const data=name==="cwl_stat_wars"?wars:
         name==="cwl_stat_attacks"?attacks:[];
       return {select(){return this},eq(){return this},order(){return this},
        limit(){return Promise.resolve({data,error:null})},
        range(){return Promise.resolve({data,error:null})}};
      }};
      const stats=createCloudStats({sb,context:()=>({
       active:true,clanId:"test-clan",role:"viewer",
       memberTags:["#2PYL","#2PQL"]
      }),notify:()=>{},confirmAction:async()=>true});
      await stats.load();
      document.querySelector('[data-stats-section="compare"]').click();
      const beforeFirst=document.querySelector("#statsDuelLeft").value;
      const beforeSecond=document.querySelector("#statsDuelRight").value;
      const beforeCompare=document.querySelector("#statsCompareType").value;
      const details=document.querySelector("#statsDuelResults .stats-duel-details");
      details.open=true;
      await new Promise(done=>setTimeout(done,0));
      const summary=details.querySelector("summary");
      summary.scrollIntoView({block:"center"});
      summary.focus({preventScroll:true});
      const beforeTop=summary.getBoundingClientRect().top;
      const oldSummary=summary;
      const oldSample=document.querySelector("#statsDuelResults .stats-duel-sample").textContent;
      attacks.push({war_key:"normal:duel15",attacker_tag:"#2PYL",
       attacker_name:"Alpha",attacker_th:18,defender_th:18,attack_order:2,
       stars:3,destruction:100});
      await stats.load();
      const newDetails=document.querySelector("#statsDuelResults .stats-duel-details");
      const newSummary=newDetails.querySelector("summary");
      const afterTop=newSummary.getBoundingClientRect().top;
      const newSample=document.querySelector("#statsDuelResults .stats-duel-sample").textContent;
      return {
       open:newDetails.open,focused:document.activeElement===newSummary,
       replaced:oldSummary!==newSummary,
       beforeTop,afterTop,beforeFirst,beforeSecond,beforeCompare,
       afterFirst:document.querySelector("#statsDuelLeft").value,
       afterSecond:document.querySelector("#statsDuelRight").value,
       afterCompare:document.querySelector("#statsCompareType").value,
       changedSample:oldSample!==newSample,
       width:innerWidth,scrollWidth:document.documentElement.scrollWidth
      };
    },theme);
    const note=JSON.stringify({width,theme,result});
    assert.equal(result.open,true,note);
    assert.equal(result.focused,true,note);
    assert.equal(result.replaced,true,note);
    assert.ok(Math.abs(result.afterTop-result.beforeTop)<5,note);
    assert.equal(result.afterFirst,result.beforeFirst,note);
    assert.equal(result.afterSecond,result.beforeSecond,note);
    assert.equal(result.afterCompare,result.beforeCompare,note);
    assert.equal(result.changedSample,true,note);
    assert.ok(result.scrollWidth<=result.width+3,note);
    assert.deepEqual(jsErrors,[],note);
   }finally{await page.close()}
  }
 }finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
 }
});

test("History time table and war cards retain keyboard context and stable visible war on refresh",{
 timeout:120000
},async()=>{
 const server=serve();await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [width,theme] of widths){
   const page=await browser.newPage({viewport:{width,height:850}});
   try{
    const jsErrors=[];page.on("pageerror",err=>jsErrors.push(err.message));
    await page.goto("http://127.0.0.1:"+server.address().port+
      "/cloud-app.html",{waitUntil:"domcontentloaded"});
    const result=await page.evaluate(async theme=>{
      document.documentElement.dataset.theme=theme;
      document.documentElement.style.scrollBehavior="auto";
      document.body.classList.add("cloud-mode");
      document.querySelectorAll(".view.active").forEach(e=>e.classList.remove("active"));
      document.querySelector("#view-stats").classList.add("active");
      const {createCloudStats}=await import("./cwl-stats.mjs");
      const wars=Array.from({length:30},(_,i)=>({
       war_key:"normal:history"+i,war_type:"normal",
       started_at:new Date(Date.UTC(2026,8,1+i)).toISOString(),
       team_size:15,finalized:true,source:"api",opponent_name:"Opponent "+i
      }));
      const attacks=wars.map((w,i)=>({
       war_key:w.war_key,attacker_tag:"#2PYL",attacker_name:"Alpha",
       attacker_th:18,defender_th:18,attack_order:1,stars:i%2?2:3,destruction:i%2?85:100
      }));
      const sb={from(name){
       const data=name==="cwl_stat_wars"?wars:name==="cwl_stat_attacks"?attacks:[];
       return {select(){return this},eq(){return this},order(){return this},
        limit(){return Promise.resolve({data,error:null})},
        range(){return Promise.resolve({data,error:null})}};
      }};
      const stats=createCloudStats({sb,context:()=>({
       active:true,clanId:"test-clan",role:"viewer",memberTags:["#2PYL"]
      }),notify:()=>{},confirmAction:async()=>true});
      await stats.load();
      document.querySelector('[data-stats-section="history"]').click();
      const table=document.querySelector("#statsTrendTable details");
      table.open=true;
      await new Promise(done=>setTimeout(done,0));
      const oldTableSummary=table.querySelector("summary");
      oldTableSummary.scrollIntoView({block:"center"});
      oldTableSummary.focus({preventScroll:true});
      const tableTop=oldTableSummary.getBoundingClientRect().top;
      attacks.push({war_key:"normal:history29",attacker_tag:"#2PYL",attacker_name:"Alpha",
       attacker_th:18,defender_th:18,attack_order:2,stars:3,destruction:100});
      await stats.load();
      const newTable=document.querySelector("#statsTrendTable details");
      const newTableSummary=newTable.querySelector("summary");
      const tableResult={
       open:newTable.open,focused:document.activeElement===newTableSummary,
       replaced:oldTableSummary!==newTableSummary,
       delta:Math.abs(newTableSummary.getBoundingClientRect().top-tableTop)
      };
      // Keep the table disclosure open while reading a long history below it.
      const selected=document.querySelector(
        '#statsWarHistory [data-war-key="normal:history14"]');
      selected.open=true;
      await new Promise(done=>setTimeout(done,0));
      const summary=selected.querySelector("summary");
      summary.scrollIntoView({block:"center"});
      summary.focus({preventScroll:true});
      const previousTop=summary.getBoundingClientRect().top;
      const oldElement=selected;
      // Adding a more recent war inserts a card above the currently read one.
      const newer={war_key:"normal:historyNew",war_type:"normal",
        started_at:"2026-11-03T12:00:00Z",team_size:15,finalized:true,
        source:"api",opponent_name:"Newest"};
      wars.unshift(newer);
      attacks.push({war_key:newer.war_key,attacker_tag:"#2PYL",attacker_name:"Alpha",
        attacker_th:18,defender_th:18,attack_order:1,stars:3,destruction:100});
      await stats.load();
      const after=document.querySelector(
        '#statsWarHistory [data-war-key="normal:history14"]');
      const afterSummary=after?.querySelector("summary");
      const result={
       table:tableResult,
       historyOpen:after?.open,
       focus:document.activeElement===afterSummary,
       replaced:after!==oldElement,
       beforeTop:previousTop,afterTop:afterSummary?.getBoundingClientRect().top,
       newWarVisible:!!document.querySelector(
         '#statsWarHistory [data-war-key="normal:historyNew"]'),
       newAttackCount:document.querySelectorAll(
         '#statsWarHistory [data-war-key="normal:history14"] .war-history-attack').length,
       width:innerWidth,scrollWidth:document.documentElement.scrollWidth
      };
      return result;
    },theme);
    const note=JSON.stringify({width,theme,result});
    assert.equal(result.table.open,true,note);
    assert.equal(result.table.focused,true,note);
    assert.equal(result.table.replaced,true,note);
    assert.ok(result.table.delta<5,note);
    assert.equal(result.historyOpen,true,note);
    assert.equal(result.focus,true,note);
    assert.equal(result.replaced,true,note);
    assert.ok(Math.abs(result.afterTop-result.beforeTop)<5,note);
    assert.equal(result.newWarVisible,true,note);
    assert.ok(result.newAttackCount>=1,note);
    assert.ok(result.scrollWidth<=result.width+3,note);
    assert.deepEqual(jsErrors,[],note);
   }finally{await page.close()}
  }
 }finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
 }
});


test("Rathaus comparison details retain keyboard focus and reading position after data reload",{
 timeout:150000
},async()=>{
 const server=serve();await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [width,theme] of [[320,"arena"],[390,"dark"],[430,"light"],
    [699,"arena"],[1366,"dark"]]){
   const page=await browser.newPage({viewport:{width,height:880}});
   try{
    const jsErrors=[];page.on("pageerror",e=>jsErrors.push(e.message));
    await page.goto("http://127.0.0.1:"+server.address().port+
      "/cloud-app.html",{waitUntil:"domcontentloaded"});
    const result=await page.evaluate(async theme=>{
     document.documentElement.dataset.theme=theme;
     document.documentElement.style.scrollBehavior="auto";
     document.body.classList.add("cloud-mode","cloud-role-viewer");
     document.querySelectorAll(".view.active").forEach(el=>el.classList.remove("active"));
     document.querySelector("#view-stats").classList.add("active");
     const {createCloudStats}=await import("./cwl-stats.mjs");
     const wars=Array.from({length:8},(_,i)=>({
      war_key:"matchups:focus"+i,war_type:i%2?"cwl":"normal",
      started_at:new Date(Date.UTC(2026,9,20+i)).toISOString(),
      finalized:true,source:"api",team_size:15,opponent_name:"Opponent "+i
     }));
     const attacks=wars.flatMap(w=>[
      {war_key:w.war_key,attacker_tag:"#2PYL",attacker_name:"Alpha",
       attacker_th:18,defender_th:18,stars:3,destruction:100,attack_order:1},
      {war_key:w.war_key,attacker_tag:"#2PQL",attacker_name:"Beta",
       attacker_th:18,defender_th:17,stars:2,destruction:80,attack_order:1}
     ]);
     const sb={from(name){
      const data=name==="cwl_stat_wars"?wars:
       name==="cwl_stat_attacks"?attacks:[];
      return {select(){return this},eq(){return this},order(){return this},
       limit(){return Promise.resolve({data,error:null})},
       range(){return Promise.resolve({data,error:null})}};
     }};
     const stats=createCloudStats({sb,context:()=>({
      active:true,clanId:"comparison-focus-test",role:"viewer",
      memberTags:["#2PYL","#2PQL"]
     }),notify:()=>{},confirmAction:async()=>true});
     await stats.load();
     document.querySelector('[data-stats-section="compare"]').click();
     const host=document.getElementById("statsMatchupComparison");
     const detail=host.querySelector(".stats-matchup-breakdown");
     detail.open=true;
     await new Promise(done=>setTimeout(done,0));
     const oldSummary=detail.querySelector("summary");
     oldSummary.scrollIntoView({block:"center",behavior:"instant"});
     oldSummary.focus({preventScroll:true});
     const oldTop=oldSummary.getBoundingClientRect().top;
     const oldQuote=host.querySelectorAll(".stats-highlight-col strong")[1].textContent;
     const oldFilter=document.getElementById("statsCompareType").value;
     const oldTime=document.getElementById("statsCompareDays").value;
     attacks.push({war_key:wars[0].war_key,attacker_tag:"#2PYL",
      attacker_name:"Alpha",attacker_th:18,defender_th:18,
      stars:0,destruction:30,attack_order:2});
     await stats.load();
     const refreshed=host.querySelector(".stats-matchup-breakdown");
     const newSummary=refreshed.querySelector("summary");
     const result={
      focused:document.activeElement===newSummary,
      replaced:oldSummary!==newSummary,open:refreshed.open,
      oldTop,newTop:newSummary.getBoundingClientRect().top,
      oldQuote,newQuote:host.querySelectorAll(".stats-highlight-col strong")[1].textContent,
      beforeFilter:oldFilter,afterFilter:document.getElementById("statsCompareType").value,
      beforeTime:oldTime,afterTime:document.getElementById("statsCompareDays").value,
      selectedSection:document.querySelector('[data-stats-panel="compare"]').hidden===false,
      viewerImportHidden:document.getElementById("statsImportButton").hidden,
      scrollOverflow:document.documentElement.scrollWidth-innerWidth
     };
     // A deliberate filter change must keep its own focus and not restore
     // the old summary's reading position.
     const filter=document.getElementById("statsCompareType");
     filter.focus({preventScroll:true});filter.value="normal";
     filter.dispatchEvent(new Event("change",{bubbles:true}));
     result.explicitFilterFocused=document.activeElement===filter;
     result.explicitFilterOpen=host.querySelector(".stats-matchup-breakdown").open;
     result.explicitFilterScope=document.getElementById("statsCompareScope").textContent;
     return result;
    },theme);
    const detail=JSON.stringify({width,theme,result});
    assert.equal(result.focused,true,"summary focus lost: "+detail);
    assert.equal(result.replaced,true,detail);
    assert.equal(result.open,true,detail);
    assert.ok(Math.abs(result.newTop-result.oldTop)<=4,"reading position moved: "+detail);
    assert.equal(result.oldQuote,"100 %",detail);
    assert.notEqual(result.newQuote,result.oldQuote,"changed API evidence did not update: "+detail);
    assert.equal(result.afterFilter,result.beforeFilter,detail);
    assert.equal(result.afterTime,result.beforeTime,detail);
    assert.equal(result.selectedSection,true,detail);
    assert.equal(result.viewerImportHidden,true,detail);
    assert.ok(result.scrollOverflow<=3,detail);
    assert.equal(result.explicitFilterFocused,true,detail);
    assert.equal(result.explicitFilterOpen,true,detail);
    assert.match(result.explicitFilterScope,/normale CWs/,detail);
    assert.deepEqual(jsErrors,[],"browser errors: "+detail);
   }finally{await page.close();}
  }
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
});
