// Read-only pilot coordination. Host supplies already authorized inputs.
import {buildStrategicEvidence,compareSeasonRosterSizes} from "./cwl-strategic-experiment.mjs";
import {previewDailyStrategy} from "./cwl-strategic-daily.mjs";
import {presentDailyStrategy,presentRosterRows} from "./cwl-strategic-presentation.mjs";
const TAG=/^#[0289PYLQGRJCUV]{3,15}$/;
const tag=x=>typeof x==="string"?x.trim().toUpperCase():"";
export function preparePilotInput({context:c,profile,currentPlan}={}){
 if(!c?.ready||!["roster","daily"].includes(c.phase)||!["owner","vice"].includes(c.role)||!TAG.test(tag(c.clanTag))||
 ![15,30].includes(c.slots)||![5,7].includes(c.days)||profile?.config?.slots!==c.slots||profile?.config?.days!==c.days||
 !Array.isArray(profile.members)||!Array.isArray(profile.locks)||!Array.isArray(currentPlan))throw Error("pilot_unavailable");
 if(c.phase==="roster"&&profile.locks.some(l=>l?.locked))throw Error("pilot_existing_locks");
 const roster=profile.members.filter(m=>m.cocSyncState!=="former"||c.phase==="daily");
 if(c.phase==="daily")for(const m of profile.archivedMembers||[])if(!roster.some(p=>p.id===m.id)&&currentPlan.some(p=>p.lineup?.includes(m.id)))roster.push({...m,cocSyncState:"former",participating:false});
 const seen=new Set(),ids=new Set();
 const members=roster.map(m=>{
  const t=tag(m.playerTag);
  if(!TAG.test(t)||!Number.isInteger(m.townHall)||m.townHall<3||m.townHall>30||typeof m.id!=="string"||!m.id||
    ["__proto__","constructor","prototype"].includes(m.id)||seen.has(t)||ids.has(m.id))throw Error("pilot_member_identity");
  seen.add(t);ids.add(m.id);
  return {...m,playerTag:t,statuses:Array.isArray(m.statuses)?[...m.statuses]:[],participationIntent:["yes","no"].includes(m.participationIntent)?m.participationIntent:"unknown"};
 });
 return {context:{...c},members,plan:currentPlan.map(p=>({day:p.day,lineup:[...p.lineup]})),locks:profile.locks.slice(0,c.days).flatMap((l,i)=>l?.locked?[{day:i+1,lineup:[...l.lineup]}]:[])};
}
export function buildPilotPreview({input,history,projection,mode,planStandard,now}={}){
 if(!input||!history||!["performance","balanced","development"].includes(mode)||typeof planStandard!=="function"||
 !Number.isFinite(now)||!Number.isFinite(history.asOf)||history.asOf>now||now-history.asOf>300000||
 !Array.isArray(history.facts)||!Array.isArray(history.obligations)||history.kind!=="current_snapshot_war_start_proxy")throw Error("pilot_history_unavailable");
 const {context:c,members,plan,locks}=input;
 const historyNote=history.audit?.sourcePartial?"Formdaten teilweise unvollständig.":"Formdaten: letzte 30 Tage, soweit erfasst.";
 if(c.phase==="roster"){
  const result=compareSeasonRosterSizes({members,facts:history.facts,obligations:history.obligations,asOf:history.asOf,mode,slots:c.slots,days:c.days,planStandard});
  if(!result.ok)throw Error("pilot_plan_conflict");
  return {kind:"roster",mode,historyNote,scenarios:result.scenarios.map(s=>({size:s.size,metrics:s.metrics,
   excluded:s.excluded.map(id=>members.find(m=>m.id===id)?.name||"Unbekannter Spieler"),rows:presentRosterRows({scenario:s,members}).rows})),canApply:false};
 }
 if(c.phase!=="daily"||projection?.status!=="preview_data"||projection.format?.attacksPerMemberReported!==true||!projection.group||!projection.standings||!projection.registered)throw Error("pilot_live_unavailable");
 const group=projection.group,asOf=group.observedAt;
 if(!Number.isFinite(asOf)||asOf<history.asOf||asOf>now||now-asOf>300000||group.season!==c.season||group.selectedClanTag!==c.clanTag)throw Error("pilot_live_scope");
 // No guessed league rules: unknown rules cannot trigger a table-based switch.
 const evidence=buildStrategicEvidence({members,facts:history.facts,obligations:history.obligations,asOf});
 const p=previewDailyStrategy({group,standings:projection.standings,evidence,members,registered:projection.registered,currentPlan:plan,manualLocks:locks,mode,role:c.role,asOf,season:c.season,selectedClanTag:c.clanTag,slots:c.slots,days:c.days});
 if(!p.ok)throw Error("pilot_plan_conflict");
 const display=presentDailyStrategy({preview:p,standings:projection.standings,group,members,role:c.role,asOf,season:c.season,selectedClanTag:c.clanTag});
 const names=ids=>ids.map(id=>members.find(m=>m.id===id)?.name||"Unbekannter Spieler");
 return {kind:"daily",mode,historyNote,display,editableDays:p.editableDays,changes:p.current.changes.map(d=>({day:d.day,removed:names(d.removed),added:names(d.added)})),
  targets:p.targetPreviews.map(t=>({day:t.day,ok:t.ok,swaps:t.ok?t.proposal.filter(x=>x.attackerPosition!==x.targetPosition).map(x=>({from:x.attackerPosition,to:x.targetPosition,n:x.evidenceN})):[]})),canApply:false};
}
