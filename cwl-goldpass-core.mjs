// Goldpass preview: evidence only, no plan mutations or official draw persistence.
import {tagOf} from "./cwl-live-core.mjs?v=1.31.2";
const validTag=t=>/^#[0289PYLQGRJCUV]{3,15}$/.test(t);
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
export const DEFAULT_RAFFLE_RULES=Object.freeze({minimumType:"none",minimum:0,base:1,one:0,two:0,three:2,perStar:0,requireDiscord:false});
export const RAFFLE_PRESETS=Object.freeze({
 balanced:Object.freeze({...DEFAULT_RAFFLE_RULES,base:0,three:1,perAttack:1,highBonus:1,perfectBonus:1}),
 performance:Object.freeze({...DEFAULT_RAFFLE_RULES,base:0,three:2,perAttack:1,highBonus:1,perfectBonus:1}),
 participation:Object.freeze({...DEFAULT_RAFFLE_RULES,base:0,three:1,perAttack:2,highBonus:0,perfectBonus:0}),
 october:Object.freeze({...DEFAULT_RAFFLE_RULES,minimumType:"triples",minimum:4,base:0,three:1,requireDiscord:true,perAttack:0,highBonus:0,perfectBonus:0})
});
export function starThresholds(warCount){return warCount===5?{high:14,perfect:15}:{high:19,perfect:21}}
export function raffleTicketBreakdown(p,r,warCount){
 const {high,perfect}=starThresholds(warCount);
 return [
  ["Startlose",r.base||0],["Angriffe",(r.perAttack||0)*p.attacks],
  ["1★",r.one*p.one],["2★",r.two*p.two],["3★",r.three*p.three],
  ["Gesamtsterne",r.perStar*p.stars],
  ["ab "+high+"★",p.stars>=high?(r.highBonus||0):0],
  ["ab "+perfect+"★",p.stars>=perfect?(r.perfectBonus||0):0]
 ].filter(([,n])=>n>0);
}
export function normalizeRaffleRules(input={}){
 const r={...DEFAULT_RAFFLE_RULES,...input,perAttack:input.perAttack??0,highBonus:input.highBonus??0,perfectBonus:input.perfectBonus??0};
 if(!["none","triples","stars","attacks"].includes(r.minimumType))throw Error("invalid_minimum");
 const limit=r.minimumType==="stars"?21:r.minimumType==="none"?0:7;
 if(!integer(r.minimum,0,limit)||!["base","one","two","three","perStar","perAttack","highBonus","perfectBonus"].every(k=>integer(r[k],0,100))||
    typeof r.requireDiscord!=="boolean")throw Error("invalid_weights");
 return Object.fromEntries([...Object.keys(DEFAULT_RAFFLE_RULES),"perAttack","highBonus","perfectBonus"].map(k=>[k,r[k]]));
}
// Compare all persisted rule fields, not just ticket weights. Missing
// optional legacy fields normalize to zero, never to new preset values.
export function rafflePresetKey(r){
 try{const n=normalizeRaffleRules(r);return Object.entries(RAFFLE_PRESETS).find(([,p])=>{
  const expected=normalizeRaffleRules(p);return Object.keys(expected).every(k=>expected[k]===n[k])
 })?.[0]||"custom"}catch{return "custom"}
}
export function collectRaffleEvidence(snapshot,expectedClan){
 const own=tagOf(expectedClan),season=snapshot?.season,rounds=snapshot?.rounds;
 if(!validTag(own)||snapshot?.clanTag!==own||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(season||"")||
    !Array.isArray(rounds))return null;
 const count=[5,7].includes(snapshot.warCount)?snapshot.warCount:null;
 const byTag=new Map(),seen=new Set(),days=new Set(),invalidDays=[];
 let ended=0,observed=0;
 for(const r of rounds){
  const war=tagOf(r?.warTag);
  if(!r?.available||!["inWar","warEnded"].includes(r.state))continue;
  const members=r.clan?.members,enemies=r.opponent?.members;
  if(!integer(r.day,1,count||7)||days.has(r.day)||!validTag(war)||seen.has(war)||
    r.clan?.tag!==own||!integer(r.teamSize,1,50)||!Array.isArray(members)||members.length!==r.teamSize||
    !Array.isArray(enemies)||enemies.length!==r.teamSize){invalidDays.push(r.day);continue}
  const ownTags=members.map(m=>tagOf(m?.tag)),enemyTags=enemies.map(m=>tagOf(m?.tag)),targets=new Set(enemyTags);
  if([...ownTags,...enemyTags].some(t=>!validTag(t))||new Set(ownTags).size!==r.teamSize||targets.size!==r.teamSize||
    ownTags.some(t=>targets.has(t))){invalidDays.push(r.day);continue}
  days.add(r.day);seen.add(war);observed++;
  let complete=r.state==="warEnded";
  for(const m of members){
   const t=tagOf(m.tag);
   let p=byTag.get(t);
   if(!p){p={tag:t,name:String(m.name||t).slice(0,80),appearances:0,attacks:0,stars:0,one:0,two:0,three:0,unknown:0,missed:0};byTag.set(t,p)}
   p.appearances++;
   const a=m.attacks;
   if(!Array.isArray(a)||a.length>1){p.unknown++;complete=false;continue}
   if(!a.length){if(r.state==="warEnded")p.missed++;else p.unknown++;continue}
   const x=a[0];
   if(tagOf(x?.attackerTag)!==t||!targets.has(tagOf(x?.defenderTag))||!integer(x?.stars,0,3)||
      typeof x.destructionPercentage!=="number"||!Number.isFinite(x.destructionPercentage)||
      x.destructionPercentage<0||x.destructionPercentage>100){p.unknown++;complete=false;continue}
   p.attacks++;p.stars+=x.stars;
   if(x.stars===1)p.one++;if(x.stars===2)p.two++;if(x.stars===3)p.three++;
   // Clan total stars are NOT the sum of all attacks, so cannot prove coverage.
  }
  if(complete)ended++;else if(r.state==="warEnded")invalidDays.push(r.day);
 }
 return {season,clanTag:own,warCount:count,observed,ended,invalidDays,
  complete:count!==null&&ended===count&&invalidDays.length===0,players:[...byTag.values()]};
}
export function rafflePreview(evidence,input={},eligibility={}){
 const rules=normalizeRaffleRules(input);
 if(!evidence||!Array.isArray(evidence.players))throw Error("missing_evidence");
 const ids=new Set();
 const rows=evidence.players.map(p=>{
  if(!validTag(p.tag)||ids.has(p.tag)||!integer(p.appearances,1,7)||!integer(p.attacks,0,p.appearances)||
    !integer(p.stars,0,21)||!["one","two","three"].every(k=>integer(p[k],0,p.attacks))||
    p.one+p.two+p.three>p.attacks||p.stars!==p.one+2*p.two+3*p.three)throw Error("invalid_player_evidence");
  ids.add(p.tag);
  const decision=Object.hasOwn(eligibility,p.tag)?eligibility[p.tag]:{};
  const e=decision||{};
  const metric=rules.minimumType==="triples"?p.three:rules.minimumType==="stars"?p.stars:rules.minimumType==="attacks"?p.attacks:0;
  let reason="";
  if(e.organizer===true)reason="Veranstalter ausgeschlossen";
  else if(e.excluded===true)reason="Manuell ausgeschlossen";
  else if(rules.requireDiscord&&e.discord!==true)reason="Discord nicht bestätigt";
  else if(metric<rules.minimum&&e.override!==true)reason="Mindestleistung nicht erreicht";
  const tickets=reason?0:raffleTicketBreakdown(p,rules,evidence.warCount).reduce((sum,[,n])=>sum+n,0);
  if(!reason&&!tickets)reason="Keine Lose nach aktueller Regel";
  return {...p,eligible:!reason,reason,tickets,decision:{organizer:e.organizer===true,excluded:e.excluded===true,discord:e.discord===true,override:e.override===true}};
 });
 const total=rows.reduce((n,p)=>n+p.tickets,0);
 return {rules,total,rows:rows.map(p=>({...p,probability:total?p.tickets/total:0})),
  readyForReview:evidence.complete===true&&total>0};
}
// Unbiased test-draw primitive only. Official persistence/owner transaction
// must be added separately; no UI button may imply this alone is official.
export function sampleRaffle(preview,cryptoSource=globalThis.crypto){
 const total=preview?.total,rows=preview?.rows;
 if(!integer(total,1,0xffffffff)||!Array.isArray(rows)||
    rows.some(p=>!integer(p.tickets,0,total))||rows.reduce((n,p)=>n+p.tickets,0)!==total||
    typeof cryptoSource?.getRandomValues!=="function")throw Error("invalid_draw");
 const limit=Math.floor(0x100000000/total)*total,buf=new Uint32Array(1);
 let n;do{cryptoSource.getRandomValues(buf);n=buf[0]}while(n>=limit);
 const ticket=n%total;let pos=ticket;
 for(const p of rows){if(pos<p.tickets)return {winnerTag:p.tag,ticket,total};pos-=p.tickets}
 throw Error("invalid_draw");
}
