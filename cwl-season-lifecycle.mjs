/* Safe Cloud CWL season lifecycle. Never infer a finished attack/war or
   mutate a historic plan just because the leaguegroup endpoint says notInWar. */
import { sanitizeSnapshot, canFinalize } from "./cwl-live-core.mjs?v=1.17.0";

const warCountOf=s=>s?.warCount===5?5:7;
function monthDistance(season,now) {
 const m=/^(20\d\d)-(0[1-9]|1[0-2])$/.exec(String(season||""));
 if(!m||!Number.isFinite(now))return Infinity;
 const date=new Date(now);
 return (date.getUTCFullYear()-Number(m[1]))*12+
   date.getUTCMonth()+1-Number(m[2]);
}
export function assessCwlLifecycle({
 profile,liveSnapshot=null,groupState="",confirmedNoCwl=false,
 clanTag="",now=Date.now()
}={}) {
 const previous=profile?.cwlLive;
 const last=previous?.season?sanitizeSnapshot({
  ok:true,active:true,season:previous.season,clanTag:previous.clanTag,
  rounds:previous.rounds,warCount:previous.warCount
 }):null;
 const observed=liveSnapshot?.active===true?sanitizeSnapshot({
  ok:true,active:true,season:liveSnapshot.season,
  clanTag:liveSnapshot.clanTag,rounds:liveSnapshot.rounds,warCount:liveSnapshot.warCount
 }):null;
 const expectedTag=String(clanTag||"").toUpperCase();
 const valid=entry=>entry?.clanTag===expectedTag&&
  profile?.cwlLiveIgnoredSeason!==entry.season;
 // A new league must never be rendered against unarchived locks from
 // another season. Hold a visible transition until a safe archive/reset.
 if(valid(observed)&&valid(last)&&observed.season!==last.season&&
    (profile?.locks||[]).some(lock=>lock?.locked)){
  return {mode:"transition",snapshot:last,oldSeason:last.season,
   newSeason:observed.season,daysEnded:last.rounds.slice(0,warCountOf(last)).filter(r=>
     r.available&&r.state==="warEnded").length,
   daysMissing:last.rounds.slice(0,warCountOf(last)).filter(r=>!r.available).length,
   verifiedSeven:false,canAutoArchive:false,
   savedDays:profile.locks.filter(l=>l?.locked).length,
   reason:"previous_season_requires_archive"};
 }
 const snapshot=valid(observed)?observed:valid(last)?last:null;
 if(!snapshot)return {mode:"idle",snapshot:null,daysEnded:0,daysMissing:7,
  verifiedSeven:false,canAutoArchive:false,reason:"no_verified_season"};
 const live=valid(observed)&&observed?.season===snapshot.season;
 // A currently *active* new season always beats an old stored season.
 if(live&&!["ended"].includes(groupState))
  return {mode:"planning",snapshot:observed,season:observed.season,
   daysEnded:observed.rounds.slice(0,warCountOf(observed)).filter(r=>r.available&&r.state==="warEnded").length,
   daysMissing:observed.rounds.slice(0,warCountOf(observed)).filter(r=>!r.available).length,
   verifiedSeven:false,canAutoArchive:false,reason:"league_active"};
 const postSeason=(live&&groupState==="ended")||confirmedNoCwl;
 if(!postSeason||monthDistance(snapshot.season,now)<0||
    monthDistance(snapshot.season,now)>1)
  return {mode:"planning",snapshot,season:snapshot.season,
   daysEnded:snapshot.rounds.slice(0,warCountOf(snapshot)).filter(r=>r.available&&r.state==="warEnded").length,
   daysMissing:snapshot.rounds.slice(0,warCountOf(snapshot)).filter(r=>!r.available).length,
   verifiedSeven:false,canAutoArchive:false,reason:"no_completed_league_evidence"};
 const days=Math.max(1,Math.min(7,Number(profile?.config?.days)||7));
 const slots=Number(profile?.config?.slots)||15;
 const warCount=warCountOf(snapshot);
 const actualRounds=snapshot.rounds.slice(0,warCount);
 const daysEnded=actualRounds.filter(r=>r.available&&r.state==="warEnded").length;
 const daysMissing=actualRounds.filter(r=>!r.available).length+
  Math.max(0,warCount-actualRounds.length);
 // A verified six-clan league ends after five real wars, not seven.
 // Still require all actual concluded roster records and their exact tags.
 const verifiedAll=days===warCount&&actualRounds.length===warCount&&
  actualRounds.every((round,i)=>round.day===i+1&&canFinalize(round,slots,now));
 const verifiedSeven=warCount===7&&verifiedAll; // existing compatibility signal
 const savedDays=Array.isArray(profile?.locks)?profile.locks.slice(0,warCount):[];
 const allPlayed=days===warCount&&savedDays.length===warCount&&savedDays.every((lock,i)=>
  lock?.locked===true&&lock.source==="coc-api"&&
  lock.season===snapshot.season&&lock.warTag===actualRounds[i]?.warTag);
 return {mode:"postseason",snapshot,season:snapshot.season,warCount,
  daysEnded,daysMissing,verifiedAll,verifiedSeven,
  canAutoArchive:verifiedAll&&allPlayed,
  savedDays:savedDays.filter(l=>l?.locked).length,
  reason:verifiedAll?"all_finals_verified":"final_round_evidence_pending"};
}
export function preservedCwlRound(previous,next) {
 if(!next?.active||!previous?.season||previous.season!==next.season||
    previous.clanTag!==next.clanTag||!Array.isArray(previous.rounds)||
    !Array.isArray(next.rounds))return next;
 // Never lose a recorded ended war because the upstream returned an older,
 // incomplete snapshot of exactly the same tagged war.
 const rounds=next.rounds.map((incoming,i)=>{
  const stored=previous.rounds[i];
  if(stored?.available!==true)return incoming;
  if(incoming?.available!==true)return stored;
  if(stored.warTag===incoming.warTag&&stored.state==="warEnded"&&
     incoming.state!=="warEnded")return stored;
  return incoming;
 });
 return {...next,rounds};
}
