// Autonomous computation; no HTTP, browser or database side effects.
// Caller must verify current tenant/owner binding and execute an atomic CAS after
// computation. Review lock protects human inputs, not derived assignments.
import {buildStrategicEvidence} from "../../../cwl-strategic-experiment.mjs";
import {planStrategicRest} from "../../../cwl-strategic-rest.mjs";
import {adaptStrategicHistory} from "../../../cwl-strategic-history-adapter.mjs";
const tag=x=>typeof x==="string"?x.trim().toUpperCase():"";
const validTag=x=>/^#[0289PYLQGRJCUV]{3,15}$/.test(x);
const validId=x=>typeof x==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(x);
const modes=["balanced","performance","development"];
const fail=reason=>({ok:false,reason});
const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&new Set(a).size===a.length&&new Set(b).size===b.length&&a.every(x=>b.includes(x));
export function automaticScope({enabled,clanId,clanTag,clan,ownerMembership,saved,review,now=Date.now()}={}){
 const p=saved?.profile_json,season=review?.season;
 return enabled===true&&validId(clanId)&&validTag(clanTag)&&clan?.id===clanId&&clan.clash_tag===clanTag&&validId(clan.owner_user_id)&&
  ownerMembership?.role==="owner"&&ownerMembership.user_id===clan.owner_user_id&&ownerMembership.clan_id===clanId&&
  validId(review?.cycle_id)&&typeof review.locked==="boolean"&&Number.isSafeInteger(saved?.revision)&&
  season===new Date(now).toISOString().slice(0,7)&&p?.cwlLive?.season===season&&p.cwlLive.clanTag===clanTag&&
  p.config?.strategicAuto===true&&modes.includes(p.config?.strategicMode)&&p.cwlLiveIgnoredSeason!==season&&!p.cocManualEmergency?.pending;
}
export function buildAutomaticStrategicCandidate({saved,review,clanId,clanTag,projection,historyRows,liveSnapshots=[],core,now=Date.now()}={}){
 const p=saved?.profile_json,season=p?.cwlLive?.season,mode=p?.config?.strategicMode;
 if(!validId(clanId)||!validTag(clanTag)||!Number.isSafeInteger(saved?.revision)||!p||
   p.config?.strategicAuto!==true||!modes.includes(mode)||!review?.cycle_id||typeof review.locked!=="boolean"||
   review.season!==season||season!==new Date(now).toISOString().slice(0,7)||
   p.cwlLive?.clanTag!==clanTag||p.cwlLiveIgnoredSeason===season||p.cocManualEmergency?.pending)return fail("inactive_or_scope");
 const {slots,days}=p.config,group=projection?.group,registered=projection?.registered,asOf=group?.observedAt,validUntil=projection?.quality?.validUntil;
 if(![15,30].includes(slots)||![5,7].includes(days)||projection?.status!=="preview_data"||
   projection.format?.teamSize!==slots||projection.format.attacksPerMember!==1||
   group?.season!==season||group?.selectedClanTag!==clanTag||!registered?.verified||
   !Number.isFinite(asOf)||asOf>now||!Number.isFinite(validUntil)||validUntil<=now||validUntil>asOf+300000||
   !Array.isArray(p.members)||!Array.isArray(p.locks)||!Array.isArray(p.archivedMembers)||!Array.isArray(p.cwlLive.rounds))return fail("unverified_group");
 const all=[...p.members,...p.archivedMembers],ids=new Map(all.map(m=>[m.id,m])),byTag=new Map(all.map(m=>[tag(m.playerTag),m.id]));
 if(ids.size!==all.length||byTag.size!==all.length||all.some(m=>!validTag(tag(m.playerTag))||!Number.isInteger(m.townHall)||m.townHall<3||m.townHall>30))return fail("identity");
 const locks=Array.from({length:days},(_,i)=>p.locks[i]?.locked?{locked:true,lineup:[...p.locks[i].lineup]}:{locked:false,lineup:[]});
 const observedRounds=Array.from({length:days},(_,i)=>({day:i+1,available:false}));
 for(const w of [...(group.wars||[]),...(group.upcoming||[])]){
  if(!w.ownRoster)continue;
  const i=w.day-1,state=w.status==="confirmed_preparation_roster"?"preparation":w.state;
  if(!Number.isInteger(i)||i<0||i>=days||observedRounds[i].available||!validTag(w.warTag)||w.teamSize!==slots||!["preparation","inWar","warEnded"].includes(state))return fail("war_identity");
  const lineup=w.ownRoster.map(m=>byTag.get(tag(m.tag)));
  if(lineup.length!==slots||new Set(lineup).size!==slots||lineup.some(id=>!id))return fail("unknown_roster");
  const previous=p.cwlLive.rounds[i],rank={preparation:1,inWar:2,warEnded:3};
  if(previous?.available===true&&(previous.warTag!==w.warTag||!rank[previous.state]||rank[previous.state]>rank[state]))return fail("stale_group");
  if(state!=="preparation"){
   if(locks[i].locked&&!same(locks[i].lineup,lineup))return fail("lock_conflict");
   locks[i]={locked:true,lineup};
  }
  observedRounds[i]={day:w.day,available:true,warTag:w.warTag,state,...(state!=="preparation"?{lineup}: {})};
 }
 // Do not auto-publish with gaps in the past, after the last actual day,
 // or when an already visible war disappeared from the fresh observation.
 const prep=observedRounds.filter(w=>w.state==="preparation");
 if(!prep.length||observedRounds.slice(0,Math.max(...prep.map(w=>w.day))-1).some(w=>!w.available)||
    p.cwlLive.rounds.slice(0,days).some((w,i)=>w?.available===true&&!observedRounds[i].available))return fail("incomplete_own_schedule");
 const live={...p.cwlLive,rounds:observedRounds};
 const members=[...p.members,...p.archivedMembers.map(m=>({...m,participating:false,cocSyncState:"former"}))];
 const standard=core.planCwl({members,locks,slots,days});
 if(!standard.ok)return fail("hard_rules");
 const baseline=saved.automatic_snapshot?{...p,strategicPlan:saved.automatic_snapshot}:p;
 const previous=core.resolvePublishedStrategicPlan({profile:baseline,clanId,locks,standard,live});
 const currentPlan=previous.plan.dayPlans;
 const stableDays=previous.status==="published"&&saved.automatic_snapshot?observedRounds.flatMap((w,i)=>{
  const prior=saved.automatic_snapshot.observedRounds?.[i];
  // Newly revealed matchup or a changed phase must be free to reoptimize.
  return w.available===prior?.available&&(!w.available||w.warTag===prior.warTag&&w.state===prior.state)?[i+1]:[];
 }):[];
 let history;
 try{
  const ns=w=>clanTag+"|"+w;
  const wars=historyRows.wars.map(w=>({...w,formClanTag:clanTag,war_key:ns(w.war_key)}));
  const scoped=rows=>rows.map(x=>({...x,war_key:ns(x.war_key)}));
  history=adaptStrategicHistory({history:{wars,attacks:scoped(historyRows.attacks),missedEvents:scoped(historyRows.missedEvents)},members,selectedClanId:clanId,authorizedClanIds:[clanId],snapshotAt:asOf,asOf});
 }catch{return fail("history_scope")}
 // Include only currently observed OWN live attacks; finalized history
 // has precedence. Never infer missed attacks from a running war.
 const finalKeys=new Set(historyRows.wars.filter(w=>w.finalized).map(w=>w.war_key));
 for(const s of liveSnapshots){
  const w=s?.war,at=Date.parse(w?.started_at);
  if(s.state!=="inWar"||w?.war_type!=="cwl"||w.source_clash_tag!==clanTag||finalKeys.has(w.war_key)||
    !observedRounds.some(r=>r.state==="inWar"&&"cwl:"+r.warTag===w.war_key)||!Number.isFinite(at)||at>asOf||!Array.isArray(s.attacks))continue;
  for(const a of s.attacks)history.facts.push({warKey:clanTag+"|"+w.war_key,playerTag:a.attacker_tag,attackOrder:a.attack_order,
    kind:"cwl",attackerTh:a.attacker_th,defenderTh:a.defender_th,stars:a.stars,destruction:a.destruction,eventAt:at,observedAt:asOf});
 }
 let rest;
 try{
  const evidence=buildStrategicEvidence({members,facts:history.facts,obligations:history.obligations,asOf});
  rest=planStrategicRest({group,evidence,registered,members,currentPlan,manualLocks:p.locks.slice(0,days).flatMap((l,i)=>l?.locked?[{day:i+1,lineup:l.lineup}]:[]),mode,slots,days,planStandard:core.planCwl,stableDays});
 }catch{return fail("solver_unavailable")}
 if(!rest.ok||rest.heldDays.length)return fail("solver_conflict");
 const s={version:1,source:"collector",clanId,clanTag,season,anchorWarTag:prep[0].warTag,
  registeredTags:[...registered.tags].sort(),ruleKey:core.strategicRuleKey(p),plan:rest.plan,
  observedAt:asOf,observedRounds};
 if(core.resolvePublishedStrategicPlan({profile:{...p,strategicPlan:s},clanId,locks,standard,live}).status!=="published")return fail("publication_invalid");
 // Compare semantic state, not the polling timestamp, to avoid revision churn.
 // Postgres JSONB canonicalizes object keys. Compare explicit tuples, not
 // insertion-order JSON of nested objects received via PostgREST.
 const semantic=x=>JSON.stringify(x?[x.clanId,x.clanTag,x.season,x.anchorWarTag,x.registeredTags,x.ruleKey,
  x.plan.map(d=>[d.day,d.lineup]),
  x.observedRounds.map(w=>[w.day,w.available,w.warTag??null,w.state??null,w.lineup??null])]:null);
 if(saved.automatic_revision===saved.revision&&semantic(saved.automatic_snapshot)===semantic(s))return {ok:true,changed:false};
 return {ok:true,changed:true,expectedRevision:saved.revision,expectedCycle:review.cycle_id,validUntil,next:s};
}
