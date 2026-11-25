// Activity-event foundation (#351). Pure evidence evaluation; no API writes,
// no draw and no assertion that a provider response is complete.
const tagPattern=/^#[0289PYLQGRJCUV]{3,15}$/;
const modes=new Set(["HOME_VILLAGE","RANKED","LEGEND"]);
const metrics=new Set(["donations","cwStars","cwAttacks","cwTriples","cwlStars","cwlAttacks","cwlTriples",
 "cwReliabilityPct","cwlReliabilityPct","rankedAttacks","rankedStars","rankedTriples","rankedParticipationPct",
 "rankedCompletedTournaments","rankedPromotions","legendAttacks","legendStars","homeAttacks","homeStars","homeTriples",
 "activeDays","raidAttacks","raidCompletedWeekends","raidParticipationPct","capitalGold","clanGamesPoints"]);
const percentage=new Set(["cwReliabilityPct","cwlReliabilityPct","rankedParticipationPct","raidParticipationPct"]);
const finite=x=>typeof x==="number"&&Number.isFinite(x)&&x>=0;
const validTag=x=>typeof x==="string"&&tagPattern.test(x);
function parseBattleTime(s){
 if(typeof s!=="string")return null;
 const compact=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\.\d{3})?Z$/.exec(s);
 const iso=compact?compact[1]+"-"+compact[2]+"-"+compact[3]+"T"+compact[4]+":"+compact[5]+":"+compact[6]+(compact[7]||".000")+"Z":s;
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(iso))return null;
 const t=Date.parse(iso);
 if(!Number.isFinite(t)||new Date(t).toISOString()!==iso.replace(/(\d{2})Z$/,"$1.000Z")&&new Date(t).toISOString()!==iso)return null;
 return new Date(t).toISOString();
}
export function normalizeBattleLog(playerTag,items){
 if(!validTag(playerTag)||!Array.isArray(items))throw Error("invalid_battle_log");
 const records=new Map(),conflicts=new Set();
 let rejected=0,defenses=0;
 for(const x of items){
  if(x?.attack===false){defenses++;continue}
  const timestamp=parseBattleTime(x?.battleTimestamp),mode=x?.battleType,stars=x?.stars,destruction=x?.destructionPercentage;
  if(x?.attack!==true||!modes.has(mode)||!timestamp||!Number.isInteger(stars)||stars<0||stars>3||
     !finite(destruction)||destruction>100){rejected++;continue}
  const opponentTag=validTag(x.opponentPlayerTag)?x.opponentPlayerTag:null;
  // Some farming entries have no opponent tag. A collision with conflicting
  // content is ambiguous; exclude both observations rather than inflate counts.
  const key=[playerTag,mode,timestamp,opponentTag||""].join("|");
  const row={key,playerTag,mode,timestamp,opponentTag,stars,destruction};
  if(conflicts.has(key))continue;
  if(records.has(key)&&JSON.stringify(records.get(key))!==JSON.stringify(row)){
   records.delete(key);conflicts.add(key);continue;
  }
  records.set(key,row);
 }
 return {records:[...records.values()].sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.key.localeCompare(b.key)),
  rejected,defenses,ambiguous:conflicts.size,coverage:"unknown"};
}
// A threshold may be established by a lower bound for monotonic counts only.
// A provisional percentage cannot be treated as a lower bound.
export function evaluateActivityRequirement(rule,evidence,marks={}){
 if(!rule||typeof rule!=="object")throw Error("invalid_requirement");
 const key=rule.metric;
 if(key==="discord"||key==="voted"){
  if(rule.minimum!==true)throw Error("invalid_manual_requirement");
  const value=marks[key];
  if(value!==true&&value!==false)return {metric:key,status:"unknown",value:null,coverage:"unknown"};
  return {metric:key,status:value?"met":"unmet",value,coverage:"manual"};
 }
 if(!metrics.has(key)||!finite(rule.minimum)||!Number.isInteger(rule.minimum)||
    (percentage.has(key)&&rule.minimum>100))throw Error("invalid_requirement");
 const e=evidence&&Object.hasOwn(evidence,key)?evidence[key]:null;
 if(!e||!finite(e.value)||!["complete","lower_bound"].includes(e.coverage)||
    (percentage.has(key)&&(e.value>100||e.coverage!=="complete"))||
    (!percentage.has(key)&&!Number.isSafeInteger(e.value)))return {metric:key,status:"unknown",value:null,coverage:"unknown"};
 const status=e.value>=rule.minimum?"met":e.coverage==="complete"?"unmet":"unknown";
 return {metric:key,status,value:e.value,coverage:e.coverage};
}
export function evaluateActivityEligibility(rules,evidence,marks={}){
 if(!Array.isArray(rules)||rules.length===0||new Set(rules.map(r=>r?.metric)).size!==rules.length)throw Error("invalid_rules");
 const results=rules.map(r=>evaluateActivityRequirement(r,evidence,marks));
 // Unknown is never represented as failed. A known unmet criterion still
 // prevents qualification in an AND-event regardless of other unknowns.
 const status=marks.excluded===true||marks.organizer===true?"excluded":results.some(r=>r.status==="unmet")?"unmet":
  results.every(r=>r.status==="met")?"qualified":"unknown";
 return {status,results,tickets:status==="qualified"?1:0};
}
