import {evaluateActivityEligibility,evaluateActivityRequirement} from "./cwl-activity-raffle-core.mjs";
const DAY=86400000;
function dateMs(value){
 if(typeof value!=="string"||!/^20\d{2}-\d{2}-\d{2}$/.test(value))throw Error("invalid_date");
 const t=Date.parse(value+"T00:00:00Z");
 if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==value)throw Error("invalid_date");
 return t;
}
export function activityPeriod(start,end){
 const days=(dateMs(end)-dateMs(start))/DAY+1;
 if(days<1||days>366)throw Error("invalid_period");
 return {start,end,days,weeks:days/7};
}
export const ACTIVITY_PRESETS=Object.freeze([
 Object.freeze({id:"balanced",name:"Ausgewogener Grind",description:"Regelmäßige Teilnahme ohne täglichen Pflicht-Grind.",donationsPerWeek:700,warParticipation:0.65,starsPerAttack:2,rankedPct:65,raidPct:75}),
 Object.freeze({id:"active",name:"Aktiver Clan",description:"Für regelmäßige CW-Spieler und aktive Spender.",donationsPerWeek:1000,warParticipation:0.8,starsPerAttack:2.4,rankedPct:80,raidPct:90}),
 Object.freeze({id:"challenge",name:"Grind-Challenge",description:"Ambitioniert, aber unter dem angenommenen Leistungsmaximum.",donationsPerWeek:1500,warParticipation:0.9,starsPerAttack:2.6,rankedPct:90,raidPct:100})
]);
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
export function presetTargets(id,start,end,{normalWars=undefined,ranked=false,raids=false}={}){
 const period=activityPeriod(start,end),p=ACTIVITY_PRESETS.find(x=>x.id===id);
 if(!p)throw Error("invalid_preset");
 // Explicit scenario, not a calendar prediction. Default: two normal wars
 // per week, deduct seven days in each calendar month that overlaps days 1–7.
 // The owner can replace the estimated CW count with their actual schedule.
 let cwlOverlap=0;
 for(let t=dateMs(start);t<=dateMs(end);t+=DAY)if(new Date(t).getUTCDate()<=7)cwlOverlap++;
 const assumedWars=Math.max(0,Math.floor((period.days-cwlOverlap)*2/7));
 const wars=normalWars===undefined?assumedWars:normalWars;
 if(!integer(wars,0,Math.floor(period.days/2)+1))throw Error("invalid_war_count");
 const attacks=wars*2,plannedAttacks=Math.floor(attacks*p.warParticipation);
 const cwStars=Math.floor(plannedAttacks*p.starsPerAttack);
 const donations=Math.max(1,Math.round(p.donationsPerWeek*period.weeks/25)*25);
 const rules=[{metric:"donations",minimum:donations}];
 if(cwStars>0)rules.push({metric:"cwStars",minimum:cwStars});
 if(ranked)rules.push({metric:"rankedParticipationPct",minimum:p.rankedPct});
 if(raids)rules.push({metric:"raidParticipationPct",minimum:p.raidPct});
 return {preset:p.id,period,rules,assumptions:{normalWars:wars,estimated:normalWars===undefined,cwlOverlap,
  maximumAttacks:attacks,maximumStars:attacks*3,plannedAttacks,starsPerAttack:p.starsPerAttack,
  donationsPerWeek:p.donationsPerWeek,rankedPct:p.rankedPct,raidPct:p.raidPct}};
}
export function activityGoalPace(rule,period,nowDate){
 const {days}=activityPeriod(period.start,period.end);
 const elapsed=Math.max(0,Math.min(days,Math.floor((dateMs(nowDate)-dateMs(period.start))/DAY)+1));
 if(typeof rule.minimum!=="number"||rule.metric.endsWith("Pct"))return {elapsed,days,perWeek:null,expected:null};
 return {elapsed,days,perWeek:rule.minimum*7/days,expected:Math.floor(rule.minimum*elapsed/days)};
}
export function campaignPhase(campaign,today){
 activityPeriod(campaign.start,campaign.end);
 const t=dateMs(today);
 if(campaign.official)return "drawn";
 if(t<dateMs(campaign.start))return "scheduled";
 if(t<=dateMs(campaign.end))return "running";
 return "review";
}
export function campaignPreview(campaign,players,today){
 const phase=campaignPhase(campaign,today);
 if(!Array.isArray(players)||new Set(players.map(x=>x.tag)).size!==players.length)throw Error("invalid_players");
 const rows=players.map(p=>{
  const result=evaluateActivityEligibility(campaign.rules,p.evidence,p.marks||{});
  return {...p,...result,results:result.results.map(r=>{
   const rule=campaign.rules.find(x=>x.metric===r.metric);
   return {...r,minimum:rule.minimum,pace:activityGoalPace(rule,campaign,today)};
  })};
 });
 return {phase,rows,qualified:rows.filter(r=>r.status==="qualified").length,unknown:rows.filter(r=>r.status==="unknown").length,
  excluded:rows.filter(r=>r.status==="excluded").length,unmet:rows.filter(r=>r.status==="unmet").length,
  // Never draw while the inclusive final calendar day is still running, nor
  // automatically exclude a player whose progress is unconfirmed.
  ready:phase==="review"&&rows.some(r=>r.status==="qualified")&&!rows.some(r=>r.status==="unknown")};
}
