"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.resolve(__dirname,"../supabase/functions/coc-cwl-status/index.ts"),"utf8");
const start=source.indexOf("async function recoverArchivedGroup(");
const end=source.indexOf("\n// Archive only sanitized group data",start);
const TAGS=["#2PYL","#2PYQ","#2PYR","#2PYG","#2PYC","#2PYV","#2PY0","#2PY9"];
const tag=x=>String(x||"").toUpperCase();
const valid=x=>/^#[0289PYLQGRJCUV]{3,15}$/.test(x);
const safeStars=x=>Number.isInteger(x)&&x>=0&&x<=150?x:null;
const safeDestruction=x=>Number.isFinite(x)&&x>=0&&x<=100?x:null;
class Clock extends Date {constructor(...a){super(...(a.length?a:["2026-11-11T23:30:00Z"]))}}
const makeSaved=()=>({season:"2026-11",clanTag:TAGS[0],
 clans:TAGS.map((tag,i)=>({tag,name:"Clan "+i})),
 rounds:Array.from({length:7},(_,d)=>({
  day:d+1,matches:Array.from({length:4},(_,i)=>({
   available:true,warTag:["#2PYY","#2PYQ","#2PYR","#2PYG"][i],teamSize:15,
   state:d===6?"inWar":"warEnded",
   clan:{tag:TAGS[2*i],name:"Clan A",stars:30,destructionPercentage:80,attacks:13},
   opponent:{tag:TAGS[2*i+1],name:"Clan B",stars:29,destructionPercentage:78,attacks:12}
  }))
 }))});
function recover(warLookup,groups){
 assert.ok(start>0&&end>start);
 const logger={warn:()=>{}};
 const fn=new Function("tag","valid","safeStars","safeDestruction","getWar","Date","console",
   source.slice(start,end)+"; return recoverArchivedGroup")(
     tag,valid,safeStars,safeDestruction,warLookup,Clock,logger);
 const db={from(t){assert.equal(t,"cwl_group_archives");return{
  select(){return this},eq(){return this},order(){return this},
  async limit(){return {data:groups,error:null}}
 }}};
 return ()=>fn("app-clan-uuid",TAGS[0],"DUMMY",{supabase:db});
}
test("archived group backfills only already observed ended round-seven wars",async()=>{
 const saved=makeSaved();let fetched=0;
 const fn=recover(async warTag=>{
  fetched++;
  const i=["#2PYY","#2PYQ","#2PYR","#2PYG"].indexOf(warTag);
  return {state:"warEnded",teamSize:15,
   clan:{tag:TAGS[2*i],stars:39,destructionPercentage:98,members:[{attacks:[{}]}]},
   opponent:{tag:TAGS[2*i+1],stars:30,destructionPercentage:85,members:[{attacks:[]}]}
  };
 },[{season:"2026-11",clan_tag:TAGS[0],group_json:saved}]);
 const newer=await fn();
 assert.equal(fetched,4,"only the 4 unfinished matches are fetched");
 assert.equal(newer.rounds[6].matches.filter(x=>x.state==="warEnded").length,4);
 assert.equal(newer.rounds[6].matches[0].clan.stars,39);
 assert.equal(newer.rounds[0].matches[0].clan.stars,30,"older verified outcomes unchanged");
 assert.equal(saved.rounds[6].matches[0].state,"inWar","existing saved record never mutated");
});
test("wrong team, unavailable API and wrong tenant never manufacture ended results",async()=>{
 const saved=makeSaved();
 const wrong=recover(async()=>({state:"warEnded",teamSize:15,
   clan:{tag:"#2PYY",stars:35,destructionPercentage:95},
   opponent:{tag:"#2PYQ",stars:20,destructionPercentage:80}
 }),[{season:"2026-11",clan_tag:TAGS[0],group_json:saved}]);
 assert.equal(await wrong(),null);
 const unavailable=recover(async()=>{throw Error("upstream offline")},
  [{season:"2026-11",clan_tag:TAGS[0],group_json:saved}]);
 assert.equal(await unavailable(),null);
 const foreign=recover(async()=>{throw Error("must not fetch")},
  [{season:"2026-11",clan_tag:TAGS[1],group_json:saved}]);
 assert.equal(await foreign(),null);
});
