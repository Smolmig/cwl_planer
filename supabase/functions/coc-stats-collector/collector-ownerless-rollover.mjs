// #227 / Stage 6 DRAFT. Opt-in service-only ownerless CWL rollover.
// Only the already authenticated collector invokes this AFTER an official
// tenant-specific Supercell group observation has been durably persisted.
// No browser input, no plan JSON, no API credential or player data is accepted.
const season=/^20\d{2}-(0[1-9]|1[0-2])$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tag=/^#[0289PYLQGRJCUV]{3,15}$/;
const MIN_PREFLIGHT_BUDGET=14000,MIN_WRITE_BUDGET=8500;

export function ownerlessRolloverPolicy(modeValue,allowedClanValues){
  // There must be TWO independent operator choices before any change:
  // 1) explicit 'apply' mode, 2) explicit per-app-clan UUID allowlist.
  // Unrecognized/empty configuration never enables a write.
  const mode=modeValue==="observe"||modeValue==="apply"?modeValue:"off";
  if(typeof allowedClanValues!=="string"||allowedClanValues.length>1800)
    return {mode:mode==="apply"?"off":mode,allowlist:new Set()};
  const entries=allowedClanValues.split(",").map(x=>x.trim());
  if(entries.some(x=>x&&!uuid.test(x))||entries.length>25)
    return {mode:mode==="apply"?"off":mode,allowlist:new Set()};
  const allowlist=new Set(entries.filter(Boolean).map(x=>x.toLowerCase()));
  return {mode:mode==="apply"&&allowlist.size===0?"off":mode,allowlist};
}

function validObservation(observation,linkedTag){
  if(!observation||typeof observation!=="object"||
     !season.test(observation.season)||!tag.test(linkedTag)||
     observation.clan_tag!==linkedTag||![5,7].includes(observation.war_count)||
     !Array.isArray(observation.group_tags)||
     observation.group_tags.length!==observation.war_count+1||
     !observation.group_tags.includes(linkedTag)||
     new Set(observation.group_tags).size!==observation.group_tags.length||
     observation.group_tags.some(x=>!tag.test(x)))return false;
  return true;
}

function validPreflight(preflight,observation){
  if(!preflight||typeof preflight!=="object"||preflight.candidate!==true||
     preflight.reason!=="atomic_archive_and_cycle_transaction_required"||
     !season.test(preflight.source_season)||
     preflight.source_season>=observation.season||
     preflight.target_season!==observation.season||
     !uuid.test(preflight.source_cycle_id)||
     !Number.isSafeInteger(preflight.source_revision)||
     preflight.source_revision<1||
     ![5,7].includes(preflight.source_war_count)||
     preflight.target_war_count!==observation.war_count||
     !Number.isInteger(preflight.source_locked_clash_days)||
     preflight.source_locked_clash_days<0||
     preflight.source_locked_clash_days>preflight.source_war_count||
     preflight.source_unconfirmed_days!==
       preflight.source_war_count-preflight.source_locked_clash_days||
     typeof preflight.source_archive_exists!=="boolean")return false;
  return true;
}

async function serviceRpc(settings,functionName,args,{fetcher,timeoutMs}){
  if(!settings||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(settings.url)||
     typeof settings.key!=="string"||!settings.key||
     !/^cwl_ownerless_(?:cycle_preflight|atomic_rollover)$/.test(functionName))
    throw Error("ownerless_service_configuration_invalid");
  let response;
  try{
    response=await fetcher(settings.url+"/rest/v1/rpc/"+functionName,{
      method:"POST",
      headers:{
        apikey:settings.key,
        Authorization:"Bearer "+settings.key,
        "Content-Type":"application/json",
        Accept:"application/json",
        Prefer:"return=representation"
      },
      body:JSON.stringify(args),
      signal:AbortSignal.timeout(timeoutMs)
    });
  }catch{
    // Coarse error: never include fetch body, tenant id, headers or secrets.
    throw Error("ownerless_rpc_unavailable");
  }
  if(!response.ok)throw Error("ownerless_rpc_unavailable");
  let value;
  try{value=await response.json()}catch{throw Error("ownerless_rpc_invalid_result")}
  if(!value||typeof value!=="object"||Array.isArray(value))
    throw Error("ownerless_rpc_invalid_result");
  return value;
}

export async function attemptOwnerlessRollover({
  policy,settings,clanId,linkedTag,observation,evidenceSaved=false,
  deadline=0,now=()=>Date.now(),fetcher=fetch
}){
  if(!policy||policy.mode==="off")return {status:"off"};
  // Per-tenant allowlist applies to observation/preview AND mutation.
  // A single linked Supercell tag never gives permission for another app-clan.
  if(!uuid.test(String(clanId||""))||
     !policy.allowlist?.has(String(clanId).toLowerCase()))
    return {status:"not_allowed"};
  if(evidenceSaved!==true||!validObservation(observation,linkedTag))
    return {status:"no_evidence"};
  if(!Number.isFinite(deadline)||deadline-now()<MIN_PREFLIGHT_BUDGET)
    return {status:"time_budget"};
  const preflight=await serviceRpc(settings,"cwl_ownerless_cycle_preflight",
    {p_clan:clanId},{fetcher,timeoutMs:5000});
  if(preflight.candidate===false)return {status:"not_candidate"};
  if(!validPreflight(preflight,observation))
    throw Error("ownerless_preflight_integrity_conflict");
  if(policy.mode==="observe")return {status:"candidate"};
  if(policy.mode!=="apply")return {status:"off"};
  if(deadline-now()<MIN_WRITE_BUDGET)return {status:"time_budget"};
  const result=await serviceRpc(settings,"cwl_ownerless_atomic_rollover",{
    p_clan:clanId,
    p_expected_cycle:preflight.source_cycle_id,
    p_expected_revision:preflight.source_revision,
    p_target_season:preflight.target_season
  },{fetcher,timeoutMs:6500});
  if(result.applied===false)return {status:"not_candidate"};
  if(result.applied!==true||
     result.target_season!==preflight.target_season||
     !uuid.test(result.target_cycle_id)||
     result.target_cycle_id===preflight.source_cycle_id)
    throw Error("ownerless_transition_integrity_conflict");
  if(result.created===false&&result.reason==="already_applied")
    return {status:"already_applied"};
  if(result.created!==true||result.reason!=="atomic_rollover_applied"||
     result.source_season!==preflight.source_season||
     result.source_cycle_id!==preflight.source_cycle_id||
     result.source_revision!==preflight.source_revision||
     result.target_revision!==preflight.source_revision+1||
     result.source_played_days!==preflight.source_locked_clash_days||
     result.source_unconfirmed_days!==preflight.source_unconfirmed_days)
    throw Error("ownerless_transition_integrity_conflict");
  return {status:"applied"};
}
