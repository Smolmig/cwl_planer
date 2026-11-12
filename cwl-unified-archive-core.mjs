// Read-only join of two independent CWL archives. No mutation, no date-label joins.
// Group results are keyed by the official season and linked Clash clan tag.
// Manual/imported plans without a verified original season+tag remain separate.
import {summarizeCwlGroup} from "./cwl-group-core.mjs?v=1.18.1";
const seasonValid=s=>/^20\d{2}-(0[1-9]|1[0-2])$/.test(String(s||""));
const normalizeTag=s=>String(s||"").trim().toUpperCase();
const tagValid=s=>/^#[0289PYLQGRJCUV]{3,15}$/.test(normalizeTag(s));
export const archivedPlanIdentity=plan=>{
  const season=plan?.sourceSeason, snapshot=plan?.cwlLive;
  if(!seasonValid(season)||snapshot?.season!==season||!tagValid(snapshot?.clanTag))
    return null;
  return {season,clanTag:normalizeTag(snapshot.clanTag)};
};
const month=season=>{
  const [year,m]=String(season).split("-").map(Number);
  return new Date(Date.UTC(year,m-1,1)).toLocaleDateString("de-AT",
    {month:"long",year:"numeric",timeZone:"UTC"});
};
const create=(id,season,clanTag,label)=>({
  id,season,clanTag,label,group:null,groupRow:null,plans:[],
  dateKey:season||"",timestamp:0
});
export function unifyCwlArchiveSeasons(groupRows=[],savedPlans=[],expectedClanTag=""){
  const expected=tagValid(expectedClanTag)?normalizeTag(expectedClanTag):null;
  const byIdentity=new Map(),entries=[];
  for(const row of (Array.isArray(groupRows)?groupRows:[])){
    const group=summarizeCwlGroup(row?.group_json);
    if(!group||row.season!==group.season||!seasonValid(group.season)||
       !tagValid(group.clanTag)||(expected&&expected!==group.clanTag))continue;
    const id=group.season+"|"+group.clanTag;
    if(byIdentity.has(id))continue;
    const item=create("season:"+id,group.season,group.clanTag,month(group.season));
    item.group=group;item.groupRow=row;
    item.timestamp=Date.parse(row.updated_at)||0;
    byIdentity.set(id,item);entries.push(item);
  }
  for(const [index,plan] of (Array.isArray(savedPlans)?savedPlans:[]).entries()){
    if(!plan||typeof plan!=="object")continue;
    const identity=archivedPlanIdentity(plan);
    const id=identity?.season+"|"+identity?.clanTag;
    let item=identity&&!expected||identity&&expected===identity.clanTag?
      byIdentity.get(id):null;
    if(!item){
      // Only source-verified plans are grouped by season+clan. An imported
      // plan with just a month label cannot be silently treated as API data.
      if(identity&&(!expected||identity.clanTag===expected)){
        item=create("season:"+id,identity.season,identity.clanTag,month(identity.season));
        byIdentity.set(id,item);
      }else{
        item=create("plan:"+String(plan.id||"unknown")+":"+index,
          null,null,String(plan.label||"Archivierter CWL-Plan"));
      }
      entries.push(item);
    }
    item.plans.push(plan);
    item.timestamp=Math.max(item.timestamp,Number(plan.createdAt)||0);
  }
  return entries.sort((a,b)=>{
    if(a.season&&b.season)return b.season.localeCompare(a.season)||
      b.timestamp-a.timestamp;
    if(a.season)return -1;
    if(b.season)return 1;
    return b.timestamp-a.timestamp;
  });
}
