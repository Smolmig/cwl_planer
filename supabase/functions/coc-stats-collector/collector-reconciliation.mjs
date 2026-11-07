// Pure, fail-closed proposal only. NOT called by the live collector.
// Future server-side reconciliation may consume this only after explicit
// authorization, full tenant-scoped DB reads and a newly fetched official
// warEnded Clash snapshot. Never log or expose returned private player rows.
import {buildWarSnapshot,tag,validTag} from "./collector-core.mjs";

const reject=reason=>({eligible:false,reason,confirmedMissedCount:null,missedRows:[]});
const uuid=value=>typeof value==="string"&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const identicalTags=(a,b)=>{
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length)return false;
  const left=a.map(tag),right=b.map(tag);
  if(!left.every(validTag)||!right.every(validTag)||
     new Set(left).size!==left.length||new Set(right).size!==right.length)
    return false;
  const sortedRight=right.sort();
  return left.sort().every((v,i)=>v===sortedRight[i]);
};
const attackKey=a=>tag(a.attacker_tag)+":"+String(a.attack_order);
const equalAttack=(a,b)=>
  tag(a.attacker_tag)===tag(b.attacker_tag)&&
  a.attack_order===b.attack_order&&
  tag(a.defender_tag)===tag(b.defender_tag)&&
  a.stars===b.stars&&a.destruction===b.destruction&&
  (a.attacker_th??null)===(b.attacker_th??null)&&
  (a.defender_th??null)===(b.defender_th??null);

/**
 * Dry-run evidence gate for an already FINALIZED, historically incomplete
 * API-sourced CWL war. Output NEVER writes data.
 *
 * linkedClan comes from the authorized tenant's cwl_clans row, storedWar and
 * both stored row arrays MUST be fetched in full from that same clan_id, and
 * officialWar MUST be fetched afresh by the trusted server using its Clash
 * API credential at the independent fetchedWarTag endpoint. Never accept a user/browser/import-supplied officialWar.
 *
 * A future, separately reviewed writer would need a transaction/optimistic
 * conflict guard and must recheck that finalized=true, missed_log_complete=false
 * and the attack rows are unchanged before writing confirmed misses.
 */
export function previewHistoricalCwlMisses({
  linkedClan,storedWar,storedAttacks,storedMissedRows,officialWar,fetchedWarTag,now=Date.now()
}={}){
  if(!linkedClan||!storedWar||!Array.isArray(storedAttacks)||
     !Array.isArray(storedMissedRows))
    return reject("stored_evidence_missing");
  if(!uuid(storedWar.clan_id)||linkedClan.id!==storedWar.clan_id||
     !validTag(linkedClan.clash_tag))
    return reject("tenant_link_invalid");
  if(storedWar.source!=="api"||storedWar.war_type!=="cwl"||
     storedWar.finalized!==true||storedWar.missed_log_complete!==false)
    return reject("not_an_unverified_final_api_cwl");
  if(typeof storedWar.war_key!=="string"||
     !/^cwl:#[0289PYLQGRJCUV]{3,15}$/.test(storedWar.war_key))
    return reject("invalid_saved_war_key");
  // Existing Missed rows must be manually reviewed rather than overwritten.
  if(storedMissedRows.length!==0)return reject("existing_missed_evidence");
  if(!officialWar||typeof officialWar!=="object")
    return reject("official_snapshot_unavailable");
  // The route's fetched tag must be independently supplied by the trusted
  // caller, not inferred from the database key or the response body.
  if(!validTag(fetchedWarTag)||
     tag(fetchedWarTag)!==storedWar.war_key.slice(4))
    return reject("official_war_tag_disagrees");

  let source;
  try{
    source=buildWarSnapshot(officialWar,tag(linkedClan.clash_tag),{
      warType:"cwl",warTag:tag(fetchedWarTag),now
    });
  }catch{return reject("official_snapshot_invalid")}
  if(!source||source.state!=="warEnded"||!source.war.finalized)
    return reject("official_war_not_final");
  if(source.war.missed_log_complete!==true||!Array.isArray(source.missed))
    return reject("official_attack_counter_unverified");

  const war=source.war;
  const storedStart=Date.parse(storedWar.started_at);
  if(war.war_key!==storedWar.war_key||
     !Number.isFinite(storedStart)||storedStart!==Date.parse(war.started_at)||
     storedWar.team_size!==war.team_size||
     tag(storedWar.opponent_tag)!==war.opponent_tag||
     !identicalTags(storedWar.roster_tags,war.roster_tags))
    return reject("saved_war_disagrees_with_official");
  if(storedAttacks.length!==source.attacks.length)
    return reject("stored_attack_count_differs_from_official");

  const expected=new Map(source.attacks.map(a=>[attackKey(a),a]));
  if(expected.size!==source.attacks.length)
    return reject("official_attack_identity_duplicate");
  const seen=new Set();
  for(const attack of storedAttacks){
    if(!attack||typeof attack!=="object"||
       attack.clan_id!==storedWar.clan_id||
       attack.war_key!==storedWar.war_key||
       !validTag(attack.attacker_tag)||!validTag(attack.defender_tag)||
       attack.attack_order!==1)
      return reject("stored_attack_scope_invalid");
    const key=attackKey(attack);
    if(seen.has(key))return reject("stored_attack_identity_duplicate");
    seen.add(key);
    const authoritative=expected.get(key);
    if(!authoritative||!equalAttack(attack,authoritative))
      return reject("stored_attack_disagrees_with_official");
  }
  // Private preview only, never a response to an authenticated browser.
  return {
    eligible:true,
    reason:"official_war_and_saved_attacks_match",
    confirmedMissedCount:source.missed.length,
    missedRows:source.missed.map(m=>({...m,clan_id:storedWar.clan_id}))
  };
}


/**
 * Constructs the only payload shape understood by the non-deployed SQL draft.
 * Pure, verified, and always DRY-RUN. It does not call an RPC, database or API.
 * A later reviewed privileged caller must independently re-fetch the official
 * source immediately before using this; do not use a browser-supplied input.
 */
export function prepareHistoricalCwlMissedRpc(input={}){
  const proposal=previewHistoricalCwlMisses(input);
  if(!proposal.eligible)
    return {eligible:false,reason:proposal.reason,rpcArgs:null};
  const {linkedClan,storedWar,storedAttacks,officialWar}=input;
  const timestamp=Date.parse(storedWar.updated_at);
  if(!Number.isFinite(timestamp)||!Number.isFinite(Date.parse(storedWar.started_at)))
    return {eligible:false,reason:"stored_version_missing",rpcArgs:null};
  const ownTag=tag(linkedClan.clash_tag);
  const officialSide=tag(officialWar.clan?.tag)===ownTag?officialWar.clan:
    tag(officialWar.opponent?.tag)===ownTag?officialWar.opponent:null;
  if(!officialSide||!Number.isInteger(officialSide.attacks)||
     officialSide.attacks!==storedAttacks.length)
    return {eligible:false,reason:"official_counter_missing",rpcArgs:null};
  const canonical=storedAttacks.map(a=>({
    attacker_tag:tag(a.attacker_tag),attack_order:a.attack_order,
    defender_tag:tag(a.defender_tag),attacker_th:a.attacker_th??null,
    defender_th:a.defender_th??null,stars:a.stars,
    destruction:a.destruction
  })).sort((a,b)=>(a.attacker_tag<b.attacker_tag?-1:
    a.attacker_tag>b.attacker_tag?1:0)||a.attack_order-b.attack_order);
  const missed=proposal.missedRows.map(m=>({
    player_tag:tag(m.player_tag),player_name:m.player_name,
    missed_count:1
  })).sort((a,b)=>a.player_tag<b.player_tag?-1:a.player_tag>b.player_tag?1:0);
  return {
    eligible:true,reason:"verified_rpc_dry_run_only",
    rpcArgs:{
      p_clan_id:storedWar.clan_id,
      p_war_key:storedWar.war_key,
      p_expected_clash_tag:ownTag,
      p_expected_updated_at:storedWar.updated_at,
      p_expected_started_at:storedWar.started_at,
      p_expected_opponent_tag:tag(storedWar.opponent_tag),
      p_expected_roster:[...storedWar.roster_tags],
      p_expected_attacks:canonical,
      p_official_attack_counter:officialSide.attacks,
      p_confirmed_missed:missed,
      p_apply:false
    }
  };
}
