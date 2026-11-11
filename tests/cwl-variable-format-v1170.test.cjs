"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const read=f=>fs.readFileSync(path.join(root,f),"utf8");
const load=async f=>import(pathToFileURL(path.join(root,f)).href);
const ABC="0289PYLQGRJCUV";
const tags=["#2PYL","#2PYQ","#2PYR","#2PYG","#2PYC","#2PYV","#2PY0","#2PY9"];
const playerTag=i=>"#"+ABC[i%14]+ABC[Math.floor(i/14)%14]+"PY";
const players=(n,offset=0)=>Array.from({length:n},(_,i)=>({
 tag:playerTag(i+offset),name:"Spieler "+(i+offset),townHallLevel:18,attacks:[]
}));
const war=(size,day,state="warEnded")=>({
 day,available:true,warTag:"#2PY"+ABC[day],state,teamSize:size,
 startTime:"20261109T100000.000Z",endTime:"20261110T100000.000Z",
 clan:{tag:tags[0],name:"United Fighters",stars:15,destructionPercentage:90,members:players(size)},
 opponent:{tag:"#8PYL",name:"Gegner",stars:9,destructionPercentage:80,members:players(size,50)}
});
const make=(size,number=7,state="preparation")=>({
 ok:true,active:true,season:"2026-11",clanTag:tags[0],
 warCount:number,groupState:state==="warEnded"?"ended":"preparation",
 rounds:Array.from({length:number},(_,i)=>war(size,i+1,state)),
 group:{season:"2026-11",clanTag:tags[0],
  clans:tags.slice(0,number+1).map(tag=>({tag,name:tag})),
  rounds:Array.from({length:number},(_,i)=>({day:i+1,matches:[
   {available:true,state,teamSize:size,clan:{tag:tags[0]},opponent:{tag:tags[1]}}
  ]}))}
});
const profile=()=>({config:{slots:15,days:7},members:[],archivedMembers:[],
 locks:Array.from({length:7},()=>({locked:false,lineup:[]}))});

test("official six-clan CWL is FIVE wars, eight-clan is SEVEN; sizes 5/15/30 come from Clash",async()=>{
 const {deriveCwlFormat}=await load("cwl-live-core.mjs");
 for(const [size,days] of [[5,5],[15,5],[30,5],[15,7],[30,7]]){
  const data=make(size,days);
  assert.deepEqual(deriveCwlFormat(data),{slots:size,warCount:days});
 }
 const disputed=make(30,5);disputed.group.clans=tags.slice(0,8).map(tag=>({tag}));
 assert.equal(deriveCwlFormat(disputed).warCount,null,"contradicting official group sizes cannot redefine days");
 const unknown=make(30,7);unknown.rounds=unknown.rounds.map(r=>({...r,available:false}));
 unknown.group.rounds=unknown.group.rounds.map(r=>({...r,matches:[]}));
 assert.equal(deriveCwlFormat(unknown).slots,null,"do not invent team size from missing wars");
});
test("linked Cloud picks 30v30 before battle; six-clan group sets five days without overwriting locks",async()=>{
 const {reconcileCwl}=await load("cwl-live-core.mjs");
 const p=profile();
 let result=reconcileCwl(p,make(30,7),()=>{throw Error("prep must not create members")});
 assert.equal(p.config.slots,30);
 assert.equal(p.config.days,7);
 assert.equal(result.changed,true);
 assert.equal(result.lockedDays.length,0);
 const six=profile();
 result=reconcileCwl(six,make(15,5),()=>{throw Error("prep must not create members")});
 assert.equal(six.config.slots,15);
 assert.equal(six.config.days,5);
 assert.equal(six.cwlLive.warCount,5);
 assert.equal(six.locks.length,7,"historic slot arrays and day goals are preserved, not truncated");
 const guarded=profile();
 guarded.locks[0]={locked:true,lineup:["historic"],source:"manual"};
 const before=JSON.stringify(guarded);
 result=reconcileCwl(guarded,make(30,5),()=>({id:"new"}));
 assert.equal(result.reason,"unlinked_manual_history");
 assert.equal(JSON.stringify(guarded),before);
});
test("five verifiably ended wars and five saved API lineups complete a five-war CWL",async()=>{
 const {assessCwlLifecycle}=await load("cwl-season-lifecycle.mjs");
 const data=make(5,5,"warEnded");
 const p={...profile(),config:{days:5,slots:5},cwlLive:{
  season:data.season,clanTag:data.clanTag,warCount:5,rounds:data.rounds
 },locks:Array.from({length:7},(_,i)=>i<5?{
  locked:true,source:"coc-api",season:data.season,warTag:data.rounds[i].warTag
 }:{locked:false,lineup:[]})};
 const now=Date.parse("2026-11-11T17:00:00Z");
 const state=assessCwlLifecycle({profile:p,clanTag:tags[0],confirmedNoCwl:true,now});
 assert.equal(state.mode,"postseason");
 assert.equal(state.warCount,5);
 assert.equal(state.daysEnded,5);
 assert.equal(state.daysMissing,0);
 assert.equal(state.verifiedAll,true);
 assert.equal(state.verifiedSeven,false,"legacy seven-specific flag remains honest");
 assert.equal(state.canAutoArchive,true);
 const {renderInlineCwlPostseason}=await load("cwl-season-view.mjs");
 const html=renderInlineCwlPostseason(p,state.snapshot,null,state);
 assert.match(html,/Alle 5 Kriegstage abgeschlossen/);
 assert.doesNotMatch(html,/Kriegstag 6|Kriegstag 7/);
 const incomplete=structuredClone(p);
 incomplete.locks[4].locked=false;
 const next=assessCwlLifecycle({profile:incomplete,clanTag:tags[0],confirmedNoCwl:true,now});
 assert.equal(next.canAutoArchive,false);
 incomplete.cwlLive.rounds[4]={day:5,available:false};
 const missing=assessCwlLifecycle({profile:incomplete,clanTag:tags[0],confirmedNoCwl:true,now});
 assert.equal(missing.verifiedAll,false);
});
test("six-clan group leaderboard has five rounds and full 15 real pairings",async()=>{
 const {summarizeCwlGroup}=await load("cwl-group-core.mjs");
 const clanTags=tags.slice(0,6);
 const rounds=[];
 let rotation=[...clanTags];
 for(let i=0;i<5;i++){
  const matches=[];
  for(let j=0;j<3;j++){
   const a=rotation[j],b=rotation[5-j];
   matches.push({available:true,state:"warEnded",teamSize:15,warTag:"#2PY"+ABC[i+1]+ABC[j],
    clan:{tag:a,stars:12,destructionPercentage:90,attacks:12},
    opponent:{tag:b,stars:9,destructionPercentage:80,attacks:10}});
  }
  rounds.push({day:i+1,matches});
  rotation=[rotation[0],rotation[5],...rotation.slice(1,5)];
 }
 const group={season:"2026-11",clanTag:clanTags[0],
  clans:clanTags.map(tag=>({tag,name:tag})),rounds};
 const sum=summarizeCwlGroup(group);
 assert.equal(sum.warCount,5);
 assert.equal(sum.rounds.length,5);
 assert.equal(sum.expected,15);
 assert.equal(sum.known,15);
 assert.equal(sum.ended,15);
 assert.equal(sum.complete,true);
 assert.equal(sum.clans.length,6);
 assert.ok(sum.clans.every(c=>c.completed===5));
});
test("11 roster members are not 11v11: solver can select 5 per war for five days",async()=>{
 const {planCwl}=require("../cwl-planning-core.js");
 const members=Array.from({length:11},(_,i)=>({id:"m"+i,name:"Player"+i,
  participating:true,fixed:false,statuses:Array(7).fill("auto"),targetDays:null}));
 const result=planCwl({members,days:5,slots:5});
 assert.equal(result.ok,true,JSON.stringify(result.conflicts));
 assert.equal(result.dayPlans.length,5);
 assert.ok(result.dayPlans.every(d=>d.lineup.length===5));
 const custom=planCwl({members,days:5,slots:11});
 assert.equal(custom.dayPlans[0].lineup.length,11,"custom/manual engine supports 11 but this is not a Supercell CWL rule");
});
test("cloud API controls format, guest remains manual and shorter rollover uses exact finished days",()=>{
 const html=read("cloud-app.html"),live=read("cwl-live.mjs");
 assert.match(html,/preset\.disabled=locked\|\|apiLinked/);
 assert.match(html,/document\.getElementById\("daysInput"\)\.disabled=locked\|\|apiLinked/);
 assert.match(html,/state\.config\.days!==\(state\.cwlLive\?\.warCount===5\?5:7\)/);
 assert.match(html,/const warCount=state\.cwlLive\?\.warCount===5\?5:7/);
 assert.match(live,/verifiedAll:model\.verifiedAll/);
 assert.match(read("index.html"),/const APP_VERSION="v1\.0\.2"/);
});
