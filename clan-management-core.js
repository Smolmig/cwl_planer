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
 // All labels are evidence, never estimated login times.
 function donorLabel(player,entry,now=Date.now()){
  const notes=[];
  const live=player?.donations;
  if(typeof live==="number"&&Number.isSafeInteger(live)&&live>=0&&live<=9999999)
   notes.push("Spenden laut Clash (laufende Saison): "+live);
  const when=Date.parse(entry?.last_donation_increase_at||"");
  const count=Number(entry?.last_donation_increase_by);
  if(Number.isFinite(when)&&when<=now+60000&&Number.isInteger(count)&&count>0&&count<=9999999){
   const date=new Date(when).toLocaleString("de-AT",{
    day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"
   });
   notes.push("Spendenzuwachs beobachtet: "+date+" (+"+count+")");
  }
  return notes.join(" · ");
 }
 function returnRankLabel(player,entry){
  // Only an actual observed absence and return. A clan switch hidden
  // between snapshots cannot be detected and must never be invented.
  if(!entry||entry.is_present!==true||Number(entry.observed_visits)<2||
     entry.rank_before_leave!=="elder"||rank(player?.role)!=="member")return "";
  const seen=Date.parse(entry.rank_before_leave_at||"");
  if(!Number.isFinite(seen))return "";
  return "Vor beobachtetem Austritt Ältester ("+
   new Date(seen).toLocaleDateString("de-AT")+
   ") – Rang nach Rückkehr im Spiel prüfen";
 }
 const DEFAULT_RULES=Object.freeze({
  performance_enabled:true,
  performance_min_days:14,
  performance_min_attacks:10,
  performance_three_star_percent:80,
  performance_lookback_days:90,
  loyalty_min_days:60,
  absence_reset_days:10
 });
 const LIMITS=Object.freeze({
  performance_min_days:[1,365],
  performance_min_attacks:[1,100],
  performance_three_star_percent:[0,100],
  performance_lookback_days:[7,730],
  loyalty_min_days:[1,730],
  absence_reset_days:[1,365]
 });
 function normalizeRules(input={}){
  if(input===null||typeof input!=="object"||Array.isArray(input))
   throw Error("Ungültige Clanregeln.");
  const rules={...DEFAULT_RULES};
  for(const key of Object.keys(LIMITS)){
   const value=Object.hasOwn(input,key)?input[key]:DEFAULT_RULES[key];
   if(key==="absence_reset_days"&&value===null){rules[key]=null;continue}
   const [min,max]=LIMITS[key];
   if(typeof value!=="number"||!Number.isInteger(value)||value<min||value>max)
    throw Error("Ungültiger Grenzwert: "+key);
   rules[key]=value;
  }
  if(Object.hasOwn(input,"performance_enabled")){
   if(typeof input.performance_enabled!=="boolean")throw Error("Ungültige Leistungsregel.");
   rules.performance_enabled=input.performance_enabled;
  }
  return rules;
 }
 function evaluatePromotion(person,entry,evidence,rules,now=Date.now()){
  // Only a CURRENT member of THIS clan, with recent complete roster time.
  // Rank histories from other clans cannot grant or remove this rank.
  if(person.rank!=="member"||person.returnRankNote||!rules.performance_enabled)return null;
  if(!entry||entry.is_present!==true)return {
   status:"Nachweise offen",note:"Clanmitgliedschaft nicht aktuell bestätigt."
  };
  const seconds=Number(entry.confirmed_seconds),seen=Date.parse(entry.last_observed_at||"");
  if(!Number.isSafeInteger(seconds)||seconds<0||!Number.isFinite(seen)||
     seen>now+60000||now-seen>24*3600000)return {
    status:"Daten prüfen",note:"Clanzeit-Beobachtung fehlt oder ist älter als 24 Stunden."
   };
  if(evidence===null)return {
   status:"Nachweise offen",note:"Angriffsdaten derzeit nicht abrufbar; keine Leistungsbewertung."
  };
  if(evidence!==undefined&&(
    !Number.isSafeInteger(evidence.attack_count)||evidence.attack_count<0||
    !Number.isSafeInteger(evidence.three_star_count)||evidence.three_star_count<0||
    evidence.three_star_count>evidence.attack_count
   ))return {status:"Daten prüfen",note:"Ungültige Angriffszähler; keine Empfehlung."};
  const attackCount=evidence?.attack_count||0,threeStars=evidence?.three_star_count||0;
  const timeOK=seconds>=rules.performance_min_days*86400;
  const countOK=attackCount>=rules.performance_min_attacks;
  const quoteOK=countOK&&threeStars*100>=rules.performance_three_star_percent*attackCount;
  const duration=Math.floor(seconds/86400);
  const sample=attackCount>0?threeStars+"/"+attackCount+" 3★":
    "keine API-Angriffe belegt";
  const note="Belegte Clanzeit "+duration+"/"+rules.performance_min_days+" Tage · "+
   "API-AG "+attackCount+"/"+rules.performance_min_attacks+
   " · "+sample+" · Zeitraum "+rules.performance_lookback_days+" Tage";
  if(timeOK&&countOK&&quoteOK)return {
   status:"Beförderung prüfen",note:note+
    " · Kriterien rechnerisch erfüllt; Rang nur manuell im Spiel ändern.",
   eligible:true
  };
  return {
   status:"Nachweise offen",note:note+
   (attackCount===0?" · fehlende Belege sind keine 0★-Angriffe.":
    countOK&&!quoteOK?" · 3★-Schwelle noch nicht erreicht.":" · noch nicht alle Kriterien erfüllt.")
  };
 }
 function buildPreview(members,tenureRows=null,evidenceRows=null,configuredRules=null){
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
  const evidenceByTag=new Map((Array.isArray(evidenceRows)?evidenceRows:[])
    .filter(x=>x&&validTag(x.player_tag))
    .map(x=>[tag(x.player_tag),x]));
  const verifiedRules=configuredRules?normalizeRules(configuredRules):null;
  let restoreRankChecks=0,promotionReviewChecks=0;
  for(const player of rows){
   const entry=byTag.get(player.tag);
   const live=members.find(m=>tag(m.tag)===player.tag);
   player.tenureNote=tenureLabel(entry);
   player.donationNote=donorLabel(live,entry);
   player.returnRankNote=returnRankLabel(live,entry);
   if(player.returnRankNote){restoreRankChecks++;player.status="Früheren Rang prüfen";}
   if(verifiedRules&&Array.isArray(evidenceRows)){
    const check=evaluatePromotion(player,entry,evidenceByTag.get(player.tag),verifiedRules);
    if(check){
     player.promotionNote=check.note;
     if(!player.returnRankNote){
      player.status=check.status;
      if(check.eligible)promotionReviewChecks++;
     }
    }
   }else if(verifiedRules&&player.rank==="member"){
    player.promotionNote="Angriffsdaten nicht abrufbar – keine Beförderungsbewertung.";
   }
  }
  rows.sort((a,b)=>Boolean(b.returnRankNote)-Boolean(a.returnRankNote)||
   (a.rank===b.rank?
    a.name.localeCompare(b.name,"de",{sensitivity:"base"}):
    (a.rank==="member"?-1:b.rank==="member"?1:a.rank==="elder"?-1:1)));
  return {ok:true,reason:null,total:members.length,counts,rows,restoreRankChecks,
   promotionReviewChecks,eligibleForRecommendation:promotionReviewChecks,
   observation:"Die Clash-API liefert keinen historischen Eintritt und keinen letzten Login. Nur abgeschlossene API-Kriege dieses Clans und belegte Clanzeit zählen; fehlende Daten sind keine negativen Spielerwerte. Alle Rangentscheidungen bleiben manuell."};
 }
 const api={normalizeRank:rank,validTag,buildPreview,tenureLabel,donorLabel,returnRankLabel,
  DEFAULT_RULES,normalizeRules,evaluatePromotion};
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.CWLClanManagement=api;
})(typeof window!=="undefined"?window:null);
