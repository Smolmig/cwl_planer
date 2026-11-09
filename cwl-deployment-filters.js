/* Read-only selectors for the current CWL Einsatzverteilung (#187).
 * No plan/solver mutation. "Ausgeführt" only means a verified attack, never a lock.
 * Exported for Node regression tests and available to the classic Cloud UI. */
(function(scope){
 "use strict";
 const integer=value=>Number.isInteger(value)&&value>=0?value:null;
 const text=value=>String(value||"").trim().toLocaleLowerCase("de");
 const compareNames=(a,b)=>String(a.m?.name||"").localeCompare(String(b.m?.name||""),"de",{numeric:true})||
   String(a.m?.id||"").localeCompare(String(b.m?.id||""),"de");
 const compareNumber=(a,b,desc=false)=>{
  const validA=Number.isFinite(a),validB=Number.isFinite(b);
  if(!validA||!validB)return Number(validB)-Number(validA);
  return desc?b-a:a-b;
 };
 function decorateDeploymentRow(row,{cloud=false,medal=null,medalFresh=false}={}){
  const m=row.m||{};
  const executed=cloud?(!m.playerTag||row.progress?.identifiable===false?null:integer(row.progress?.executed)):integer(row.played);
  const fixed=!!m.fixed,rotating=!!m.participating&&!fixed&&m.cocSyncState!=="former";
  const explicitTarget=!fixed&&Number.isInteger(m.targetDays)&&m.targetDays>=1&&m.targetDays<=7
   ?m.targetDays:null;
  // Explicit user targets win. "Automatisch" has no *fixed* target, but it
  // still has a real current plan. For an Einsatz-status filter, compare
  // completed attacks to that plan instead of excluding all automatic users.
  // The plan projection is dynamic and never persisted as an exact target.
  const planned=integer(row.count);
  const exact=explicitTarget??(planned!==null&&planned>0?planned:null);
  const targetSource=explicitTarget!==null?"fixed":exact!==null?"planned":"none";
  const open=integer(row.open);
  const targetStatus=executed===null?"unknown":exact===null?"unknown":
   executed>=exact?"reached":"open";
  const status=medal?.status==="reached"?"reached":
   !cloud||!medal||!medalFresh||medal.unknown||medal.status==="uncertain"?"unknown":
   medal.status==="not-reachable"?"unreachable":"open";
  const starsRemaining=Number.isFinite(medal?.remainingStars)?Math.max(0,medal.remainingStars):
   Number.isFinite(medal?.stars)?Math.max(0,8-medal.stars):null;
  return {...row,rotating,fixed,exact,explicitTarget,targetSource,targetStatus,
   medalStatus:status,starsRemaining,verifiedAttacks:executed,
   openVerifiedPlan:open,hitRate:cloud?row.progress?.hitRate:null,
   averageStars:cloud?row.progress?.averageStars:null};
 }
 function filterDeploymentRows(rows,{query="",legacy="all",group="all",
  progress="all",medal="all",sort="default"}={}){
  const q=text(query);
  const visible=rows.filter(row=>{
   if(q&&!text(row.m?.name).includes(q)&&!text(row.m?.playerTag).includes(q))return false;
   if(legacy==="zero"&&row.count!==0)return false;
   if(legacy==="played"&&!(row.played>0))return false;
   if(legacy==="future"&&!(row.open>0))return false;
   if(legacy==="fixed"&&!row.fixed)return false; // backwards compatible
   if(group==="rotation"&&!row.rotating)return false;
   if(progress==="target-met"&&row.targetStatus!=="reached")return false;
   if(progress==="target-open"&&row.targetStatus!=="open")return false;
   if(medal==="reached"&&row.medalStatus!=="reached")return false;
   if(medal==="open"&&row.medalStatus!=="open"&&row.medalStatus!=="unreachable")return false;
   return true;
  });
  const sorts={
   "open-asc":r=>r.openVerifiedPlan,"open-desc":r=>r.openVerifiedPlan,
   "stars-asc":r=>r.starsRemaining,"stars-desc":r=>r.starsRemaining,
   "hit-desc":r=>r.hitRate,"avg-desc":r=>r.averageStars,
   "attacks-desc":r=>r.verifiedAttacks
  };
  visible.sort((a,b)=>{
   if(sort==="name")return compareNames(a,b);
   if(sorts[sort]){
    const desc=sort.endsWith("-desc");
    const cmp=compareNumber(sorts[sort](a),sorts[sort](b),desc);
    if(cmp)return cmp;
   }else if(a.count!==b.count)return a.count-b.count;
   return compareNames(a,b);
  });
  return visible;
 }
 const api={decorateDeploymentRow,filterDeploymentRows};
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(scope)scope.CWLDeploymentFilters=api;
})(typeof window!=="undefined"?window:undefined);
