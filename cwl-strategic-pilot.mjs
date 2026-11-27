// Read-only pilot coordination. Host supplies already authorized inputs.
import {buildStrategicEvidence,compareSeasonRosterSizes} from "./cwl-strategic-experiment.mjs";
import {previewDailyStrategy} from "./cwl-strategic-daily.mjs";
import {planStrategicRest} from "./cwl-strategic-rest.mjs";
import {previewLiveStrategicTargets} from "./cwl-strategic-targets.mjs";
import {presentDailyStrategy,presentRosterRows} from "./cwl-strategic-presentation.mjs";
const TAG=/^#[0289PYLQGRJCUV]{3,15}$/;
const tag=x=>typeof x==="string"?x.trim().toUpperCase():"";
export function preparePilotInput({context:c,profile,currentPlan,draft=null}={}){
 if(!c?.ready||!["roster","daily"].includes(c.phase)||!["owner","vice"].includes(c.role)||!TAG.test(tag(c.clanTag))||
 ![15,30].includes(c.slots)||![5,7].includes(c.days)||profile?.config?.slots!==c.slots||profile?.config?.days!==c.days||
 !Array.isArray(profile.members)||!Array.isArray(profile.locks)||!Array.isArray(currentPlan))throw Error("pilot_unavailable");
 const oldSeason=c.phase==="roster"&&typeof c.previousSeason==="string"&&/^\d{4}-(0[1-9]|1[0-2])$/.test(c.previousSeason)&&
   profile.cwlLive?.season===c.previousSeason&&tag(profile.cwlLive?.clanTag)===tag(c.clanTag)&&Number.isFinite(c.observedAt);
 if(c.phase==="roster"&&profile.locks.some(l=>l?.locked)&&!oldSeason)throw Error("pilot_existing_locks");
 if(c.phase==="roster"&&c.previousSeason&&!oldSeason)throw Error("pilot_existing_locks");
 const roster=profile.members.filter(m=>c.phase==="daily"||!["former","kept"].includes(m.cocSyncState));
 if(c.phase==="daily")for(const m of profile.archivedMembers||[])if(!roster.some(p=>p.id===m.id)&&currentPlan.some(p=>p.lineup?.includes(m.id)))roster.push({...m,cocSyncState:"former",participating:false});
 // Only current, eligible members may receive explicit draft answers.
 const choices=new Map();
 let slots=c.slots,days=c.days;
 if(draft!==null){
  if(c.phase!=="roster"||![15,30].includes(draft?.slots)||![5,7].includes(draft?.days)||!Array.isArray(draft.answers)||draft.answers.length>50)throw Error("pilot_invalid_draft");
  slots=draft.slots;days=draft.days;
  for(const a of draft.answers){
   const m=roster.find(m=>m.id===a?.id&&tag(m.playerTag)===tag(a?.tag));
   if(!m||m.participating===false||choices.has(m.id)||!["yes","no","unknown"].includes(a.intent))throw Error("pilot_invalid_draft_answer");
   choices.set(m.id,a.intent);
  }
 }
 const issues=[],seen=new Set(),ids=new Set();
 const members=roster.map(m=>{
  const t=tag(m.playerTag);
  if(!TAG.test(t)||!Number.isInteger(m.townHall)||m.townHall<3||m.townHall>30||typeof m.id!=="string"||!m.id||
    ["__proto__","constructor","prototype"].includes(m.id)||seen.has(t)||ids.has(m.id))throw Error("pilot_member_identity");
  seen.add(t);ids.add(m.id);
  // Next-season draft follows the existing rollover rule: day-specific
  // constraints belong to the previous cycle, fixed/global preferences stay.
  // The original profile, archives and prior war records are never changed.
  const member={...m,playerTag:t,statuses:Array.isArray(m.statuses)?[...m.statuses]:[],participationIntent:["yes","no"].includes(m.participationIntent)?m.participationIntent:"unknown"};
  if(oldSeason)Object.assign(member,{statuses:Array(days).fill("auto"),targetDays:null,firstDay:null,outFromDay:null,participationIntent:"unknown"});
  if(c.phase==="roster"){
   // There is no persisted season-bound poll in this pilot. Never treat old
   // unscoped participation flags as a confirmation for the next league.
   member.participationIntent=choices.get(m.id)||"unknown";
   const hard=member.fixed||member.targetDays!=null&&member.targetDays!==""||member.statuses.includes("must");
   if(member.participating!==false&&member.participationIntent==="no"&&hard)
    issues.push(member.name+": Absage widerspricht einer festen Einsatzvorgabe. Bitte Vorgabe prüfen oder Teilnahme offen lassen.");
   if(!oldSeason&&member.participating!==false&&member.participationIntent!=="no"&&
     (member.statuses.slice(days).some(s=>s==="must")||member.targetDays!=null&&member.targetDays!==""&&!member.fixed&&Number(member.targetDays)>=days))
    issues.push(member.name+": Einsatzziel oder MUSS-Tag passt nicht zur gewählten Anzahl Kriegstage.");
  }
  return member;
 });
 return {context:{...c,slots,days},members,issues,plan:c.phase==="roster"?[]:currentPlan.map(p=>({day:p.day,lineup:[...p.lineup]})),
   locks:c.phase==="roster"?[]:profile.locks.slice(0,c.days).flatMap((l,i)=>l?.locked?[{day:i+1,lineup:[...l.lineup]}]:[]),oldSeason:!!oldSeason};
}
export function buildPilotPreview({input,history,projection,mode,planStandard,now}={}){
 if(!input||!history||!["performance","balanced","development"].includes(mode)||typeof planStandard!=="function"||
 !Number.isFinite(now)||!Number.isFinite(history.asOf)||history.asOf>now||now-history.asOf>300000||
 !Array.isArray(history.facts)||!Array.isArray(history.obligations)||history.kind!=="current_snapshot_war_start_proxy")throw Error("pilot_history_unavailable");
 const {context:c,members,plan,locks}=input;
 const historyNote=history.audit?.sourcePartial?"Formdaten teilweise unvollständig.":"Formdaten: letzte 30 Tage, soweit erfasst.";
 if(c.phase==="roster"){
  const active=members.filter(m=>m.participating!==false&&m.participationIntent!=="no"),declined=members.filter(m=>m.participating!==false&&m.participationIntent==="no");
  const base={kind:"roster",mode,historyNote,oldSeason:input.oldSeason,format:{slots:c.slots,days:c.days},expiresAt:history.asOf+300000,
    participation:{yes:active.filter(m=>m.participationIntent==="yes").length,unknown:active.filter(m=>m.participationIntent==="unknown").length,no:declined.length},canApply:false};
  const issues=[...(input.issues||[])];
  if(active.length<c.slots)issues.push("Für "+c.slots+" Plätze sind nur "+active.length+" mögliche Teilnehmer vorhanden.");
  if(issues.length)return {...base,issues,scenarios:[]};
  const result=compareSeasonRosterSizes({members,facts:history.facts,obligations:history.obligations,asOf:history.asOf,mode,slots:c.slots,days:c.days,planStandard});
  if(!result.ok)return {...base,issues:result.conflicts?.length?result.conflicts:["Für diese Vorgaben ist keine vollständige Aufstellung möglich."],scenarios:[]};
  return {...base,issues:[],scenarios:result.scenarios.map(s=>({size:s.size,metrics:s.metrics,
   excluded:s.excluded.map(id=>members.find(m=>m.id===id)?.name||"Unbekannter Spieler"),rows:presentRosterRows({scenario:s,members}).rows})),canApply:false};
 }
 if(c.phase!=="daily"||projection?.status!=="preview_data"||projection.format?.attacksPerMember!==1||!projection.group||!projection.standings||!projection.registered)throw Error("pilot_live_unavailable");
 const group=projection.group,asOf=group.observedAt,validUntil=projection.quality?.validUntil;
 if(!Number.isFinite(asOf)||asOf<history.asOf||asOf>now||now-asOf>300000||group.season!==c.season||group.selectedClanTag!==c.clanTag||
 !Number.isFinite(validUntil)||validUntil<=now||validUntil>asOf+300000)throw Error("pilot_live_scope");
 // No guessed league rules: unknown rules cannot trigger a table-based switch.
 const evidence=buildStrategicEvidence({members,facts:history.facts,obligations:history.obligations,asOf});
 const rest=planStrategicRest({group,evidence,registered:projection.registered,members,currentPlan:plan,manualLocks:locks,mode,slots:c.slots,days:c.days,planStandard});
 const p=previewDailyStrategy({group,standings:projection.standings,evidence,members,registered:projection.registered,currentPlan:plan,manualLocks:locks,mode,role:c.role,asOf,season:c.season,selectedClanTag:c.clanTag,slots:c.slots,days:c.days});
 const liveTargets=previewLiveStrategicTargets({group,evidence,selectedClanTag:c.clanTag,season:c.season,asOf,now}).map(w=>({...w,suggestions:w.suggestions.map(({attackerTag,...a})=>({...a,name:members.find(m=>m.playerTag===attackerTag)?.name||"Position "+a.attackerPosition}))}));
 if(!p.ok&&!liveTargets.length)throw Error("pilot_plan_conflict");
 // Running-war cleanup is independent of future lineup conflicts. Do not
 // display or publish an unsafe rest-day proposal if the daily guard failed.
 if(!p.ok)return {kind:"daily",mode,historyNote,expiresAt:Math.min(history.asOf+300000,validUntil,...liveTargets.map(w=>w.expiresAt)),
  display:{tableStatus:"Aufstellung bitte prüfen",dataStatus:"Angriffsziele anhand der bestätigten laufenden Aufstellung.",recommendation:null,medals:[]},groupStrength:group.clanStrength||[],
  rest:{ok:false,reason:p.reason},publication:null,liveTargets,editableDays:[],changes:[],targets:[],canApply:false};
 const display=presentDailyStrategy({preview:p,standings:projection.standings,group,members,role:c.role,asOf,season:c.season,selectedClanTag:c.clanTag});
 const names=ids=>ids.map(id=>members.find(m=>m.id===id)?.name||"Unbekannter Spieler");
 return {kind:"daily",mode,historyNote,expiresAt:Math.min(history.asOf+300000,validUntil,...liveTargets.map(w=>w.expiresAt)),display,liveTargets,groupStrength:group.clanStrength||[],publication:rest.ok?{season:c.season,clanTag:c.clanTag,registeredTags:[...projection.registered.tags],anchorWarTag:[...group.wars,...group.upcoming].find(w=>w.ownRoster)?.warTag||null}:null,rest:rest.ok?{...rest,changes:rest.changes.map(d=>({day:d.day,removed:names(d.removed),added:names(d.added)})),warnings:rest.warnings.map(w=>({day:w.day,name:names([w.id])[0],alternative:names([w.alternative])[0]}))}:{ok:false,reason:rest.reason},editableDays:p.editableDays,changes:p.current.changes.map(d=>({day:d.day,removed:names(d.removed),added:names(d.added)})),
  targets:p.targetPreviews.map(t=>({day:t.day,ok:t.ok,swaps:t.ok?t.proposal.filter(x=>x.attackerPosition!==x.targetPosition).map(x=>({from:x.attackerPosition,to:x.targetPosition,n:x.evidenceN})):[]})),canApply:false};
}
