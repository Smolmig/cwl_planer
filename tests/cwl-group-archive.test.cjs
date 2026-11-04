"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {pathToFileURL}=require("node:url");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=pathName=>fs.readFileSync(path.join(root,pathName),"utf8");
const load=async name=>import(pathToFileURL(path.join(root,name)).href);
const TAGS=["#2PYL","#2PYQ","#2PYR","#2PYG","#2PYC","#2PYV","#2PY0","#2PY9"];
const group=()=>({season:"2026-11",clanTag:TAGS[0],
 clans:TAGS.map((tag,i)=>({tag,name:i===4?"<img src=x onerror=alert(1)>":"Clan "+i,badgeUrl:null})),
 rounds:Array.from({length:7},(_,i)=>({day:i+1,matches:i===0?[
  {available:true,state:"warEnded",teamSize:15,warTag:"#2PYY",
   clan:{tag:TAGS[0],name:"Clan 0",stars:24,destructionPercentage:70,attacks:12},
   opponent:{tag:TAGS[1],name:"Clan 1",stars:16,destructionPercentage:45,attacks:11}},
  {available:false},{available:false},{available:false}
 ]:[]}))
});
const wrapper=()=>new JSDOM('<section id="view-archive" class="view active">'+
 '<button id="cwlGroupArchiveRefresh"></button><div id="cwlGroupArchiveContent"></div></section>',{
 url:"https://example.test"
});
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return {resolve,promise}}
test("server-only group archive schema exposes SELECT to members, not client writes",()=>{
 const sql=read("supabase/migrations/20261104124937_cwl_group_archive_secure_read_only.sql");
 assert.match(sql,/CREATE TABLE public.cwl_group_archives/);
 assert.match(sql,/PRIMARY KEY \(clan_id, season\)/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/FOR SELECT TO authenticated/);
 assert.match(sql,/private\.cwl_is_member\(clan_id\)/);
 assert.match(sql,/GRANT SELECT ON public\.cwl_group_archives TO authenticated/);
 assert.doesNotMatch(sql,/GRANT (INSERT|UPDATE|DELETE) ON public\.cwl_group_archives TO authenticated/);
 assert.match(sql,/CREATE TRIGGER cwl_group_archive_merge/);
 assert.match(sql,/old_state = 'warEnded' AND next_state <> 'warEnded'/);
 assert.match(sql,/next_attacks < old_attacks/);
});
test("backend persists only sanitized authenticated group, not opponent members",async()=>{
 const source=read("supabase/functions/coc-cwl-status/index.ts");
 assert.match(source,/withSupabase\(\{auth:"user"\}/);
 assert.match(source,/if\(memErr\|\|!membership/);
 assert.match(source,/saveGroupArchive\(clanId,response\.group\)/);
 assert.match(source,/rest\/v1\/cwl_group_archives/);
 assert.doesNotMatch(read("cloud-app.html"),/SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
 assert.doesNotMatch(read("cwl-group-archive.mjs"),/SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
 const start=source.indexOf("async function saveGroupArchive("),end=source.indexOf("\nconst handler=",start);
 assert.ok(start>0&&end>start);
 let captured=[],status=201;
 const save=new Function("Deno","valid","tag","fetch","AbortSignal","console",
  source.slice(start,end)+";return saveGroupArchive")({
    env:{get:key=>({"SUPABASE_URL":"https://example.supabase.co",
     "SUPABASE_SERVICE_ROLE_KEY":"TEST_SECRET"}[key])}
  }, t=>/^#[0289PYLQGRJCUV]{3,15}$/.test(t),
   v=>String(v||"").toUpperCase(),
   async(url,args)=>{captured.push({url,args});return {ok:status,status}},
   AbortSignal,{warn:()=>{}}); 
 await save("00000000-0000-4000-8000-000000000001",group());
 assert.equal(captured.length,1);
 assert.match(captured[0].url,/cwl_group_archives/);
 assert.equal(captured[0].args.method,"POST");
 assert.equal(captured[0].args.headers.Authorization,"Bearer TEST_SECRET");
 const payload=JSON.parse(captured[0].args.body);
 assert.equal(payload.season,"2026-11");
 assert.equal(payload.group_json.rounds[0].matches[0].state,"warEnded");
 assert.ok(!JSON.stringify(payload).includes("members"));
 const bad=group();bad.season="bad";
 await save("00000000-0000-4000-8000-000000000001",bad);
 assert.equal(captured.length,1,"malformed season not saved");
});
test("historic groups render independently of existing plan archives and HTML is escaped",async()=>{
 const dom=wrapper(),original=global.document;global.document=dom.window.document;
 try{
  const {createCwlGroupArchiveView}=await load("cwl-group-archive.mjs");
  const client={from(table){
   assert.equal(table,"cwl_group_archives");
   return {
     select(){return this},
     eq(key,value){assert.equal(key,"clan_id");assert.equal(value,"clan-a");return this},
     order(){return this},
     async limit(){return {data:[
       {season:"2026-11",group_json:group(),updated_at:"2026-11-04T11:00:00Z"}
     ],error:null}}
   };
  }};
  const view=createCwlGroupArchiveView({sb:client,getClanId:()=>"clan-a",isConnected:()=>true});
  await view.open();
  let html=dom.window.document.getElementById("cwlGroupArchiveContent").innerHTML;
  assert.match(html,/November 2026/);
  assert.match(html,/Gespeicherter Zwischenstand/);
  assert.match(html,/24/);
  assert.match(html,/Runde 1/);
  assert.doesNotMatch(html,/<img src=x onerror=alert\(1\)>/);
  assert.doesNotMatch(html,/delete-archive|Löschen/);
  assert.ok(dom.window.document.querySelectorAll(".season-archive-item").length===1);
 }finally{if(original===undefined)delete global.document;else global.document=original;dom.window.close()}
});
test("when user switches clans mid-request stale archive data is discarded",async()=>{
 const dom=wrapper(),original=global.document;global.document=dom.window.document;
 try{
  const {createCwlGroupArchiveView}=await load("cwl-group-archive.mjs");
  let id="clan-a";const a=deferred(),b=deferred(),pending=[a,b];
  const client={from(){return {
   select(){return this},
   eq(){return this},
   order(){return this},
   limit(){return pending.shift().promise}
  }}};
  const view=createCwlGroupArchiveView({sb:client,getClanId:()=>id,isConnected:()=>true});
  const first=view.open();id="clan-b";const second=view.open();
  const latest=group();latest.season="2026-12";
  b.resolve({data:[{season:"2026-12",group_json:latest,updated_at:"2026-12-05T11:00:00Z"}],error:null});
  await second;
  a.resolve({data:[{season:"2026-11",group_json:group(),updated_at:"2026-11-04T11:00:00Z"}],error:null});
  await first;
  const html=dom.window.document.getElementById("cwlGroupArchiveContent").innerHTML;
  assert.match(html,/Dezember 2026/);
  assert.doesNotMatch(html,/November 2026/);
 }finally{if(original===undefined)delete global.document;else global.document=original;dom.window.close()}
});

test("group archive remains usable on iPhone and desktop without horizontal page overflow",{
 timeout:120000
},async()=>{
 const {chromium}=require("playwright");
 const app=read("cloud-app.html")
   .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
   .replace(/<link\b[^>]*>/gi,"");
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,820,1366]){
   const page=await browser.newPage({viewport:{width,height:840}});
   try{
    await page.setContent(app,{waitUntil:"domcontentloaded"});
    const metrics=await page.evaluate(()=>{
      document.documentElement.dataset.theme="arena";
      document.querySelectorAll(".view.active").forEach(e=>e.classList.remove("active"));
      document.getElementById("view-archive").classList.add("active");
      const host=document.getElementById("cwlGroupArchiveContent");
      host.innerHTML='<details class="season-archive-item" open><summary><span>'+
       '<strong>November 2026</strong><small>8 Clans · 3 / 28 abgeschlossen</small></span>'+
       '<span class="season-archive-chip">Gespeicherter Zwischenstand</span></summary>'+
       '<div class="season-archive-body"><div class="season-group-scroll">'+
       '<table class="season-group-table"><tbody>'+
       Array.from({length:8},(_,i)=>'<tr><td>'+(i+1)+'.</td><td>United Fighters</td>'+
         '<td>3</td><td>100</td><td>456</td></tr>').join("")+
       '</tbody></table></div></div></details>';
      const table=document.querySelector(".season-group-scroll");
      return {
       windowWidth:innerWidth,
       documentWidth:document.documentElement.scrollWidth,
       tableWidth:table.getBoundingClientRect().width,
       tableContentWidth:table.scrollWidth,
       cardWidth:document.querySelector(".season-archive-item").getBoundingClientRect().width
      };
    });
    assert.ok(metrics.documentWidth<=width+3,"archive page must fit "+JSON.stringify({width,metrics}));
    assert.ok(metrics.tableWidth>120&&metrics.cardWidth>150,"archive content visible "+width);
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});


test("background polling retains expanded season, round and own roster; temporary errors keep view intact",async()=>{
 const dom=wrapper(),previous=global.document;global.document=dom.window.document;
 try{
  const {createCwlGroupArchiveView}=await load("cwl-group-archive.mjs");
  let groupFetches=0,fail=false;
  const own=[{season:"2026-11",day:1,war_tag:"#2PYY",state:"warEnded",
   team_size:1,lineup_json:{members:[{tag:"#2PYL",name:"Owned player",townHallLevel:18,
    attacks:[{stars:3,destructionPercentage:100}]}]}}];
  const client={from(table){return{
   select(){return this},eq(){return this},order(){return this},
   async limit(){
    if(table==="cwl_own_lineup_archives")return {data:own,error:null};
    if(fail)throw Error("network offline");
    const fresh=group();
    fresh.rounds[0].matches[0].clan.stars=24+groupFetches++;
    return {data:[{season:"2026-11",group_json:fresh,updated_at:"2026-11-04T15:00:00Z"}],error:null};
   }
  }}};
  const view=createCwlGroupArchiveView({sb:client,getClanId:()=>"clan-a",isConnected:()=>true});
  await view.open();
  const root=dom.window.document.querySelector("#cwlGroupArchiveContent");
  let details=[...root.querySelectorAll("details[data-archive-key]")];
  // Seven rounds exist even when only one has a real own-team roster.
  assert.equal(details.length,9,"season, seven rounds and own roster use stable keys");
  const expanded=new Set(["season:2026-11","round:2026-11:1","roster:2026-11:1"]);
  details.forEach(node=>{node.open=expanded.has(node.dataset.archiveKey)});
  assert.equal(details.filter(node=>node.open).length,3);
  assert.ok(root.textContent.includes("24"),"initial score displayed");
  const before=root.innerHTML;
  view.invalidate();
  assert.equal(root.innerHTML,before,"background refresh must not swap existing content for loading");
  await new Promise(resolve=>setImmediate(resolve));
  details=[...root.querySelectorAll("details[data-archive-key]")];
  assert.ok(details.every(node=>node.open===expanded.has(node.dataset.archiveKey)),
    "only the three explicitly opened panels remain open after refresh");
  assert.match(root.textContent,/25/,"new values updated while preserving opened panels");
  assert.match(root.textContent,/Owned player/);
  fail=true;
  view.invalidate();
  await new Promise(resolve=>setImmediate(resolve));
  details=[...root.querySelectorAll("details[data-archive-key]")];
  assert.ok(details.every(node=>node.open===expanded.has(node.dataset.archiveKey)),
    "temporary network error keeps expanded and collapsed panels unchanged");
  assert.match(root.textContent,/Owned player/);
  assert.doesNotMatch(root.textContent,/konnte nicht geladen werden/);
 }finally{if(previous===undefined)delete global.document;else global.document=previous;dom.window.close()}
});

test("UX guide is repository-wide and redundant season entry removed from Mehr",()=>{
 const ux=read("docs/UX_DESIGN_PRINCIPLES.md"),agents=read("AGENTS.md");
 const app=read("cloud-app.html");
 assert.match(agents,/docs\/UX_DESIGN_PRINCIPLES\.md/);
 assert.match(ux,/Auto-Refresh darf niemals geöffnete Bereiche schließen/);
 assert.match(ux,/Plan, Mitglieder, Einsätze, Statistik, Mehr/);
 assert.match(ux,/Karte > Karte > Karte/);
 assert.doesNotMatch(app,/data-more-action="season"/);
 assert.match(app,/id="planCwlSeasonOpen"/);
 assert.match(app,/const navView=visible==="cwl-season"\?"plan"/);
 assert.match(app,/id="view-archive"/);
});

test("archive list uses restrained separators instead of frames around every player",{timeout:120000},async()=>{
 const {chromium}=require("playwright");
 const html=read("cloud-app.html").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
   .replace(/<link\b[^>]*>/gi,"");
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1366]){
   const page=await browser.newPage({viewport:{width,height:850}});
   try{
    await page.setContent(html);
    const result=await page.evaluate(()=>{
     document.querySelectorAll(".view.active").forEach(node=>node.classList.remove("active"));
     document.querySelector("#view-archive").classList.add("active");
     const host=document.querySelector("#cwlGroupArchiveContent");
     host.innerHTML='<details class="season-archive-item" open><summary>November 2026</summary>'+
      '<div class="season-archive-body"><div class="season-group-archive-rounds">'+
      '<details class="season-archive-round" open><summary>Runde 1</summary>'+
      '<details class="season-archive-lineup" open><summary>Unser Team</summary>'+
      '<div class="season-archive-roster"><div class="season-archive-player">'+
      '<strong>Spielername</strong><small>RH 18 · 3★</small></div></div></details></details></div></div></details>';
     const style=x=>getComputedStyle(document.querySelector(x));
     return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,
       outerBorder:style(".archive-page.card").borderTopWidth,
       roundBorder:style(".season-archive-round").borderTopWidth,
       rosterBorder:style(".season-archive-lineup").borderLeftWidth,
       playerBorder:style(".season-archive-player").borderLeftWidth};
    });
    assert.ok(result.documentWidth<=width+3,JSON.stringify(result));
    assert.equal(result.outerBorder,"0px");
    assert.equal(result.roundBorder,"0px");
    assert.equal(result.rosterBorder,"0px");
    assert.equal(result.playerBorder,"0px");
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
