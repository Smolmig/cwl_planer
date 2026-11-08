"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const http=require("node:http");
const {pathToFileURL}=require("node:url");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const core=()=>import(pathToFileURL(path.join(root,"cwl-stats-core.mjs")));
const serve=()=>http.createServer((req,res)=>{
 const name=new URL(req.url||"/","http://localhost").pathname.slice(1);
 if(name==="cloud-sync.mjs"){
  res.writeHead(200,{"content-type":"text/javascript"});
  res.end("export {};\n");
  return;
 }
 if(name==="cloud-app.html"||name==="cwl-planning-core.js"||
    /^[a-z0-9-]+\.mjs$/.test(name)){
  if(fs.existsSync(path.join(root,name))){
   res.writeHead(200,{"content-type":name.endsWith(".html")?"text/html":"text/javascript"});
   res.end(read(name));
   return;
  }
 }
 res.writeHead(404);
 res.end("");
});

test("current members without attacks have null form, and current profile names win",async()=>{
 const {computePlayerFormWindows,sortPlayerFormRows}=await core();
 const wars=[
  {war_key:"normal:A",war_type:"normal",source:"import",started_at:"2026-11-05T12:00:00Z"},
  {war_key:"cwl:B",war_type:"cwl",source:"api",finalized:true,started_at:"2026-10-25T12:00:00Z"},
  {war_key:"normal:draft",war_type:"normal",source:"api",finalized:false,started_at:"2026-11-06T12:00:00Z"}
 ];
 const attack=(tag,key,thD,stars=3)=>({
  attacker_tag:tag,attacker_name:"Historic "+tag,attacker_th:18,defender_th:thD,
  stars,war_key:key
 });
 const attacks=[
  attack("#PPPP","normal:A",18),attack("#RRRR","normal:A",17,2),
  attack("#JJJJ","cwl:B",18),attack("#QQQQ","normal:draft",18)
 ];
 const result=computePlayerFormWindows(wars,attacks,{
  asOf:"2026-11-09T12:00:00Z",windows:[30,90],
  memberTags:["#PPPP","qqqq","#RRRR","#YYYY"],
  memberProfiles:[
   {playerTag:"#PPPP",name:"Aktueller Name"},
   {playerTag:"#QQQQ",name:"Ohne erfassten Angriff"},
   {playerTag:"#RRRR",name:"Anderes RH"},
   {playerTag:"#YYYY",name:"Noch neu"},
   {playerTag:"#JJJJ",name:"Darf ehemaligen Spieler NICHT umbenennen"}
  ]
 });
 assert.equal(result.players.length,5);
 const p=tag=>result.players.find(x=>x.tag===tag);
 assert.equal(p("#PPPP").name,"Aktueller Name");
 assert.equal(p("#PPPP").windows[30].hitRate,100);
 assert.equal(p("#PPPP").former,false);
 for(const tag of ["#QQQQ","#YYYY"]){
  assert.equal(p(tag).former,false);
  assert.equal(p(tag).windows[30].attacks,0);
  assert.equal(p(tag).windows[30].hitRate,null);
  assert.equal(p(tag).windows[30].averageStars,null);
  assert.equal(p(tag).windows[30].quality,"keine Daten");
 }
 assert.equal(p("#RRRR").windows[30].attacks,0);
 assert.equal(p("#RRRR").windows[30].excludedDifferentRH,1);
 assert.equal(p("#RRRR").windows[30].hitRate,null);
 assert.equal(p("#JJJJ").former,true);
 assert.equal(p("#JJJJ").name,"Historic #JJJJ");
 assert.equal(p("#QQQQ").windows[30].excludedUnknownRH,0,
  "an unfinalized attack is not a zero or excluded sample");
 assert.ok(sortPlayerFormRows(result.players,30,"evidence").slice(-3)
  .every(x=>x.windows[30].hitRate===null),"unknown form sorts behind real evidence");
 assert.equal(attacks.length,4,"pure calculation must not change stored attack history");
 const legacy=computePlayerFormWindows(wars,attacks,{asOf:"2026-11-09T12:00:00Z"});
 assert.equal(legacy.players.some(x=>x.tag==="#YYYY"),false,
  "callers without current clan membership retain historical behavior");
});

test("form UI distinguishes unobserved members from real losses; reload keeps reading anchor",{
 timeout:150000
},async()=>{
 const server=serve();
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [width,theme] of [[320,"arena"],[390,"dark"],[430,"light"],[1366,"arena"]]){
   const page=await browser.newPage({viewport:{width,height:880}});
   try{
    const errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",
     {waitUntil:"domcontentloaded"});
    const result=await page.evaluate(async theme=>{
     document.documentElement.dataset.theme=theme;
     document.body.classList.add("cloud-mode","cloud-role-viewer");
     document.querySelectorAll(".view.active").forEach(e=>e.classList.remove("active"));
     document.getElementById("view-stats").classList.add("active");
     const {createCloudStats}=await import("./cwl-stats.mjs");
     const wars=[{
      war_key:"normal:fixture",war_type:"normal",source:"import",finalized:true,
      started_at:new Date(Date.now()-5*86400000).toISOString(),team_size:15,
      opponent_name:"Synthetic Enemy"
     }];
     const attacks=[
      {war_key:wars[0].war_key,attacker_tag:"#PPPP",attacker_name:"Alter Name",
       attack_order:1,attacker_th:18,defender_th:18,stars:3,destruction:100},
      {war_key:wars[0].war_key,attacker_tag:"#RRRR",attacker_name:"Different RH",
       attack_order:1,attacker_th:18,defender_th:17,stars:2,destruction:80},
      {war_key:wars[0].war_key,attacker_tag:"#JJJJ",attacker_name:"Ehemalig",
       attack_order:1,attacker_th:18,defender_th:18,stars:2,destruction:80}
     ];
     const alphabet="0289PYLQGRJCUV";
     const extras=Array.from({length:45},(_,i)=>({
      playerTag:"#P"+alphabet[Math.floor(i/alphabet.length)]+alphabet[i%alphabet.length]+"P",
      name:"Spieler "+String(i+1).padStart(2,"0")
     }));
     const roster=[
      {playerTag:"#PPPP",name:"Neuer Name"},
      {playerTag:"#QQQQ",name:"Ohne Angriff"},
      {playerTag:"#RRRR",name:"Nur anderes RH"},
      ...extras
     ];
     let ctx={active:true,clanId:"form-A",role:"viewer",
      memberTags:roster.map(m=>m.playerTag),memberProfiles:roster};
     const sb={from(name){
      const data=name==="cwl_stat_wars"?wars:name==="cwl_stat_attacks"?attacks:[];
      return {select(){return this},eq(){return this},order(){return this},
       limit(){return Promise.resolve({data,error:null})},
       range(){return Promise.resolve({data,error:null})}};
     }};
     const stats=createCloudStats({sb,context:()=>ctx,notify:()=>{},
      confirmAction:async()=>true});
     await stats.load();
     document.querySelector('[data-stats-section="form"]').click();
     const host=document.getElementById("statsFormRows");
     const get=tag=>[...host.querySelectorAll(".stats-form-row")]
       .find(x=>x.dataset.formTag===tag);
     const named=get("#PPPP"),unknown=get("#QQQQ"),different=get("#RRRR"),former=get("#JJJJ");
     const initial={
      liveName:named?.querySelector("b")?.textContent,
      observed:named?.querySelector("strong")?.textContent,
      unknownName:unknown?.querySelector("b")?.textContent,
      unknownQuote:unknown?.querySelector("strong")?.textContent,
      unknownDetail:unknown?.querySelector(".stats-form-breakdown")?.textContent,
      unknownAria:unknown?.querySelector(".stats-bar-track")?.getAttribute("aria-label"),
      differentDetail:different?.textContent,
      former:former?.textContent,
      intro:document.getElementById("statsFormIntro").textContent,
      count:host.querySelectorAll(".stats-form-row").length
     };
     const search=document.getElementById("statsFormSearch");
     search.value="Ohne Angriff";search.dispatchEvent(new Event("input",{bubbles:true}));
     const searchResult=[...host.querySelectorAll(".stats-form-row")]
       .map(x=>x.querySelector("b")?.textContent);
     search.value="nicht vorhanden";search.dispatchEvent(new Event("input",{bubbles:true}));
     const noMatch=host.textContent;
     search.value="";search.dispatchEvent(new Event("input",{bubbles:true}));
     // At least one visible row in a long list should remain anchored if
     // a new confirmed attack moves a formerly unobserved player to the top.
     const anchor=host.querySelectorAll(".stats-form-row")[24];
     anchor.scrollIntoView({block:"center"});
     const anchorTag=anchor.dataset.formTag,topBefore=anchor.getBoundingClientRect().top;
     attacks.push({war_key:wars[0].war_key,attacker_tag:extras[40].playerTag,
      attacker_name:"Latest",attack_order:1,attacker_th:18,defender_th:18,
      stars:3,destruction:100});
     await stats.load();
     const restored=get(anchorTag);
     const positionDrift=Math.abs(restored.getBoundingClientRect().top-topBefore);
     const liveCount=host.querySelectorAll(".stats-form-row").length;
     ctx={...ctx,clanId:"form-B",memberTags:["#LLLL"],
      memberProfiles:[{playerTag:"#LLLL",name:"Anderer Clan"}]};
     stats.reset();
     const clearOnSwitch=host.children.length===0;
     return {initial,searchResult,noMatch,positionDrift,liveCount,clearOnSwitch,
      pageOverflow:document.documentElement.scrollWidth-innerWidth};
    },theme);
    const context=JSON.stringify({width,theme,result});
    assert.equal(result.initial.liveName,"Neuer Name",context);
    assert.equal(result.initial.observed,"100 %",context);
    assert.equal(result.initial.unknownName,"Ohne Angriff",context);
    assert.equal(result.initial.unknownQuote,"Keine Daten",context);
    assert.match(result.initial.unknownDetail,/Keine belegte 3★-Quote/,context);
    assert.doesNotMatch(result.initial.unknownDetail,/0 von 0/,context);
    assert.match(result.initial.unknownAria,/Keine auswertbaren Angriffe/,context);
    assert.match(result.initial.differentDetail,/1 andere RH/,context);
    assert.match(result.initial.former,/Früherer Spieler/,context);
    assert.match(result.initial.intro,/ohne gleich-RH-Auswertung/,context);
    assert.ok(result.initial.count>=49,context);
    assert.deepEqual(result.searchResult,["Ohne Angriff"],context);
    assert.match(result.noMatch,/Keine Spieler für diese Suche/,context);
    assert.ok(result.positionDrift<=4,"reading position lost on refresh: "+context);
    assert.equal(result.liveCount,result.initial.count,context);
    assert.equal(result.clearOnSwitch,true,context);
    assert.ok(result.pageOverflow<=3,context);
    assert.deepEqual(errors,[],"browser errors: "+context);
   }finally{await page.close()}
  }
 }finally{
  await browser.close();
  await new Promise(ok=>server.close(ok));
 }
});