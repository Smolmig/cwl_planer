// #178 – Portable Cloud-App backup foundation.
// This module is deliberately NOT wired to the public Cloud UI.
// Restricted, owner-authorized transactional restore adapters below remain gated.
export const PORTABLE_CLOUD_BACKUP_KIND = "cwl-cloud-app-backup";
export const PORTABLE_CLOUD_BACKUP_FORMAT = 1;
export const PORTABLE_BACKUP_ROW_LIMIT = 100000;
export const PORTABLE_BACKUP_BYTE_LIMIT = 128 * 1024 * 1024;

// Field-level allowlist based on the 19 Nov 2026 live public schema.
// Private-schema apply checkpoints never enter the public table inventory.
// Security configuration and generated authentication credentials are excluded.
// audit/observed rows are evidence, NOT unconditional SQL upserts.
const descriptors = [
 ["cwl_cloud_profiles","clan_id","clan_id profile_json data_version revision created_at updated_at","plan"],
 ["cwl_profile_snapshots","id","id clan_id revision profile_json created_at","audit"],
 ["cwl_change_events","id","id clan_id actor_id revision event_type details created_at","audit"],
 ["cwl_stat_wars","clan_id war_key","clan_id war_key war_type started_at team_size opponent_tag opponent_name source roster_tags finalized updated_at missed_log_complete source_clash_tag","fact"],
 ["cwl_stat_attacks","clan_id war_key attacker_tag attack_order","clan_id war_key attacker_tag attack_order attacker_name attacker_th defender_tag defender_name defender_th stars destruction created_at","fact"],
 ["cwl_stat_missed","clan_id war_key player_tag","clan_id war_key player_tag player_name missed_count created_at","fact"],
 ["cwl_plan_review_state","clan_id","clan_id cycle_id season locked locked_by locked_at updated_at","plan"],
 ["cwl_plan_suggestions","id","id clan_id cycle_id author_id base_revision suggested_profile status submitted_at decided_at decided_by","audit"],
 ["cwl_group_archives","clan_id season","clan_id season clan_tag group_json created_at updated_at","archive"],
 ["cwl_own_lineup_archives","clan_id season day","clan_id season day war_tag state team_size lineup_json created_at updated_at","archive"],
 ["cwl_missed_owner_decisions","id","id clan_id season war_key day target_day player_tag decision note actor_id created_at","audit"],
 ["cwl_clan_member_tenure","clan_id source_clash_tag player_tag","clan_id source_clash_tag player_tag first_observed_at last_present_at last_observed_at state_changed_at is_present confirmed_seconds observed_visits last_clash_rank last_clash_rank_at rank_before_leave rank_before_leave_at last_donations last_donations_at last_donation_increase_at last_donation_increase_by","observed"],
 ["cwl_clan_management_rules","clan_id","clan_id performance_enabled performance_min_days performance_min_attacks performance_three_star_percent performance_lookback_days loyalty_min_days absence_reset_days revision updated_at loyalty_enabled loyalty_min_donations loyalty_min_active_days loyalty_lookback_days","plan"],
 ["cwl_clan_donation_observations","clan_id source_clash_tag player_tag observed_at","clan_id source_clash_tag player_tag observed_at positive_delta","observed"],
 ["cwl_clan_absence_observations","clan_id source_clash_tag player_tag prior_visit_number","clan_id source_clash_tag player_tag prior_visit_number leave_observed_at last_absent_observed_at return_observed_at observed_absent_snapshots current_streak_seconds max_streak_seconds","observed"],
 ["cwl_clan_review_decisions","clan_id source_clash_tag player_tag review_kind","clan_id source_clash_tag player_tag review_kind disposition evidence_fingerprint revision updated_at","audit"],
 ["cwl_clan_cw_missed_decisions","id","id clan_id source_clash_tag war_key player_tag decision note actor_id created_at","audit"]
];
export const PORTABLE_CLOUD_TABLES = Object.freeze(descriptors.map(([name,key,cols,category]) =>
 Object.freeze({name, key:Object.freeze(key.split(" ")),
  columns:Object.freeze(cols.split(" ")), category})
));
export const PORTABLE_EXCLUDED_TABLES = Object.freeze([
 "cwl_clan_invites", "cwl_clan_memberships", "cwl_access_blocks",
 "cwl_clan_presence", "cwl_stat_collector_status",
 "cwl_portable_restore_checkpoints", "cwl_portable_plan_recovery_candidates"
]);
const tablesByName = new Map(PORTABLE_CLOUD_TABLES.map(spec => [spec.name,spec]));
const forbiddenKeys = new Set(["__proto__","prototype","constructor"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tagPattern = /^#[0289PYLQGRJCUV]{3,15}$/;

function reject(message){throw new Error("Cloud-Backup: "+message);}
function record(x){return x!==null && typeof x==="object" && !Array.isArray(x);}
function requireKeys(obj,allowed,label){
 if(!record(obj))reject(label+" muss ein Objekt sein.");
 for(const key of Object.keys(obj)){
  if(forbiddenKeys.has(key)||!allowed.includes(key))reject(label+" enthält ein unerlaubtes Feld: "+key);
 }
}
function safeJson(value,depth=0,seen=new WeakSet()){
 if(depth>60)reject("zu tief verschachtelte Daten.");
 if(value===null||typeof value==="string"||typeof value==="boolean")return value;
 if(typeof value==="number"&&Number.isFinite(value))return value;
 if(typeof value!=="object")reject("ungültiger JSON-Wert.");
 if(seen.has(value))reject("zyklische Daten.");
 seen.add(value);
 let result;
 if(Array.isArray(value))result=value.map(item=>safeJson(item,depth+1,seen));
 else{
  if(!record(value))reject("ungültiger JSON-Typ.");
  result=Object.create(null);
  for(const key of Object.keys(value).sort()){
   if(forbiddenKeys.has(key))reject("gefährlicher JSON-Schlüssel: "+key);
   result[key]=safeJson(value[key],depth+1,seen);
  }
 }
 seen.delete(value);
 return result;
}
export function canonicalBackupJson(value){return JSON.stringify(safeJson(value));}
function stableRowKey(row,spec){
 const values=spec.key.map(k=>{
  const v=row[k];
  if(v===undefined||v===null||(typeof v==="string"&&!v.trim()))
   reject(spec.name+": fehlender Schlüssel "+k);
  return v;
 });
 return JSON.stringify(values);
}
function normalizedRows(raw,spec,clanId){
 if(!Array.isArray(raw)||raw.length>PORTABLE_BACKUP_ROW_LIMIT)
  reject(spec.name+": ungültige oder zu große Datenmenge.");
 const keys=new Set();
 const sorted=raw.map(row=>{
  requireKeys(row,spec.columns,spec.name);
  if(row.clan_id!==clanId)reject(spec.name+": Datensatz gehört zu einem anderen Clan.");
  for(const col of spec.columns)if(!Object.hasOwn(row,col))
   reject(spec.name+": Feld fehlt: "+col);
  const copy=safeJson(row),id=stableRowKey(copy,spec);
  if(keys.has(id))reject(spec.name+": doppelter Primärschlüssel.");
  keys.add(id);
  return {id,row:copy};
 });
 sorted.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 return sorted.map(x=>x.row);
}
function normalizedClan(source){
 requireKeys(source,["source_clan_id","name","clash_tag","tables"],"Clan");
 if(!uuidPattern.test(source.source_clan_id||""))reject("ungültige Quell-Clan-ID.");
 if(typeof source.name!=="string"||!source.name.trim()||source.name.length>100)
  reject("ungültiger Clanname.");
 if(source.clash_tag!==null&&!tagPattern.test(source.clash_tag||""))
  reject("ungültiger Clash-Clan-Tag.");
 requireKeys(source.tables,PORTABLE_CLOUD_TABLES.map(x=>x.name),"Tabellen");
 const tables=Object.create(null);
 for(const spec of PORTABLE_CLOUD_TABLES){
  if(!Object.hasOwn(source.tables,spec.name))
   reject("unvollständiges Backup: "+spec.name+" fehlt.");
  tables[spec.name]=normalizedRows(source.tables[spec.name],spec,source.source_clan_id);
 }
 // A missing/empty cloud profile is never silently interpreted as a valid plan.
 if(tables.cwl_cloud_profiles.length!==1)
  reject("genau ein Cloud-Profil je Clan erforderlich.");
 return {source_clan_id:source.source_clan_id,name:source.name.trim(),
  clash_tag:source.clash_tag,tables};
}
function checkRelations(clan){
 const wars=new Set(clan.tables.cwl_stat_wars.map(row=>row.war_key));
 for(const table of ["cwl_stat_attacks","cwl_stat_missed"])
  for(const row of clan.tables[table])
   if(!wars.has(row.war_key))reject(table+": Angriff/Fehlangriff ohne zugehörigen Krieg.");
 const profile=clan.tables.cwl_cloud_profiles[0];
 if(!record(profile.profile_json)||!Array.isArray(profile.profile_json.members)||
    !Array.isArray(profile.profile_json.locks)||!Array.isArray(profile.profile_json.archives))
  reject("Cloud-Profil hat kein gültiges Mitglieder-/Plan-/Archivformat.");
 if(profile.data_version!==9)reject("nicht unterstützte Cloud-Profil-Datenversion.");
}
function normalizedContent(body){
 requireKeys(body,["kind","format_version","created_at","consistency","clans","server_receipt"],"Datei");
 if(body.kind!==PORTABLE_CLOUD_BACKUP_KIND||body.format_version!==PORTABLE_CLOUD_BACKUP_FORMAT)
  reject("Dateiformat oder Version nicht unterstützt.");
 if(typeof body.created_at!=="string"||!Number.isFinite(Date.parse(body.created_at)))
  reject("ungültiger Exportzeitpunkt.");
 if(!["client-read-non-atomic","server-stable-statement"].includes(body.consistency))
  reject("ungültige oder fehlende Export-Konsistenzangabe.");
 if(!Array.isArray(body.clans)||body.clans.length<1||body.clans.length>30)
  reject("ungültige Clananzahl.");
 const seen=new Set();
 const clans=body.clans.map(source=>{
  const clan=normalizedClan(source);
  if(seen.has(clan.source_clan_id))reject("Clan doppelt im Backup.");
  seen.add(clan.source_clan_id);
  checkRelations(clan);return clan;
 });
 clans.sort((a,b)=>a.source_clan_id<b.source_clan_id?-1:a.source_clan_id>b.source_clan_id?1:0);
 let receipt=null;
 if(Object.hasOwn(body,"server_receipt")){
  receipt=body.server_receipt;
  requireKeys(receipt,["id","payload_sha256","owner_user_id","snapshot_at"],"Server-Beleg");
  if(!uuidPattern.test(receipt.id||"")||
     !uuidPattern.test(receipt.owner_user_id||"")||
     !/^[a-f0-9]{64}$/.test(receipt.payload_sha256||"")||
     receipt.snapshot_at!==body.created_at)
   reject("Ungültiger oder nicht zu dieser Datei passender Server-Beleg.");
 }
 return {kind:body.kind,format_version:body.format_version,
  created_at:body.created_at,consistency:body.consistency,clans,
  ...(receipt?{server_receipt:safeJson(receipt)}:{})};
}
async function sha256(value){
 if(!globalThis.crypto?.subtle)reject("SHA-256 ist auf diesem Gerät nicht verfügbar.");
 const binary=new TextEncoder().encode(value);
 if(binary.length>PORTABLE_BACKUP_BYTE_LIMIT)reject("Datei überschreitet die Größenobergrenze.");
 const digest=await crypto.subtle.digest("SHA-256",binary);
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
export async function createPortableCloudBackup({clans,createdAt=new Date().toISOString(),consistency="client-read-non-atomic",serverReceipt=null}){
 const body=normalizedContent({kind:PORTABLE_CLOUD_BACKUP_KIND,
  format_version:PORTABLE_CLOUD_BACKUP_FORMAT,created_at:createdAt,
  consistency,clans,...(serverReceipt?{server_receipt:serverReceipt}:{})});
 return {...body,sha256:await sha256(canonicalBackupJson(body))};
}
export async function verifyPortableCloudBackup(file){
 // Parse before accepting; never trust a sender-supplied checksum or clan ID.
 requireKeys(file,["kind","format_version","created_at","consistency","clans","sha256","server_receipt"],"Backup");
 if(!/^[a-f0-9]{64}$/.test(file.sha256||""))reject("ungültige SHA-256-Prüfsumme.");
 const {sha256:checksum,...body}=file;
 const checked=normalizedContent(body);
 if(await sha256(canonicalBackupJson(checked))!==checksum)
  reject("Integritätsprüfung fehlgeschlagen; Datei verändert oder beschädigt.");
 return checked;
}
function normalizeTargetRows(rows,spec,targetId){
 if(!Array.isArray(rows))reject("bestehende Zieldaten für "+spec.name+" fehlen.");
 return normalizedRows(rows,spec,targetId);
}
export async function previewPortableCloudRestore(file,{targets,mapping,existingByClan}){
 const content=await verifyPortableCloudBackup(file);
 if(!Array.isArray(targets)||!record(mapping)||!record(existingByClan))
  reject("vertrauenswürdige Zielclans und vollständige Bestandsdaten fehlen.");
 const targetById=new Map(targets.map(t=>[t.id,t])),destinations=new Set(),clans=[];
 for(const source of content.clans){
  const targetId=mapping[source.source_clan_id],target=targetById.get(targetId);
  if(!target||target.isOwner!==true||!uuidPattern.test(targetId||""))
   reject("Zielclan nicht ausdrücklich als eigener Clan autorisiert.");
  if(destinations.has(targetId))reject("mehrere Quellclans auf denselben Zielclan.");
  destinations.add(targetId);
  // Never allow an imported name or UUID to silently reassign a real Clash clan.
  if(!source.clash_tag||source.clash_tag!==target.clash_tag)
   reject("Clash-Tag von Quell- und Zielclan stimmt nicht überein.");
  const current=existingByClan[targetId];
  requireKeys(current,PORTABLE_CLOUD_TABLES.map(s=>s.name),"Zieldaten");
  const tableStats=Object.create(null);
  for(const spec of PORTABLE_CLOUD_TABLES){
   if(!Object.hasOwn(current,spec.name))reject("Ziel-Datentabelle fehlt: "+spec.name);
   const existing=normalizeTargetRows(current[spec.name],spec,targetId);
   const byKey=new Map(existing.map(row=>[stableRowKey(row,spec),canonicalBackupJson(row)]));
   const counts={new:0,identical:0,conflict:0,reviewOnly:0,targetOnly:0};
   const sourceKeys=new Set();
   for(const original of source.tables[spec.name]){
    // Read-only preview: remapping a clan ID never grants write authority.
    const row={...original,clan_id:targetId};
    const key=stableRowKey(row,spec),previous=byKey.get(key);
    sourceKeys.add(key);
    // Historical audit and collector observations must NEVER be automatically
    // replayed. If the exact row already exists, however, it needs no review.
    if(previous===canonicalBackupJson(row))counts.identical++;
    else if(["audit","observed"].includes(spec.category))counts.reviewOnly++;
    else if(previous===undefined)counts.new++;
    else counts.conflict++;
   }
   // A destination may contain older or newer wars, audit events and plans
   // absent from the file. These target-only rows are NOT recoverable gaps
   // and must never be removed or overwritten by a backup import.
   counts.targetOnly=existing.filter(row=>!sourceKeys.has(stableRowKey(row,spec))).length;
   tableStats[spec.name]=counts;
  }
  clans.push({source_clan_id:source.source_clan_id,target_clan_id:targetId,tables:tableStats});
 }
 return {format_version:content.format_version,created_at:content.created_at,
  clans,mutationPermitted:false,
  warning:"Nur Vorschau. Kein Restore ohne serverseitige Owner-/RLS-/Transaktionsprüfung. Entscheidungen, Beobachtungen und Audits bleiben gesondert zu prüfen."};
}

// Read-only collection for later integration. RLS is enforced by the signed-in
// Supabase client. Never accept foreign clan rows, partial pages, or 1000-row
// default truncation as a completed backup. This is not a DB transaction.
export async function collectOwnerCloudBackup({sb,clanIds,pageSize=500}){
 if(!sb?.auth?.getUser||!Array.isArray(clanIds)||!clanIds.length||
    clanIds.length>30||new Set(clanIds).size!==clanIds.length||
    !clanIds.every(id=>uuidPattern.test(id||""))||
    !Number.isInteger(pageSize)||pageSize<1||pageSize>1000)
  reject("ungültige Clanauswahl oder Seitengröße.");
 const who=await sb.auth.getUser();
 const user=who.data?.user;
 if(who.error||!uuidPattern.test(user?.id||""))reject("Anmeldung konnte nicht geprüft werden.");
 async function owned(){
  const q=await sb.from("cwl_clans")
   .select("id,name,clash_tag,owner_user_id")
   .eq("owner_user_id",user.id).in("id",clanIds).order("id");
  if(q.error)reject("Clan-Berechtigung konnte nicht geprüft werden.");
  const rows=q.data||[];
  if(rows.length!==clanIds.length||rows.some(row=>row.owner_user_id!==user.id))
   reject("nicht alle Clans gehören dem angemeldeten Besitzer.");
  return rows;
 }
 const original=await owned();
 const clans=[];
 for(const clan of original){
  const tables=Object.create(null);
  for(const spec of PORTABLE_CLOUD_TABLES){
   const rows=[];
   let offset=0;
   for(;;){
    let request=sb.from(spec.name).select(spec.columns.join(","))
     .eq("clan_id",clan.id);
    for(const key of spec.key)request=request.order(key,{ascending:true});
    const response=await request.range(offset,offset+pageSize-1);
    if(response.error||!Array.isArray(response.data))
     reject(spec.name+": unvollständiger oder gesperrter Export.");
    if(response.data.length>pageSize||rows.length+response.data.length>PORTABLE_BACKUP_ROW_LIMIT)
     reject(spec.name+": Export zu groß.");
    rows.push(...response.data);
    if(response.data.length<pageSize)break;
    offset+=pageSize;
   }
   tables[spec.name]=rows;
  }
  clans.push({source_clan_id:clan.id,name:clan.name,clash_tag:clan.clash_tag,tables});
 }
 // Permission/tenant switching guard before returning a downloadable file.
 const after=await sb.auth.getUser();
 if(after.error||after.data?.user?.id!==user.id)reject("Benutzersitzung hat sich geändert.");
 const final=await owned();
 if(original.some(c=>!final.some(x=>x.id===c.id&&x.clash_tag===c.clash_tag&&x.name===c.name)))
  reject("Clan-Zuordnung hat sich während des Exports geändert.");
 // The export is explicitly marked non-atomic; concurrent collector changes
 // must be handled by the future server-side snapshot/restore workflow.
 return createPortableCloudBackup({clans});
}

// The ONLY consistent full-dataset export path. The SQL RPC is a STABLE,
// SECURITY INVOKER, RLS-protected read, not a privileged server bypass.
// It returns all 17 tables from one MVCC statement snapshot; PostgREST's
// normal 1000-row truncation does NOT apply to nested SQL JSON aggregates.
// Deliberately not connected to the Cloud backup UI until restore is safe.
export async function exportOwnerCloudSnapshot({sb,clanIds}){
 if(!sb?.rpc||!sb?.auth?.getUser||!Array.isArray(clanIds)||
    clanIds.length<1||clanIds.length>30||
    new Set(clanIds).size!==clanIds.length||
    !clanIds.every(id=>uuidPattern.test(id||"")))
  reject("ungültige Clanauswahl.");
 const before=await sb.auth.getUser();
 const user=before.data?.user?.id;
 if(before.error||!uuidPattern.test(user||""))
  reject("Bitte erneut anmelden.");
 const result=await sb.rpc("cwl_export_owned_backup",{p_clan_ids:clanIds});
 if(result.error||!record(result.data))
  reject("Der vollständige Datenbank-Snapshot konnte nicht erstellt werden.");
 const payload=result.data;
 requireKeys(payload,["kind","format_version","created_at","consistency","clans"],"Server-Snapshot");
 if(payload.kind!==PORTABLE_CLOUD_BACKUP_KIND||
    payload.format_version!==PORTABLE_CLOUD_BACKUP_FORMAT||
    payload.consistency!=="server-stable-statement"||
    !Array.isArray(payload.clans)||payload.clans.length!==clanIds.length||
    new Set(payload.clans.map(c=>c.source_clan_id)).size!==clanIds.length||
    payload.clans.some(c=>!clanIds.includes(c.source_clan_id)))
  reject("Unvollständiger oder ungültiger Server-Snapshot.");
 const after=await sb.auth.getUser();
 if(after.error||after.data?.user?.id!==user)
  reject("Benutzersitzung hat sich während des Exports geändert.");
 // Validates every projected column, table and relationship before checksum.
 return createPortableCloudBackup({clans:payload.clans,
  createdAt:payload.created_at,consistency:payload.consistency});
}

 // All target-clan facts are fetched through the same RLS-enforced STABLE RPC,
 // not from arbitrary client-provided rows. This is READ ONLY: a future restore
 // must recheck roles, locks, revisions and conflicts in its write transaction.
export async function previewOwnerCloudRestore({sb,file,mapping}){
 const source=await verifyPortableCloudBackup(file);
 if(!record(mapping))reject("Zielzuordnung muss ein Objekt sein.");
 const sourceIds=source.clans.map(c=>c.source_clan_id);
 requireKeys(mapping,sourceIds,"Zielzuordnung");
 if(Object.keys(mapping).length!==sourceIds.length)
  reject("Nicht alle Quellclans sind einem Ziel zugeordnet.");
 const targetIds=sourceIds.map(id=>mapping[id]);
 if(targetIds.some(id=>!uuidPattern.test(id||""))||
    new Set(targetIds).size!==targetIds.length)
  reject("Ungültige oder doppelte Zielclans.");
 const target=await exportOwnerCloudSnapshot({sb,clanIds:targetIds});
 const targets=target.clans.map(c=>({
  id:c.source_clan_id,clash_tag:c.clash_tag,isOwner:true
 }));
 const existingByClan=Object.fromEntries(target.clans.map(c=>[c.source_clan_id,c.tables]));
 const preview=await previewPortableCloudRestore(file,{targets,mapping,existingByClan});
 return {...preview,
  source_consistency:source.consistency,
  target_snapshot_consistency:target.consistency,
  target_snapshot_at:target.created_at,
  // This is informational, NOT a compare-and-swap token or authorization.
  target_snapshot_sha256:target.sha256,
  mutationPermitted:false};
}


// #178 Phase 3a: fact-only Restore API. These helpers are deliberately NOT
// wired to the Cloud UI. A complete app restore needs separate plan/archive/
// audit/observation handling plus an independent checkpoint/recovery workflow.
// Never send raw unverified file content or rely on checksum for authorization.
function extractPortableFactSource(content,sourceClanId){
 if(content.consistency!=="server-stable-statement")
  reject("Nur aus konsistentem Server-Snapshot erstellte Cloud-Dateien können importiert werden.");
 const clan=content.clans.find(c=>c.source_clan_id===sourceClanId);
 if(!clan)reject("Quellclan fehlt in der verifizierten Datei.");
 return clan;
}
function ensurePortableFactResult(result,{targetClanId,apply}){
 if(result.error||!record(result.data))
  reject("Der geschützte Fakten-Restore wurde vom Server abgelehnt.");
 const value=result.data;
 if(value.target_clan_id!==targetClanId||
    value.scope!=="war-facts-only"||value.applied!==apply||
    !["wars","attacks","missed"].every(k=>
      record(value[k])&&["new","identical","conflict"].every(n=>
        Number.isSafeInteger(value[k][n])&&value[k][n]>=0)))
  reject("Ungültige oder unvollständige Server-Restore-Antwort.");
 if(apply&&["wars","attacks","missed"].some(k=>value[k].conflict!==0))
  reject("Server meldet einen nicht vollständig aufgelösten Restore-Konflikt.");
 return value;
}
export async function previewPortableWarFactRestore({sb,file,sourceClanId,targetClanId}){
 if(!sb?.rpc)reject("Supabase-Sitzung ist nicht bereit.");
 const content=await verifyPortableCloudBackup(file);
 const source=extractPortableFactSource(content,sourceClanId);
 if(!uuidPattern.test(targetClanId||""))reject("ungültiger Zielclan.");
 const snapshot=await exportOwnerCloudSnapshot({sb,clanIds:[targetClanId]});
 const target=snapshot.clans[0];
 if(!target||!target.clash_tag||target.clash_tag!==source.clash_tag)
  reject("Quell- und Zielclan stimmen nicht überein.");
 const revision=target.tables.cwl_cloud_profiles[0].revision;
 if(!Number.isSafeInteger(revision)||revision<1)
  reject("Cloud-Planrevision fehlt.");
 const response=await sb.rpc("cwl_restore_portable_facts_atomic",{
  p_target:targetClanId,p_source:source,p_expected_revision:revision,
  p_apply:false,p_confirmation:null
 });
 const preview=ensurePortableFactResult(response,{targetClanId,apply:false});
 return {...preview,mutationPermitted:false,
  source_backup_sha256:file.sha256,
  target_snapshot_sha256:snapshot.sha256,
  expectedRevision:revision,
  warning:"Nur CW-/CWL-Rohfakten. Kein Plan-, Archiv-, Regel- oder Entscheidungs-Restore. Neue API-Herkunft wird als unbestätigter Import gespeichert."};
}
export async function applyPortableWarFactRestore({
 sb,file,sourceClanId,targetClanId,expectedRevision,confirmation
}){
 if(!sb?.rpc||confirmation!=="RESTORE_VERIFIED_WAR_FACTS"||
    !Number.isSafeInteger(expectedRevision)||expectedRevision<1)
  reject("Explizite Bestätigung und gültiger geprüfter Zielstand erforderlich.");
 const content=await verifyPortableCloudBackup(file);
 const source=extractPortableFactSource(content,sourceClanId);
 if(!uuidPattern.test(targetClanId||""))reject("ungültiger Zielclan.");
 // Checks source/target tag using freshly owner-authorized snapshot. Server
 // still re-checks owner, membership, tag and CAS inside its own transaction.
 const target=await exportOwnerCloudSnapshot({sb,clanIds:[targetClanId]});
 if(!target.clans[0]||target.clans[0].clash_tag!==source.clash_tag||
    target.clans[0].tables.cwl_cloud_profiles[0].revision!==expectedRevision)
  reject("Zielclan oder Planrevision seit der Vorschau verändert.");
 const result=await sb.rpc("cwl_restore_portable_facts_atomic",{
  p_target:targetClanId,p_source:source,p_expected_revision:expectedRevision,
  p_apply:true,p_confirmation:confirmation
 });
 return ensurePortableFactResult(result,{targetClanId,apply:true});
}


// #178 Phase 3b: plan/archives restore CANDIDATE preview + immutable staging.
// Does NOT apply any plan, played day, approved lock, verified lineup or
// collector-only group archive. Those require a separate reviewed recovery
// procedure; a sender-supplied JSON hash is NOT sufficient authorization.
const PORTABLE_PLAN_CANDIDATE_TABLES=Object.freeze([
 "cwl_cloud_profiles","cwl_plan_review_state",
 "cwl_group_archives","cwl_own_lineup_archives"
]);
function checkPlanStageReply(reply,{targetClanId,stage,expectedRevision}){
 if(reply.error||!record(reply.data))
  reject("Der geschützte Plan-/Archiv-Vergleich ist fehlgeschlagen.");
 const x=reply.data;
 if(x.scope!=="plan-archive-review-only"||x.target_clan_id!==targetClanId||
    x.target_revision!==expectedRevision||x.staged!==stage||
    x.mutation_permitted!==false||x.active_plan_modified!==false||
    x.archives_modified!==false||!Number.isSafeInteger(x.target_protected_days)||
    x.target_protected_days<0||!["group_archives","own_lineup_archives"].every(k=>
      record(x[k])&&["new","identical","conflict"].every(n=>
        Number.isSafeInteger(x[k][n])&&x[k][n]>=0))||
    (stage&&!uuidPattern.test(x.candidate_id||"")))
  reject("Unvollständige oder ungültige Antwort zur Plan-Wiederherstellung.");
 return x;
}
export async function previewPortablePlanArchiveRecovery({
 sb,file,sourceClanId,targetClanId,stage=false,confirmation=null
}){
 if(!sb?.rpc||!uuidPattern.test(targetClanId||"")||
    (stage!==true&&stage!==false)||
    (stage&&confirmation!=="STAGE_PLAN_FOR_MANUAL_REVIEW"))
  reject("Ein gültiger Zielclan und eine ausdrückliche Bestätigung sind erforderlich.");
 const verified=await verifyPortableCloudBackup(file);
 const source=extractPortableFactSource(verified,sourceClanId);
 // The target is fetched through the already-live owner+membership+RLS RPC.
 const target=await exportOwnerCloudSnapshot({sb,clanIds:[targetClanId]});
 const selected=target.clans[0];
 if(!selected||!selected.clash_tag||selected.clash_tag!==source.clash_tag)
  reject("Quell- und Zielclan stimmen nicht überein.");
 const revision=selected.tables.cwl_cloud_profiles[0].revision;
 if(!Number.isSafeInteger(revision)||revision<1)
  reject("Planrevision fehlt; neu laden.");
 const proposal={
  source_clan_id:source.source_clan_id,
  clash_tag:source.clash_tag,
  tables:Object.fromEntries(PORTABLE_PLAN_CANDIDATE_TABLES.map(k=>[k,source.tables[k]]))
 };
 const reply=await sb.rpc("cwl_stage_portable_plan_recovery",{
  p_target:targetClanId,p_source:proposal,p_expected_revision:revision,
  p_stage:stage,p_confirmation:stage?confirmation:null
 });
 const checked=checkPlanStageReply(reply,{targetClanId,stage,expectedRevision:revision});
 return {...checked,mutationPermitted:false,
  source_backup_sha256:file.sha256,
  target_snapshot_sha256:target.sha256,
  target_snapshot_consistency:target.consistency,
  warning:"Nur geschützte Vorschau/Ablage. Der aktive CWL-Plan, gespielte Tage und Collector-Archive bleiben unverändert. Es gibt noch keinen vollständigen App-Restore."};
}


// #178 Phase 3c. An owner may restore ONLY members, day goals and config to a
// pristine, unused target. All locks, histories, audit and collector archives
// remain untouched. Not a full-plan or full-app import; UI intentionally off.
// The SQL RPC enforces ownership, candidate/source identity, CAS and same-TXN
// before/after checkpoint independently of these browser checks.
function validatePristineApplyResult(reply,{candidateId,targetClanId,expectedRevision,apply}){
 if(reply.error||!record(reply.data))
   reject("Der geschützte Plan-Import wurde vom Server abgelehnt.");
 const x=reply.data;
 if(x.scope!=="pristine-plan-planning-only"||
   x.target_clan_id!==targetClanId||x.candidate_id!==candidateId||
   x.expected_revision!==expectedRevision||x.applied!==apply||
   x.locks_preserved!==true||x.archives_preserved!==true||
   x.plan_approval_preserved!==true||
   !Number.isSafeInteger(x.protected_days)||x.protected_days<0||
   !Number.isSafeInteger(x.existing_archive_rows)||x.existing_archive_rows<0||
   !Number.isSafeInteger(x.existing_wars)||x.existing_wars<0||
   !Number.isSafeInteger(x.pending_editor_suggestions)||
   x.pending_editor_suggestions<0||
   !Number.isSafeInteger(x.member_count)||x.member_count<0||
   typeof x.eligible_for_empty_target_apply!=="boolean"||
   typeof x.target_is_empty!=="boolean"||
   typeof x.has_changes!=="boolean"||
   typeof x.matches_staging_baseline!=="boolean"||
   JSON.stringify(x.restored_fields)!==JSON.stringify(["members","dayGoals","config"])||
   !Number.isSafeInteger(x.result_revision)||
   x.result_revision!==expectedRevision+(apply?1:0)||
   (apply&&(!x.eligible_for_empty_target_apply||
     !uuidPattern.test(x.checkpoint_id||""))))
   reject("Der Server hat einen unvollständigen Plan-Import gemeldet.");
 return x;
}
export async function previewPortablePristinePlanApply({sb,candidateId,targetClanId}){
 if(!sb?.rpc||!uuidPattern.test(candidateId||"")||
   !uuidPattern.test(targetClanId||""))
   reject("Ungültiger Plan-Kandidat oder Zielclan.");
 const snapshot=await exportOwnerCloudSnapshot({sb,clanIds:[targetClanId]});
 const revision=snapshot.clans[0]?.tables?.cwl_cloud_profiles?.[0]?.revision;
 if(!Number.isSafeInteger(revision)||revision<1)reject("Aktuelle Planrevision fehlt.");
 const reply=await sb.rpc("cwl_apply_portable_pristine_plan",{
   p_candidate:candidateId,p_expected_revision:revision,p_apply:false,p_confirmation:null
 });
 const x=validatePristineApplyResult(reply,{
   candidateId,targetClanId,expectedRevision:revision,apply:false
 });
 return {...x,expectedRevision:revision,mutationPermitted:false,
   target_snapshot_consistency:snapshot.consistency,
   warning:"Nur Mitglieder, Einsatzziele und Planungseinstellungen in einen noch unbenutzten Clan. Gespielte Tage, Aufstellungen und Archivdaten werden nicht importiert."};
}
export async function applyPortablePristinePlan({
 sb,candidateId,targetClanId,expectedRevision,confirmation
}){
 if(!sb?.rpc||!uuidPattern.test(candidateId||"")||
   !uuidPattern.test(targetClanId||"")||
   !Number.isSafeInteger(expectedRevision)||expectedRevision<1||
   confirmation!=="APPLY_TO_EMPTY_CWL_PLAN")
   reject("Gültiger Zielstand und ausdrückliche Plan-Import-Bestätigung erforderlich.");
 const snapshot=await exportOwnerCloudSnapshot({sb,clanIds:[targetClanId]});
 if(snapshot.clans[0]?.tables?.cwl_cloud_profiles?.[0]?.revision!==expectedRevision)
   reject("Zielplan hat sich seit der Vorschau geändert.");
 const reply=await sb.rpc("cwl_apply_portable_pristine_plan",{
   p_candidate:candidateId,p_expected_revision:expectedRevision,
   p_apply:true,p_confirmation:confirmation
 });
 return validatePristineApplyResult(reply,{
   candidateId,targetClanId,expectedRevision,apply:true
 });
}


// Proof-of-origin is a separate server authorization step. A client SHA
// alone is not a signature, and this optional receipt MUST be looked up
// again on the server prior to any future high-trust archive recovery.
// This is deliberately not a generic full-restore/write API.
export async function exportWitnessedOwnerCloudSnapshot({sb,clanIds}){
 if(!sb?.rpc||!sb?.auth?.getUser||!Array.isArray(clanIds)||
    clanIds.length<1||clanIds.length>30||
    new Set(clanIds).size!==clanIds.length||
    !clanIds.every(id=>uuidPattern.test(id||"")))
  reject("Ungültige eigene Clanauswahl.");
 const before=await sb.auth.getUser();
 const actor=before.data?.user?.id;
 if(before.error||!uuidPattern.test(actor||""))
  reject("Anmeldung konnte nicht geprüft werden.");
 const response=await sb.rpc("cwl_issue_owned_backup_witness",{p_clan_ids:clanIds});
 if(response.error||!record(response.data)||
    !record(response.data.snapshot)||!record(response.data.server_receipt))
  reject("Der sichere Cloud-Export konnte nicht bestätigt werden.");
 const payload=response.data.snapshot,receipt=response.data.server_receipt;
 requireKeys(payload,["kind","format_version","created_at","consistency","clans"],"Server-Snapshot");
 if(payload.kind!==PORTABLE_CLOUD_BACKUP_KIND||
   payload.format_version!==PORTABLE_CLOUD_BACKUP_FORMAT||
   payload.consistency!=="server-stable-statement"||
   !Array.isArray(payload.clans)||payload.clans.length!==clanIds.length||
   new Set(payload.clans.map(c=>c.source_clan_id)).size!==clanIds.length||
   payload.clans.some(c=>!clanIds.includes(c.source_clan_id))||
   receipt.owner_user_id!==actor||receipt.snapshot_at!==payload.created_at)
  reject("Der Server-Snapshot gehört nicht vollständig zu den eigenen Clans.");
 // PostgreSQL hashes the canonical JSONB text. The browser never
 // guesses that digest; the server must verify it on subsequent import.
 if(!/^[a-f0-9]{64}$/.test(receipt.payload_sha256||"")||
    !uuidPattern.test(receipt.id||""))
  reject("Ungültiger Server-Herkunftsbeleg.");
 const after=await sb.auth.getUser();
 if(after.error||after.data?.user?.id!==actor)
  reject("Benutzersitzung hat sich während des Exports geändert.");
 return createPortableCloudBackup({
  clans:payload.clans,createdAt:payload.created_at,
  consistency:payload.consistency,serverReceipt:receipt
 });
}

export async function verifyWitnessedOwnerCloudBackup({sb,file,mapping}){
 if(!sb?.rpc)reject("Keine Cloud-Verbindung für die Herkunftsprüfung.");
 const verified=await verifyPortableCloudBackup(file);
 const receipt=verified.server_receipt;
 if(!receipt)reject("Diese ältere Sicherung enthält keinen serverseitigen Herkunftsbeleg.");
 if(verified.consistency!=="server-stable-statement")
  reject("Nicht-atomare Quelldaten dürfen nicht als vollständiger Restore gelten.");
 if(!record(mapping))reject("Die Zielclans müssen ausdrücklich zugeordnet werden.");
 const sources=verified.clans.map(c=>c.source_clan_id);
 requireKeys(mapping,sources,"Zielzuordnung");
 if(Object.keys(mapping).length!==sources.length)
  reject("Nicht alle Quellclans wurden zugeordnet.");
 const targets=sources.map(s=>mapping[s]);
 if(targets.some(t=>!uuidPattern.test(t||""))||
   new Set(targets).size!==targets.length)
  reject("Ungültige oder doppelte Wiederherstellungsziele.");
 const body={...verified};delete body.server_receipt;
 const reply=await sb.rpc("cwl_verify_owned_backup_witness",{
  p_receipt_id:receipt.id,p_payload:body,p_target_clan_ids:targets
 });
 if(reply.error||!record(reply.data)||
    reply.data.verified!==true||
    reply.data.scope!=="server-origin-17-table-snapshot"||
    reply.data.receipt_id!==receipt.id||
    reply.data.payload_sha256!==receipt.payload_sha256||
    reply.data.source_clan_count!==sources.length||
    !Array.isArray(reply.data.target_clan_ids)||
    targets.some((id,i)=>reply.data.target_clan_ids[i]!==id))
  reject("Die Datenbank konnte die Originalherkunft der Sicherung nicht bestätigen.");
 return {verified:true,sourceClans:sources.length,targetClans:targets,
   verifiedSnapshotDigest:receipt.payload_sha256,
   // Valid provenance does not grant full-write permissions.
   fullRestoreAvailable:false,mutationPermitted:false};
}


// #178: genuine, single-transaction recovery for missing ORIGINAL historical
// rows only. This is intentionally NOT the public full-app Restore action.
// The current owner clan ID, full live plan and its revision MUST be intact.
// Every write is authorized and origin-verified again inside PostgreSQL.
const WITNESSED_HISTORY_CONFIRMATION="RESTORE_WITNESSED_MISSING_HISTORY";
function witnessedHistorySource(verified,targetClanId){
 if(!uuidPattern.test(targetClanId||"")||
    verified.consistency!=="server-stable-statement"||
    !verified.server_receipt||verified.clans.length!==1||
    verified.clans[0].source_clan_id!==targetClanId)
  reject("Dieser sichere Historien-Restore setzt den unveränderten ursprünglichen Clan und einen Server-Herkunftsbeleg voraus.");
 return verified.clans[0];
}
function checkedHistoryReply(reply,{targetClanId,apply}){
 const value=reply?.data;
 if(reply.error||!record(value)||
    value.scope!=="witnessed-same-clan-missing-history"||
    value.clan_id!==targetClanId||
    value.full_app_restore!==false||
    !Number.isSafeInteger(value.new)||value.new<0||
    !Number.isSafeInteger(value.conflict)||value.conflict<0)
  reject("Server konnte den geschützten Historien-Restore nicht bestätigen.");
 if(!apply){
  if(value.applied!==false||value.mutation_permitted!==false||
     !/^[a-f0-9]{64}$/.test(value.target_fingerprint||"")||
     !Number.isSafeInteger(value.expected_revision)||value.expected_revision<1||
     !record(value.tables))
   reject("Ungültige schreibgeschützte Historien-Vorschau.");
 }else if(value.applied!==true&&
    !(value.applied===false&&value.already_complete===true&&value.new===0)){
   reject("Der Server hat die angeforderte Wiederherstellung nicht bestätigt.");
 }else if(value.applied===true&&
    (!uuidPattern.test(value.checkpoint_id||"")||value.conflict!==0)){
   reject("Der unveränderliche Vorher-Sicherungspunkt fehlt.");
 }
 return value;
}
function witnessedPayload(verified){
 const body={...verified};delete body.server_receipt;return body;
}
export async function previewWitnessedMissingHistoryRestore({sb,file,targetClanId}){
 if(!sb?.rpc)reject("Supabase-Sitzung ist nicht bereit.");
 const verified=await verifyPortableCloudBackup(file);
 const source=witnessedHistorySource(verified,targetClanId);
 const target=await exportOwnerCloudSnapshot({sb,clanIds:[targetClanId]});
 const current=target.clans[0];
 if(!current||current.clash_tag!==source.clash_tag)
  reject("Originaler Clan-Tag stimmt nicht mit dem aktuellen Besitzer-Clan überein.");
 const revision=current.tables.cwl_cloud_profiles[0].revision;
 if(!Number.isSafeInteger(revision)||revision<1)
  reject("Aktuelle Planrevision ist ungültig.");
 await verifyWitnessedOwnerCloudBackup({sb,file,mapping:{[targetClanId]:targetClanId}});
 const reply=await sb.rpc("cwl_restore_witnessed_missing_history",{
  p_receipt_id:verified.server_receipt.id,
  p_payload:witnessedPayload(verified),
  p_clan_id:targetClanId,p_expected_revision:revision,
  p_expected_target_fingerprint:null,p_apply:false,p_confirmation:null
 });
 return {...checkedHistoryReply(reply,{targetClanId,apply:false}),
  backupSha256:file.sha256,fullRestoreAvailable:false,mutationPermitted:false};
}
export async function applyWitnessedMissingHistoryRestore({
 sb,file,targetClanId,expectedRevision,expectedTargetFingerprint,confirmation
}){
 if(!sb?.rpc||confirmation!==WITNESSED_HISTORY_CONFIRMATION||
    !Number.isSafeInteger(expectedRevision)||expectedRevision<1||
    !/^[a-f0-9]{64}$/.test(expectedTargetFingerprint||""))
  reject("Ausdrückliche Historien-Restore-Bestätigung und aktuelle Vorschau erforderlich.");
 const verified=await verifyPortableCloudBackup(file);
 const source=witnessedHistorySource(verified,targetClanId);
 const target=await exportOwnerCloudSnapshot({sb,clanIds:[targetClanId]});
 const current=target.clans[0];
 if(!current||current.clash_tag!==source.clash_tag||
    current.tables.cwl_cloud_profiles[0].revision!==expectedRevision)
  reject("Zielclan oder Planrevision hat sich seit der Vorschau verändert.");
 await verifyWitnessedOwnerCloudBackup({sb,file,mapping:{[targetClanId]:targetClanId}});
 const reply=await sb.rpc("cwl_restore_witnessed_missing_history",{
  p_receipt_id:verified.server_receipt.id,
  p_payload:witnessedPayload(verified),
  p_clan_id:targetClanId,p_expected_revision:expectedRevision,
  p_expected_target_fingerprint:expectedTargetFingerprint,
  p_apply:true,p_confirmation:WITNESSED_HISTORY_CONFIRMATION
 });
 return {...checkedHistoryReply(reply,{targetClanId,apply:true}),
  fullRestoreAvailable:false,mutationPermitted:false};
}


// #178 – Complete original 17-dataset replay onto a fresh, owner-linked
// replacement clan UUID. NOT exposed in the public app while the full
// multi-clan/device/disaster-recovery release gates remain unfinished.
// All authorization, pristine-state and immutable source proofs are checked
// again under one transaction by PostgreSQL; client checks are only UX.
const PRISTINE_REPLACEMENT_CONFIRMATION="RESTORE_ORIGINAL_TO_EMPTY_CLAN";
function validatedReplacementSource(verified,sourceClanId,targetClanId){
 if(verified.consistency!=="server-stable-statement"||
    !verified.server_receipt||verified.clans.length!==1||
    !uuidPattern.test(sourceClanId||"")||!uuidPattern.test(targetClanId||"")||
    sourceClanId===targetClanId||
    verified.clans[0]?.source_clan_id!==sourceClanId)
  reject("Ein neuer, leerer Zielclan und die originale 17-Bereiche-Datei mit Serverbeleg sind erforderlich.");
 return verified.clans[0];
}
function assertPristineReplacementResult(reply,{sourceClanId,targetClanId,apply}){
 const v=reply?.data;
 if(reply.error||!record(v)||
    v.scope!=="verified-pristine-new-clan-17-datasets"||
    v.source_clan_id!==sourceClanId||
    v.target_clan_id!==targetClanId||
    v.restored_table_count!==17||
    v.public_full_restore_available!==false||
    v.mutation_permitted!==false||
    !Number.isSafeInteger(v.source_rows)||v.source_rows<0||
    !Number.isSafeInteger(v.source_locked_days)||
    v.source_locked_days<0||v.source_locked_days>7)
  reject("Der geprüfte Neuaufbau von 17 Datengruppen wurde serverseitig nicht bestätigt.");
 if(!apply){
  if(v.applied!==false||!/^[a-f0-9]{64}$/.test(v.target_fingerprint||"")||
    !Number.isSafeInteger(v.expected_revision)||v.expected_revision<1||
    !Number.isSafeInteger(v.source_archive_rows)||v.source_archive_rows<0)
   reject("Keine vollständige schreibgeschützte Neuaufbau-Vorschau.");
 }else if(v.applied!==true||!uuidPattern.test(v.checkpoint_id||"")||
     !Number.isSafeInteger(v.applied_revision)||v.applied_revision<2)
  reject("Es wurde kein atomarer, durch Checkpoint belegter Neuaufbau bestätigt.");
 return v;
}
export async function previewWitnessedPristineClanRestore({
 sb,file,sourceClanId,targetClanId
}){
 if(!sb?.rpc)reject("Keine Cloud-Verbindung für die Original-Wiederherstellung.");
 const verified=await verifyPortableCloudBackup(file);
 const source=validatedReplacementSource(verified,sourceClanId,targetClanId);
 const target=await exportOwnerCloudSnapshot({sb,clanIds:[targetClanId]});
 const destination=target.clans?.[0];
 if(!destination||destination.clash_tag!==source.clash_tag||
    destination.source_clan_id!==targetClanId)
  reject("Der Ersatzclan muss denselben Clash-Tag haben und dem Besitzer gehören.");
 const revision=destination.tables?.cwl_cloud_profiles?.[0]?.revision;
 if(!Number.isSafeInteger(revision)||revision<1)
  reject("Ungültige Revision des neuen Clanprofils.");
 await verifyWitnessedOwnerCloudBackup({sb,file,mapping:{[sourceClanId]:targetClanId}});
 const payload={...verified};delete payload.server_receipt;
 const reply=await sb.rpc("cwl_restore_witnessed_pristine_clan",{
  p_receipt_id:verified.server_receipt.id,
  p_payload:payload,p_target_clan_id:targetClanId,
  p_expected_revision:revision,p_expected_target_fingerprint:null,
  p_apply:false,p_confirmation:null
 });
 return {...assertPristineReplacementResult(reply,{sourceClanId,targetClanId,apply:false}),
   backupSha256:file.sha256,fullRestoreAvailable:false,mutationPermitted:false};
}
export async function applyWitnessedPristineClanRestore({
 sb,file,sourceClanId,targetClanId,expectedRevision,
 expectedTargetFingerprint,confirmation
}){
 if(!sb?.rpc||confirmation!==PRISTINE_REPLACEMENT_CONFIRMATION||
   !Number.isSafeInteger(expectedRevision)||expectedRevision<1||
   !/^[a-f0-9]{64}$/.test(expectedTargetFingerprint||""))
  reject("Für den vollständigen Neuaufbau sind die aktuelle Vorschau und die ausdrückliche Bestätigung notwendig.");
 const verified=await verifyPortableCloudBackup(file);
 const source=validatedReplacementSource(verified,sourceClanId,targetClanId);
 const target=await exportOwnerCloudSnapshot({sb,clanIds:[targetClanId]});
 const destination=target.clans?.[0];
 if(!destination||destination.clash_tag!==source.clash_tag||
    destination.source_clan_id!==targetClanId||
    destination.tables?.cwl_cloud_profiles?.[0]?.revision!==expectedRevision)
  reject("Der Ersatzclan oder seine Planrevision hat sich seit der Vorschau geändert.");
 await verifyWitnessedOwnerCloudBackup({sb,file,mapping:{[sourceClanId]:targetClanId}});
 const payload={...verified};delete payload.server_receipt;
 const reply=await sb.rpc("cwl_restore_witnessed_pristine_clan",{
  p_receipt_id:verified.server_receipt.id,p_payload:payload,
  p_target_clan_id:targetClanId,p_expected_revision:expectedRevision,
  p_expected_target_fingerprint:expectedTargetFingerprint,
  p_apply:true,p_confirmation:PRISTINE_REPLACEMENT_CONFIRMATION
 });
 return {...assertPristineReplacementResult(reply,{sourceClanId,targetClanId,apply:true}),
   fullRestoreAvailable:false,mutationPermitted:false};
}


// #178 – internal multi-clan 17-area recovery. The public Cloud app does
// NOT call these adapters until the complete backup UI/device release gate.
// A single witnessed 2–10-clan source maps to exactly N different, owner
// controlled, unused replacement clans in the same original source order.
// PostgreSQL performs ALL writes in ONE transaction and owns final authority.
const MULTI_CLAN_RESTORE_CONFIRMATION="RESTORE_ALL_VERIFIED_EMPTY_CLANS";
function witnessedMultiMapping(verified,mapping){
 if(!verified.server_receipt||
    verified.consistency!=="server-stable-statement"||
    verified.clans.length<2||verified.clans.length>10||
    !record(mapping))
   reject("Mehrclan-Restore benötigt 2 bis 10 original belegte Clans aus EINER Datei.");
 const sources=verified.clans.map(c=>c.source_clan_id);
 requireKeys(mapping,sources,"Mehrclan-Zielzuordnung");
 if(Object.keys(mapping).length!==sources.length)
  reject("Alle Quellclans müssen vollständig und genau einmal zugeordnet werden.");
 const targets=sources.map(s=>mapping[s]);
 if(targets.some((t,i)=>!uuidPattern.test(t||"")||t===sources[i])||
    new Set(targets).size!==targets.length)
  reject("Jeder Quellclan benötigt einen anderen, eindeutigen neuen Zielclan.");
 return {sources,targets};
}
function verifiedMultiPreviewResponse(reply,{sources,targets}){
 const v=reply?.data;
 if(reply?.error||!record(v)||
    v.scope!=="verified-multi-pristine-clan-17-datasets"||
    v.applied!==false||v.mutation_permitted!==false||
    v.public_full_restore_available!==false||
    v.source_clan_count!==sources.length||
    v.target_clan_count!==targets.length||
    !Array.isArray(v.previews)||v.previews.length!==sources.length||
    !Array.isArray(v.source_clan_ids)||!Array.isArray(v.target_clan_ids)||
    v.source_clan_ids.some((id,i)=>id!==sources[i])||
    v.target_clan_ids.some((id,i)=>id!==targets[i])||
    !Number.isSafeInteger(v.source_rows)||v.source_rows<0)
  reject("Die atomare schreibgeschützte Mehrclan-Vorschau ist ungültig.");
 v.previews.forEach((row,i)=>{
  if(!record(row)||row.scope!=="verified-pristine-new-clan-17-datasets"||
     row.source_clan_id!==sources[i]||row.target_clan_id!==targets[i]||
     row.applied!==false||row.restored_table_count!==17||
     !Number.isSafeInteger(row.expected_revision)||row.expected_revision<1||
     !/^[0-9a-f]{64}$/.test(row.target_fingerprint||""))
   reject("Nicht alle Clan-Vorschauen wurden serverseitig bestätigt.");
 });
 return v;
}
function verifiedMultiApplyResponse(reply,{sources,targets}){
 const v=reply?.data;
 if(reply?.error||!record(v)||
    v.scope!=="verified-multi-pristine-clan-17-datasets"||
    v.applied!==true||v.mutation_permitted!==false||
    v.public_full_restore_available!==false||
    v.source_clan_count!==sources.length||
    v.target_clan_count!==targets.length||
    !uuidPattern.test(v.recovery_session_id||"")||
    !Array.isArray(v.checkpoints)||v.checkpoints.length!==targets.length||
    !Array.isArray(v.restores)||v.restores.length!==targets.length||
    v.checkpoints.some(x=>!uuidPattern.test(x||""))||
    !Array.isArray(v.source_clan_ids)||!Array.isArray(v.target_clan_ids)||
    v.source_clan_ids.some((id,i)=>id!==sources[i])||
    v.target_clan_ids.some((id,i)=>id!==targets[i]))
  reject("Der gemeinsame Wiederherstellungs-Checkpoint aller Clans fehlt.");
 v.restores.forEach((row,i)=>{
  if(!record(row)||row.scope!=="verified-pristine-new-clan-17-datasets"||
    row.applied!==true||row.restored_table_count!==17||
    row.source_clan_id!==sources[i]||row.target_clan_id!==targets[i]||
    row.checkpoint_id!==v.checkpoints[i]||
    !Number.isSafeInteger(row.applied_revision)||row.applied_revision<2)
   reject("Der Server hat nicht alle Clan-Restores atomar bestätigt.");
 });
 return v;
}
export async function previewWitnessedMultiClanRestore({sb,file,mapping}){
 if(!sb?.rpc)reject("Keine Cloud-Sitzung für vollständigen Mehrclan-Restore.");
 const verified=await verifyPortableCloudBackup(file);
 const {sources,targets}=witnessedMultiMapping(verified,mapping);
 const dest=await exportOwnerCloudSnapshot({sb,clanIds:targets});
 const targetById=new Map(dest.clans.map(c=>[c.source_clan_id,c]));
 const revisions=sources.map((id,i)=>{
  const d=targetById.get(targets[i]);
  if(!d||d.clash_tag!==verified.clans[i].clash_tag)
   reject("Mindestens ein Ersatzclan ist nicht identisch mit seinem Clash-Clan.");
  const rev=d.tables?.cwl_cloud_profiles?.[0]?.revision;
  if(!Number.isSafeInteger(rev)||rev<1)
   reject("Ungültige Ziel-Planrevision eines Ersatzclans.");
  return rev;
 });
 await verifyWitnessedOwnerCloudBackup({sb,file,mapping});
 const body={...verified};delete body.server_receipt;
 const reply=await sb.rpc("cwl_restore_witnessed_multi_clans",{
  p_receipt_id:verified.server_receipt.id,p_payload:body,
  p_target_clan_ids:targets,p_expected_revisions:revisions,
  p_expected_target_fingerprints:null,p_apply:false,p_confirmation:null
 });
 return {...verifiedMultiPreviewResponse(reply,{sources,targets}),
  backupSha256:file.sha256,fullRestoreAvailable:false,mutationPermitted:false};
}
export async function applyWitnessedMultiClanRestore({
 sb,file,mapping,expectedRevisions,expectedTargetFingerprints,confirmation
}){
 if(!sb?.rpc||confirmation!==MULTI_CLAN_RESTORE_CONFIRMATION)
  reject("Für ALLE Clans ist eine ausdrückliche Mehrclan-Restore-Bestätigung erforderlich.");
 const verified=await verifyPortableCloudBackup(file);
 const {sources,targets}=witnessedMultiMapping(verified,mapping);
 if(!Array.isArray(expectedRevisions)||expectedRevisions.length!==sources.length||
    expectedRevisions.some(x=>!Number.isSafeInteger(x)||x<1)||
    !Array.isArray(expectedTargetFingerprints)||
    expectedTargetFingerprints.length!==sources.length||
    expectedTargetFingerprints.some(x=>!/^[0-9a-f]{64}$/.test(x||"")))
  reject("Es fehlt eine frische vollständige Vorschau für jeden Ersatzclan.");
 const dest=await exportOwnerCloudSnapshot({sb,clanIds:targets});
 const targetById=new Map(dest.clans.map(c=>[c.source_clan_id,c]));
 sources.forEach((id,i)=>{
  const d=targetById.get(targets[i]);
  if(!d||d.clash_tag!==verified.clans[i].clash_tag||
    d.tables?.cwl_cloud_profiles?.[0]?.revision!==expectedRevisions[i])
   reject("Ein Zielclan oder seine Planrevision hat sich seit der Vorschau geändert.");
 });
 await verifyWitnessedOwnerCloudBackup({sb,file,mapping});
 const body={...verified};delete body.server_receipt;
 const reply=await sb.rpc("cwl_restore_witnessed_multi_clans",{
  p_receipt_id:verified.server_receipt.id,p_payload:body,
  p_target_clan_ids:targets,p_expected_revisions:expectedRevisions,
  p_expected_target_fingerprints:expectedTargetFingerprints,
  p_apply:true,p_confirmation:MULTI_CLAN_RESTORE_CONFIRMATION
 });
 return {...verifiedMultiApplyResponse(reply,{sources,targets}),
  fullRestoreAvailable:false,mutationPermitted:false};
}
