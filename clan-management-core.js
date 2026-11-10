/* Issue #183, phase 1: pure, read-only Clash rank preview.
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
 function buildPreview(members){
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
  rows.sort((a,b)=>a.rank===b.rank?
    a.name.localeCompare(b.name,"de",{sensitivity:"base"}):
    (a.rank==="member"?-1:b.rank==="member"?1:a.rank==="elder"?-1:1));
  return {ok:true,reason:null,total:members.length,counts,rows,
   eligibleForRecommendation:0,
   observation:"Die Clash-API liefert keinen historischen Eintritt und keinen letzten Login. Ohne belegte 14 kumulierte Mitgliedschaftstage und aussagekräftige CW/CWL-Daten gibt es keine Beförderungs- oder Kick-Empfehlung."};
 }
 const api={normalizeRank:rank,validTag,buildPreview};
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.CWLClanManagement=api;
})(typeof window!=="undefined"?window:null);
