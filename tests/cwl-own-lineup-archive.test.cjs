"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {pathToFileURL}=require("node:url"),{JSDOM}=require("jsdom"),{chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const load=async p=>import(pathToFileURL(path.join(root,p)).href);
const own="#2PYL",enemy="#2PYQ",war="#2PYY";
const members=Array.from({length:15},(_,i)=>({
 tag:"#2PY"+["L","Q","R","G","J","C","U","V","0","8","9","P","Y","L","Q"][i],
 name:i===0?'<img src=x onerror=alert(1)>':"Kämpfer "+(i+1),
 townHallLevel:i===14?17:18,
 attacks:i===0?[{stars:3,destructionPercentage:100},{stars:2,destructionPercentage:85}]:[]
}));
const group=()=>({season:"2026-11",clanTag:own,clans:[
 {tag:own,name:"United Fighters"},{tag:enemy,name:"AMAZING"}],
 rounds:Array.from({length:7},(_,i)=>({day:i+1,matches:i===0?[{
  available:true,warTag:war,teamSize:15,state:"warEnded",
  clan:{tag:own,name:"United Fighters",stars:35,destructionPercentage:90,attacks:12},
  opponent:{tag:enemy,name:"AMAZING",stars:29,destructionPercentage:85,attacks:10}
 }]:[]}))
});
const body=()=>({active:true,season:"2026-11",clanTag:own,rounds:[
 {day:1,warTag:war,available:true,state:"warEnded",teamSize:15,
  clan:{tag:own,members},opponent:{tag:enemy,members:[{name:"OPPONENT PRIVATE"}]}},
 {day:2,warTag:"#2PYP",available:true,state:"preparation",teamSize:15,
  clan:{tag:own,members},opponent:{tag:enemy,members:[]}}
]});
test("own-roster archive database is read-only for signed-in users and rejects preparation",()=>{
 const sql=read("supabase/migrations/20261104131000_cwl_own_lineup_archives.sql");
 assert.match(sql,/CREATE TABLE public\.cwl_own_lineup_archives/);
 assert.match(sql,/PRIMARY KEY \(clan_id, season, day\)/);
 assert.match(sql,/state IN \('inWar','warEnded'\)/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/FOR SELECT TO authenticated/);
 assert.match(sql,/private\.cwl_is_member\(clan_id\)/);
 assert.match(sql,/GRANT SELECT ON public\.cwl_own_lineup_archives TO authenticated/);
 assert.doesNotMatch(sql,/GRANT (?:INSERT|UPDATE|DELETE) ON public\.cwl_own_lineup_archives TO authenticated/);
 assert.match(sql,/OLD\.state = 'warEnded' AND NEW\.state <> 'warEnded'/);
 assert.match(sql,/incoming_attacks < old_attacks OR incoming_stars < old_stars/);
 assert.match(sql,/old_tags IS DISTINCT FROM incoming_tags/);
});
test("authenticated proxy persists only our own started or ended lineup, never opponent members or preparation",async()=>{
 const src=read("supabase/functions/coc-cwl-status/index.ts");
 const start=src.indexOf("async function saveOwnLineups("),end=src.indexOf("const handler=withSupabase",start);
 assert.ok(start>0&&end>start);
 assert.match(src,/withSupabase\(\{auth:"user"\}/);
 assert.match(src,/if\(memErr\|\|!membership/);
 assert.match(src,/saveOwnLineups\(clanId,response\)/);
 assert.doesNotMatch(read("cloud-app.html"),/SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
 let calls=[];
 const fn=new Function("Deno","valid","tag","fetch","AbortSignal","console","safeDestruction",
  src.slice(start,end)+";return saveOwnLineups")(
  {env:{get:key=>({"SUPABASE_URL":"https://example.supabase.co","SUPABASE_SERVICE_ROLE_KEY":"TEST_ONLY"}[key])}},
  t=>/^#[0289PYLQGRJCUV]{3,15}$/.test(t),t=>String(t||"").toUpperCase(),
  async(url,opts)=>{calls.push({url,opts});return {ok:true,status:201}},
  AbortSignal,{warn:()=>{}},x=>x==null?null:Number(x)
 );
 await fn("00000000-0000-4000-8000-000000000001",body());
 assert.equal(calls.length,1);
 assert.match(calls[0].url,/cwl_own_lineup_archives/);
 assert.equal(calls[0].opts.headers.Authorization,"Bearer TEST_ONLY");
 const saved=JSON.parse(calls[0].opts.body);
 assert.equal(saved.length,1,"no preparation roster");
 assert.equal(saved[0].season,"2026-11");
 assert.equal(saved[0].day,1);
 assert.equal(saved[0].state,"warEnded");
 assert.equal(saved[0].lineup_json.members.length,15);
 assert.equal(saved[0].lineup_json.members[0].attacks[0].stars,3);
 assert.ok(!JSON.stringify(saved).includes("OPPONENT PRIVATE"),"other team's roster never saved");
 const bad=body();bad.rounds[0].clan.members=[members[0]];
 await fn("00000000-0000-4000-8000-000000000001",bad);
 assert.equal(calls.length,1,"partial/incomplete own rosters not stored");
});
function dom(){
 return new JSDOM('<section id="view-archive" class="view active">'+
 '<button id="cwlGroupArchiveRefresh"></button><div id="cwlGroupArchiveContent"></div></section>',
 {url:"https://example.test"});
}
const record=(data,archive)=>({from(table){
 return {
  select(){return this},eq(){return this},order(){return this},
  async limit(){return {data:table==="cwl_group_archives"?[{
   season:"2026-11",group_json:data,updated_at:"2026-11-04T13:00:00Z"
  }]:table==="cwl_own_lineup_archives"?archive:[],error:null}}
 }
}});
test("historical round expands verified roster with players, town halls and attack stars",async()=>{
 const before=global.document,d=dom();global.document=d.window.document;
 try{
  const {createCwlGroupArchiveView}=await load("cwl-group-archive.mjs");
  const server=[{season:"2026-11",day:1,war_tag:war,state:"warEnded",team_size:15,
    lineup_json:{members}}];
  const v=createCwlGroupArchiveView({sb:record(group(),server),getClanId:()=>"id",isConnected:()=>true,getProfile:()=>({archives:[]})});
  await v.open();
  const content=d.window.document.querySelector("#cwlGroupArchiveContent");
  assert.ok(content.querySelector(".season-archive-lineup"),"own team has a dedicated expandable section");
  assert.match(content.textContent,/Unser Team · 15 Spieler/);
  assert.match(content.textContent,/Clash · Krieg abgeschlossen/);
  assert.match(content.textContent,/Kämpfer 2/);
  assert.match(content.textContent,/RH 18/);
  assert.match(content.textContent,/2 Angr. · 5★/);
  assert.doesNotMatch(content.innerHTML,/<img src=x onerror=alert\(1\)>/);
  assert.doesNotMatch(content.textContent,/OPPONENT PRIVATE/);
 }finally{if(before===undefined)delete global.document;else global.document=before;d.window.close()}
});
test("old plan snapshots still serve as clearly labelled fallback without pretending to be Clash-verified",async()=>{
 const before=global.document,d=dom();global.document=d.window.document;
 try{
  const {createCwlGroupArchiveView}=await load("cwl-group-archive.mjs");
  const profile={archives:[{cwlLive:{season:"2026-11",clanTag:own,rounds:[]},
    players:[{id:"p1",name:"Archivierter Spieler",townHall:17}],lineups:[
     {day:1,lineup:["p1"],snapshots:{}}]}]};
  const v=createCwlGroupArchiveView({sb:record(group(),[]),getClanId:()=>"id",isConnected:()=>true,getProfile:()=>profile});
  await v.open();
  const text=d.window.document.querySelector("#cwlGroupArchiveContent").textContent;
  assert.match(text,/Archivierter Spieler/);
  assert.match(text,/Aus dem Planarchiv · nicht mit Clash abgeglichen/);
 }finally{if(before===undefined)delete global.document;else global.document=before;d.window.close()}
});
test("Plan shortcut is read-only, present only with a linked season, and preserves navigation source",async()=>{
 const before=global.document,d=new JSDOM(
 '<div id="planCwlSeasonEntry" hidden><span id="planCwlSeasonHint"></span></div>'+
 '<div id="cwlSeasonCaption"></div><button id="cwlSeasonRefresh"></button>'+
 '<div id="cwlSeasonTabs"><button data-season-tab="rounds"></button><button data-season-tab="group"></button><button data-season-tab="players"></button></div>'+
 '<div id="cwlSeasonContent"></div>',{url:"https://example.test"});
 global.document=d.window.document;
 try{
  const {createCwlSeasonView}=await load("cwl-season-view.mjs");
  const active={cwlLive:{season:"2026-11",clanTag:own,rounds:[]}};
  const v=createCwlSeasonView({getProfile:()=>active,getSnapshot:()=>null,getGroup:()=>group(),isConnected:()=>true});
  v.render();
  assert.equal(d.window.document.querySelector("#planCwlSeasonEntry").hidden,false);
  assert.match(d.window.document.querySelector("#planCwlSeasonHint").textContent,/1 von 1 Paarungen/);
  active.cwlLiveIgnoredSeason="2026-11";
  v.render();
  assert.equal(d.window.document.querySelector("#planCwlSeasonEntry").hidden,true);
  const html=read("cloud-app.html"),cloud=read("cloud-sync.mjs");
  assert.match(html,/id="planCwlSeasonOpen"/);
  assert.doesNotMatch(html,/data-more-action="season"/);
  assert.match(html,/const navView=visible==="cwl-season"\?"plan"/);
  assert.match(html,/Zurück zum Plan/);
  assert.match(cloud,/"planCwlSeasonOpen"/);
 }finally{if(before===undefined)delete global.document;else global.document=before;d.window.close()}
});
test("mobile archival roster cards and Plan shortcut do not overflow narrow screens",{timeout:120000},async()=>{
 const html=read("cloud-app.html").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1366]){
   const page=await browser.newPage({viewport:{width,height:840}});
   try{
    await page.setContent(html,{waitUntil:"domcontentloaded"});
    const m=await page.evaluate(()=>{
     document.querySelector("#planCwlSeasonEntry").hidden=false;
     const section=document.querySelector("#view-archive");
     document.querySelectorAll(".view.active").forEach(v=>v.classList.remove("active"));
     section.classList.add("active");
     document.querySelector("#cwlGroupArchiveContent").innerHTML='<details class="season-archive-lineup" open>'+
      '<summary><span>Unser Team · 15 Spieler</span><small>Clash · Krieg abgeschlossen</small></summary>'+
      '<div class="season-archive-roster">'+Array.from({length:15},()=>
      '<div class="season-archive-player"><strong>Spieler mit langem Namen</strong><small>RH 18 · 2 Angr. · 5★</small></div>').join("")+'</div></details>';
     return {width:innerWidth,scroll:document.documentElement.scrollWidth,
       roster:document.querySelector(".season-archive-roster").getBoundingClientRect().width};
    });
    assert.ok(m.scroll<=width+3,"layout overflow "+JSON.stringify(m));
    assert.ok(m.roster>150,"roster visible "+width);
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
