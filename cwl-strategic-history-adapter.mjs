// #44 read-only bridge for a CURRENT, already permission-scoped merged
// member-form snapshot. No DB/client access. This is NOT historical replay:
// rows are mutable and created_at/updated_at are not per-attack event history.
const DAY=86400000;
const TAG=/^#[0289PYLQGRJCUV]{3,15}$/;
const tag=v=>typeof v==="string"?v.trim().toUpperCase():"";
const time=v=>typeof v==="string"&&/^\d{4}-\d\d-\d\dT/.test(v)?Date.parse(v):NaN;
const th=v=>Number.isInteger(v)&&v>=3&&v<=30;
export function adaptStrategicHistory({history,members=[],selectedClanId,authorizedClanIds=[],snapshotAt,asOf}={}){
 if(typeof selectedClanId!=="string"||!selectedClanId||!Array.isArray(authorizedClanIds)||
   !authorizedClanIds.includes(selectedClanId)||!Number.isFinite(snapshotAt)||!Number.isFinite(asOf)||snapshotAt!==asOf||
   !Array.isArray(members)||!history||!["wars","attacks","missedEvents"].every(k=>Array.isArray(history[k])))throw Error("invalid_current_snapshot");
 // A caller cannot turn a present-day DB export into a historical backtest by
 // passing a past cutoff. Snapshot time must be independently captured by
 // the signed-in loader. No permissions granted by this adapter.
 const allowed=new Set(authorizedClanIds),playerTags=new Set(members.map(m=>tag(m.playerTag)).filter(t=>TAG.test(t)));
 const facts=[],obligations=[],wars=new Map(),badWars=new Set();
 const audit={warStartProxy:true,strictHistoricalReplay:false,sourcePartial:!!history.partial,sourceExcluded:history.excluded||0,
  staleOrUnfinished:0,invalidWars:0,invalidRows:0,unknownTownHall:0,conflictingRows:0,obligationConflicts:0,unconfirmedCoverageWars:0};
 for(const w of history.wars){
  if(!allowed.has(w?.clan_id))throw Error("history_scope_mismatch");
  const start=time(w.started_at),updated=time(w.updated_at),clanTag=tag(w.formClanTag);
  if(typeof w.war_key!=="string"||!TAG.test(clanTag)||!w.war_key.startsWith(clanTag+"|")||
     !["normal","cwl"].includes(w.war_type)||!["api","import"].includes(w.source)||
     !Number.isFinite(start)||!Number.isFinite(updated)||updated<start){audit.invalidWars++;continue}
  if(wars.has(w.war_key)){badWars.add(w.war_key);audit.invalidWars++;continue}
  if(w.finalized!==true||start>asOf||start<asOf-30*DAY||updated>snapshotAt){audit.staleOrUnfinished++;continue}
  if(w.missed_log_complete!==true)audit.unconfirmedCoverageWars++;
  wars.set(w.war_key,{w,start,updated});
 }
 const attacks=new Map(),misses=new Map(),badAttack=new Set(),badMiss=new Set(),badPlayerWar=new Set();
 for(const a of history.attacks){
  if(!allowed.has(a?.clan_id))throw Error("history_scope_mismatch");
  const entry=wars.get(a.war_key),t=tag(a.attacker_tag);
  if(!entry||badWars.has(a.war_key)||!playerTags.has(t))continue;
  if(a.clan_id!==entry.w.clan_id)throw Error("history_scope_mismatch");
  const created=time(a.created_at),pw=JSON.stringify([a.war_key,t]),cap=entry.w.war_type==="cwl"?1:2;
  if(!Number.isFinite(created)||created<entry.start||created>snapshotAt||!Number.isInteger(a.attack_order)||a.attack_order<0||
     a.attack_order>200||!Number.isInteger(a.stars)||a.stars<0||a.stars>3||
     !Number.isInteger(a.destruction)||a.destruction<0||a.destruction>100){
   audit.invalidRows++;badPlayerWar.add(pw);continue;
  }
  const key=JSON.stringify([a.war_key,t,a.attack_order]);
  const normalized={warKey:a.war_key,playerTag:t,attackOrder:a.attack_order,kind:entry.w.war_type,
    attackerTh:a.attacker_th,defenderTh:a.defender_th,stars:a.stars,destruction:a.destruction,
    defenderTag:tag(a.defender_tag),eventAt:entry.start,observedAt:snapshotAt,pw,cap};
  if(attacks.has(key)){
   if(JSON.stringify(attacks.get(key))!==JSON.stringify(normalized)){badAttack.add(key);badPlayerWar.add(pw);audit.conflictingRows++}
  }else attacks.set(key,normalized);
 }
 for(const m of history.missedEvents){
  if(!allowed.has(m?.clan_id))throw Error("history_scope_mismatch");
  const entry=wars.get(m.war_key),t=tag(m.player_tag);
  if(!entry||badWars.has(m.war_key)||!playerTags.has(t))continue;
  if(m.clan_id!==entry.w.clan_id)throw Error("history_scope_mismatch");
  const created=time(m.created_at),pw=JSON.stringify([m.war_key,t]),cap=entry.w.war_type==="cwl"?1:2;
  if(!Number.isFinite(created)||created<entry.start||created>snapshotAt||!Number.isInteger(m.missed_count)||m.missed_count<1||m.missed_count>cap){
   audit.invalidRows++;badPlayerWar.add(pw);continue;
  }
  if(misses.has(pw)&&misses.get(pw).count!==m.missed_count){badMiss.add(pw);badPlayerWar.add(pw);audit.conflictingRows++}
  else misses.set(pw,{warKey:m.war_key,playerTag:t,count:m.missed_count,cap,eventAt:entry.start});
 }
 const grouped=new Map();
 for(const [key,a] of attacks){
  if(badAttack.has(key))continue;
  if(!grouped.has(a.pw))grouped.set(a.pw,[]);
  grouped.get(a.pw).push(a);
 }
 for(const [pw,rows] of grouped){
  if(rows.length>rows[0].cap){badPlayerWar.add(pw);audit.obligationConflicts++;continue}
  if(badPlayerWar.has(pw))continue;
  for(const a of rows){
   if(!th(a.attackerTh)||!th(a.defenderTh)){audit.unknownTownHall++;continue}
   const {pw:_,cap,defenderTag,...fact}=a;facts.push(fact);
  }
 }
 for(const pw of new Set([...grouped.keys(),...misses.keys()])){
  const rows=grouped.get(pw)||[],miss=misses.get(pw);
  if(badPlayerWar.has(pw)||badMiss.has(pw))continue;
  const cap=rows[0]?.cap??miss.cap;
  if(rows.length+(miss?.count||0)>cap){audit.obligationConflicts++;continue}
  for(const a of rows)obligations.push({playerTag:a.playerTag,slotKey:JSON.stringify([a.warKey,"performed",a.attackOrder]),
    result:"performed",eventAt:a.eventAt,observedAt:snapshotAt,verified:true});
  if(miss)for(let i=0;i<miss.count;i++)obligations.push({playerTag:miss.playerTag,slotKey:JSON.stringify([miss.warKey,"missed",i]),
    result:"missed",eventAt:miss.eventAt,observedAt:snapshotAt,verified:true});
 }
 return {facts,obligations,audit,asOf,kind:"current_snapshot_war_start_proxy",calibrated:false};
}
