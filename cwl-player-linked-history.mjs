// Read-only, permission-scoped player identity bridge (Issue #212, stage 1).
// This intentionally does NOT publish or aggregate global cross-tenant stats.
// All requests use the signed-in user's Supabase client: RLS remains in force.
const normalizeTag=value=>{
 const tag=String(value||"").trim().toUpperCase();
 return tag.startsWith("#")?tag:(tag?"#"+tag:"");
};
const validTag=tag=>/^#[0289PYLQGRJCUV]{3,15}$/.test(tag);
const chunks=(arr,size)=>Array.from({length:Math.ceil(arr.length/size)},
  (_,i)=>arr.slice(i*size,(i+1)*size));
const asDate=value=>{
 const t=Date.parse(value);
 return Number.isFinite(t)?t:null;
};
const getWarId=(clanId,warKey)=>String(clanId)+"|"+String(warKey);
export function summarizeAccessiblePlayerHistory(clans,attacks,wars,{
 truncated=false
}={}){
 const known=new Map((wars||[])
  .filter(w=>w?.finalized===true)
  .map(w=>[getWarId(w.clan_id,w.war_key),w]));
 return (clans||[]).map(clan=>{
   const matched=(attacks||[]).filter(a=>
     a.clan_id===clan.id&&known.has(getWarId(a.clan_id,a.war_key)))
     .map(a=>({attack:a,war:known.get(getWarId(a.clan_id,a.war_key))}))
     .filter(({war})=>asDate(war.started_at)!==null);
   if(!matched.length)return null;
   matched.sort((a,b)=>asDate(b.war.started_at)-asDate(a.war.started_at));
   const triples=matched.filter(({attack})=>Number(attack.stars)===3).length;
   const one=(matched[0]||{}).attack;
   const recent=matched[0].war.started_at;
   const sourceTypes=new Set(matched.map(m=>m.war.source));
   // If multiple observations for one real war are present, avoid claiming
   // this is a unique-war global total. The full reconciler lives in the
   // selected-clan statistics loader, not in this lightweight preview.
   return {
     clanId:clan.id,clanName:clan.name,clashTag:clan.clash_tag,
     recordedAttacks:matched.length,triples,
     rawThreeStarRate:Math.round(100*triples/matched.length),
     latestAttackDate:recent,
     latestDocumentedTh:Number.isInteger(one?.attacker_th)&&
       one.attacker_th>=1&&one.attacker_th<=20?one.attacker_th:null,
     warTypes:[...new Set(matched.map(x=>x.war.war_type))],
     possibleDuplicateSources:sourceTypes.has("api")&&sourceTypes.has("import"),
     truncated
   };
 }).filter(Boolean).sort((a,b)=>
   Date.parse(b.latestAttackDate)-Date.parse(a.latestAttackDate));
}
export async function loadAccessiblePlayerHistory(sb,playerTag,currentClanId){
 const tag=normalizeTag(playerTag);
 if(!validTag(tag)||!currentClanId)throw Error("Ungültiges Spielerprofil.");
 if(!sb?.auth?.getUser)throw Error("Anmeldung erforderlich.");
 const {data:identity,error:authError}=await sb.auth.getUser();
 if(authError||!identity?.user)throw Error("Bitte anmelden, um weitere Clans zu prüfen.");
 // Only the clans visible via the caller's cwl_clans SELECT RLS policy.
 // Statistic reads independently have cwl_is_member(clan_id) RLS.
 const {data:clans,error:clanError}=await sb.from("cwl_clans")
   .select("id,name,clash_tag").neq("id",currentClanId)
   .order("name").limit(41);
 if(clanError)throw new Error("Berechtigte Clans konnten nicht geladen werden.");
 const candidates=(clans||[]).slice(0,40);
 if(!candidates.length)return {clans:[],truncated:false};
 const allowed=candidates.map(c=>c.id);
 let attacks=[],truncated=clans.length>40;
 for(let offset=0;offset<5000;offset+=500){
   const {data,error}=await sb.from("cwl_stat_attacks")
     .select("clan_id,war_key,attack_order,attacker_tag,attacker_th,stars")
     .in("clan_id",allowed).eq("attacker_tag",tag)
     .order("clan_id").order("war_key").order("attack_order")
     .range(offset,offset+499);
   if(error)throw new Error("Angriffe anderer zugänglicher Clans konnten nicht geladen werden.");
   attacks.push(...(data||[]));
   if(!data||data.length<500)break;
   if(offset===4500)truncated=true;
 }
 if(!attacks.length)return {clans:[],truncated};
 const keys=[...new Set(attacks.map(a=>a.war_key))];
 const wars=[];
 for(const group of chunks(keys,60)){
   const {data,error}=await sb.from("cwl_stat_wars")
     .select("clan_id,war_key,war_type,started_at,source,finalized")
     .in("clan_id",allowed).in("war_key",group)
     .range(0,999);
   if(error)throw new Error("Kriegsdaten anderer zugänglicher Clans konnten nicht geladen werden.");
   wars.push(...(data||[]));
   if(data?.length===1000)truncated=true;
 }
 return {
   clans:summarizeAccessiblePlayerHistory(candidates,attacks,wars,{truncated}),
   truncated
 };
}
