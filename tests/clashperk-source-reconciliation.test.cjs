"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {pathToFileURL}=require("node:url");
const path=require("node:path");
const mod=()=>import(pathToFileURL(path.join(__dirname,"..","cwl-stats-source-reconciliation.mjs")).href);
const counts=[15,13,14,15,15,14,14];
const clanId="tenant-a",opponent=i=>"#QPY"+i;
const war=(i,source,type="cwl",extra={})=>({
 clan_id:clanId,source,finalized:true,war_key:source==="api"?"cwl:#R"+i:"cp:"+(7000+i),
 war_type:type,team_size:type==="normal"?10:15,opponent_tag:opponent(i),
 opponent_name:"Synthetic opponent "+i,
 started_at:new Date(Date.UTC(2026,10,3+i+(source==="import"?1:0),19,17)).toISOString(),
 missed_log_complete:source==="import",...extra
});
const hits=(warKey,n)=>{
 const list=[];
 for(let i=0;i<n;i++)list.push({
  war_key:warKey,attacker_tag:"#PLY"+(i%15),defender_tag:"#QPY"+(i+100),
  attack_order:i+1,stars:i%4,destruction:60+i,attacker_th:17,defender_th:17
 });
 return list;
};
const misses=(warKey,n,tag="#PLY2")=>n?[{war_key:warKey,player_tag:tag,player_name:"Example",missed_count:n}]:[];
test("UF 2 synthetic regression: seven duplicated CWL wars and 100 duplicate attack rows",async()=>{
 const {reconcileClashPerkApiHistory}=await mod();
 const wars=[],attacks=[],missed=[];
 const impMiss=[0,2,1,0,0,1,1],apiMiss=[0,0,0,0,0,1,1];
 for(let i=0;i<7;i++){
  const a=war(i,"api","cwl",{missed_log_complete:i>=3});
  const b=war(i,"import");
  wars.push(a,b);
  attacks.push(...hits(a.war_key,counts[i]),...hits(b.war_key,counts[i]));
  missed.push(...misses(a.war_key,apiMiss[i]),...misses(b.war_key,impMiss[i]));
 }
 assert.equal(attacks.length,200);
 const normalized=reconcileClashPerkApiHistory(wars,attacks,missed);
 assert.equal(normalized.deduplicatedWars,7);
 assert.equal(normalized.deduplicatedAttacks,100);
 assert.equal(normalized.wars.length,7);
 assert.equal(normalized.attacks.length,100);
 assert.equal(normalized.missedEvents.reduce((n,m)=>n+m.missed_count,0),5);
 assert.equal(normalized.wars.every(w=>w.source==="api"&&w.missed_log_complete===true),true);
 assert.equal(normalized.conflicts.length,0);
 const core=await import(pathToFileURL(path.join(__dirname,"..","cwl-stats-core.mjs")).href);
 const summary=core.computeWarStats(normalized.wars,normalized.attacks,{
  type:"all",last:"all",cwlSeasons:"all",missedEvents:normalized.missedEvents
 });
 assert.equal(summary.wars,7);
 assert.equal(summary.attacks,100);
 assert.equal(summary.misses,5);
 assert.equal(summary.complete,true);
 assert.equal(summary.missingCoverage,false);
 assert.equal(normalized.aliases.get("cp:7000"),"cwl:#R0");
 assert.deepEqual(
  normalized.wars.map(w=>w.started_at),
  wars.filter(w=>w.source==="api").map(w=>w.started_at)
 );
 const replay=reconcileClashPerkApiHistory(normalized.wars,normalized.attacks,normalized.missedEvents);
 assert.equal(replay.deduplicatedWars,0);
 assert.equal(replay.wars.length,7);
 assert.equal(replay.attacks.length,100);
 assert.equal(replay.missedEvents.reduce((n,m)=>n+m.missed_count,0),5);
});
test("Normal CWs also reconcile when attack signatures prove identity",async()=>{
 const {reconcileClashPerkApiHistory,classifyClashPerkApiCandidates}=await mod();
 const api=war(30,"api","normal",{war_key:"normal:20261103:#QPY30"});
 const imported=war(30,"import","normal",{war_key:"cp:9030"});
 const a=hits(api.war_key,4),b=hits(imported.war_key,4);
 const result=reconcileClashPerkApiHistory([api,imported],[...a,...b],misses(imported.war_key,1));
 assert.equal(result.deduplicatedWars,1);
 assert.equal(result.wars.length,1);
 assert.equal(result.attacks.length,4);
 assert.equal(result.missedEvents[0].war_key,api.war_key);
 const preview=classifyClashPerkApiCandidates({wars:[imported],attacks:b},[api],a);
 assert.equal(preview.verified.get(imported.war_key),api.war_key);
 assert.equal(preview.conflicts.length,0);
});
test("Different clans, sizes, war types, or months are never automatically merged",async()=>{
 const {reconcileClashPerkApiHistory}=await mod();
 const a=war(1,"api"),b=war(1,"import");
 const variants=[
  {...b,clan_id:"tenant-b"},
  {...b,opponent_tag:"#OTHER"},
  {...b,team_size:30},
  {...b,war_type:"normal"},
  {...b,started_at:"2026-12-05T19:17:00.000Z"}
 ];
 for(const change of variants){
  const result=reconcileClashPerkApiHistory([a,change],
   [...hits(a.war_key,3),...hits(change.war_key,3)]);
  assert.equal(result.deduplicatedWars,0);
  assert.equal(result.wars.length,2);
 }
});
test("Incomplete or conflicting attack signatures do not authorize a war alias",async()=>{
 const {reconcileClashPerkApiHistory,classifyClashPerkApiCandidates}=await mod();
 const a=war(2,"api"),b=war(2,"import");
 const api=hits(a.war_key,5),imported=hits(b.war_key,5);
 const changes=[
  imported.slice(0,4),
  imported.map((x,i)=>i===0?{...x,stars:3}:x),
  imported.map((x,i)=>i===0?{...x,destruction:99}:x),
  [imported[0]],
  []
 ];
 for(const other of changes){
  const result=reconcileClashPerkApiHistory([a,b],[...api,...other]);
  assert.equal(result.deduplicatedWars,0);
  assert.equal(result.wars.length,2);
  assert.equal(result.conflicts.length,1);
  const preview=classifyClashPerkApiCandidates({wars:[b],attacks:other},[a],api);
  assert.equal(preview.verified.size,0);
  assert.equal(preview.conflicts.length,1);
 }
});
test("Contradictory confirmed missed evidence blocks the automatic merge",async()=>{
 const {reconcileClashPerkApiHistory}=await mod();
 const a=war(3,"api","cwl",{missed_log_complete:true});
 const b=war(3,"import","cwl",{missed_log_complete:true});
 const matched=[...hits(a.war_key,3),...hits(b.war_key,3)];
 const result=reconcileClashPerkApiHistory([a,b],matched,[
  ...misses(a.war_key,1),...misses(b.war_key,2)
 ]);
 assert.equal(result.deduplicatedWars,0);
 assert.equal(result.conflicts[0].reason,"missed_source_conflict");
});
test("No attack evidence, no automatic alias: an old enemy name is not proof",async()=>{
 const {reconcileClashPerkApiHistory}=await mod();
 const a=war(5,"api"),b=war(5,"import");
 const result=reconcileClashPerkApiHistory([a,b],[],[]);
 assert.equal(result.aliases.size,0);
 assert.equal(result.conflicts.length,1);
});

test("Import preview counts verified API overlap as a known logical war while preserving missed source",async()=>{
 const {classifyClashPerkApiCandidates}=await mod();
 const {pathToFileURL}=require("node:url");
 const db=await import(pathToFileURL(path.join(__dirname,"..","cwl-clashperk-import-db.mjs")).href);
 const official=war(40,"api","cwl");
 const cp=war(40,"import","cwl");
 const apiHits=hits(official.war_key,8),cpHits=hits(cp.war_key,8);
 const parsed={wars:[cp],attacks:cpHits,missed:misses(cp.war_key,1)};
 const verified=classifyClashPerkApiCandidates(parsed,[official],apiHits);
 const plan=db.planClashPerkMerge(parsed,[official],{
  verifiedApiPairs:verified.verified,unverifiedCandidates:verified.conflicts});
 assert.equal(plan.conflicts.length,0);
 assert.equal(plan.insert.length,1); // physical source evidence retained
 assert.equal(plan.logicalNew,0); // BUT no new logical war in the statistics
 assert.deepEqual(plan.apiMatched,[cp.war_key]);
 assert.equal(plan.attacks.length,8);
 assert.equal(plan.missed.length,1);
 const repeated=db.planClashPerkMerge(parsed,[official,cp],{
  verifiedApiPairs:verified.verified});
 assert.equal(repeated.insert.length,0);
 assert.equal(repeated.extend.length,1);
 assert.equal(repeated.logicalNew,0);
 assert.equal(repeated.apiMatched.length,1);
 const unsafe=db.planClashPerkMerge(parsed,[official],{
  unverifiedCandidates:[{importKey:cp.war_key,reason:"insufficient_or_different_attacks"}]});
 assert.equal(unsafe.insert.length,0);
 assert.deepEqual(unsafe.conflicts,[cp.war_key]);
});

test("Old non-finalized ClashPerk wars are only marked fully covered from exact player slots",async()=>{
 const {normalizeLegacyImportedWarStatuses,reconcileClashPerkApiHistory}=await mod();
 const w1=war(81,"import","normal",{
   war_key:"cp:99181",finalized:false,missed_log_complete:true,
   team_size:2,roster_tags:["#STALE"],started_at:"2026-08-20T18:00:00.000Z"
 });
 const w2=war(82,"import","normal",{
   war_key:"cp:99182",finalized:false,missed_log_complete:true,
   team_size:2,roster_tags:["#STALE"],started_at:"2026-08-22T18:00:00.000Z"
 });
 const played=[
   {...hits(w1.war_key,1)[0],attacker_tag:"#PLY1",attack_order:1},
   {...hits(w1.war_key,1)[0],attacker_tag:"#PLY1",attack_order:2},
   {...hits(w2.war_key,1)[0],attacker_tag:"#PLY1",attack_order:1}
 ];
 const missed=[{war_key:w1.war_key,player_tag:"#PLY2",missed_count:2,player_name:"Example"}];
 const now=Date.parse("2026-11-14T01:00:00Z");
 const r=normalizeLegacyImportedWarStatuses([w1,w2],played,missed,now);
 assert.equal(r.reclassified,2);
 assert.equal(r.incomplete,1);
 assert.equal(r.wars[0].finalized,true);
 assert.equal(r.wars[0].missed_log_complete,true);
 assert.deepEqual(new Set(r.wars[0].roster_tags),new Set(["#PLY1","#PLY2"]));
 assert.equal(r.wars[1].finalized,true);
 assert.equal(r.wars[1].missed_log_complete,false);
 assert.equal(r.wars[1].roster_tags,null);
 assert.equal(w2.missed_log_complete,true,"original source record remains unchanged");
 const stats=reconcileClashPerkApiHistory([w1,w2],played,missed);
 assert.equal(stats.legacyReclassified,2);
 assert.equal(stats.legacyIncomplete,1);
 assert.equal(stats.wars.length,2);
 assert.equal(stats.missedEvents.reduce((n,m)=>n+m.missed_count,0),2);
});
test("Recent/non-import war statuses are never inferred from missing historical logs",async()=>{
 const {normalizeLegacyImportedWarStatuses}=await mod();
 const now=Date.parse("2026-11-14T01:00:00Z");
 const recent=war(90,"import","normal",{war_key:"cp:9990",finalized:false,
   started_at:"2026-11-13T01:00:00.000Z"});
 const official=war(91,"api","normal",{finalized:false,
   started_at:"2026-10-02T01:00:00.000Z"});
 const r=normalizeLegacyImportedWarStatuses([recent,official],[],[],now);
 assert.equal(r.reclassified,0);
 assert.equal(r.wars[0],recent);
 assert.equal(r.wars[1],official);
});
