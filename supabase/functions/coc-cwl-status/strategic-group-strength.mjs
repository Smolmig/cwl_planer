// Minimal per-clan summaries of the already authorized league group.
// Registered roster is not a confirmed daily lineup. No external fan-out.
const tag=x=>typeof x==="string"?x.trim().toUpperCase():"";
const validTag=x=>/^#[0289PYLQGRJCUV]{3,15}$/.test(x);
const th=x=>Number.isInteger(x)&&x>=3&&x<=30;
function distribution(levels){
 const result={};for(const t of levels)result[t]=(result[t]||0)+1;return result;
}
function evidence(profiles,kind){
 let n=0,stars=0,players=0;
 for(const p of profiles){
  const c=p[kind]?.byTownHall?.find(x=>x.relation==="same");
  if(!Number.isInteger(c?.n)||c.n<=0||!Number.isFinite(c.averageStars)||c.averageStars<0||c.averageStars>3)continue;
  n+=c.n;stars+=c.n*c.averageStars;players++;
 }
 return {n,players,average:n?stars/n:null,adjusted:n?(stars+12*2.5)/(n+12):null};
}
export function summarizeGroupStrength({clans,analyzed,teamSize,own}){
 const rows=clans.map(c=>{
  const clanTag=tag(c.tag),raw=Array.isArray(c.members)?c.members:[],ids=raw.map(m=>tag(m.tag)),levels=raw.map(m=>m.townhallLevel??m.townHallLevel);
  const valid=raw.length>=teamSize&&raw.length<=50&&new Set(ids).size===ids.length&&ids.every(validTag)&&levels.every(th);
  const top=valid?[...levels].sort((a,b)=>b-a).slice(0,teamSize):[];
  const profiles=analyzed.profiles.filter(p=>p.clanTag===clanTag);
  const attack=evidence(profiles,"attack"),defense=evidence(profiles,"defense");
  const mean=top.length?top.reduce((s,x)=>s+x,0)/top.length:null;
  // Roster-based upper-envelope prior, plus heavily shrunk same-TH observations.
  // Use rates, not total stars. Defense means stars conceded; lower is better.
  // No forecast of a win or actual deployment.
  const index=mean===null?null:mean+.35*((attack.adjusted??2.5)-2.5)-.25*((defense.adjusted??2.5)-2.5);
  return {clanTag,name:typeof c.name==="string"?c.name.slice(0,80):clanTag,own:clanTag===own,
   registeredCount:valid?raw.length:null,topRhs:distribution(top),meanTopRh:mean,attack,defense,index};
 }).sort((a,b)=>(b.index??-Infinity)-(a.index??-Infinity)||a.clanTag.localeCompare(b.clanTag));
 return rows.map((r,i)=>({...r,rank:r.index===null?null:1+rows.filter(s=>s.index!==null&&s.index>r.index+1e-9).length}));
}
