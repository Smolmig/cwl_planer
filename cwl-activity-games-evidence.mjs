// Fixture-only account-wide cumulative achievement evidence. No polling,
// storage, campaign qualification wiring or assertion of clan/event ownership.
const tag=x=>typeof x==="string"&&/^#[0289PYLQGRJCUV]{3,15}$/.test(x);
function utc(s){
 if(typeof s!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s))return null;
 const t=Date.parse(s);
 return Number.isFinite(t)&&new Date(t).toISOString()===s?t:null;
}
const unknown=()=>({value:null,coverage:"unknown"});
export function evaluateGamesAchievement({playerTag,startTime,endTime,observations=[]}={}){
 const start=utc(startTime),end=utc(endTime);
 if(!tag(playerTag)||start===null||end===null||end<=start||!Array.isArray(observations))throw Error("invalid_games_context");
 const points=new Map();
 let conflicts=0,rejected=0;
 for(const o of observations){
  if(o?.verified!==true||o.playerTag!==playerTag||o.profile?.tag!==playerTag)continue;
  const time=utc(o.observedAt);
  if(time===null){rejected++;continue}
  if(time<start||time>end)continue;
  const rows=Array.isArray(o.profile.achievements)?o.profile.achievements.filter(x=>x?.name==="Games Champion"):[];
  const value=rows[0]?.value;
  if(rows.length!==1||!Number.isSafeInteger(value)||value<0){rejected++;continue}
  if(points.has(time)&&points.get(time)!==value){conflicts++;continue}
  points.set(time,value);
 }
 const rows=[...points].sort((a,b)=>a[0]-b[0]);
 const reset=rows.some((x,i)=>i>0&&x[1]<rows[i-1][1]);
 const enough=rows.length>=2&&!reset&&!conflicts&&!rejected;
 // Even an exact boundary pair does not prove a clan-specific score or
 // eliminate provider delays or unobserved resets. Never mark as complete.
 const delta=enough?rows.at(-1)[1]-rows[0][1]:null;
 return {accountWideAchievementDelta:delta===null?unknown():{value:delta,coverage:"lower_bound"},
  evidence:{clanGamesPoints:unknown()},
  coverage:{scope:"account",observedSnapshots:rows.length,exactStart:points.has(start),exactEnd:points.has(end),reset,conflicts,rejected}};
}
