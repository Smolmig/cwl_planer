/* Issue #183: pure, read-only Clash rank and independently observed tenure.
   NO promotions, kicks, join-date inference or writes. */
(function(root){
 "use strict";
 const rankMap=Object.freeze({
  member:"member",elder:"elder",admin:"elder",
  coleader:"coLeader",leader:"leader"
 });
 const rankLabels=Object.freeze({
  member:"Mitglied",elder:"Ältester",coLeader:"Vize",leader:"Clanführer",unknown:"Rang unklar"
 });
 const tag=value=>{
  const normalized=String(value||"").trim().toUpperCase();
  return normalized.startsWith("#")?normalized:normalized?"#"+normalized:"";
 };
 const validTag=value=>/^#[0289PYLQGRJCUV]{3,15}$/.test(tag(value));
 const rank=value=>rankMap[String(value??"").trim().replace(/[\s_-]/g,"").toLowerCase()]||"unknown";
 function tenureLabel(entry,now=Date.now()){
  if(!entry)return "Mitgliedschaftszeit noch nicht beobachtet";
  const seconds=Number(entry.confirmed_seconds),seen=Date.parse(entry.last_observed_at);
  if(!Number.isSafeInteger(seconds)||seconds<0||!Number.isFinite(seen)||
     seen>now+60000)return "Beobachtungsdaten unklar";
  const hours=Math.floor(seconds/3600),days=Math.floor(hours/24);
  const duration=hours===0?"unter 1 Std.":
    days>0?days+" Tg. "+(hours%24)+" Std.":hours+" Std.";
  const returnCount=Number(entry.observed_visits);
  const returns=Number.isInteger(returnCount)&&returnCount>1?
    " · "+returnCount+" beobachtete Aufenthalte":"";
  const stale=now-seen>24*3600000?" · Stand älter als 24 Std.":"";
  const state=entry.is_present===false?" · letzter Snapshot: ausgetreten":"";
  return "Belegte Clanzeit: "+duration+returns+state+stale;
 }
 function buildPreview(members,tenureRows=null){
  if(!Array.isArray(members)||members.length<1||members.length>50)
   return {ok:false,reason:"roster_incomplete",rows:[],total:0};
  const seen=new Set(),rows=[],counts={member:0,elder:0,coLeader:0,leader:0,unknown:0};
  for(const player of members){
   if(!player||typeof player!=="object")return {ok:false,reason:"roster_incomplete",rows:[],total:0};
   const playerTag=tag(player.tag);
   if(!validTag(playerTag)||seen.has(playerTag)||typeof player.name!=="string"||
     !player.name.trim()||player.name.length>80)
    return {ok:false,reason:"roster_unverified",rows:[],total:0};
   seen.add(playerTag);
   const clashRank=rank(player.role);
   counts[clashRank]++;
   // Leader and co-leaders are completely excluded from the evaluation.
   if(clashRank==="leader"||clashRank==="coLeader")continue;
   rows.push({
    tag:playerTag,name:player.name,rank:clashRank,
    rankLabel:rankLabels[clashRank],
    status:clashRank==="unknown"?"Rang prüfen":"Nachweise fehlen",
    explanation:clashRank==="unknown"?
     "Der Clash-Rang ist unbekannt. Keine Empfehlung.": 
     "Eintritts-/Rückkehrzeiten, Angriffsstichprobe und Zuverlässigkeit sind noch nicht belegt."
   });
  }
  const byTag=new Map((Array.isArray(tenureRows)?tenureRows:[])
    .filter(x=>x&&validTag(x.player_tag))
    .map(x=>[tag(x.player_tag),x]));
  for(const player of rows)player.tenureNote=tenureLabel(byTag.get(player.tag));
  rows.sort((a,b)=>a.rank===b.rank?
    a.name.localeCompare(b.name,"de",{sensitivity:"base"}):
    (a.rank==="member"?-1:b.rank==="member"?1:a.rank==="elder"?-1:1));
  return {ok:true,reason:null,total:members.length,counts,rows,
   eligibleForRecommendation:0,
   observation:"Die Clash-API liefert keinen historischen Eintritt und keinen letzten Login. Ohne belegte 14 kumulierte Mitgliedschaftstage und aussagekräftige CW/CWL-Daten gibt es keine Beförderungs- oder Kick-Empfehlung."};
 }
 const api={normalizeRank:rank,validTag,buildPreview,tenureLabel};
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.CWLClanManagement=api;
})(typeof window!=="undefined"?window:null);
