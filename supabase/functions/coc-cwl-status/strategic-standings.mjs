// #44 conservative mathematical placement bounds; pure shadow module.
// Official rules vary by league/season. Caller must supply verified rules for
// the actual league, not assume the last two populated positions are relegated.
// Source: https://support.supercell.com/clash-of-clans/en/articles/cwl-matchmaking-and-groups.html
// https://support.supercell.com/clash-of-clans/en/articles/clan-war-leagues-promotion-demotion.html
const TAG=/^#[0289PYLQGRJCUV]{3,15}$/;
const tag=v=>typeof v==="string"?v.trim().toUpperCase():"";
const int=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
const pct=v=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=100;
const finite=v=>typeof v==="number"&&Number.isFinite(v);
const cmp=(a,b)=>a.stars-b.stars||a.destruction-b.destruction;
const pair=(a,b)=>[a,b].sort().join("|");
const add=(a,s,d)=>{a.stars+=s;a.destruction+=d};
function outcome(best,worst,first,last){
 if(first>last)return "not_applicable";
 if(best>=first&&worst<=last)return "guaranteed";
 if(worst<first||best>last)return "impossible";
 return "open";
}
export function assessStrategicStandings({snapshot,selectedClanTag,season,league,asOf,rules,teamSize}={}){
 const own=tag(selectedClanTag);
 if(!TAG.test(own)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(season||"")||
   !snapshot||snapshot.season!==season||tag(snapshot.clanTag)!==own||
   !finite(asOf)||!finite(snapshot.observedAt)||snapshot.observedAt>asOf||
   !Array.isArray(snapshot.clans)||!Array.isArray(snapshot.rounds)||![15,30].includes(teamSize))
  throw Error("invalid_standings_scope");
 const clans=snapshot.clans.map(c=>tag(c?.tag)),n=clans.length;
 if(![6,8].includes(n)||new Set(clans).size!==n||!clans.includes(own)||clans.some(t=>!TAG.test(t)))throw Error("invalid_group_clans");
 const leagueRules=rules?.verified===true&&typeof league==="string"&&league.length>0&&rules.league===league&&rules.season===season&&
  rules.fullGroupSize===8&&int(rules.promotionPlaces,0,8)&&int(rules.demotionPlaces,0,8)&&rules.promotionPlaces+rules.demotionPlaces<=8&&
  typeof rules.source==="string"&&rules.source.length>0;
 const blank=()=>({stars:0,destruction:0});
 const teams=new Map(clans.map(t=>[t,{tag:t,min:blank(),max:blank(),confirmed:blank(),completed:0,unknown:0}]));
 const records=[],pairCounts=new Map(),dayCounts=new Map(),warCounts=new Map(),rounds=new Set();
 let invalid=0,missing=0,liveMatches=0;
 for(const round of snapshot.rounds){
  if(!int(round?.day,1,n-1)||rounds.has(round.day)||!Array.isArray(round.matches)||round.matches.length>n/2)throw Error("invalid_group_rounds");
  rounds.add(round.day);
  for(const w of round.matches){
   if(!w?.available){missing++;continue}
   const a=tag(w.clan?.tag),b=tag(w.opponent?.tag),k=tag(w.warTag);
   if(!teams.has(a)||!teams.has(b)||a===b||!TAG.test(k)){invalid++;continue}
   const p=pair(a,b);
   pairCounts.set(p,(pairCounts.get(p)||0)+1);warCounts.set(k,(warCounts.get(k)||0)+1);
   for(const t of [a,b]){const key=round.day+"|"+t;dayCounts.set(key,(dayCounts.get(key)||0)+1)}
   records.push({w,a,b,k,p,day:round.day});
  }
 }
 const used=new Set(),cap=teamSize*3,maxD=teamSize*100;
 const unknown=(t)=>{const x=teams.get(t);add(x.max,cap+10,maxD);x.unknown++};
 for(const {w,a,b,k,p,day} of records){
  if(pairCounts.get(p)!==1||warCounts.get(k)!==1||dayCounts.get(day+"|"+a)!==1||dayCounts.get(day+"|"+b)!==1||
     w.teamSize!==teamSize||!["preparation","inWar","warEnded"].includes(w.state)||
     (w.attacksPerMember!==undefined&&w.attacksPerMember!==1)){invalid++;continue}
  const sides=[w.clan,w.opponent],valid=sides.every(s=>int(s.stars,0,cap)&&pct(s.destructionPercentage));
  if(w.state==="warEnded"&&!valid){invalid++;continue}
  used.add(p);
  if(w.state==="inWar")liveMatches++;
  if(w.state==="warEnded"){
   const ss=sides.map(s=>({stars:s.stars,destruction:Math.round(s.destructionPercentage*teamSize*100)}));
   // integer hundredths of cumulative destruction, identical war sizes.
   for(const [i,t] of [a,b].entries()){
    const x=teams.get(t),s=ss[i],bonus=cmp(s,ss[1-i])>0?10:0;
    add(x.min,s.stars+bonus,s.destruction);add(x.max,s.stars+bonus,s.destruction);add(x.confirmed,s.stars+bonus,s.destruction);x.completed++;
   }
  }else{
   for(const [i,t] of [a,b].entries()){
    const x=teams.get(t),s=sides[i];
    // Stars cannot decrease, but a higher-star best attack can replace a
    // higher-destruction lower-star attack. Never use live destruction as a lower bound.
    if(w.state==="inWar"&&valid)add(x.min,s.stars,0);
    add(x.max,cap+10,maxD*100);
   }
  }
 }
 // Missing matchup gets the entire possible range; no invented zero result.
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
  if(used.has(pair(clans[i],clans[j])))continue;
  for(const t of [clans[i],clans[j]]){const x=teams.get(t);add(x.max,cap+10,maxD*100);x.unknown++}
 }
 const all=[...teams.values()],x=teams.get(own),other=all.filter(t=>t.tag!==own);
 // Strict comparison for certain lead, equality may still be resolved randomly.
 const best=1+other.filter(t=>cmp(t.min,x.max)>0).length;
 const worst=1+other.filter(t=>cmp(t.max,x.min)>=0).length;
 const promotionLast=leagueRules?Math.min(n,rules.promotionPlaces):null;
 const demotionFirst=leagueRules?9-rules.demotionPlaces:null; // unfilled rank slots stay unfilled
 const promotion=leagueRules?outcome(best,worst,1,promotionLast):"unknown_rules";
 const demotion=leagueRules?outcome(best,worst,demotionFirst,n):"unknown_rules";
 const complete=all.every(t=>t.completed===n-1)&&invalid===0;
 const quality=invalid||used.size<n*(n-1)/2?"partial":"schedule_known";
 // Range is deliberately conservative, not all extrema jointly attainable.
 // Mode suggestions require more than a merely mathematically possible risk.
 const current=1+other.filter(t=>cmp(t.min,x.min)>0).length;
 const confirmedRank=1+other.filter(t=>cmp(t.confirmed,x.confirmed)>0).length;
 const confirmedRankWorst=1+other.filter(t=>cmp(t.confirmed,x.confirmed)>=0).length;
 return {season,league,selectedClanTag:own,asOf,observedAt:snapshot.observedAt,teamSize,liveMatches,calibrated:false,
  bounds:{best,worst},currentLowerBoundRank:current,confirmedRank,confirmedRankWorst,promotion,demotion,promotionLast,demotionFirst,
  complete,quality,invalid,missing,knownPairings:used.size,expectedPairings:n*(n-1)/2,
  teams:all.map(t=>({...t,confirmed:{stars:t.confirmed.stars,destruction:t.confirmed.destruction/100},min:{stars:t.min.stars,destruction:t.min.destruction/100},max:{stars:t.max.stars,destruction:t.max.destruction/100}})),
  limitations:["conservative_independent_bounds","no_probability","ties_unresolved","verified_league_rules_required"]};
}
