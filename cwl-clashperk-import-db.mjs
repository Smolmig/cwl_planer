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

export function planClashPerkMerge(parsed,existing=[],{
 verifiedApiPairs=new Map(),unverifiedCandidates=[]
}={}){
 if(!parsed||!Array.isArray(parsed.wars)||!parsed.wars.length)
  throw Error("Kein ClashPerk-Angriffsexport zum Importieren gefunden.");
 const old=new Map(existing.map(w=>[w.war_key,w]));
 const insert=[],extend=[],skip=[],conflicts=[],apiMatched=[];
 const uncertain=new Set(unverifiedCandidates.map(c=>c.importKey));
 for(const w of parsed.wars){
  const direct=old.get(w.war_key);
  if(direct){
   if(!sameIdentity(w,direct)){
    conflicts.push(w.war_key);
    continue;
   }
   if(direct.source==="api")skip.push(w.war_key);
   else extend.push(w);
   if(verifiedApiPairs.has(w.war_key))apiMatched.push(w.war_key);
   continue;
  }
  if(uncertain.has(w.war_key)){
   conflicts.push(w.war_key);continue;
  }
  const matched=verifiedApiPairs.get(w.war_key);
  if(matched){
   // Preserve source evidence under its own cp: ID; a verified API alias
   // makes it one logical war in every statistics view. Do not discard
   // its complete missed log just because the API has attacks already.
   if(old.get(matched)?.source!=="api"){
    conflicts.push(w.war_key);continue;
   }
   apiMatched.push(w.war_key);
  }else{
   const api=existing.find(e=>e.source==="api"&&
    normalizeTag(e.opponent_tag)===normalizeTag(w.opponent_tag)&&
    Number.isFinite(Date.parse(e.started_at))&&Number.isFinite(Date.parse(w.started_at))&&
    Math.abs(Date.parse(e.started_at)-Date.parse(w.started_at))<=36*3600000);
   if(api){
    // A nearby official war with the same opponent may even have a
    // conflicting type/size: never claim it as a new verified war.
    conflicts.push(w.war_key);continue;
   }
  }
  const historical=existing.find(e=>e.source==="import"&&sameIdentity(e,w));
  // Old JSON history and newer ClashPerk War ID may describe one war.
  // Do not guess how to remap 1st/2nd attacks across mismatched identities.
  if(historical){conflicts.push(w.war_key);continue}
  insert.push(w);
 }
 const allowed=new Set([...insert,...extend].map(w=>w.war_key));
 return {insert,extend,skip,conflicts,apiMatched,
  logicalNew:insert.length-apiMatched.filter(key=>insert.some(w=>w.war_key===key)).length,
  attacks:parsed.attacks.filter(a=>allowed.has(a.war_key)),
  missed:parsed.missed.filter(m=>allowed.has(m.war_key)),
  total:parsed.wars.length};
}
export async function readAllStatWars(sb,clanId){
 const result=[];
 for(let offset=0;offset<10000;offset+=500){
  const {data,error}=await sb.from("cwl_stat_wars")
   .select("war_key,war_type,started_at,team_size,opponent_tag,opponent_name,source,finalized,missed_log_complete")
   .eq("clan_id",clanId).order("started_at",{ascending:false})
   .range(offset,offset+499);
  if(error)throw error;
  result.push(...(data||[]));
  if(!data||data.length<500)return result;
 }
 throw Error("Sehr große Historie: Import derzeit gesperrt, damit keine alten Kriege übersehen werden.");
}
export async function commitClashPerkMerge(sb,plan,{
 clanId,clanTag,assertCurrent,onProgress=()=>{}
}){
 if(plan.conflicts.length)throw Error("Importkonflikte bitte vor dem Speichern klären.");
 if(!assertCurrent())throw Error("Clan gewechselt oder Berechtigung geändert. Bitte Import neu starten.");
 if(!/^#[0289PYLQGRJCUV]{3,15}$/.test(String(clanTag||"").trim().toUpperCase()))
  throw Error("Kein gültiger Clash-Clan für den Import gewählt.");
 // ONE request, ONE PostgreSQL transaction. NEVER silently downgrade to
 // multiple client-side upserts if the database RPC is not yet installed.
 const payload={
  clanTag:String(clanTag).trim().toUpperCase(),
  wars:[...plan.insert,...plan.extend].map(w=>({
   war_key:w.war_key,war_type:w.war_type,started_at:w.started_at,
   team_size:w.team_size,opponent_tag:w.opponent_tag,
   opponent_name:w.opponent_name
  })),
  attacks:plan.attacks,
  missed:plan.missed
 };
 if(!payload.wars.length)return {
  inserted:0,extended:0,skippedApi:plan.skip.length,attacks:0,missed:0,
  completeWars:0
 };
 if(payload.wars.length>1000||payload.attacks.length>20000||
    payload.missed.length>4000||
    new TextEncoder().encode(JSON.stringify(payload)).byteLength>9000000)
  throw Error("Zu viele Daten für einen sicheren Import. Bitte kleinere Clan-/Zeiträume einzeln exportieren.");
 onProgress("Alle geprüften Kriege werden gemeinsam gespeichert …");
 if(!assertCurrent())throw Error("Clan gewechselt oder Berechtigung geändert. Bitte Import neu starten.");
 const {data,error}=await sb.rpc("cwl_import_clashperk_canonical_atomic",{
  p_clan:clanId,p_payload:payload
 });
 if(error){
  if(error.code==="PGRST202"||error.code==="42883")
   throw Error("Der aktualisierte ClashPerk-Import ist noch nicht auf dem Server verfügbar. Es wurden keine Daten übernommen.");
  const details=String(error.message||"Datenbankfehler").slice(0,230);
  if(details.includes("Stored ClashPerk attack evidence differs")||
     details.includes("Cannot prove complete legacy attack mapping"))
    throw Error("Ein früher gespeicherter Angriff stimmt nicht mit diesem Excel-Export überein. "+
      "Bitte den betreffenden Krieg prüfen. Nichts wurde übernommen. ("+details+")");
  throw Error("Import nicht übernommen: "+details);
 }
 if(!data||typeof data!=="object"||!Number.isInteger(data.inserted)||
    !Number.isInteger(data.extended)||!Number.isInteger(data.attacks)||
    !Number.isInteger(data.missed)||!Number.isInteger(data.skippedApi))
  throw Error("Der Server hat keinen bestätigten Importstatus geliefert. Bitte Statistik neu laden.");
 if(data.inserted!==plan.insert.length||data.extended!==plan.extend.length||data.skippedApi!==0)
  throw Error("Der Server hat nicht alle geprüften Quellbelege übernommen. "+
    "Bitte die Statistik neu laden und den Importstatus prüfen.");
 if(!assertCurrent())throw Error("Der Clan wurde während des Imports gewechselt. Daten wurden nur im zuvor bestätigten Clan übernommen.");
 return {...data,skippedApi:data.skippedApi+plan.skip.length};
}
