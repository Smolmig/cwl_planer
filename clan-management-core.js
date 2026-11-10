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
  performance_lookback_days:14,
  loyalty_min_days:60,
  absence_reset_days:10,
  loyalty_enabled:false,
  loyalty_min_donations:50,
  loyalty_min_active_days:3,
  loyalty_lookback_days:30
 });
 const LIMITS=Object.freeze({
  performance_min_days:[1,365],
  performance_min_attacks:[1,100],
  performance_three_star_percent:[0,100],
  performance_lookback_days:[7,730],
  loyalty_min_days:[1,730],
  absence_reset_days:[1,365],
  loyalty_min_donations:[1,100000],
  loyalty_min_active_days:[1,365],
  loyalty_lookback_days:[7,365]
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
  for(const key of ["performance_enabled","loyalty_enabled"]){
   if(Object.hasOwn(input,key)){
    if(typeof input[key]!=="boolean")throw Error("Ungültige Regel: "+key);
    rules[key]=input[key];
   }
  }
  if(rules.loyalty_min_active_days>rules.loyalty_lookback_days)
   throw Error("Die benötigten Spendentage dürfen den Zeitraum nicht überschreiten.");
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

 // Only confirmed *positive* deltas are available, not all donations, and
 // absence sequences are not an exact offline/leave time. This evaluator
 // never mutates historical clan-time counters or changes any Clash role.
 function evaluateLoyalty(person,entry,summary,rules,now=Date.now()){
  if(person.rank!=="member"||person.returnRankNote||!rules.loyalty_enabled)return null;
  const unavailable=(status,note)=>({status,note,eligible:false});
  if(!entry||entry.is_present!==true)
   return unavailable("Nachweise offen","Aktuelle Clanmitgliedschaft nicht bestätigt.");
  const seconds=Number(entry.confirmed_seconds),last=Date.parse(entry.last_observed_at||"");
  const visits=Number(entry.observed_visits);
  if(!Number.isSafeInteger(seconds)||seconds<0||!Number.isFinite(last)||
     last>now+60000||now-last>24*3600000||
     !Number.isSafeInteger(visits)||visits<1)
   return unavailable("Daten prüfen","Clanzeit/Clash-Liste fehlen oder sind älter als 24 Stunden.");
  if(!summary)
   return unavailable("Nachweise offen","Spenden-/Rückkehrdaten derzeit nicht bestätigt; keine Treueempfehlung.");
  const nonnegative=value=>{
   if(typeof value==="string"&&/^\d+$/.test(value))value=Number(value);
   return Number.isSafeInteger(value)&&value>=0?value:null;
  };
  const total=nonnegative(summary.observed_positive_donations),
   events=nonnegative(summary.observed_donation_events),
   days=nonnegative(summary.observed_donation_days),
   absences=nonnegative(summary.observed_absence_windows),
   longest=nonnegative(summary.longest_observed_absence_seconds);
  const lastDonation=summary.last_positive_donation_at===null?null:
   Date.parse(summary.last_positive_donation_at||"");
  if([total,events,days,absences,longest].some(x=>x===null)||
     days>events||absences>visits-1||
     (events===0&&(days!==0||total!==0||lastDonation!==null))||
     (events>0&&(total<events||days<1||!Number.isFinite(lastDonation)||
       lastDonation>now+60000)))
   return unavailable("Daten prüfen","Widersprüchliche Treue-Nachweise; keine Empfehlung.");
  const timeDays=Math.floor(seconds/86400);
  const label="Belegte Clanzeit "+timeDays+"/"+rules.loyalty_min_days+" Tage · "+
   "beobachteter Spendenzuwachs "+total+"/"+rules.loyalty_min_donations+
   " in "+rules.loyalty_lookback_days+" Tagen · "+
   "Spendentage "+days+"/"+rules.loyalty_min_active_days;
  if(visits>1&&absences!==visits-1)
   return unavailable("Daten prüfen",label+
    " · Frühere Rückkehr nicht lückenlos protokolliert; Qualifikation manuell prüfen.");
  if(rules.absence_reset_days!==null&&
     longest>=rules.absence_reset_days*86400)
   return unavailable("Rückkehr prüfen",label+
    " · Längere Abwesenheits-Snapshotfolge beobachtet (Schwelle "+
    rules.absence_reset_days+" Tage): möglicher Qualifikations-Reset nur manuell prüfen; belegte Gesamt-Clanzeit bleibt erhalten.");
  const recent=lastDonation!==null&&now-lastDonation<=
    Math.min(14,rules.loyalty_lookback_days)*86400000;
  if(seconds>=rules.loyalty_min_days*86400&&total>=rules.loyalty_min_donations&&
     days>=rules.loyalty_min_active_days&&recent)
   return {status:"Treue: Beförderung prüfen",note:label+
    " · letzte beobachtete Spende in den letzten 14 Tagen · CW-Pflicht/Fehlangriffe nicht bewertet. Nur manuell im Spiel prüfen.",
    eligible:true};
  return unavailable("Nachweise offen",label+
   (recent?" · noch nicht alle Kriterien bestätigt.":
    " · kein frischer belegter Spendenzuwachs; ungemessene Aktivität bleibt unbekannt."));
 }
 function buildPreview(members,tenureRows=null,evidenceRows=null,configuredRules=null,loyaltyRows=null){
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
  const loyaltyByTag=new Map((Array.isArray(loyaltyRows)?loyaltyRows:[])
    .filter(x=>x&&validTag(x.player_tag))
    .map(x=>[tag(x.player_tag),x]));
  const verifiedRules=configuredRules?normalizeRules(configuredRules):null;
  let restoreRankChecks=0,promotionReviewChecks=0,loyaltyReviewChecks=0;
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
    player.promotionNote="Angriffsdaten nicht abrufbar – keine Leistungsbewertung.";
   }
   if(verifiedRules?.loyalty_enabled&&player.rank==="member"&&!player.returnRankNote){
    const check=evaluateLoyalty(player,entry,
     Array.isArray(loyaltyRows)?loyaltyByTag.get(player.tag):null,
     verifiedRules);
    if(check){
     player.loyaltyNote=check.status+" · "+check.note;
     if(check.eligible){
      loyaltyReviewChecks++;
      if(player.status!=="Beförderung prüfen"){
       player.status=check.status;
       promotionReviewChecks++;
      }
     }
    }
   }
  }
  rows.sort((a,b)=>Boolean(b.returnRankNote)-Boolean(a.returnRankNote)||
   (a.rank===b.rank?
    a.name.localeCompare(b.name,"de",{sensitivity:"base"}):
    (a.rank==="member"?-1:b.rank==="member"?1:a.rank==="elder"?-1:1)));
  return {ok:true,reason:null,total:members.length,counts,rows,restoreRankChecks,
   promotionReviewChecks,loyaltyReviewChecks,
   eligibleForRecommendation:promotionReviewChecks,
   observation:"Die Clash-API liefert keinen historischen Eintritt und keinen letzten Login. Nur abgeschlossene API-Kriege dieses Clans und belegte Clanzeit zählen; fehlende Daten sind keine negativen Spielerwerte. Alle Rangentscheidungen bleiben manuell."};
 }
 const api={normalizeRank:rank,validTag,buildPreview,tenureLabel,donorLabel,returnRankLabel,
  DEFAULT_RULES,normalizeRules,evaluatePromotion,evaluateLoyalty};
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.CWLClanManagement=api;
})(typeof window!=="undefined"?window:null);
