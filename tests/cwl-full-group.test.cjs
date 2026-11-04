"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),{pathToFileURL}=require("node:url");
const {JSDOM}=require("jsdom"),{chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const load=async p=>import(pathToFileURL(path.join(root,p)).href);
const tags=["#2PYL","#2PYQ","#2PYR","#2PYG","#2PYC","#2PYV","#2PY0","#2PY9"];
const side=(tag,stars,destructionPercentage,attacks=0)=>({
 tag,name:"Clan "+tag,stars,destructionPercentage,attacks,
 badgeUrl:null
});
function fixture(){
 const clans=tags.map((tag,i)=>({tag,name:i===7?"<svg onload=alert(1)>":"Clan "+i,badgeUrl:null}));
 const rounds=Array.from({length:7},(_,i)=>({day:i+1,matches:[]}));
 rounds[0].matches=[
 {available:true,state:"warEnded",teamSize:15,warTag:"#2PYL0",
 clan:side(tags[0],24,53.33,8),opponent:side(tags[1],18,44,7)},
 {available:true,state:"warEnded",teamSize:15,warTag:"#2PYL2",
 clan:side(tags[2],20,53,9),opponent:side(tags[3],20,52,9)},
 {available:true,state:"inWar",teamSize:15,warTag:"#2PYL8",
 clan:side(tags[4],10,22,5),opponent:side(tags[5],20,50,7)},
 {available:false}
 ];
 rounds[1].matches=[{available:true,state:"preparation",teamSize:15,warTag:"#2PYL9",
 clan:side(tags[0],0,0,0),opponent:side(tags[3],0,0,0)}];
 return {season:"2026-11",clanTag:tags[0],clans,rounds};
}
test("full-group rankings: +10 only for completed winner, tie-break destruction, no preparation score",async()=>{
 const {summarizeCwlGroup}=await load("cwl-group-core.mjs"),group=fixture(),original=JSON.stringify(group);
 const data=summarizeCwlGroup(group);
 assert.equal(data.clans.length,8);
 assert.equal(data.known,4);
 assert.equal(data.ended,2);
 assert.equal(data.missing,1);
 assert.equal(data.complete,false);
 const own=data.clans.find(c=>c.tag===tags[0]);
 assert.equal(own.stars,34,"24 stars plus ten ended-win bonus");
 assert.equal(own.warStars,24);
 assert.equal(own.bonusStars,10);
 assert.equal(own.wins,1);
 assert.equal(own.completed,1);
 assert.equal(own.known,2);
 assert.equal(own.totalDestruction,799.95);
 const tieWinner=data.clans.find(c=>c.tag===tags[2]);
 assert.equal(tieWinner.stars,30,"tie decided by destruction percentage");
 assert.equal(tieWinner.bonusStars,10);
 const opponent=data.clans.find(c=>c.tag===tags[5]);
 assert.equal(opponent.stars,20,"no early bonus for ongoing war");
 assert.equal(opponent.wins,0);
 assert.equal(data.rounds[1].matches[0].clan.stars,null,"preparation must not display zero");
 assert.equal(JSON.stringify(group),original,"must not mutate input");
});
test("no arbitrary ordering for exact star/destruction ties, invalid group not a leaderboard",async()=>{
 const {summarizeCwlGroup}=await load("cwl-group-core.mjs");
 assert.equal(summarizeCwlGroup(null),null);
 assert.equal(summarizeCwlGroup({season:"2026-11",clans:[],rounds:[]}),null);
 const d=summarizeCwlGroup(fixture());
 const zeroes=d.clans.filter(c=>c.stars===0&&c.totalDestruction===0);
 assert.ok(zeroes.length>1);
 assert.ok(zeroes.every(c=>c.position===zeroes[0].position));
});
test("backend already fetches all group wars, adds no extra calls, and returns no other clans' members",async()=>{
 const source=read("supabase/functions/coc-cwl-status/index.ts");
 const stripped=source.replace(/^import .*;\n/,"").replace(/export default \{fetch:[\s\S]*$/,"");
 const code=new Function("fetch","withSupabase","Response","AbortSignal","Deno",stripped+";return {loadStatus};");
 const requestLog=[];
 const warTags=["#2PYL0","#2PYL2","#2PYL8","#2PYL9"];
 const group={state:"inWar",season:"2026-11-02",
   clans:tags.map((tag,i)=>({tag,name:"Clan "+i,badgeUrls:{medium:"https://api-assets.clashofclans.com/badges/123/x.png"}})),
   rounds:[{warTags},...Array.from({length:6},()=>({warTags:["#0","#0","#0","#0"]}))]};
 const wars=warTags.map((tag,i)=>({
   state:i===0?"warEnded":i===1?"inWar":i===2?"preparation":"inWar",
   teamSize:15,
   clan:{tag:i===0?tags[1]:tags[i*2],name:"A"+i,stars:24,
     destructionPercentage:70,members:[{tag:"#2YPP",name:"PRIVATE PERSON",attacks:[{stars:3}]}]},
   opponent:{tag:i===0?tags[0]:tags[i*2+1],name:"B"+i,stars:18,
     destructionPercentage:45,members:[{tag:"#2YLL",name:"PRIVATE ENEMY",attacks:[]}]}
 }));
 const mocked=async url=>{
   requestLog.push(url);
   if(url.includes("leaguegroup"))return {ok:true,json:async()=>group,status:200};
   const index=warTags.findIndex(tag=>url.endsWith(encodeURIComponent(tag)));
   if(index>=0)return {ok:true,json:async()=>wars[index],status:200};
   throw Error("unexpected fetch "+url);
 };
 const backend=code(mocked,f=>f,Response,AbortSignal,{env:{get:()=>"MOCK_KEY"}});
 const data=await backend.loadStatus(tags[0],"MOCK_KEY");
 assert.equal(data.ok,true);
 assert.equal(data.active,true);
 assert.equal(data.rounds[0].clan.tag,tags[0],"requested clan may be in opponent field");
 assert.equal(data.group.clans.length,8);
 assert.equal(data.group.rounds[0].matches.length,4);
 assert.equal(data.group.rounds[0].matches[0].clan.tag,tags[1]);
 assert.equal(data.group.rounds[0].matches[0].state,"warEnded");
 assert.equal(data.group.rounds[0].matches[2].clan.stars,null);
 assert.equal(data.group.rounds[0].matches[2].opponent.attacks,null);
 assert.ok(!JSON.stringify(data.group).includes("PRIVATE PERSON"));
 assert.ok(!JSON.stringify(data.group).includes("members"));
 assert.equal(requestLog.length,5,"exactly one group call plus the same four war calls");
});
test("group round UI shows all matchups and escapes unsafe group names",async()=>{
 const before=global.document;
 const dom=new JSDOM('<div id="cwlSeasonCaption"></div><button id="cwlSeasonRefresh"></button>'+
   '<div id="cwlSeasonTabs"><button data-season-tab="group">Gruppe</button>'+
   '<button data-season-tab="rounds">Runden</button><button data-season-tab="players">Clan</button></div>'+
   '<div id="cwlSeasonContent"></div>',{url:"https://example.test"});
 global.document=dom.window.document;
 try{
   const {createCwlSeasonView}=await load("cwl-season-view.mjs");
   const group=fixture(),profile={cwlLive:{season:"2026-11",clanTag:tags[0],rounds:[]}};
   const view=createCwlSeasonView({getProfile:()=>profile,getSnapshot:()=>null,getGroup:()=>group,isConnected:()=>true,refresh:()=>{}});
   view.render();
   // Season view requires a verified own-season snapshot; simulate a known own war.
   assert.match(dom.window.document.querySelector("#cwlSeasonContent").textContent,/Runde 1/);
   profile.cwlLive.rounds=[{day:1,available:true,state:"warEnded",warTag:"#2PYL0",
     clan:{tag:tags[0],name:"Clan 0",members:[],stars:24},
     opponent:{tag:tags[1],name:"Clan 1",members:[],stars:18}}];
   view.render();
   assert.match(dom.window.document.querySelector("#cwlSeasonContent").textContent,/Runde 1/);
   assert.match(dom.window.document.querySelector("#cwlSeasonContent").textContent,/Paarungen bekannt/);
   dom.window.document.querySelector('[data-season-tab="group"]').click();
   const html=dom.window.document.querySelector("#cwlSeasonContent").innerHTML;
   assert.match(html,/\+ 10 Bonus/);
   assert.doesNotMatch(html,/<svg onload=alert\(1\)>/);
   assert.match(html,/vorläufig/);
   assert.match(html,/Zerstörung Σ/);
 }finally{if(before===undefined)delete global.document;else global.document=before;dom.window.close();}
});
test("group UI respects 320px mobile width and desktop",{
 timeout:120000
},async()=>{
 const html=read("cloud-app.html").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1366]){
   const page=await browser.newPage({viewport:{width,height:850}});
   try{
    await page.setContent(html,{waitUntil:"domcontentloaded"});
    const m=await page.evaluate(()=>{
     document.documentElement.dataset.theme="arena";
     document.querySelectorAll(".view.active").forEach(e=>e.classList.remove("active"));
     document.querySelector("#view-cwl-season").classList.add("active");
     document.querySelector("#cwlSeasonContent").innerHTML=
      '<div class="season-group-scroll"><table class="season-group-table"><tbody>'+
      Array.from({length:8},()=>'<tr><td>1.</td><td>United Fighters</td><td>2</td><td>100</td><td>800</td></tr>').join("")+
      '</tbody></table></div>';
     return {scroll:document.documentElement.scrollWidth,
       viewport:innerWidth,table:document.querySelector(".season-group-scroll").clientWidth};
    });
    assert.ok(m.scroll<=width+3,"group should not overflow "+JSON.stringify({width,m}));
    assert.ok(m.table>100);
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
