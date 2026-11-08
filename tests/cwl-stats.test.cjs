"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const load=()=>import(pathToFileURL(path.join(root,"cwl-stats-core.mjs")).href);
const war=(key,type,date,roster=null,finalized=false)=>({
 clan_id:"demo-clan",war_key:key,war_type:type,started_at:date,
 team_size:15,opponent_name:"Example",source:roster?"api":"import",
 roster_tags:roster,finalized
});
const attack=(war_key,tag,stars,attacker_th,defender_th)=>({
 war_key,attacker_tag:tag,attacker_name:tag,attacker_th,defender_th,
 stars,destruction:stars===3?100:74,attack_order:1
});
test("Historical import accepts the current clan and rejects duplicate or foreign data",async()=>{
 const {validateHistoryFile}=await load();
 const h={kind:"cwl-stats-history",format:1,clanTag:"#99JP2RL2",
 wars:[{war_key:"cp:123",war_type:"normal",started_at:"2026-10-25T12:00:00Z",
  team_size:15,opponent_tag:"#2JGC",opponent_name:"Gegner"}],
 attacks:[{war_key:"cp:123",attacker_tag:"#2PYL",attack_order:7,
  attacker_name:"Name",attacker_th:18,defender_tag:"#8PY",defender_name:"Base",
  defender_th:18,stars:3,destruction:100}]};
 const result=validateHistoryFile(h,"#99JP2RL2");
 assert.equal(result.wars.length,1);
 assert.equal(result.attacks.length,1);
 assert.equal(result.attacks[0].stars,3);
 assert.throws(()=>validateHistoryFile(h,"#2JGC2J8VG"),/falscher Clan-Tag/);
 const dup=structuredClone(h);dup.attacks.push({...dup.attacks[0]});
 assert.throws(()=>validateHistoryFile(dup,h.clanTag),/doppelte Angriffszeile/);
});
test("Hit rate uses 3 stars/attacks and same-or-higher TH filter only counts eligible attacks",async()=>{
 const {computeWarStats}=await load();
 const w=[war("cw:1","normal","2026-10-30T00:00:00Z"),war("cwl:2","cwl","2026-10-28T00:00:00Z")];
 const a=[attack("cw:1","#2PYL",3,18,17),attack("cwl:2","#2PYL",2,18,19),
  attack("cwl:2","#8PY",3,18,18)];
 let s=computeWarStats(w,a,{type:"all",last:25});
 assert.equal(s.attacks,3);assert.equal(s.hitRate,67);
 assert.equal(s.misses,null,"Historical missed counts cannot be inferred");
 s=computeWarStats(w,a,{type:"all",last:25,sameHigher:true});
 assert.equal(s.attacks,2);assert.equal(s.hitRate,50);
 s=computeWarStats(w,a,{type:"cwl",last:25});
 assert.equal(s.wars,1);assert.equal(s.hitRate,50);
 s=computeWarStats(w,a,{type:"normal",last:25});
 assert.equal(s.wars,1);assert.equal(s.hitRate,100);
});
test("CWL missed attacks require a verified complete missed log, not roster-only inference",async()=>{
 const {computeWarStats}=await load();
 const w=[{...war("cwl:ok","cwl","2026-11-01T00:00:00Z",["#2PYL","#8PY"],true),
   team_size:2,missed_log_complete:false}];
 const a=[attack("cwl:ok","#2PYL",3,18,18)];
 const unknown=computeWarStats(w,a,{});
 assert.equal(unknown.complete,false);
 assert.equal(unknown.misses,null);
 assert.equal(unknown.missesKnown,0);
 assert.equal(unknown.missedCoverage.cwl.coveredWars,0);
 assert.equal(unknown.rows.find(r=>r.tag==="#2PYL").missed,null);
 assert.equal(unknown.rows.some(r=>r.tag==="#8PY"),false,
   "No phantom missed-attack record for a player with no recorded attack");

 const confirmed=computeWarStats([{...w[0],missed_log_complete:true}],a,{
   missedEvents:[{war_key:"cwl:ok",player_tag:"#8PY",player_name:"Absent",missed_count:1}]
 });
 assert.equal(confirmed.complete,true);
 assert.equal(confirmed.misses,1);
 assert.equal(confirmed.missedCoverage.cwl.coveredWars,1);
 assert.equal(confirmed.rows.find(r=>r.tag==="#8PY").missed,1);
 assert.equal(confirmed.rows.find(r=>r.tag==="#8PY").attacks,0);
 assert.equal(confirmed.rows.find(r=>r.tag==="#2PYL").missed,0);
});
test("Stats UI, migration and data version are independent from the manual planner",async()=>{
 const source=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 const client=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
 const migration=fs.readFileSync(path.join(root,"supabase/migrations/20261031125500_cwl_private_attack_history_stats.sql"),"utf8");
 const stats=fs.readFileSync(path.join(root,"cwl-stats.mjs"),"utf8");
 assert.match(source,/id="view-stats"/);
 assert.match(source,/id="statsNav"/);
 assert.match(source,/id="statsSameTH"/);
 assert.match(source,/const DATA_VERSION=9/);
 assert.match(client,/createCloudStats/);
 assert.match(client,/return stats\.captureCwl\(data\)/);
 assert.match(stats,/validateHistoryFile/);
 assert.match(migration,/enable row level security/);
 assert.match(migration,/private\.cwl_is_member/);
 assert.match(migration,/private\.cwl_can_edit/);
});


test("Missed log is grouped by actual war and player, excluding unknown CWL misses",async()=>{
 const {validateHistoryFile,computeWarStats}=await load();
 const history={kind:"cwl-stats-history",format:1,clanTag:"#99JP2RL2",
  wars:[
    {war_key:"cp:101",war_type:"normal",started_at:"2026-10-20T00:00:00Z",
      team_size:15,opponent_name:"Test CW",missed_log_complete:true},
    {war_key:"cp:102",war_type:"cwl",started_at:"2026-10-19T00:00:00Z",
      team_size:15,opponent_name:"Test CWL"}
  ],
  attacks:[
    {war_key:"cp:101",attacker_tag:"#2PYL",attack_order:1,attacker_name:"One",
      attacker_th:18,defender_th:18,stars:3,destruction:100},
    {war_key:"cp:102",attacker_tag:"#2PYL",attack_order:1,attacker_name:"One",
      attacker_th:18,defender_th:18,stars:2,destruction:75}
  ],
  missed:[
    {war_key:"cp:101",player_tag:"#2PYL",player_name:"One",missed_count:1},
    {war_key:"cp:101",player_tag:"#8PY",player_name:"Only missed",missed_count:2}
  ]
 };
 const parsed=validateHistoryFile(history,history.clanTag);
 assert.equal(parsed.missed.length,2);
 const opts={type:"normal",last:25,missedEvents:parsed.missed};
 const normal=computeWarStats(parsed.wars,parsed.attacks,opts);
 assert.equal(normal.complete,true);
 assert.equal(normal.misses,3);
 assert.equal(normal.missesKnown,3);
 assert.equal(normal.rows.find(p=>p.tag==="#2PYL").missed,1);
 const absent=normal.rows.find(p=>p.tag==="#8PY");
 assert.equal(absent.attacks,0);
 assert.equal(absent.hitRate,null);
 assert.equal(absent.missed,2);
 const all=computeWarStats(parsed.wars,parsed.attacks,{type:"all",missedEvents:parsed.missed});
 assert.equal(all.complete,false,"No CWL missed log");
 assert.equal(all.misses,null);
 assert.equal(all.missesKnown,3);
 assert.equal(all.rows.find(p=>p.tag==="#2PYL").missedKnown,1);
 assert.equal(all.rows.find(p=>p.tag==="#2PYL").missed,null);
 const cwl=computeWarStats(parsed.wars,parsed.attacks,{type:"cwl",missedEvents:parsed.missed});
 assert.equal(cwl.missesKnown,0);assert.equal(cwl.misses,null);
 const restricted=computeWarStats(parsed.wars,parsed.attacks,{...opts,sameHigher:true});
 assert.equal(restricted.misses,normal.misses,"TH filter must not alter logged misses");
 const duplicated=structuredClone(history);duplicated.missed.push({...duplicated.missed[0]});
 assert.throws(()=>validateHistoryFile(duplicated,history.clanTag),/doppelter Missed-Attacks-Eintrag/);
 const cross=structuredClone(history);cross.missed[0].war_key="cp:102";
 const cwEvent=validateHistoryFile(cross,history.clanTag);
 assert.equal(cwEvent.missed[0].war_key,"cp:102","A CWL missed event is valid partial evidence");
 assert.equal(cwEvent.wars[1].missed_log_complete,false,"Unknown CWL coverage must be explicitly false, not NULL");
 assert.throws(()=>validateHistoryFile(history,"#2JGC2J8VG"),/falscher Clan-Tag/);
});
test("New missed log table uses per-clan RLS with editor write and viewer read",()=>{
 const sql=fs.readFileSync(path.join(root,
   "supabase/migrations/20261031133000_cwl_statistics_missed_attack_log.sql"),"utf8");
 assert.match(sql,/missed_log_complete/);
 assert.match(sql,/cwl_stat_missed/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/private\.cwl_is_member/);
 assert.match(sql,/private\.cwl_can_edit/);
});


test("Exact CWL misses count as proven lower bound without assuming full league coverage",async()=>{
 const {validateHistoryFile,computeWarStats}=await load();
 const raw={kind:"cwl-stats-history",format:1,clanTag:"#99JP2RL2",
   wars:[{war_key:"cp:101",war_type:"normal",started_at:"2026-10-29T00:00:00Z",
      team_size:15,opponent_name:"CW",missed_log_complete:true},
     {war_key:"cp:102",war_type:"cwl",started_at:"2026-10-28T00:00:00Z",
      team_size:15,opponent_name:"CWL"}],
   attacks:[{war_key:"cp:101",attacker_tag:"#2PYL",attack_order:1,attacker_name:"Alpha",
      attacker_th:18,defender_th:18,stars:3,destruction:100},
     {war_key:"cp:102",attacker_tag:"#8PY",attack_order:1,attacker_name:"Bravo",
      attacker_th:19,defender_th:18,stars:2,destruction:86}],
   missed:[{war_key:"cp:101",player_tag:"#2PYL",player_name:"Alpha",missed_count:1},
     {war_key:"cp:102",player_tag:"#8PY",player_name:"Bravo",missed_count:1}]};
 const parsed=validateHistoryFile(raw,raw.clanTag);
 const opts={type:"all",last:25,missedEvents:parsed.missed};
 const combined=computeWarStats(parsed.wars,parsed.attacks,opts);
 assert.equal(combined.missesKnown,2,"Both logs are counted exactly once");
 assert.equal(combined.misses,null,"Uncovered CWLs prohibit complete totals");
 assert.equal(combined.rows.find(p=>p.tag==="#8PY").missedKnown,1);
 assert.equal(combined.rows.find(p=>p.tag==="#8PY").missed,null);
 const onlyCwl=computeWarStats(parsed.wars,parsed.attacks,{...opts,type:"cwl"});
 assert.equal(onlyCwl.missesKnown,1);
 assert.equal(onlyCwl.misses,null);
 assert.equal(onlyCwl.hitRate,0);
 const bad=structuredClone(raw);bad.missed[1].missed_count=2;
 assert.throws(()=>validateHistoryFile(bad,bad.clanTag),/Missed-Attacks-Eintrag/);
 const normal=computeWarStats(parsed.wars,parsed.attacks,{...opts,type:"normal"});
 assert.equal(normal.misses,1);
 assert.equal(normal.complete,true);
});
test("Cloud statistics show native normal CWs independently of manual CWL planning",()=>{
 const src=fs.readFileSync(path.join(root,"supabase/functions/coc-cwl-status/index.ts"),"utf8");
 const ui=fs.readFileSync(path.join(root,"cwl-stats.mjs"),"utf8");
 const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
 assert.match(src,/currentNormalWar/);
 assert.match(src,/currentwar",key\)/); // official current-war endpoint
 assert.match(src,/attacksPerMember/);
 assert.match(ui,/const normal=payload\?\.currentWar/);
 assert.match(ui,/war_type:"normal"/);
 assert.match(ui,/source:"api",finalized:true/);
 assert.match(ui,/const snap=sanitizeSnapshot\(payload\)/);
 assert.match(sync,/return stats\.captureCwl\(data\)/);
});
test("Logout removes cloud-only Statistics and returns to Plan",()=>{
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
 assert.ok(html.includes("body.cloud-mode .navinner{grid-template-columns:repeat(4,minmax(0,1fr))}"));
 assert.ok(html.includes(".navinner{grid-template-columns:repeat(3,minmax(0,1fr));"));
 assert.match(sync,/async function leaveCloud\(\)\{[\s\S]*?toggle\("statsNav",false\)/);
 assert.match(sync,/document\.querySelector\('\.navbtn\[data-view="plan"\]'\)\?\.click\(\)/);
});


test("Historical import always produces a concrete boolean for every war",async()=>{
 const {validateHistoryFile}=await load();
 const history={kind:"cwl-stats-history",format:1,clanTag:"#99JP2RL2",
   wars:[
     {war_key:"cp:123",war_type:"normal",started_at:"2026-10-29T00:00:00Z",team_size:15,
      missed_log_complete:true},
     {war_key:"cp:124",war_type:"cwl",started_at:"2026-10-28T00:00:00Z",team_size:15,
      missed_log_complete:false},
     {war_key:"cp:125",war_type:"cwl",started_at:"2026-10-27T00:00:00Z",team_size:15}
   ],attacks:[],missed:[]};
 const result=validateHistoryFile(history,history.clanTag);
 assert.deepEqual(result.wars.map(w=>w.missed_log_complete),[true,false,false]);
 for(const w of result.wars){
   assert.equal(typeof w.missed_log_complete,"boolean");
   assert.notEqual(w.missed_log_complete,null);
 }
 const ui=fs.readFileSync(path.join(root,"cwl-stats.mjs"),"utf8");
 assert.match(ui,/missed_log_complete:w\.missed_log_complete===true/);
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 assert.doesNotMatch(html,/<span class="badge ok">3★ Hit Rate<\/span>/);
});


test("CWL run selection groups 21 league days into Aug/Sep/Oct, never one season per day",async()=>{
 const {computeWarStats,selectStatWars,cwlSeasonOf}=await load();
 const months=["2026-08","2026-09","2026-10"];
 const wars=months.flatMap(month=>Array.from({length:7},(_,i)=>({
   war_key:"league:"+month+":"+i,war_type:"cwl",
   started_at:month+"-"+String(i+4).padStart(2,"0")+"T06:00:00Z",
   team_size:15,finalized:false,missed_log_complete:false,roster_tags:null
 })));
 const attacks=wars.map(w=>({
   war_key:w.war_key,attacker_tag:"#L9RR0YP28",attacker_name:"UF Weiss",
   attacker_th:18,defender_th:18,stars:3,destruction:100,attack_order:1
 }));
 const one=computeWarStats(wars,attacks,{type:"cwl",cwlSeasons:1});
 assert.equal(one.wars,7);
 assert.equal(one.attacks,7);
 assert.deepEqual(one.cwlSeasonBreakdown.map(({season,days})=>({season,days})),[{season:"2026-10",days:7}]);
 const two=computeWarStats(wars,attacks,{type:"cwl",cwlSeasons:2});
 assert.equal(two.wars,14);
 assert.equal(two.attacks,14);
 const three=computeWarStats(wars,attacks,{type:"cwl",cwlSeasons:3});
 assert.equal(three.wars,21);
 assert.equal(three.attacks,21);
 assert.equal(three.rows[0].hitRate,100);
 assert.equal(three.rows[0].attacks,21);
 assert.equal(three.totalCwlSeasons,3);
 assert.equal(three.totalCwlDays,21);
 assert.deepEqual(three.cwlSeasonBreakdown.map(({season,days})=>({season,days})),[
   {season:"2026-08",days:7},{season:"2026-09",days:7},{season:"2026-10",days:7}
 ]);
 assert.equal(computeWarStats(wars,attacks,{type:"cwl",cwlSeasons:"all"}).wars,21);
 assert.equal(computeWarStats(wars,attacks,{type:"cwl",last:10}).wars,21,
   "CWL always groups by seasons; last-N no longer truncates individual days");
 assert.equal(selectStatWars(wars,{type:"cwl",cwlSeasons:1}).length,7);
 assert.equal(cwlSeasonOf(wars[0]),"2026-08");
});
test("Partial league seasons are not silently expanded to seven days",async()=>{
 const {computeWarStats}=await load();
 const full=Array.from({length:7},(_,i)=>({
   war_key:"sept:"+i,war_type:"cwl",started_at:"2026-09-"+String(i+4).padStart(2,"0")+"T12:00:00Z",team_size:15
 }));
 const partial=Array.from({length:3},(_,i)=>({
   war_key:"oct:"+i,war_type:"cwl",started_at:"2026-10-"+String(i+4).padStart(2,"0")+"T12:00:00Z",team_size:15
 }));
 const r=computeWarStats([...full,...partial],[],{type:"cwl",cwlSeasons:1});
 assert.equal(r.wars,3);
 assert.deepEqual(r.cwlSeasonBreakdown.map(({season,days})=>({season,days})),[{season:"2026-10",days:3}]);
 assert.equal(r.totalCwlDays,10);
 assert.equal(r.totalCwlSeasons,2);
});
test("Statistics UI explicitly labels CWL season period and shows included months",()=>{
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 const ui=fs.readFileSync(path.join(root,"cwl-stats.mjs"),"utf8");
 assert.match(html,/id="statsPeriodLabel"/);
 assert.match(html,/id="statsSeasonDetails"/);
 assert.match(ui,/cwlSeasons="all"/);
 assert.match(html,/Letzter CWL-Durchgang/);
 assert.match(html,/Letzte 3 CWL-Durchgänge/);
 assert.match(html,/Alle gespeicherten CWL-Durchgänge/);
 assert.match(ui,/gespeicherten CWL-Kriegstagen/);
 assert.match(ui,/erfasste Kriegstage/);
 assert.match(ui,/type,last,cwlSeasons,sameHigher/);
});


test("Missed coverage stays exact for CW while CWL remains a lower bound",async()=>{
 const {computeWarStats}=await load();
 const a="#2PYL",b="#8PY";
 const wars=[
  {...war("cw:complete","normal","2026-10-29T00:00:00Z"),missed_log_complete:true},
  {...war("cwl:partial","cwl","2026-10-28T00:00:00Z"),missed_log_complete:false},
  {...war("cwl:api","cwl","2026-10-27T00:00:00Z",[a,b],true),team_size:2}
 ];
 const attacks=[
  attack("cw:complete",a,3,18,18),
  attack("cwl:partial",a,2,18,18),
  attack("cwl:api",a,3,18,18)
 ];
 const missedEvents=[
  {war_key:"cw:complete",player_tag:a,player_name:"A",missed_count:1},
  {war_key:"cwl:partial",player_tag:a,player_name:"A",missed_count:1},
  // A redundant explicit roster miss must NOT double-count a proved API miss.
  {war_key:"cwl:api",player_tag:b,player_name:"B",missed_count:1}
 ];
 const all=computeWarStats(wars,attacks,{type:"all",missedEvents});
 assert.equal(all.missesKnown,3);
 assert.equal(all.misses,null,"Mixed CW/CWL history must not fabricate a complete total");
 assert.deepEqual(all.missedCoverage.normal,{wars:1,coveredWars:1,missedKnown:1,complete:true});
 assert.deepEqual(all.missedCoverage.cwl,{wars:2,coveredWars:0,missedKnown:2,complete:false});
 const known=all.rows.find(p=>p.tag===a);
 assert.deepEqual(known.missedKnownByType,{normal:1,cwl:1});
 assert.equal(known.missedKnown,2);
 assert.equal(known.missed,null);
 const maybe=all.rows.find(p=>p.tag===b);
 assert.equal(maybe.missedKnown,1);
 assert.equal(maybe.missed,null,
  "If another CWL lineup is unknown, a player absent from that export cannot have a verified complete count");
 assert.equal(maybe.missedComplete,false);
 assert.deepEqual(maybe.missedKnownByType,{normal:0,cwl:1});
 const cw=computeWarStats(wars,attacks,{type:"normal",missedEvents});
 assert.equal(cw.misses,1);
 assert.equal(cw.missedCoverage.normal.complete,true);
 assert.equal(cw.rows.find(p=>p.tag===a).missed,1);
 const cwl=computeWarStats(wars,attacks,{type:"cwl",missedEvents});
 assert.equal(cwl.misses,null);
 assert.equal(cwl.missedCoverage.cwl.missedKnown,2);
 assert.equal(cwl.missedCoverage.cwl.coveredWars,0);
 const filtered=computeWarStats(wars,attacks,{type:"all",sameHigher:true,missedEvents});
 assert.equal(filtered.missesKnown,3,"TH filters cannot erase missed attack evidence");
});

test("Statistics UI explains incomplete historical CWL data and sorts proved misses",()=>{
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 const ui=fs.readFileSync(path.join(root,"cwl-stats.mjs"),"utf8");
 assert.match(html,/id="statsMissedCoverage"/);
 assert.match(ui,/const coverageDescriptions=/);
 assert.match(ui,/missedCoverageHost\.textContent/);
 assert.match(ui,/order==="missed"\?p\.missedKnown/);
 assert.match(ui,/Eine CWL-Aufstellung allein ist kein Nachweis/,"Missing league data must be explained");
 assert.match(ui,/cwl-stats-core\.mjs\?v=1\.16\.24/);
 assert.match(ui,/CWL: /);
});
