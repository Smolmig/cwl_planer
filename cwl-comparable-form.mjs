// Descriptive comparable-attack sample, independent of the planner and the
// seven-attack member badge. Not a probability, rank or recommendation.
// We only know opponent Town Hall, NOT historic map position, base progress,
// true first hit, army, hero equipment or the exact moment of each attack.
import {cleanTag} from "./cwl-stats-core.mjs";

const DAY=86400000;
const validStar=n=>Number.isInteger(n)&&n>=0&&n<=3;
const validTh=n=>Number.isInteger(n)&&n>=3&&n<=30;
const round=(number,decimals=0)=>Math.round(number*10**decimals)/10**decimals;

function summarize(rows){
 const n=rows.length;
 const stars=rows.reduce((sum,r)=>sum+r.stars,0);
 const triples=rows.filter(r=>r.stars===3).length;
 return {attacks:n,triples,stars,hitRate:n?round(100*triples/n):null,
   averageStars:n?round(stars/n,2):null};
}

function weighted(rows,halfLifeDays){
 let weight=0,weight2=0,hit=0,stars=0;
 for(const row of rows){
  const w=2**(-row.ageDays/halfLifeDays);
  weight+=w;weight2+=w*w;
  hit+=w*Number(row.stars===3);stars+=w*row.stars;
 }
 return {attacks:rows.length,
  effectiveAttacks:weight2?round(weight*weight/weight2,1):0,
  hitRate:weight?round(100*hit/weight):null,
  averageStars:weight?round(stars/weight,2):null};
}

export function computeComparableForm(wars,attacks,{
 asOf=Date.now(),windowDays=90,recentDays=30,halfLifeDays=30
}={}){
 const now=typeof asOf==="number"?asOf:Date.parse(asOf);
 if(!Number.isFinite(now)||!Number.isFinite(windowDays)||windowDays<=0||
  !Number.isFinite(recentDays)||recentDays<=0||recentDays>windowDays||
  !Number.isFinite(halfLifeDays)||halfLifeDays<=0)
  throw new Error("Ungültiger Zeitraum für die Formanalyse.");
 const sources=new Map((Array.isArray(wars)?wars:[])
  .filter(w=>(w.source!=="api"||w.finalized===true) &&
    (w.war_type==="normal"||w.war_type==="cwl"))
  .map(w=>[w.war_key,w]));
 const data=new Map();
 const summary={periodDays:windowDays,recentDays,halfLifeDays,
  comparableAttacks:0,lowerThExcluded:0,higherThExcluded:0,
  unknownThExcluded:0,players:0,
  mirrorPositionKnown:false,firstHitKnown:false};
 for(const attack of Array.isArray(attacks)?attacks:[]){
  const war=sources.get(attack.war_key),tag=cleanTag(attack.attacker_tag);
  if(!war||!/^#[0289PYLQGRJCUV]{3,15}$/.test(tag)||!validStar(attack.stars))continue;
  const stamp=Date.parse(war.started_at),age=(now-stamp)/DAY;
  if(!Number.isFinite(age)||age<0||age>windowDays)continue;
  if(!data.has(tag))data.set(tag,{
   tag,name:String(attack.attacker_name||tag),rows:[],
   excluded:{lower:0,higher:0,unknown:0},newestWar:null
  });
  const group=data.get(tag);
  if(!group.name||group.name===tag)group.name=String(attack.attacker_name||tag);
  if(!group.newestWar||stamp>Date.parse(group.newestWar))group.newestWar=war.started_at;
  if(!validTh(attack.attacker_th)||!validTh(attack.defender_th)){
   group.excluded.unknown++;summary.unknownThExcluded++;
  }else if(attack.defender_th<attack.attacker_th){
   group.excluded.lower++;summary.lowerThExcluded++;
  }else if(attack.defender_th>attack.attacker_th){
   group.excluded.higher++;summary.higherThExcluded++;
  }else{
   group.rows.push({stars:attack.stars,ageDays:age,type:war.war_type,source:war.source});
   summary.comparableAttacks++;
  }
 }
 const profiles=new Map();
 for(const [tag,group] of data){
  const recent=group.rows.filter(r=>r.ageDays<=recentDays);
  const cw=group.rows.filter(r=>r.type==="normal");
  const cwl=group.rows.filter(r=>r.type==="cwl");
  const last30=summarize(recent);
  const last90=summarize(group.rows);
  const weighted90=weighted(group.rows,halfLifeDays);
  const newestAge=group.newestWar?Math.max(0,(now-Date.parse(group.newestWar))/DAY):null;
  let quality="none";
  if(group.rows.length){
   quality=newestAge>recentDays?"stale":
    weighted90.effectiveAttacks>=12&&last30.attacks>=5?"solid":
    weighted90.effectiveAttacks>=5&&last30.attacks>=2?"trend":"limited";
  }
  profiles.set(tag,{
   tag,name:group.name,newestWar:group.newestWar,newestAgeDays:newestAge===null?null:round(newestAge,1),
   last30,last90,weighted90,normal90:summarize(cw),cwl90:summarize(cwl),
   quality,excluded:{...group.excluded},
   apiAttacks:group.rows.filter(r=>r.source==="api").length,
   importedAttacks:group.rows.filter(r=>r.source==="import").length,
   mirrorKnown:false,firstHitKnown:false
  });
 }
 summary.players=profiles.size;
 return {profiles,summary};
}
