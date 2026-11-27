// Optional phase of the existing authenticated collector. The server-only
// allowlist is empty by default. Publish only the separate derived snapshot,
// never the approved profile or pending human proposals.
import "../../../cwl-planning-core.js";
import {projectStrategicGroup} from "../coc-cwl-status/strategic-projection.mjs";
import {automaticGrant,buildAutomaticStrategicCandidate} from "./collector-strategic-cycle.mjs";
export async function loadAutomaticContext({rest,settings,clanId,clanTag,records}){
 if(!records||!records.includes(clanId))return null;
 const [clans,saved,review]=await Promise.all([
  rest(settings,"cwl_clans?select=id,clash_tag,owner_user_id&id=eq."+encodeURIComponent(clanId)+"&limit=1"),
  rest(settings,"cwl_cloud_profiles?select=revision,profile_json&clan_id=eq."+encodeURIComponent(clanId)+"&limit=1"),
  rest(settings,"cwl_plan_review_state?select=cycle_id,season,locked&clan_id=eq."+encodeURIComponent(clanId)+"&limit=1")
 ]);
 const c=clans[0],p=saved[0],r=review[0];
 if(!c||c.clash_tag!==clanTag||!automaticGrant(records,clanId,clanTag,c.owner_user_id)||
    p?.profile_json?.config?.strategicAuto!==true||!r?.cycle_id)return null;
 const rows=await rest(settings,"cwl_strategic_assignments?select=base_revision,cycle_id,snapshot&clan_id=eq."+encodeURIComponent(clanId)+"&limit=1");
 const last=rows[0];
 return {saved:{...p,automatic_revision:last?.base_revision??null,automatic_snapshot:last?.cycle_id===r.cycle_id&&last.snapshot?.ruleKey===globalThis.CWLPlanningCore.strategicRuleKey(p.profile_json)?last.snapshot:null},review:r,clanId,clanTag,ownerId:c.owner_user_id};
}
async function readAll(rest,settings,table,query,max){
 const rows=[];
 for(let offset=0;offset<max;offset+=500){
  const page=await rest(settings,table+"?"+query+"&limit=500&offset="+offset);
  if(!Array.isArray(page))throw Error("invalid_page");
  rows.push(...page);if(page.length<500)return rows;
 }
 throw Error("history_limit"); // never silently truncate
}
export async function calculateAutomatic({rest,settings,context,scan,deadline}){
 if(Date.now()>deadline-35000||!scan.strategicGroup||!(scan.strategicResults instanceof Map))return {ok:false,reason:"budget_or_group"};
 const {clanId,clanTag}=context,scope="clan_id=eq."+encodeURIComponent(clanId);
 const cutoff=encodeURIComponent(new Date(Date.now()-30*86400000).toISOString());
 // Only this one app tenant. No service-role expansion to partner data.
 const wars=await readAll(rest,settings,"cwl_stat_wars",scope+"&select=clan_id,war_key,war_type,started_at,source,source_clash_tag,updated_at,finalized,missed_log_complete&finalized=eq.true&source_clash_tag=eq."+encodeURIComponent(clanTag)+"&started_at=gte."+cutoff+"&order=war_key.asc",500);
 const keys=wars.map(w=>w.war_key);
 if(keys.some(k=>typeof k!=="string"||!/^[A-Za-z0-9:#_-]{1,100}$/.test(k)))return {ok:false,reason:"history_key"};
 const attacks=[],missedEvents=[];
 for(let i=0;i<keys.length;i+=20){
  if(Date.now()>deadline-15000)return {ok:false,reason:"budget"};
  const f=scope+"&war_key=in.("+keys.slice(i,i+20).map(k=>encodeURIComponent('"'+k+'"')).join(",")+")";
  const [a,m]=await Promise.all([
   readAll(rest,settings,"cwl_stat_attacks",f+"&select=clan_id,war_key,attacker_tag,attack_order,attacker_th,defender_tag,defender_th,stars,destruction,created_at&order=war_key.asc,attacker_tag.asc,attack_order.asc",4000),
   readAll(rest,settings,"cwl_stat_missed",f+"&select=clan_id,war_key,player_tag,missed_count,created_at&order=war_key.asc,player_tag.asc",2000)
  ]);attacks.push(...a);missedEvents.push(...m);
 }
 const now=Date.now();
 const projection=projectStrategicGroup({group:scan.strategicGroup,results:scan.strategicResults,clanTag,season:context.review.season,observedAt:scan.strategicObservedAt,readStartedAt:scan.strategicStartedAt});
 return buildAutomaticStrategicCandidate({...context,projection,historyRows:{wars,attacks,missedEvents},liveSnapshots:scan.snaps,core:globalThis.CWLPlanningCore,now});
}

export async function publishAutomatic({rest,settings,context,result,deadline}){
 if(!result.ok||!result.changed||Date.now()>=result.validUntil||Date.now()>deadline-12000)return false;
 const data=await rest(settings,"rpc/cwl_publish_strategic_assignment",{method:"POST",rows:{
  p_clan:context.clanId,p_owner:context.ownerId,p_tag:context.clanTag,p_cycle:result.expectedCycle,
  p_revision:result.expectedRevision,p_valid_until:new Date(result.validUntil).toISOString(),p_snapshot:result.next
 },returnData:true});
 return data===true;
}
