// Read-only reconciliation between verified API war tags and ClashPerk War IDs.
// A unique real war may have two source records. The API startTime and the
// ClashPerk "War Start Time" can differ by exactly 24h (observed in UF 2).
// NEVER guess an identity from opponent/date alone or mutate tenant storage.
const tag=value=>String(value||"").trim().toUpperCase();
const time=value=>Date.parse(value);
const sameTenant=(a,b)=>!!a.clan_id&&!!b.clan_id?a.clan_id===b.clan_id:true;
export const isPotentialClashPerkApiOverlap=(a,b)=>{
 const delta=time(b.started_at)-time(a.started_at);
 return a.source==="api"&&b.source==="import"&&
  a.finalized===true&&b.finalized===true&&sameTenant(a,b)&&
  a.war_type===b.war_type&&tag(a.opponent_tag).length>=4&&
  tag(a.opponent_tag)===tag(b.opponent_tag)&&
  Number(a.team_size)===Number(b.team_size)&&
  Number.isFinite(delta)&&Math.abs(delta)<=36*3600000;
};
const signature=a=>[
 tag(a.attacker_tag),tag(a.defender_tag),
 Number(a.stars),Number(a.destruction)
].join("|");
const summarizeMisses=(rows,warKey)=>{
 const byTag=new Map();
 for(const row of rows){
  if(row.war_key!==warKey)continue;
  const k=tag(row.player_tag),n=Number(row.missed_count);
  if(!k||!Number.isInteger(n)||n<1)return null;
  if(byTag.has(k))return null;
  byTag.set(k,n);
 }
 return byTag;
};
const isSubset=(minor,major)=>[...minor].every(([k,n])=>(major.get(k)||0)>=n);
function matchesAttacks(a,b){
 // At least two full, identical attacks: avoids false matches on sparse
 // historical logs. An unresolved close opponent match requires review.
 if(a.length<2||a.length!==b.length)return false;
 const stats=rows=>{
  const out=new Map();
  for(const x of rows){
   if(!tag(x.attacker_tag)||!tag(x.defender_tag)||
      !Number.isInteger(Number(x.stars))||
      !Number.isInteger(Number(x.destruction)))return null;
   const k=signature(x);out.set(k,(out.get(k)||0)+1);
  }
  return out;
 };
 const x=stats(a),y=stats(b);
 return x&&y&&x.size===y.size&&
  [...x].every(([k,count])=>y.get(k)===count);
}
export function normalizeLegacyImportedWarStatuses(wars=[],attacks=[],missedEvents=[],now=Date.now()){
 // Older source imports could persist 'finalized=false' despite having
 // ended long ago, and even incorrectly persist missed_log_complete=true.
 // This is a READ-MODEL correction only: do not mutate source evidence.
 const slots=new Map();
 const add=(warKey,playerTag,count)=>{
  const k=tag(playerTag),n=Number(count);
  if(!warKey||!k||!Number.isInteger(n)||n<1)return;
  if(!slots.has(warKey))slots.set(warKey,new Map());
  const byPlayer=slots.get(warKey);
  byPlayer.set(k,(byPlayer.get(k)||0)+n);
 };
 for(const a of attacks)add(a.war_key,a.attacker_tag,1);
 for(const m of missedEvents)add(m.war_key,m.player_tag,m.missed_count);
 let reclassified=0,incomplete=0;
 const items=wars.map(w=>{
  const start=time(w.started_at);
  if(w.source!=="import"||w.finalized!==false||
     !["normal","cwl"].includes(w.war_type)||
     !Number.isFinite(start)||start>now-72*3600000)return w;
  const size=Number(w.team_size),cap=w.war_type==="cwl"?1:2;
  const players=slots.get(w.war_key)||new Map();
  const full=Number.isInteger(size)&&size>0&&size<=50&&
    players.size===size&&[...players.values()].every(n=>n===cap);
  reclassified++;
  if(!full)incomplete++;
  return {...w,finalized:true,missed_log_complete:full,
    roster_tags:full?[...players.keys()]:null};
 });
 return {wars:items,reclassified,incomplete};
}
export function reconcileClashPerkApiHistory(wars=[],attacks=[],missedEvents=[]){
 const legacy=normalizeLegacyImportedWarStatuses(wars,attacks,missedEvents);
 const normalizedWars=legacy.wars;
 const byWar=new Map();
 for(const row of attacks){
  if(!byWar.has(row.war_key))byWar.set(row.war_key,[]);
  byWar.get(row.war_key).push(row);
 }
 const api=normalizedWars.filter(w=>w.source==="api");
 const imports=normalizedWars.filter(w=>w.source==="import");
 const pairCandidates=new Map();
 const conflicts=[];
 for(const imported of imports){
  const possible=api.filter(w=>isPotentialClashPerkApiOverlap(w,imported));
  if(!possible.length)continue;
  const exact=possible.filter(w=>matchesAttacks(
   byWar.get(w.war_key)||[],byWar.get(imported.war_key)||[]));
  if(exact.length!==1){
   conflicts.push({importKey:imported.war_key,reason:exact.length>1?
    "ambiguous_identity":"insufficient_or_different_attacks"});
   continue;
  }
  const official=exact[0];
  const ownMiss=summarizeMisses(missedEvents,imported.war_key);
  const officialMiss=summarizeMisses(missedEvents,official.war_key);
  if(!ownMiss||!officialMiss){
   conflicts.push({importKey:imported.war_key,reason:"invalid_missed_entries"});
   continue;
  }
  // An incomplete source's proven misses must be a subset of the complete
  // source's claims. Two complete sources must agree exactly.
  const compatible=imported.missed_log_complete===true?
   isSubset(officialMiss,ownMiss)&&
   (official.missed_log_complete!==true||
    isSubset(ownMiss,officialMiss)):
   official.missed_log_complete===true?
    isSubset(ownMiss,officialMiss):true;
  if(!compatible){
   conflicts.push({importKey:imported.war_key,reason:"missed_source_conflict"});
   continue;
  }
  if(!pairCandidates.has(official.war_key))pairCandidates.set(official.war_key,[]);
  pairCandidates.get(official.war_key).push(imported);
 }
 // Two imports claiming one API war cannot both become the canonical source.
 const aliases=new Map(),byOfficial=new Map();
 for(const [apiKey,items] of pairCandidates){
  if(items.length!==1){
   for(const w of items)conflicts.push({importKey:w.war_key,reason:"ambiguous_multiple_imports"});
   continue;
  }
  aliases.set(items[0].war_key,apiKey);
  byOfficial.set(apiKey,items[0]);
 }
 const canonicalWars=normalizedWars.filter(w=>!aliases.has(w.war_key)).map(w=>{
  const imported=byOfficial.get(w.war_key);
  if(!imported)return w;
  return {...w,missed_log_complete:
   w.missed_log_complete===true||imported.missed_log_complete===true};
 });
 const canonicalAttacks=attacks.filter(a=>!aliases.has(a.war_key));
 const acceptedMisses=[];
 // Use one consistent source for the whole verified war, not a sum of two.
 for(const row of missedEvents){
  if(aliases.has(row.war_key))continue;
  if(byOfficial.has(row.war_key)){
   const fromImport=byOfficial.get(row.war_key).missed_log_complete===true;
   if(fromImport)continue;
  }
  acceptedMisses.push(row);
 }
 for(const [apiKey,imported] of byOfficial){
  if(imported.missed_log_complete===true){
   for(const row of missedEvents){
    if(row.war_key===imported.war_key)
     acceptedMisses.push({...row,war_key:apiKey});
   }
  }else{
   // Both sources incomplete: keep the highest *proven* count for each
   // player, never sum duplicates. Existing API misses remain unchanged.
   const existing=new Map(acceptedMisses.filter(r=>r.war_key===apiKey)
    .map(r=>[tag(r.player_tag),r]));
   for(const row of missedEvents.filter(r=>r.war_key===imported.war_key)){
    const key=tag(row.player_tag),old=existing.get(key);
    if(!old||Number(row.missed_count)>Number(old.missed_count)){
     if(old)acceptedMisses.splice(acceptedMisses.indexOf(old),1);
     const mapped={...row,war_key:apiKey};
     acceptedMisses.push(mapped);existing.set(key,mapped);
    }
   }
  }
 }
 return {wars:canonicalWars,attacks:canonicalAttacks,missedEvents:acceptedMisses,
  aliases,conflicts,
  deduplicatedWars:aliases.size,
  deduplicatedAttacks:attacks.length-canonicalAttacks.length,
  legacyReclassified:legacy.reclassified,
  legacyIncomplete:legacy.incomplete};
}

// Import preflight can call this with parsed import wars + existing official
// wars/attacks, but should never treat a CLOSE match as sufficient by itself.
export function classifyClashPerkApiCandidates(parsed,existingWars,existingAttacks){
 const official=existingWars.filter(w=>w.source==="api"&&w.finalized===true);
 const apiRows=existingAttacks.filter(a=>official.some(w=>w.war_key===a.war_key));
 const candidateWars=parsed.wars.filter(w=>
  official.some(o=>isPotentialClashPerkApiOverlap(o,w)));
 if(!candidateWars.length)return {verified:new Map(),conflicts:[]};
 const result=reconcileClashPerkApiHistory(
  [...official,...candidateWars],[...apiRows,...parsed.attacks],[]);
 // At preview time missed entries are not yet persisted; only attack identity
 // is verified. The subsequent SQL RPC still enforces tenant/row permissions.
 return {verified:new Map([...result.aliases]),
  conflicts:result.conflicts};
}
