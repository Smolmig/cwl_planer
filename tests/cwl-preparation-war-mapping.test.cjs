"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");

// Exercise the actual edge-function day-mapping code, without credentials,
// Supabase, requests, or any writes to a live Clash clan.
const source=fs.readFileSync(path.join(__dirname,"..","supabase/functions/coc-cwl-status/index.ts"),"utf8");
const helpers=source.slice(source.indexOf("const tag="),source.indexOf("async function getGame("));
const begin=source.indexOf("async function loadStatus("),end=source.indexOf("const handler=withSupabase",begin);
assert.ok(begin>0&&end>begin,"CWL edge-function mapping exists");
const loadCode=helpers+"\n"+source.slice(begin,end)+"\nloadStatus";

const names="0289PYLQGRJCUV";
const tag=n=>"#2P"+names[Math.floor(n/names.length)]+names[n%names.length];
const players=(prefix,n=15,start=0)=>Array.from({length:n},(_,i)=>({
 tag:tag(i+start),name:prefix+" "+(i+1),townHallLevel:18+i%3,attacks:[]
}));
const side=(clanTag,name,members)=>({tag:clanTag,name,stars:0,members});
function make(group,wars){
 const called=[];
 const ctx={
  URL,Date,Map,Set,console:{warn(){}},
  getGame:async uri=>{
   called.push(uri);return group;
  },
  getWar:async warTag=>{
   called.push(warTag);return wars[warTag]||null;
  },
  currentNormalWar:async()=>null
 };
 return {load:vm.runInNewContext(loadCode,ctx),called};
}
test("first preparation war is correctly attached to day 1 when our clan is the API opponent",async()=>{
 const own=players("United",15,0),enemy=players("Enemy",15,15);
 const group={season:"2026-11-02",state:"preparation",
  clans:[{tag:"#2PYG",name:"United Fighters"},{tag:"#2PYJ",name:"Enemy Clan"}],
  rounds:[{warTags:["#0","#2PYR","#2PYY"]},{warTags:["#0"]}]};
 const wars={
  "#2PYR":{state:"preparation",teamSize:15,startTime:"20261104T120000.000Z",
   clan:side("#2PYJ","Enemy Clan",enemy),opponent:side("#2PYG","United Fighters",own)},
  "#2PYY":{state:"preparation",teamSize:15,clan:side("#2PYV","Unrelated A",players("X")),
   opponent:side("#2PYQ","Unrelated B",players("Y",15,15))}
 };
 const x=make(group,wars),result=await x.load("#2PYG","key-placeholder");
 assert.equal(result.ok,true);
 assert.equal(result.active,true);
 assert.equal(result.season,"2026-11");
 assert.equal(result.rounds[0].day,1);
 assert.equal(result.rounds[0].warTag,"#2PYR");
 assert.equal(result.rounds[0].state,"preparation");
 assert.equal(result.rounds[0].clan.name,"United Fighters");
 assert.equal(result.rounds[0].opponent.name,"Enemy Clan");
 assert.equal(result.rounds[0].clan.members.length,15);
 assert.equal(result.rounds[0].opponent.members.length,15);
 assert.equal(result.rounds[0].clan.members[0].name,"United 1");
 assert.equal(result.rounds[0].opponent.members[0].name,"Enemy 1");
 assert.equal(result.rounds[1].available,false);
 assert.equal(result.rounds[1].day,2);
 assert.equal(result.rounds.length,7);
 assert.ok(!x.called.includes("#0"),"unreleased placeholder should never be fetched");
});
test("preparation grouping never invents a lineup if wars are unreleased",async()=>{
 const group={season:"2026-11-02",state:"preparation",
  rounds:[{warTags:["#0"]},{warTags:[]}]};
 const x=make(group,{}),res=await x.load("#2PYG","placeholder");
 assert.equal(res.active,true);
 assert.equal(res.rounds.length,7);
 assert.ok(res.rounds.every(r=>r.available===false));
 assert.equal(res.detailsStatus,"not_released");
 assert.equal(x.called.filter(s=>s.startsWith("/clanwarleagues/")).length,0);
});
test("preparation roster preserves names, Rathaus and player tags, but never imports the complete league group as a day lineup",async()=>{
 const group={season:"2026-11",state:"preparation",
  clans:[{tag:"#2PYG",name:"United",members:players("Registered",30)}],
  rounds:[{warTags:["#2PYR"]}]};
 const war={state:"preparation",teamSize:15,
  clan:side("#2PYG","United",players("Day-1",15)),
  opponent:side("#2PYJ","Enemy",players("Day-1 Enemy",15,15))};
 const res=await make(group,{"#2PYR":war}).load("#2PYG","placeholder");
 assert.equal(res.rounds[0].teamSize,15);
 assert.equal(res.rounds[0].clan.members.length,15);
 assert.equal(res.rounds[0].clan.members[0].name,"Day-1 1");
 assert.equal(res.rounds[0].clan.members[14].tag,tag(14));
 assert.equal(res.rounds[0].opponent.members[14].tag,tag(29));
});
