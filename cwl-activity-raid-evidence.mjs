// Fixture-only raid evidence evaluator. Not wired into collector, campaign
// storage or eligibility UI until the authenticated capability probe passes.
// Callers must bind observations to one verified clan and one campaign roster.
const tag=/^#[0289PYLQGRJCUV]{3,15}$/;
const integer=x=>Number.isSafeInteger(x)&&x>=0;
function utc(value){
 if(typeof value!=="string")return null;
 const compact=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\.\d{3})?Z$/.exec(value);
 const s=compact?compact[1]+"-"+compact[2]+"-"+compact[3]+"T"+compact[4]+":"+compact[5]+":"+compact[6]+(compact[7]||".000")+"Z":value;
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(s))return null;
 const t=Date.parse(s);
 return Number.isFinite(t)&&new Date(t).toISOString()===(s.includes(".")?s:s.replace(/Z$/,".000Z"))?t:null;
}
function interval(row){
 const start=utc(row?.startTime),end=utc(row?.endTime);
 return start!==null&&end!==null&&start<end?{start,end,key:start+"|"+end}:null;
}
const unknown=()=>({value:null,coverage:"unknown"});
function total(rows,field,complete){
 if(!rows.length)return unknown();
 const value=rows.reduce((sum,row)=>sum+row[field],0);
 if(!Number.isSafeInteger(value))return unknown();
 return {value,coverage:complete?"complete":"lower_bound"};
}
export function evaluateRaidEvidence({clanTag,playerTag,startTime,endTime,expectedWeekends=[],scheduleVerified=false,observations=[]}={}){
 if(!tag.test(clanTag??"")||!tag.test(playerTag??"")||!Array.isArray(expectedWeekends)||!Array.isArray(observations)||typeof scheduleVerified!=="boolean")throw Error("invalid_raid_context");
 const window=interval({startTime,endTime});
 if(!window)throw Error("invalid_raid_window");
 const expected=new Map();
 for(const raw of expectedWeekends){
  const x=interval(raw);
  if(!x)throw Error("invalid_raid_schedule");
  if(x.start>=window.start&&x.end<=window.end)expected.set(x.key,x);
 }
 const ordered=[...expected.values()].sort((a,b)=>a.start-b.start||a.end-b.end);
 if(ordered.some((x,i)=>i>0&&x.start<ordered[i-1].end))throw Error("overlapping_raid_schedule");
 // Never derive a complete denominator from the returned list itself.
 const seen=new Map(),conflicts=new Set();
 let unexpected=0;
 for(const obs of observations){
  if(obs?.clanTag!==clanTag)continue;
  const season=obs.season,x=interval(season);
  if(!x||x.start<window.start||x.end>window.end||season.state!=="ended")continue;
  if(!expected.has(x.key)){unexpected++;continue}
  if(!Array.isArray(season.members))continue;
  const members=season.members.filter(m=>m?.tag===playerTag);
  if(members.length!==1){
   if(members.length>1){conflicts.add(x.key);seen.delete(x.key)}
   continue;
  }
  const m=members[0],limit=m.attackLimit+m.bonusAttackLimit;
  if(!integer(m.attacks)||!integer(m.attackLimit)||!integer(m.bonusAttackLimit)||!Number.isSafeInteger(limit)||limit<=0||m.attacks>limit){
   conflicts.add(x.key);seen.delete(x.key);continue;
  }
  const row={attacks:m.attacks,limit,gold:integer(m.capitalResourcesLooted)?m.capitalResourcesLooted:null};
  if(conflicts.has(x.key))continue;
  const prior=seen.get(x.key);
  if(prior&&(prior.attacks!==row.attacks||prior.limit!==row.limit||(prior.gold!==null&&row.gold!==null&&prior.gold!==row.gold))){
   conflicts.add(x.key);seen.delete(x.key);continue;
  }
  seen.set(x.key,{...row,gold:row.gold??prior?.gold??null});
 }
 const rows=[...seen.values()],gold=rows.filter(x=>x.gold!==null);
 const complete=scheduleVerified&&expected.size>0&&rows.length===expected.size&&unexpected===0;
 const attacks=total(rows,"attacks",complete),limits=total(rows,"limit",complete);
 const percent=complete&&attacks.coverage==="complete"&&limits.coverage==="complete"&&limits.value>0?
  {value:100*attacks.value/limits.value,coverage:"complete"}:unknown();
 return {evidence:{raidAttacks:attacks,capitalGold:total(gold,"gold",complete&&gold.length===rows.length),raidParticipationPct:percent},
  coverage:{expectedWeekends:expected.size,observedWeekends:rows.length,goldWeekends:gold.length,conflictingWeekends:conflicts.size,unexpectedWeekends:unexpected,scheduleVerified}};
}
