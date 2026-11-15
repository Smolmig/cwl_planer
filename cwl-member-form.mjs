// Read-only member form: the latest documented CWL run, plus a separate
// short CW fallback. This module never influences the CWL planner automatically.
// All data arrives from the currently authorized, deduplicated clan statistics.
import {cleanTag,groupCwlRuns,computePlayerFormWindows} from "./cwl-stats-core.mjs";

const finished=w=>w&&["normal","cwl"].includes(w.war_type)&&
  (w.source!=="api"||w.finalized===true)&&
  Number.isFinite(Date.parse(w.started_at));
const dateOf=w=>Date.parse(w.started_at);
const sortLatest=(a,b)=>dateOf(b)-dateOf(a)||
  String(a.war_key).localeCompare(String(b.war_key));
function snapshot(selectedWars,attacks,memberTags,memberProfiles,missedEvents){
  if(!selectedWars.length)return new Map();
  const latest=Math.max(...selectedWars.map(dateOf));
  // The selected wars are a *run/count scope*, not an implicit calendar
  // window. 730 days from the most recent documented war is a conservative
  // guard against silently treating very distant records as current form.
  const p=computePlayerFormWindows(selectedWars,attacks,{
    asOf:latest+1000,windows:[730],memberTags,memberProfiles,missedEvents
  });
  return new Map(p.players.map(row=>[cleanTag(row.tag),row.windows[730]]));
}
export function computeMemberFormEvidence(wars,attacks,{
  asOf=Date.now(),memberTags=[],memberProfiles=[],missedEvents=[],cwWarCount=5
}={}){
  const now=typeof asOf==="number"?asOf:Date.parse(asOf);
  if(!Number.isFinite(now)||!Number.isInteger(cwWarCount)||cwWarCount<1||cwWarCount>20)
    throw Error("Ungültige Formbasis.");
  const eligible=(wars||[]).filter(w=>finished(w)&&dateOf(w)<=now);
  const cw=eligible.filter(w=>w.war_type==="normal").sort(sortLatest)
    .slice(0,cwWarCount);
  const lastRun=groupCwlRuns(eligible)[0]||null;
  const latestKeys=new Set(lastRun?.warKeys||[]);
  const league=eligible.filter(w=>latestKeys.has(w.war_key));
  const cwlStats=snapshot(league,attacks,memberTags,memberProfiles,missedEvents);
  const cwStats=snapshot(cw,attacks,memberTags,memberProfiles,missedEvents);
  const tags=new Set([...memberTags.map(cleanTag),...cwlStats.keys(),...cwStats.keys()]);
  const summaries=new Map();
  for(const tag of tags){
    if(!tag)continue;
    const cwl=cwlStats.get(tag)||null,cwForm=cwStats.get(tag)||null;
    const cwlObserved=!!cwl&&(cwl.performed+cwl.missedKnown)>0;
    const cwObserved=!!cwForm&&(cwForm.performed+cwForm.missedKnown)>0;
    const source=cwlObserved?"cwl":cwObserved?"cw":null;
    const selected=source==="cwl"?cwl:source==="cw"?cwForm:null;
    summaries.set(tag,{
      tag,source,
      label:source==="cwl"?"Letzte CWL":source==="cw"?"Letzte "+cw.length+" CWs":"Keine Formdaten",
      score:selected?.formIndex??null,performance:selected?.performanceIndex??null,
      reliability:selected?.reliability??null,missedKnown:selected?.missedKnown??0,
      performed:selected?.performed??0,comparable:selected?.attacks??0,
      triples:selected?.triples??0,quality:selected?.quality||"keine Daten",
      cwl,cw:cwForm,
      lastCwlFrom:lastRun?.from||null,lastCwlTo:lastRun?.to||null,
      cwWarCount:cw.length,hasCwlEvidence:cwlObserved,
      reliabilityComplete:selected?.reliabilityComplete??false,
      reliabilityProvisional:selected?.reliabilityProvisional??false,
      formProvisional:selected?.formProvisional??false
    });
  }
  return {byTag:summaries,lastCwlRun:lastRun,cwWarCount:cw.length};
}
