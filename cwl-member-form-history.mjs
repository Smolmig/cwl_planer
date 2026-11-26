// Permission-scoped read model for member planning only. No global registry,
// no writes or grants. All reads use the existing signed-in RLS client.
import {reconcileClashPerkApiHistory} from "./cwl-stats-source-reconciliation.mjs?v=1.22.1";
const validTag=t=>typeof t==="string"&&/^#[0289PYLQGRJCUV]{3,15}$/.test(t);
const norm=t=>String(t||"").trim().toUpperCase();
const groups=(xs,n)=>Array.from({length:Math.ceil(xs.length/n)},(_,i)=>xs.slice(i*n,i*n+n));
const day=86400000;
async function paged(query,max=16000){
 const out=[];
 for(let offset=0;offset<max;offset+=500){
  const {data,error}=await query().range(offset,offset+499);
  if(error)throw error;
  if(!Array.isArray(data))throw Error("invalid_form_data");
  out.push(...data);if(data.length<500)return out;
 }
 throw Error("form_history_limit");
}
export async function loadMemberFormClans(sb,ctx,{asOf=Date.now()}={}){
 if(!ctx?.clanId||!validTag(ctx.clanTag))return {sources:[],partial:false};
 const {data,error}=await sb.from("cwl_clans").select("id,name,clash_tag")
   .order("id").limit(41);
 if(error||!Array.isArray(data))throw Error("form_clans_unavailable");
 const active=data.find(c=>c.id===ctx.clanId);
 if(!active||active.clash_tag!==ctx.clanTag)return {sources:[],partial:true};
 // Only linked clans already visible to this caller through RLS. Each
 // stats query is independently permission-scoped. Different owners are
 // allowed when the signed-in user has explicit access to both clans.
 const seen=new Set([ctx.clanTag]),sources=[];
 let partial=data.length>=41;
 for(const c of data){
  if(c.id===ctx.clanId||!validTag(c.clash_tag))continue;
  if(seen.has(c.clash_tag)){partial=true;continue}
  if(sources.length>=8){partial=true;break}
  seen.add(c.clash_tag);
  try{
   const wars=await paged(()=>sb.from("cwl_stat_wars").select("*").eq("clan_id",c.id)
      .gte("started_at",new Date(asOf-180*day).toISOString()).order("war_key"),2000);
   const attacks=[],missedEvents=[];
   for(const keys of groups(wars.map(w=>w.war_key),40)){
    attacks.push(...await paged(()=>sb.from("cwl_stat_attacks").select("*").eq("clan_id",c.id)
      .in("war_key",keys).order("war_key").order("attacker_tag").order("attack_order")));
    missedEvents.push(...await paged(()=>sb.from("cwl_stat_missed").select("*").eq("clan_id",c.id)
      .in("war_key",keys).order("war_key").order("player_tag")));
   }
   if([...wars,...attacks,...missedEvents].some(r=>r.clan_id!==c.id))throw Error("form_clan_scope");
   const result=reconcileClashPerkApiHistory(wars,attacks,missedEvents);
   sources.push({clanId:c.id,clanTag:c.clash_tag,clanName:c.name,...result});
  }catch{partial=true}
 }
 return {sources,partial};
}
// Each source is first reconciled within its own tenant. Namespace every
// war key, so two real clans in the same CWL cannot overwrite one another.
// Unresolved import duplicates are excluded, not silently counted twice.
export function mergeMemberFormClans(local,others=[]){
 const wars=[],attacks=[],missedEvents=[],seenClans=new Set();
 let partial=false,excluded=0;
 const known=[];
 for(const src of [local,...others]){
  if(!src||!validTag(src.clanTag))continue;
  if(seenClans.has(src.clanTag)){partial=true;continue}
  seenClans.add(src.clanTag);
  const conflictKeys=new Set((src.conflicts||[]).map(c=>c.importKey));
  const byWar=new Map(),missByWar=new Map();
  for(const a of src.attacks||[]){if(!byWar.has(a.war_key))byWar.set(a.war_key,[]);byWar.get(a.war_key).push(a)}
  for(const m of src.missedEvents||[]){if(!missByWar.has(m.war_key))missByWar.set(m.war_key,[]);missByWar.get(m.war_key).push(m)}
  for(const w of src.wars||[]){
   if(conflictKeys.has(w.war_key)){partial=true;excluded++;continue}
   const aa=byWar.get(w.war_key)||[],mm=missByWar.get(w.war_key)||[];
   const participants=new Set([...aa.map(a=>norm(a.attacker_tag)),...mm.map(m=>norm(m.player_tag)),
    ...(Array.isArray(w.roster_tags)?w.roster_tags.map(norm):[])].filter(validTag));
   const stamp=Date.parse(w.started_at);
   // Same documented player in both sides of the very same war is not
   // valid evidence. Do not merge guesses or sum conflicting misses.
   const overlap=known.some(k=>k.clanTag!==src.clanTag&&k.type===w.war_type&&(
     k.key===w.war_key||Number.isFinite(stamp)&&Math.abs(k.stamp-stamp)<=36*3600000&&
       norm(w.opponent_tag)===k.opponent&&validTag(k.opponent)
   )&&[...participants].some(t=>k.participants.has(t)));
   if(overlap){partial=true;excluded++;continue}
   known.push({clanTag:src.clanTag,key:w.war_key,type:w.war_type,stamp,opponent:norm(w.opponent_tag),participants});
   const key=src.clanTag+"|"+w.war_key;
   wars.push({...w,war_key:key,formClanTag:src.clanTag,formClanName:String(src.clanName||src.clanTag).slice(0,80)});
   attacks.push(...aa.map(a=>({...a,war_key:key})));
   missedEvents.push(...mm.map(m=>({...m,war_key:key})));
  }
 }
 return {wars,attacks,missedEvents,partial,excluded};
}
