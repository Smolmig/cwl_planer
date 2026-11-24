// Dry-run of one member's CWL day rule against the SAME validated solver
// used by the live plan. No profile writes, no Cloud RPC, no opponent assumptions.
const STATUS=new Set(["auto","must","out"]);
const own=value=>Array.isArray(value)?value:[];
const currentStatus=(m,d)=>["auto","must","out"].includes(m?.statuses?.[d])?m.statuses[d]:"auto";
const orderedDifference=(after,before)=>after.filter(id=>!before.includes(id));
const spread=(members,counts)=>{
 const values=own(members).filter(m=>m?.participating&&m.cocSyncState!=="former"&&!m.fixed)
  .map(m=>counts?.[m.id]||0);
 return values.length<2?null:Math.max(...values)-Math.min(...values);
};
const invalid=(reason)=>({ready:false,reason});
function formatDraft(base,next,members,memberId,dayIndex,fromStatus,toStatus,days,locks){
 const changedDays=[];
 for(let d=0;d<days;d++){
  const before=own(base.dayPlans[d]?.lineup),after=own(next.dayPlans[d]?.lineup);
  const entering=orderedDifference(after,before),leaving=orderedDifference(before,after);
  if(locks[d]?.locked&&(entering.length||leaving.length))
   return invalid("Die Vorschau würde einen bereits fixierten Kriegstag verändern. Keine Simulation freigegeben.");
  if(!locks[d]?.locked&&after.length!==base.dayPlans[d]?.lineup.length)
   return invalid("Die Vorschau ändert die Anzahl der Spielerplätze. Bitte zuerst die Regeln prüfen.");
  if(entering.length||leaving.length)
   changedDays.push({day:d+1,entering,leaving});
 }
 const ids=new Set([...Object.keys(base.counts||{}),...Object.keys(next.counts||{})]);
 const affected=[...ids].map(id=>({id,before:base.counts[id]||0,after:next.counts[id]||0}))
  .filter(p=>p.before!==p.after)
  .sort((a,b)=>Math.abs(b.after-b.before)-Math.abs(a.after-a.before)||a.id.localeCompare(b.id));
 const focus=affected.find(p=>p.id===memberId)||
  {id:memberId,before:base.counts[memberId]||0,after:next.counts[memberId]||0};
 return {ready:true,memberId,day:dayIndex+1,fromStatus,toStatus,
  changed:changedDays.length>0,changedDays,affected,focus,
  fairnessBefore:spread(members,base.counts),fairnessAfter:spread(members,next.counts),
  baselineNotices:own(base.notices),previewNotices:own(next.notices),
  simulatedOnly:true};
}
function previewCwlRuleChange({members=[],archivedMembers=[],locks=[],slots,days,
 memberId,dayIndex,nextStatus,solver}={}){
 if(typeof solver!=="function")return invalid("Der geprüfte CWL-Planer ist nicht verfügbar.");
 if(!Number.isInteger(days)||days<1||days>7||!Number.isInteger(slots)||slots<1||slots>50)
  return invalid("Ungültige CWL-Konfiguration.");
 if(!Number.isInteger(dayIndex)||dayIndex<0||dayIndex>=days)
  return invalid("Bitte einen gültigen Kriegstag wählen.");
 if(!STATUS.has(nextStatus))return invalid("Ungültige Tagesregel.");
 if(locks[dayIndex]?.locked)
  return invalid("Dieser Kriegstag ist fixiert und darf nicht geändert werden.");
 const person=own(members).find(p=>p?.id===memberId);
 if(!person||!person.participating||person.cocSyncState==="former")
  return invalid("Der Spieler nimmt nicht am aktuellen CWL-Plan teil.");
 const fromStatus=currentStatus(person,dayIndex);
 if(fromStatus===nextStatus)
  return invalid("Diese Tagesregel ist bereits eingestellt; die Aufstellungen würden unverändert bleiben.");
 const scenarioMembers=members.map(p=>p?.id===memberId?
  {...p,statuses:Array.from({length:days},(_,d)=>d===dayIndex?nextStatus:currentStatus(p,d))}:p);
 // Hard-rule simulation uses the same immutable server-confirmed day locks as
 // the ordinary client calculation. Only ONE copy of one member is changed.
 const input={archivedMembers,locks,slots,days};
 let base,scenario;
 try{
  base=solver({...input,members});
  scenario=solver({...input,members:scenarioMembers});
 }catch{
  return invalid("Die Tagesregel konnte nicht sicher simuliert werden.");
 }
 if(!base?.ok)
  return {...invalid("Der Ausgangsplan hat bereits widersprüchliche Vorgaben. Bitte diese zuerst beheben."),
   conflicts:own(base.conflicts)};
 if(!scenario?.ok)
  return {...invalid("Die geänderte Tagesregel wäre mit den bestehenden Vorgaben nicht vereinbar."),
   conflicts:own(scenario.conflicts),memberId,day:dayIndex+1,fromStatus,toStatus:nextStatus};
 if(!Array.isArray(base.dayPlans)||!Array.isArray(scenario.dayPlans)||
  base.dayPlans.length!==days||scenario.dayPlans.length!==days)
  return invalid("Die Vergleichsdaten des Planers sind unvollständig.");
 return formatDraft(base,scenario,members,memberId,dayIndex,fromStatus,
  nextStatus,days,locks);
}
if(typeof window!=="undefined")
 window.CWLPlanWhatIf=Object.freeze({previewCwlRuleChange});
if(typeof module!=="undefined"&&module.exports)
 module.exports={previewCwlRuleChange};
