// SERVER-ONLY, NON-DEPLOYED evidence acquisition for historical CWL missed attacks.
// NOT imported by index.ts, browser code, or an automatic scheduler.
// The official Clash-shaped data is retrieved ONLY by this privileged reader
// from the server-configured, existing Clash proxy, never accepted from a user.
//
// This module performs at most TWO fixed-origin GETs. It never reads/writes
// Supabase or invokes the draft RPC; all results are private to a trusted
// server-side future caller and MUST NOT be exposed via an HTTP response.
import {tag,validTag} from "./collector-core.mjs";
import {prepareHistoricalCwlMissedRpc} from "./collector-reconciliation.mjs";

const GAME="https://cocproxy.royaleapi.dev/v1";
const KEY_PATTERN=/^[A-Za-z0-9_.-]{16,512}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CWL_KEY=/^cwl:#[0289PYLQGRJCUV]{3,15}$/;
const MAX_BODY=1024*1024;

const reject=reason=>({eligible:false,reason,rpcArgs:null});
class SourceError extends Error{
  constructor(code){super(code);this.name="SourceError"}
}
function httpError(status){
  if(status===404)return "official_source_not_found";
  if(status===401||status===403)return "official_source_forbidden";
  if(status===429)return "official_source_rate_limited";
  return status>=500?"official_source_unavailable":"official_response_invalid";
}
function validInputs({linkedClan,storedWar,storedAttacks,storedMissedRows,gameKey,fetchImpl}){
  if(!linkedClan||!storedWar||!Array.isArray(storedAttacks)||
     !Array.isArray(storedMissedRows)||!UUID.test(linkedClan.id||"")||
     storedWar.clan_id!==linkedClan.id||!validTag(linkedClan.clash_tag))
    return "tenant_evidence_invalid";
  if(storedWar.source!=="api"||storedWar.war_type!=="cwl"||
     storedWar.finalized!==true||storedWar.missed_log_complete!==false||
     typeof storedWar.war_key!=="string"||
     !CWL_KEY.test(storedWar.war_key)||storedMissedRows.length!==0)
    return "historical_candidate_not_eligible";
  if(!storedAttacks.every(a=>a&&a.clan_id===linkedClan.id&&
      a.war_key===storedWar.war_key))
    return "tenant_attack_scope_invalid";
  if(!KEY_PATTERN.test(gameKey||"")||typeof fetchImpl!=="function")
    return "server_not_configured";
  return null;
}
async function getClashJson(path,gameKey,fetchImpl){
  // Both paths are authored below, contain only previously validated tags,
  // and are never composed from a user-provided URL.
  let response;
  try{
    response=await fetchImpl(GAME+path,{
      method:"GET",
      redirect:"error",
      cache:"no-store",
      headers:{Authorization:"Bearer "+gameKey,Accept:"application/json"},
      signal:AbortSignal.timeout(8000)
    });
  }catch{
    throw new SourceError("official_source_unavailable");
  }
  if(!response||typeof response.status!=="number"||!response.ok)
    throw new SourceError(httpError(response?.status||503));
  const type=response.headers?.get?.("content-type")||"";
  const length=Number(response.headers?.get?.("content-length")||0);
  if(!/^application\/json(?:\s*;|$)/i.test(type)||length>MAX_BODY)
    throw new SourceError("official_response_invalid");
  // Do not buffer an untrusted chunked body in full before checking size.
  // The Content-Length header alone cannot bound streamed responses.
  let reader;
  try{
    reader=response.body?.getReader();
    if(!reader)throw new Error("empty_body");
    const chunks=[];
    let used=0;
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      used+=value.byteLength;
      if(used>MAX_BODY)throw new Error("body_limit");
      chunks.push(value);
    }
    const bytes=new Uint8Array(used);
    let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
    return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
  }catch{
    try{await reader?.cancel()}catch{/* Fail closed. */}
    throw new SourceError("official_response_invalid");
  }
}
function groupIncludesWar(group,clanTag,warTag){
  if(!group||!Array.isArray(group.clans)||group.clans.length<2||
     group.clans.length>8||!Array.isArray(group.rounds)||
     group.rounds.length<1||group.rounds.length>7)
    return false;
  const memberTags=group.clans.map(c=>tag(c?.tag));
  if(memberTags.some(t=>!validTag(t))||
     new Set(memberTags).size!==memberTags.length||
     !memberTags.includes(clanTag))return false;
  let matches=0;
  for(const round of group.rounds){
    if(!Array.isArray(round?.warTags)||round.warTags.length>4)return false;
    for(const value of round.warTags){
      // The league group may contain "#0" placeholders for future pairings.
      if(value==="#0")continue;
      const candidate=tag(value);
      if(!validTag(candidate))return false;
      if(candidate===warTag)matches++;
    }
  }
  // The actual war tag must have appeared exactly once in the *separately
  // retrieved* official league group. A stored DB key alone proves nothing.
  return matches===1;
}

/**
 * Future privileged service only. Caller MUST acquire linkedClan/storedWar
 * and complete attacks+missed rows from the same tenant-scoped DB records.
 * It supplies COC_API_KEY from a server secret and NEVER passes browser JSON.
 *
 * Success returns a DRY-RUN RPC payload (p_apply:false) for internal review.
 * The caller must not return that private payload to browsers or log it.
 *
 * This function is intentionally not wired to the deployed Edge Function.
 */
export async function prepareHistoricalCwlFromServerSource(input={}){
  const invalid=validInputs(input);
  if(invalid)return reject(invalid);
  const {linkedClan,storedWar,storedAttacks,storedMissedRows,
    gameKey,fetchImpl,now=Date.now()}=input;
  const clanTag=tag(linkedClan.clash_tag);
  const warTag=tag(storedWar.war_key.slice(4));
  let group,officialWar;
  try{
    group=await getClashJson("/clans/"+encodeURIComponent(clanTag)+
      "/currentwar/leaguegroup",gameKey,fetchImpl);
    if(!groupIncludesWar(group,clanTag,warTag))
      return reject("official_leaguegroup_cannot_confirm_war");
    officialWar=await getClashJson("/clanwarleagues/wars/"+
      encodeURIComponent(warTag),gameKey,fetchImpl);
  }catch(e){
    // No upstream response body, raw error, URL, clan/player/tag or secret
    // reaches the returned reason code.
    return reject(e instanceof SourceError?e.message:"official_source_unavailable");
  }
  if(tag(officialWar?.clan?.tag)!==clanTag&&
     tag(officialWar?.opponent?.tag)!==clanTag)
    return reject("official_war_clan_mismatch");

  return prepareHistoricalCwlMissedRpc({
    linkedClan,storedWar,storedAttacks,storedMissedRows,officialWar,
    fetchedWarTag:warTag,now
  });
}
