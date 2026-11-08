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
  res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};\n");return;
 }
 if(name==="cloud-app.html"||name==="cwl-planning-core.js"||/^[a-z0-9-]+\.mjs$/.test(name)){
  if(fs.existsSync(path.join(root,name))){
   res.writeHead(200,{"content-type":name.endsWith(".html")?"text/html":"text/javascript"});
   res.end(read(name));return;
  }
 }
 res.writeHead(404);res.end("");
});

test("active clan names agree across raw stats, player form and duels without altering historical names",{
 timeout:150000
},async()=>{
 const server=serve();await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [width,theme] of [[320,"arena"],[390,"dark"],[430,"light"],[1366,"arena"]]){
   const page=await browser.newPage({viewport:{width,height:880}});
   try{
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",
     {waitUntil:"domcontentloaded"});
    const out=await page.evaluate(async theme=>{
     document.documentElement.dataset.theme=theme;
     document.documentElement.style.scrollBehavior="auto";
     document.body.classList.add("cloud-mode","cloud-role-viewer");
     document.querySelectorAll(".view.active").forEach(e=>e.classList.remove("active"));
     document.getElementById("view-stats").classList.add("active");
     const {createCloudStats}=await import("./cwl-stats.mjs");
     const wars=[{
      war_key:"normal:names",war_type:"normal",source:"import",finalized:true,
      started_at:new Date(Date.now()-3*86400000).toISOString(),
      team_size:15,opponent_name:"Names Fixture"
     }];
     const attacks=[
      {war_key:wars[0].war_key,attacker_tag:"#PPPP",attacker_name:"Alter Angriffsname",
       attack_order:1,attacker_th:18,defender_th:18,stars:3,destruction:100},
      {war_key:wars[0].war_key,attacker_tag:"#QQQQ",attacker_name:"Ehemaliger Name",
       attack_order:1,attacker_th:18,defender_th:18,stars:2,destruction:85}
     ];
     const ctx={active:true,clanId:"name-clan",role:"viewer",
      memberTags:["#PPPP"],memberProfiles:[
       {playerTag:"#PPPP",name:"Aktueller Clanname"},
       {playerTag:"#QQQQ",name:"Fremde Zuordnung darf nicht übernommen werden"}
      ]};
     const sb={from(name){
      const data=name==="cwl_stat_wars"?wars:name==="cwl_stat_attacks"?attacks:[];
      return {select(){return this},eq(){return this},order(){return this},
       limit(){return Promise.resolve({data,error:null})},
       range(){return Promise.resolve({data,error:null})}};
     }};
     const stats=createCloudStats({sb,context:()=>ctx,notify:()=>{},
      confirmAction:async()=>true});
     await stats.load();
     const tab=s=>document.querySelector('[data-stats-section="'+s+'"]').click();
     tab("players");
     const host=document.getElementById("statsRows");
     const byTag=tag=>[...host.querySelectorAll(".stats-player-details")].find(el=>
      el.dataset.playerTag===tag)?.closest(".stats-player-row");
     const initialActive=byTag("#PPPP")?.querySelector(".stats-name b")?.textContent;
     const initialFormer=byTag("#QQQQ")?.querySelector(".stats-name b")?.textContent;
     const initialQuote=byTag("#PPPP")?.querySelector(".stats-rate")?.textContent;
     const search=document.getElementById("statsSearch");
     search.value="Aktueller Clanname";search.dispatchEvent(new Event("input",{bubbles:true}));
     const searched=[...host.querySelectorAll(".stats-name b")].map(x=>x.textContent);
     search.value="Alter Angriffsname";search.dispatchEvent(new Event("input",{bubbles:true}));
     const oldSearch=host.textContent;
     search.value="";search.dispatchEvent(new Event("input",{bubbles:true}));
     ctx.memberProfiles[0].name="Neuerer Clanname";
     stats.render();
     const afterRename=byTag("#PPPP")?.querySelector(".stats-name b")?.textContent;
     const afterRenameQuote=byTag("#PPPP")?.querySelector(".stats-rate")?.textContent;
     tab("compare");
     const names=[...document.querySelectorAll("#statsDuelLeft option")].map(el=>el.textContent);
     const duelCards=[...document.querySelectorAll(".stats-duel-person h4")]
      .map(el=>el.textContent);
     tab("form");
     const formActive=[...document.querySelectorAll(".stats-form-row")].find(el=>
      el.dataset.formTag==="#PPPP")?.querySelector("b")?.textContent;
     const formFormer=[...document.querySelectorAll(".stats-form-row")].find(el=>
      el.dataset.formTag==="#QQQQ")?.querySelector("b")?.textContent;
     const historicalName=attacks[0].attacker_name;
     const oldWarName=attacks[1].attacker_name;
     stats.reset();
     return {initialActive,initialFormer,initialQuote,searched,oldSearch,
      afterRename,afterRenameQuote,names,duelCards,formActive,formFormer,
      historicalName,oldWarName,emptyAfterReset:
      document.querySelectorAll("#statsFormRows .stats-form-row").length===0,
      noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth+3};
    },theme);
    const note=JSON.stringify({width,theme,out});
    assert.equal(out.initialActive,"Aktueller Clanname",note);
    assert.equal(out.initialFormer,"Ehemaliger Name",note);
    assert.equal(out.initialQuote,"100%",note);
    assert.deepEqual(out.searched,["Aktueller Clanname"],note);
    assert.match(out.oldSearch,/Keine passenden Spieler/,note);
    assert.equal(out.afterRename,"Neuerer Clanname",note);
    assert.equal(out.afterRenameQuote,out.initialQuote,note);
    assert.ok(out.names.includes("Neuerer Clanname"),note);
    assert.ok(out.names.includes("Ehemaliger Name"),note);
    assert.ok(out.duelCards.some(x=>x.includes("Neuerer Clanname")),note);
    assert.ok(out.duelCards.some(x=>x.includes("Ehemaliger Name")),note);
    assert.equal(out.formActive,"Neuerer Clanname",note);
    assert.equal(out.formFormer,"Ehemaliger Name",note);
    assert.equal(out.historicalName,"Alter Angriffsname",note);
    assert.equal(out.oldWarName,"Ehemaliger Name",note);
    assert.equal(out.emptyAfterReset,true,note);
    assert.equal(out.noHorizontalOverflow,true,note);
    assert.deepEqual(errors,[],note);
   }finally{await page.close()}
  }
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});