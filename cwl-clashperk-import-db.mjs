// Non-destructive historical-statistics merge for original ClashPerk XLSX files.
// This never modifies planning, protected API war rows or other clan tenants.
const normalizeTag=x=>String(x||"").trim().toUpperCase();
const sameIdentity=(a,b)=>a.war_type===b.war_type&&
 normalizeTag(a.opponent_tag)===normalizeTag(b.opponent_tag)&&
 Number(a.team_size)===Number(b.team_size)&&
 Number.isFinite(Date.parse(a.started_at))&&
 Math.abs(Date.parse(a.started_at)-Date.parse(b.started_at))<=8*3600000;
const batches=(items,n=80)=>Array.from({length:Math.ceil(items.length/n)},
 (_,i)=>items.slice(i*n,(i+1)*n));

export function planClashPerkMerge(parsed,existing=[]){
 if(!parsed||!Array.isArray(parsed.wars)||!parsed.wars.length)
  throw Error("Kein ClashPerk-Angriffsexport zum Importieren gefunden.");
 const old=new Map(existing.map(w=>[w.war_key,w]));
 const insert=[],extend=[],skip=[],conflicts=[];
 for(const w of parsed.wars){
  const direct=old.get(w.war_key);
  if(direct){
   if(!sameIdentity(w,direct)){
    conflicts.push(w.war_key);
    continue;
   }
   if(direct.source==="api")skip.push(w.war_key);
   else extend.push(w);
   continue;
  }
  const api=existing.find(e=>e.source==="api"&&sameIdentity(e,w));
  if(api){skip.push(w.war_key);continue}
  const historical=existing.find(e=>e.source==="import"&&sameIdentity(e,w));
  // Old JSON history and newer ClashPerk War ID may describe one war.
  // Do not guess how to remap 1st/2nd attacks across mismatched identities.
  if(historical){conflicts.push(w.war_key);continue}
  insert.push(w);
 }
 const allowed=new Set([...insert,...extend].map(w=>w.war_key));
 return {insert,extend,skip,conflicts,
  attacks:parsed.attacks.filter(a=>allowed.has(a.war_key)),
  missed:parsed.missed.filter(m=>allowed.has(m.war_key)),
  total:parsed.wars.length};
}
export async function readAllStatWars(sb,clanId){
 const result=[];
 for(let offset=0;offset<10000;offset+=500){
  const {data,error}=await sb.from("cwl_stat_wars")
   .select("war_key,war_type,started_at,team_size,opponent_tag,source,missed_log_complete")
   .eq("clan_id",clanId).order("started_at",{ascending:false})
   .range(offset,offset+499);
  if(error)throw error;
  result.push(...(data||[]));
  if(!data||data.length<500)return result;
 }
 throw Error("Sehr große Historie: Import derzeit gesperrt, damit keine alten Kriege übersehen werden.");
}
export async function commitClashPerkMerge(sb,plan,{clanId,assertCurrent,onProgress=()=>{}}){
 if(plan.conflicts.length)throw Error("Importkonflikte bitte vor dem Speichern klären.");
 const verify=()=>{
  if(!assertCurrent())throw Error("Clan gewechselt oder Berechtigung geändert. Bitte Import neu starten.");
 };
 verify();
 // API wars retain their rows and history. A repeated XLSX upload inserts
 // only missing cp: rows; it must never overwrite newer/verified information.
 for(const batch of batches(plan.insert)){
  verify();
  const {error}=await sb.from("cwl_stat_wars").upsert(
   // Keep new imported wars provisional until every attack and missed
   // batch has succeeded. Failed imports can be safely resumed on reupload.
   batch.map(w=>({...w,clan_id:clanId,
    finalized:false,roster_tags:null,missed_log_complete:false})),
   {onConflict:"clan_id,war_key",ignoreDuplicates:true});
  if(error)throw error;
 }
 let n=0;
 for(const batch of batches(plan.attacks)){
  verify();
  const {error}=await sb.from("cwl_stat_attacks").upsert(
   batch.map(a=>({...a,clan_id:clanId})),
   {onConflict:"clan_id,war_key,attacker_tag,attack_order",ignoreDuplicates:true});
  if(error)throw error;
  n+=batch.length;onProgress("Angriffe: "+n+" / "+plan.attacks.length+" …");
 }
 for(const batch of batches(plan.missed)){
  verify();
  const {error}=await sb.from("cwl_stat_missed").upsert(
   batch.map(m=>({...m,clan_id:clanId})),
   {onConflict:"clan_id,war_key,player_tag",ignoreDuplicates:true});
  if(error)throw error;
 }
 // Finalize only AFTER all attack and missed batches were successfully
 // saved. Existing official API wars are never edited; an interruption leaves
 // a resumable provisional import rather than a false "finished" result.
 for(const war of [...plan.insert,...plan.extend]){
  verify();
  const patch={finalized:war.finalized===true};
  if(war.missed_log_complete===true){
   patch.missed_log_complete=true;
   patch.roster_tags=war.roster_tags;
  }
  const {error}=await sb.from("cwl_stat_wars")
   .update(patch).eq("clan_id",clanId).eq("war_key",war.war_key)
   .eq("source","import");
  if(error)throw error;
 }
 return {inserted:plan.insert.length,extended:plan.extend.length,
  skippedApi:plan.skip.length,attacks:plan.attacks.length,missed:plan.missed.length};
}
