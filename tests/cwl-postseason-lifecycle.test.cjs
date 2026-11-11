"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const now=Date.parse("2026-11-10T22:00:00Z");
const end=day=>new Date(now-(8-day)*86400000).toISOString()
 .replaceAll("-","").replaceAll(":","");
const validWarDigits="0289PYL";
const warTag=i=>"#P9Q"+validWarDigits[i];
const team=(tag,name)=>[
 {tag,name,townHallLevel:18,attacks:[]},
 {tag:"#G9QL",name:"Second",townHallLevel:18,attacks:[]}
];
function snapshot(season="2026-11",lastState="warEnded"){
 const teamA=team("#2PYL","United"),teamB=team("#8PYL","Other");
 return {ok:true,active:true,season,clanTag:"#2PYL",
  rounds:Array.from({length:7},(_,i)=>({
   day:i+1,available:true,warTag:warTag(i),
   state:i===6?lastState:"warEnded",
   teamSize:2,startTime:end(i+1),endTime:end(i+1),
   clan:{tag:"#2PYL",name:"United",stars:30,members:teamA,
    destructionPercentage:92.3},
   opponent:{tag:"#8PYL",name:"Opponent",stars:27,members:teamB,
    destructionPercentage:87.8}
  }))};
}
const locks=(s,played=7)=>Array.from({length:7},(_,i)=>
 ({locked:i<played,source:i<played?"coc-api":undefined,
   warTag:warTag(i),season:s}));
const profile=(s="2026-11",played=7,state="warEnded")=>({
 config:{days:7,slots:2},locks:locks(s,played),
 cwlLive:{season:s,clanTag:"#2PYL",rounds:snapshot(s,state).rounds}
});
const load=()=>import("../cwl-season-lifecycle.mjs");

test("CWL disappears with last war still inWar: keep 6/7 saved and mark finale unresolved",async()=>{
 const {assessCwlLifecycle}=await load();
 const p=profile("2026-11",6,"inWar");
 const result=assessCwlLifecycle({profile:p,clanTag:"#2PYL",
  confirmedNoCwl:true,now});
 assert.equal(result.mode,"postseason");
 assert.equal(result.savedDays,6);
 assert.equal(result.daysEnded,6);
 assert.equal(result.verifiedSeven,false);
 assert.equal(result.canAutoArchive,false);
 assert.equal(p.locks[6].locked,false);
});
test("Seven confirmed final API rosters + seven same-season API locks permit archiving",async()=>{
 const {assessCwlLifecycle}=await load();
 const p=profile();
 const result=assessCwlLifecycle({profile:p,clanTag:"#2PYL",
   confirmedNoCwl:true,now});
 assert.equal(result.mode,"postseason");
 assert.equal(result.daysEnded,7);
 assert.equal(result.daysMissing,0);
 assert.equal(result.verifiedSeven,true);
 assert.equal(result.canAutoArchive,true);
 assert.equal(assessCwlLifecycle({profile:profile("2026-11",6),clanTag:"#2PYL",
   confirmedNoCwl:true,now}).canAutoArchive,false);
 const manual=profile();manual.locks[6].source="manual";
 assert.equal(assessCwlLifecycle({profile:manual,clanTag:"#2PYL",
   confirmedNoCwl:true,now}).canAutoArchive,false);
});
test("Explicit ended league is postseason, but temporary API loss never ends a season",async()=>{
 const {assessCwlLifecycle}=await load();
 const p=profile("2026-11",6);
 assert.equal(assessCwlLifecycle({profile:p,liveSnapshot:snapshot(),
  groupState:"ended",clanTag:"#2PYL",now}).mode,"postseason");
 assert.equal(assessCwlLifecycle({profile:p,liveSnapshot:snapshot(),
  groupState:"inWar",clanTag:"#2PYL",now}).mode,"planning");
 assert.equal(assessCwlLifecycle({profile:p,clanTag:"#2PYL",now}).mode,"planning");
 assert.equal(assessCwlLifecycle({profile:p,clanTag:"#8PYL",
  confirmedNoCwl:true,now}).mode,"idle");
 assert.equal(assessCwlLifecycle({profile:{},clanTag:"#2PYL",
  confirmedNoCwl:true,now}).mode,"idle");
});
test("New season never overwrites older locked plan; old ended war wins over stale upstream",async()=>{
 const {assessCwlLifecycle,preservedCwlRound}=await load();
 const old=profile("2026-11",6,"inWar");
 const newLeague=snapshot("2026-12");
 const tr=assessCwlLifecycle({profile:old,liveSnapshot:newLeague,
  groupState:"preparation",clanTag:"#2PYL",now});
 assert.equal(tr.mode,"transition");
 assert.equal(tr.oldSeason,"2026-11");
 assert.equal(tr.newSeason,"2026-12");
 assert.equal(tr.canAutoArchive,false);
 const previous=snapshot();
 const stale=snapshot("2026-11","inWar");
 stale.rounds[3]={day:4,available:false};
 const retained=preservedCwlRound(previous,stale);
 assert.equal(retained.rounds[3].state,"warEnded");
 assert.equal(retained.rounds[6].state,"warEnded");
 assert.equal(preservedCwlRound(previous,newLeague),newLeague,
  "Other seasons must not merge rosters or war tags");
});
test("Plan shows actual CWL results inline with same season report; incomplete rounds stay visible",async()=>{
 const {assessCwlLifecycle}=await load();
 const {renderInlineCwlPostseason}=await import("../cwl-season-view.mjs");
 const p=profile("2026-11",6,"inWar");
 const lifecycle=assessCwlLifecycle({profile:p,clanTag:"#2PYL",
  confirmedNoCwl:true,now});
 const html=renderInlineCwlPostseason(p,lifecycle.snapshot,null,lifecycle);
 assert.match(html,/LETZTE CWL/);
 assert.match(html,/6 von 7 Tagen gespeichert/);
 assert.match(html,/Kriegstage/);
 assert.match(html,/Tabelle/);
 assert.match(html,/Spieler/);
 assert.match(html,/Kriegstag 7/);
 assert.doesNotMatch(html,/Saison ansehen/);
 assert.equal(renderInlineCwlPostseason(p,lifecycle.snapshot,null,{mode:"planning"}),"");
});
test("Original Cloud remains independently editable only through owner-gated intentional actions",()=>{
 const core=read("cwl-season-lifecycle.mjs"),live=read("cwl-live.mjs"),
  html=read("cloud-app.html"),cloud=read("cloud-sync.mjs");
 assert.match(core,/canFinalize\(round,slots,now\)/);
 assert.match(core,/lock\.source==="coc-api"/);
 assert.match(core,/previous_season_requires_archive/);
 assert.match(live,/confirmedNoCwl=!data\.active&&!data\.pending/);
 assert.match(live,/renderInlineCwlPostseason/);
 assert.match(live,/cwl_group_archives/);
 assert.match(html,/id="planCwlPostseason"/);
 assert.match(html,/sourceSeason:season\?\.\[0\]/);
 assert.match(html,/archiveConfirmedCwl:.*?\(season\)=>/s);
 assert.match(html,/autoAdvanceCwl:async/);
 assert.match(html,/await cloud\.openNewCycle\(\)/);
 assert.match(html,/state\.archives\.some\(a=>a\.sourceSeason===oldSeason\)/);
 assert.match(cloud,/getCwlLifecycle:\(\)=>live\.getLifecycle\(\)/);
 assert.doesNotMatch(live,/automatically\s+promote|automatically\s+kick/i);
});
