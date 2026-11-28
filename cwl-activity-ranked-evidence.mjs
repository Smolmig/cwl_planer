// Fixture-only Ranked evidence. An observed rolling log cannot prove complete
// coverage, even when the provider returned HTTP 200. No API calls or writes.
import {normalizeBattleLog} from "./cwl-activity-raffle-core.mjs";
const validTag=x=>typeof x==="string"&&/^#[0289PYLQGRJCUV]{3,15}$/.test(x);
function utc(s){
 if(typeof s!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s))return null;
 const t=Date.parse(s);
 return Number.isFinite(t)&&new Date(t).toISOString()===s?t:null;
}
const unknown=()=>({value:null,coverage:"unknown"});
export function evaluateRankedEvidence({playerTag,startTime,endTime,observations=[]}={}){
 const start=utc(startTime),end=utc(endTime);
 if(!validTag(playerTag)||start===null||end===null||end<=start||!Array.isArray(observations))throw Error("invalid_ranked_context");
 // Observations are tagged by the trusted request context, not a user-provided
 // name or an opponent field. Unverified/foreign responses are ignored.
 const accepted=observations.filter(x=>x?.verified===true&&x.playerTag===playerTag&&Array.isArray(x.items));
 const all=accepted.flatMap(x=>x.items);
 // Normalize all snapshots together so conflicting repeated observations
 // cannot re-enter the count after a subsequent collection.
 const log=normalizeBattleLog(playerTag,all);
 const buckets=new Map();
 // Preserve conflict evidence from each timestamp even when normalization
 // has already removed a colliding key. More than one distinct possible
 // attack at the same timestamp is conservatively quarantined.
 for(const item of all){
  if(item?.attack!==true||item.battleType!=="RANKED")continue;
  const one=normalizeBattleLog(playerTag,[item]).records[0];
  if(!one)continue;
  const t=Date.parse(one.timestamp);
  if(t<start||t>=end)continue;
  const rows=buckets.get(one.timestamp)||[];
  rows.push(one);buckets.set(one.timestamp,rows);
 }
 let attacks=0,stars=0,triples=0,conflictingTimes=0;
 for(const rows of buckets.values()){
  const scores=new Set(rows.map(x=>x.stars+"|"+x.destruction));
  const opponents=new Set(rows.map(x=>x.opponentTag).filter(Boolean));
  if(scores.size!==1||opponents.size>1){conflictingTimes++;continue}
  // A missing opponent tag in a repeat does not create a second attack.
  attacks++;stars+=rows[0].stars;triples+=Number(rows[0].stars===3);
 }
 const bound=value=>attacks>0?{value,coverage:"lower_bound"}:unknown();
 return {evidence:{rankedAttacks:bound(attacks),rankedStars:bound(stars),rankedTriples:bound(triples),
  rankedParticipationPct:unknown(),rankedCompletedTournaments:unknown(),rankedPromotions:unknown()},
  coverage:{acceptedSnapshots:accepted.length,observedAttacks:attacks,conflictingTimes,rejectedEntries:log.rejected,
   complete:false}};
}
