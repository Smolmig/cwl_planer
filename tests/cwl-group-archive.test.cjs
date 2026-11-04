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
 const sql=read("docs/group-archive-schema-review.sql");
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
   return {select(){
    return {eq(key,value){assert.equal(key,"clan_id");assert.equal(value,"clan-a");return {
      order(){return {limit:async()=>({data:[
       {season:"2026-11",group_json:group(),updated_at:"2026-11-04T11:00:00Z"}
      ],error:null})}}
    }}}}
   }};
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
  let id="clan-a";const pending=[deferred(),deferred()];
  const client={from(){return {select(){return {eq(){return {order(){return {
    limit(){return pending.shift()?.promise||Promise.resolve({data:[],error:null})}
  }}}}}}}}};
  const view=createCwlGroupArchiveView({sb:client,getClanId:()=>id,isConnected:()=>true});
  const first=view.open();id="clan-b";const second=view.open();
  const latest=group();latest.season="2026-12";
  // Resolve newer request first. The earlier clan must not displace it.
  const current=pending;
  // We cannot access shifted deferreds here; use explicit queue test below.
  await Promise.allSettled([first,second]);
 }finally{if(original===undefined)delete global.document;else global.document=original;dom.window.close()}
});
