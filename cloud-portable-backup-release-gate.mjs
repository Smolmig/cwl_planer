// #178 release gate: a self-contained FULL 17-table Cloud-App export is
// NOT equivalent to a complete, safe, atomic 17-table restore. Do not
// activate either public restore button or claim full roundtrip prematurely.
// This contract has no writes and is safe to use for integration/UAT.
import {
 PORTABLE_CLOUD_TABLES,
 PORTABLE_BACKUP_BYTE_LIMIT,
 exportWitnessedOwnerCloudSnapshot,
 verifyWitnessedOwnerCloudBackup,
 verifyPortableCloudBackup,
 previewOwnerCloudRestore
} from "./cloud-portable-backup-core.mjs";

const tableByName=new Map(PORTABLE_CLOUD_TABLES.map(t=>[t.name,t]));
const statusLabels=Object.freeze({
 new:"neu",
 identical:"bereits vorhanden",
 conflict:"widersprüchlich",
 reviewOnly:"gesonderte Prüfung nötig"
});
const forbidden=["__proto__","constructor","prototype"];
const fail=s=>{throw new Error("Cloud-Backup: "+s);};
const safeId=s=>/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s||"");
function requireRowCounts(item){
 if(!item||typeof item!=="object"||Array.isArray(item))fail("Prüfergebnis fehlt.");
 for(const name of Object.keys(item)){
  if(!tableByName.has(name)||forbidden.includes(name))fail("Unerwartete Tabelle.");
 }
 for(const spec of PORTABLE_CLOUD_TABLES){
  const x=item[spec.name];
  if(!x||typeof x!=="object"||Array.isArray(x))fail("Fehlender Datensatzbereich: "+spec.name);
  for(const field of ["new","identical","conflict","reviewOnly"]){
   if(!Number.isSafeInteger(x[field])||x[field]<0)fail("Ungültiger Zähler: "+spec.name);
  }
  // Older previews did not include this reverse-diff field.
  if(x.targetOnly!==undefined&&(!Number.isSafeInteger(x.targetOnly)||
     x.targetOnly<0||x.targetOnly>100000))fail("Ungültige neuere Zieldaten: "+spec.name);
 }
}
/**
 * Summarizes a *server-RLS-checked* preview. Unsupported data is explicitly
 * surfaced instead of silently skipped. Never returns permission to apply.
 */
export function summarizePortableRestoreCoverage(preview){
 if(!preview||!Array.isArray(preview.clans)||preview.clans.length<1||
    preview.mutationPermitted!==false)fail("Ungültige Read-only-Vorschau.");
 const seen=new Set(),clans=[],overall={
  total:0,new:0,identical:0,conflict:0,reviewOnly:0,targetOnly:0
 };
 for(const clan of preview.clans){
  if(!safeId(clan?.source_clan_id)||!safeId(clan?.target_clan_id)||
     seen.has(clan.source_clan_id))fail("Ungültige Quell-/Zielzuordnung.");
  seen.add(clan.source_clan_id);
  requireRowCounts(clan.tables);
  const rows=[],counts={total:0,new:0,identical:0,conflict:0,reviewOnly:0,targetOnly:0};
  for(const spec of PORTABLE_CLOUD_TABLES){
   const x=clan.tables[spec.name];
   const total=x.new+x.identical+x.conflict+x.reviewOnly;
   if(!Number.isSafeInteger(total)||total>100000)fail("Zähler außerhalb des Datenvertrags.");
   for(const k of ["new","identical","conflict","reviewOnly"])counts[k]+=x[k];
   counts.total+=total;
   counts.targetOnly+=x.targetOnly??0;
   rows.push({
    table:spec.name,category:spec.category,
    ...Object.fromEntries(["new","identical","conflict","reviewOnly"].map(k=>[k,x[k]])),
    count:total,
    targetOnly:x.targetOnly??0,
    keepsNewerTarget:(x.targetOnly??0)>0,
    requiresRecovery:x.new>0||x.conflict>0||x.reviewOnly>0,
    note:spec.category==="archive"?"Offizielles Collector-Archiv: fehlende Daten sind kein verifizierter API-Beleg.":
      spec.category==="audit"?"Historischer Entscheidungs-/Änderungsnachweis: nicht als neuer Autor importieren.":
      spec.category==="observed"?"Beobachtung: nicht rückwirkend als aktuelle API-Beobachtung werten.":
      spec.category==="plan"?"Pläne, Sperren und Einstellungen brauchen transaktionale Owner-CAS-Prüfung.":
      "Kriegsfakten benötigen source- und API-qualitätsgeschützten Insert."
   });
  }
  for(const key of Object.keys(counts))overall[key]+=counts[key];
  clans.push({
   source_clan_id:clan.source_clan_id,target_clan_id:clan.target_clan_id,
   counts,rows,
   incompleteAreas:rows.filter(x=>x.requiresRecovery).map(x=>x.table)
  });
 }
 const nothingToImport=overall.new===0&&overall.conflict===0&&overall.reviewOnly===0;
 const noChanges=nothingToImport&&overall.targetOnly===0;
 return {
  formatVersion:preview.format_version,
  createdAt:preview.created_at,
  clanCount:clans.length,
  tablesPerClan:PORTABLE_CLOUD_TABLES.length,
  counts:overall,
  clans,
  alreadyIdentical:noChanges,
  nothingToImport,
  targetHasAdditionalData:overall.targetOnly>0,
  // A full restore is not a sequence of the existing per-table RPCs.
  // Never claim a successful atomic full-app roundtrip here.
  fullRestoreAvailable:false,
  mutationPermitted:false,
  explanation:nothingToImport?
   (overall.targetOnly>0?
    "Alle Datensätze der Sicherung sind bereits vorhanden. Im Zielclan liegen zusätzlich neuere Daten, die erhalten bleiben müssen. Ein Import ist nicht erforderlich.":
    "Alle geprüften Nutzdaten sind bereits vorhanden. Es ist kein Import erforderlich."):
   "Die Datei ist lesbar, aber nicht vollständig transaktional rückspielbar. Eine Wiederherstellung würde sonst Pläne, verifizierte Archive, Regeln, Entscheidungen oder Beobachtungen auslassen. Es wurden keine Daten geändert.",
  canDownloadCompleteBackup:true
 };
}
/**
 * Creates exactly ONE downloadable, independently checksummed JSON file.
 * Auth/roles/secrets and operational checkpoint tables are excluded.
 * The trusted exportOwnerCloudSnapshot enforces owner membership, MVCC and
 * 17-table field-level allowlists. The serializer is verified again.
 */
export async function preparePortableOwnerBackupDownload({sb,clanIds}){
 const snapshot=await exportWitnessedOwnerCloudSnapshot({sb,clanIds});
 const full=JSON.stringify(snapshot,null,2);
 const bytes=new TextEncoder().encode(full);
 if(!bytes.length||bytes.byteLength>PORTABLE_BACKUP_BYTE_LIMIT)
  fail("Backup-Datei überschreitet die sichere Größenbegrenzung.");
 const verified=await verifyPortableCloudBackup(JSON.parse(full));
 if(verified.clans.length!==clanIds.length)
  fail("Nicht alle Clans sind im Download enthalten.");
 for(const clan of verified.clans){
  if(!clanIds.includes(clan.source_clan_id))fail("Fremder Clan im Export.");
  if(Object.keys(clan.tables).length!==PORTABLE_CLOUD_TABLES.length)
   fail("Unvollständiger Tabellenumfang.");
 }
 const stamp=verified.created_at.slice(0,10);
 return {
  filename:"CWL_Cloud_App_Backup_"+stamp+"_"+verified.clans.length+"-Clans.json",
  json:full,
  byteLength:bytes.byteLength,
  createdAt:verified.created_at,
  sha256:snapshot.sha256,
  clanCount:verified.clans.length,
  dataTables:PORTABLE_CLOUD_TABLES.length,
  // Important: do not allow a download success toast to imply restore ready.
  completeExport:true,
  fullRestoreAvailable:false,
  originReceiptId:snapshot.server_receipt?.id??null
 };
}
/**
 * 128MB input guard: never silently parse arbitrarily large or partial files.
 * Mapping supplied by UI is re-authorized against live owned target snapshots.
 */
export async function inspectPortableOwnerRestoreFile({sb,fileText,mapping}){
 if(typeof fileText!=="string"||!fileText||
    new TextEncoder().encode(fileText).byteLength>PORTABLE_BACKUP_BYTE_LIMIT)
  fail("Ungültige oder zu große Cloud-Datei.");
 let file;
 try{file=JSON.parse(fileText);}catch{fail("Die Datei enthält kein gültiges JSON.");}
 const verified=await verifyPortableCloudBackup(file);
 if(verified.consistency!=="server-stable-statement")
  fail("Nur vollständige, konsistente Server-Snapshots sind für die Cloud-Wiederherstellung zulässig.");
 const origin=file.server_receipt?
  await verifyWitnessedOwnerCloudBackup({sb,file,mapping}):null;
 const preview=await previewOwnerCloudRestore({sb,file,mapping});
 return {...summarizePortableRestoreCoverage(preview),
  sourceOriginVerified:origin?.verified===true,
  sourceOriginWarning:origin?.verified===true?
   null:"Ältere Datei ohne überprüfbaren Originalbeleg. Keine Wiederherstellung verifizierter Clash-Ergebnisse.",
  fullRestoreAvailable:false,mutationPermitted:false};
}
export const PORTABLE_RESTORE_STATUS_LABELS=statusLabels;
