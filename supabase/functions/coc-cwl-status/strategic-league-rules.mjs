// Server-only, manually reviewed in-game evidence. Bind to a witnessed
// own war as well as app tenant, month, and format (two CWLs may share a month).
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TAG=/^#[0289PYLQGRJCUV]{3,15}$/;
const SEASON=/^\d{4}-(0[1-9]|1[0-2])$/;
const LEAGUES=new Set(["Legend League",...["Bronze","Silver","Gold","Crystal","Master","Champion","Titan"].flatMap(l=>["I","II","III"].map(t=>l+" "+t))]);
const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
export function resolveReviewedLeagueRules({records,clanId,clanTag,season,teamSize,observedAt,ownWarTags}={}){
 if(typeof records!=="string"||records.length>24000||!UUID.test(clanId||"")||!TAG.test(clanTag||"")||!SEASON.test(season||"")||
 ![15,30].includes(teamSize)||!Number.isFinite(observedAt)||!Array.isArray(ownWarTags))return null;
 let all;try{all=JSON.parse(records)}catch{return null}
 if(!Array.isArray(all)||all.length>100)return null;
 const matching=all.filter(r=>r?.clanId===clanId&&r.clanTag===clanTag&&r.season===season&&r.teamSize===teamSize&&ownWarTags.includes(r.anchorWarTag));
 if(matching.length!==1)return null;
 const r=matching[0],at=Date.parse(r.verifiedAt);
 if(r.source!=="in_game_current_group"||!LEAGUES.has(r.league)||r.fullGroupSize!==8||
 !TAG.test(r.anchorWarTag)||!int(r.promotionPlaces,0,7)||!int(r.demotionPlaces,0,7)||r.promotionPlaces+r.demotionPlaces>=8||
 typeof r.verifiedAt!=="string"||!Number.isFinite(at)||at>observedAt||new Date(at).toISOString()!==r.verifiedAt||r.verifiedAt.slice(0,7)!==season||
 (r.league==="Legend League"?r.promotionPlaces!==0:r.promotionPlaces===0)||
 (r.league==="Bronze III"&&r.demotionPlaces!==0))return null;
 return {verified:true,league:r.league,season,fullGroupSize:8,promotionPlaces:r.promotionPlaces,demotionPlaces:r.demotionPlaces,
 source:"in_game_current_group",verifiedAt:r.verifiedAt};
}
