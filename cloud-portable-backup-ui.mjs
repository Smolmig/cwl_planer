// #178 – Owner-only CLOUD FILE backup / guarded pristine replacement restore.
// Exactly two primary user actions, under More -> Backup & Import.
// No service key, no localStorage backup, no API provenance invention.
// All source/target/actor/CAS checks are independently repeated in Postgres.
import {
 PORTABLE_BACKUP_BYTE_LIMIT,
 exportWitnessedOwnerCloudSnapshot,
 verifyPortableCloudBackup,
 previewWitnessedPristineClanRestore,
 applyWitnessedPristineClanRestore,
 previewWitnessedMultiClanRestore,
 applyWitnessedMultiClanRestore
} from "./cloud-portable-backup-core.mjs";

const TRANSLATIONS=Object.freeze({
 de:{
  title:"Vollständiges Cloud-Backup",summary:"Sichere deinen Plan samt Kriegsstatistiken, CWL-Archiven und Entscheidungen in einer JSON-Datei.",
  download:"Backup herunterladen",restore:"Backup wiederherstellen",
  scope:"Was sichern?",all:"Alle eigenen Clans",current:"Nur aktuellen Clan",
  disclaimer:"Enthält alle 17 Datenbereiche pro Clan. Passwörter und Zugriffsrechte werden nicht exportiert. Bitte bewahre die Datei sicher auf.",
  noOwner:"Nur Clanbesitzer können vollständige Cloud-Sicherungen herunterladen oder wiederherstellen.",
  noCloud:"Bitte melde dich zuerst bei einem Cloud-Clan an.",
  tooMany:"Es sind mehr als zehn eigene Clans vorhanden. Bitte „Nur aktuellen Clan“ wählen; Mehrclan-Restore unterstützt derzeit bis zu zehn Clans.",
  busy:"Die Sicherung wird geprüft …",
  exportBusy:"Alle Datenbereiche werden auf dem Server gesichert …",
  exported:"Backup erstellt und heruntergeladen. Bitte prüfe, ob die Datei wirklich gespeichert wurde.",
  readError:"Die ausgewählte Datei ist ungültig oder beschädigt.",
  fileInfo:"Ausgewählte Sicherung",fileClans:"Clans",fileRows:"gesicherte Datensätze",
  fileServer:"Serverbeleg geprüft in der Datei (auf dem Server erneut zu bestätigen)",
  fileMissingServer:"Kein originaler Serverbeleg – nur ansehen, niemals als vollständigen Cloud-Stand einspielen.",
  chooseTarget:"Neuer, leerer Zielclan",choose:"Zielclan auswählen",
  noTarget:"Kein neuer eigener Clan mit identischem Clash-Tag vorhanden.",
  sourceWarning:"Bisherigen Clan nicht überschreiben: Lege zuerst unter „Clan & Konto“ einen neuen, leeren Clan mit demselben Clash-Tag an. Der bestehende CWL-/CW-Verlauf bleibt unverändert.",
  preview:"Wiederherstellung sicher prüfen",previewBusy:"Prüfe alle Zielclans, Besitzerrechte und den ursprünglichen Serverbeleg …",
  previewOk:"Die Daten können ausschließlich in die geprüften leeren Ersatzclans übertragen werden.",
  details:"Wird wiederhergestellt",played:"gesperrte CWL-Tage",archives:"Archiv-Einträge",
  apply:"Geprüfte Sicherung wiederherstellen",applyBusy:"Wiederherstellung läuft – bitte nicht wechseln oder schließen …",
  applyOk:"Vollständige Wiederherstellung abgeschlossen. Alle Datenbereiche wurden zusammen gespeichert.",
  mappingError:"Bitte jedem Clan einen anderen neuen, leeren Clan mit demselben Clash-Tag zuordnen.",
  failed:"Keine Daten geändert. Die Wiederherstellung wurde nicht freigegeben: ",
  confirmTitle:"Alle Clan-Daten wiederherstellen?",
  confirmMessage:"Die ausgewählte Datei wird in die neu angelegten und als leer geprüften Ersatzclans eingespielt. Aktive oder bereits benutzte Clans werden nicht überschrieben. Alle 17 Datenbereiche pro Clan werden in einer Transaktion wiederhergestellt.",
  confirmText:"Weiter zur Bestätigung",
  typeTitle:"Wiederherstellung bestätigen",
  typeMessage:'Gib zur Bestätigung exakt „WIEDERHERSTELLEN“ ein. Das betrifft alle ausgewählten Ersatzclans.',
  typeLabel:"Bestätigungswort",typeWord:"WIEDERHERSTELLEN",
  typeButton:"Jetzt vollständig wiederherstellen",
  cancelled:"Abgebrochen. Keine Daten geändert.",
  contextChanged:"Die Anmeldung oder der Clan hat sich verändert. Bitte die Sicherung erneut prüfen.",
  fileTooLarge:"Datei zu groß oder leer. Maximal 128 MB JSON sind erlaubt.",
  invalidCount:"Die Datei enthält mehr als zehn Clans. Eine gemeinsame atomare Wiederherstellung ist für maximal zehn Clans freigegeben.",
  helpTitle:"So funktioniert die vollständige Sicherung",
  helpText:"„Backup herunterladen“ speichert alle 17 erlaubten Datenbereiche mit einem überprüfbaren Serverbeleg. „Backup wiederherstellen“ prüft zuerst die Datei und zeigt die zugeordneten Clans; du musst neue, leere Ersatzclans mit gleichem Clash-Tag auswählen. Bestehende oder aktive CWL-Pläne werden niemals automatisch ersetzt.",
  helpFooter:"Wichtig: Ein rein lokaler JSON-Export ohne noch vorhandenen originalen Serverbeleg beweist nach vollständigem Serververlust nicht die Herkunft alter API-Angriffe. Für diesen Ausnahmefall muss ein aktuelles verschlüsseltes Betreiber-Datenbankbackup vorhanden sein. Auth-Konten und Berechtigungen werden nicht aus JSON neu angelegt."
 },
 en:{
  title:"Full Cloud backup",summary:"Save your plan, war statistics, CWL archives and decisions in one JSON file.",
  download:"Download backup",restore:"Restore backup",
  scope:"What to include?",all:"All clans you own",current:"Current clan only",
  disclaimer:"Includes all 17 data areas per clan. Passwords and access permissions are not exported. Keep the file secure.",
  noOwner:"Only clan owners can download or restore full Cloud backups.",
  noCloud:"Please sign in to a Cloud clan first.",
  tooMany:"You own more than ten clans. Select Current clan only; a multi-clan restore currently supports up to ten clans.",
  busy:"Checking the backup …",
  exportBusy:"The server is collecting every data area …",
  exported:"Backup generated and downloaded. Please verify that the file was saved.",
  readError:"The selected file is invalid or damaged.",
  fileInfo:"Selected backup",fileClans:"Clans",fileRows:"saved records",
  fileServer:"Original server receipt is present (server will verify it again)",
  fileMissingServer:"No original server receipt – preview only, never restore as verified Cloud history.",
  chooseTarget:"New, unused destination clan",choose:"Select destination clan",
  noTarget:"No newly created clan you own with the same Clash tag.",
  sourceWarning:"Do not overwrite your original clan. First create a new, empty clan with the same Clash tag under Clan & Account. Existing CWL and war history is preserved.",
  preview:"Check restore safely",previewBusy:"Checking destinations, owner permissions and original server receipt …",
  previewOk:"Data can only be restored to the verified empty replacement clans.",
  details:"Restore summary",played:"locked CWL days",archives:"archive records",
  apply:"Restore verified backup",applyBusy:"Restoring all data – do not switch clans or close the app …",
  applyOk:"Full restore completed. All data areas were stored atomically.",
  mappingError:"Assign every source to a different, new, empty clan with the same Clash tag.",
  failed:"No data changed. Restore not authorized: ",
  confirmTitle:"Restore all clan data?",
  confirmMessage:"The selected file will be restored to newly created, verified unused replacement clans. Active or previously used clans cannot be overwritten. All 17 data areas per clan are restored in one transaction.",
  confirmText:"Continue to confirmation",
  typeTitle:"Confirm restore",typeMessage:'Type exactly “RESTORE” to confirm for all selected replacement clans.',
  typeLabel:"Confirmation word",typeWord:"RESTORE",
  typeButton:"Restore all verified data now",
  cancelled:"Cancelled. No data changed.",
  contextChanged:"Your sign-in or selected clan changed. Please verify the backup again.",
  fileTooLarge:"File too large or empty. Maximum supported JSON file size is 128 MB.",
  invalidCount:"This backup has more than ten clans. Atomic multi-clan restoration is available for up to ten.",
  helpTitle:"How full backups work",
  helpText:"Download backup saves all 17 supported data areas with a verifiable server receipt. Restore backup checks the file first and shows each source clan; choose a new unused replacement clan with the same Clash tag. Existing or active CWL plans are never replaced automatically.",
  helpFooter:"Important: A standalone JSON file without its surviving original server receipt cannot prove historical API-attack provenance after total server loss. An operator-encrypted database backup is required for that case. User accounts and access roles are not recreated from JSON."
 }
});
export function portableBackupText(language="de"){return TRANSLATIONS[language==="en"?"en":"de"];}
export function portableFileSummary(file){
 if(!file||!Array.isArray(file.clans))throw Error("Invalid complete backup");
 const groups=file.clans.map(clan=>{
  const tables=clan.tables||{};
  const rows=Object.values(tables).reduce((n,items)=>n+(Array.isArray(items)?items.length:0),0);
  const archiveRows=(tables.cwl_group_archives?.length||0)+(tables.cwl_own_lineup_archives?.length||0);
  return {id:clan.source_clan_id,name:clan.name,tag:clan.clash_tag,rows,archiveRows};
 });
 return {groups,totalRows:groups.reduce((n,g)=>n+g.rows,0)};
}
export function portableRestoreMapping(file,selected,ownedClans){
 if(!file?.clans?.length||!Array.isArray(ownedClans))throw Error("Missing valid source/targets");
 const ownedById=new Map(ownedClans.map(c=>[c.id,c]));
 const used=new Set();
 const mapping=Object.create(null);
 for(const source of file.clans){
  const targetId=selected[source.source_clan_id],target=ownedById.get(targetId);
  if(!target||target.id===source.source_clan_id||target.clash_tag!==source.clash_tag||used.has(targetId))
   throw Error("Choose distinct owned new clans with matching Clash tags");
  used.add(targetId);mapping[source.source_clan_id]=targetId;
 }
 return mapping;
}

const $=id=>document.getElementById(id);
const create=(tag,className,text)=>{
 const el=document.createElement(tag);
 if(className)el.className=className;
 if(text!==undefined)el.textContent=text;
 return el;
};
export function createCloudPortableBackupUI({
 sb,context,ensureSaved,loadProfile,toast,confirmAction,askAction
}){
 let file=null,selected=Object.create(null),previewState=null,busy=false,sequence=0;
 let language="de",originalFileName="",lastContext=null;
 const t=()=>portableBackupText(language);
 const ownerContext=()=>{
  const x=context();
  if(!x?.active||!x.userId||!x.clanId||!Array.isArray(x.ownerClanIds)||
     x.ownerClanIds.length===0||!x.role)
    throw Error(t().noOwner);
  return x;
 };
 const token=x=>[x.userId,x.clanId,x.epoch,x.role].join(":");
 const stable=(old,seq)=>{
  if(sequence!==seq||token(ownerContext())!==old)throw Error(t().contextChanged);
 };
 const owned=x=>x.clans.filter(c=>x.ownerClanIds.includes(c.id));
 const setText=(id,value)=>{const e=$(id);if(e)e.textContent=value;};
 const announce=(value,error=false)=>{
  const el=$("cloudPortableStatus");
  if(!el)return;
  el.textContent=value;
  el.dataset.state=error?"error":"status";
 };
 const clearPreview=()=>{
  previewState=null;
  const details=$("cloudPortablePreviewResult");
  if(details){details.replaceChildren();details.hidden=true;}
  const apply=$("cloudPortableApply");
  if(apply)apply.hidden=true;
 };
 const reset=()=>{
  sequence++;file=null;selected=Object.create(null);originalFileName="";
  clearPreview();
  const info=$("cloudPortableFileInfo"),targets=$("cloudPortableTargets");
  if(info){info.replaceChildren();info.hidden=true;}
  if(targets){targets.replaceChildren();targets.hidden=true;}
  if($("cloudPortablePreview"))$("cloudPortablePreview").hidden=true;
  if($("cloudPortableFile"))$("cloudPortableFile").value="";
  announce("");
 };
 function render(){
  const root=$("cloudPortableBackupSection");if(!root)return;
  const x=context(),active=!!x?.active;
  root.hidden=!active;
  const local=$("localBackupActions");
  if(local)local.hidden=active;
  const localLast=$("localBackupLast");
  if(localLast)localLast.hidden=active;
  if(!active)return;
  const owner=!!x.ownerClanIds?.length&&!!x.userId;
  setText("cloudPortableTitle",t().title);
  setText("cloudPortableIntro",t().summary);
  setText("cloudPortableScopeLabel",t().scope);
  setText("cloudPortableScopeAll",t().all);
  setText("cloudPortableScopeCurrent",t().current);
  setText("cloudPortableDownload",t().download);
  setText("cloudPortableRestore",t().restore);
  setText("cloudPortableDisclaimer",t().disclaimer);
  setText("cloudPortablePreview",t().preview);
  setText("cloudPortableApply",t().apply);
  setText("cloudPortableLanguageLabel",language==="de"?"Sprache / Language":"Language / Sprache");
  const download=$("cloudPortableDownload"),restore=$("cloudPortableRestore");
  if(download)download.disabled=!owner||busy;
  if(restore)restore.disabled=!owner||busy;
  const scope=$("cloudPortableScope");
  if(scope)scope.disabled=!owner||busy;
  if($("cloudPortableLanguage"))$("cloudPortableLanguage").value=language;
  if(!owner)announce(t().noOwner,true);
  const signature=token(x);
  if(lastContext&&signature!==lastContext&&file)reset();
  lastContext=signature;
  if(file)renderFile();
 }
 function renderFile(){
  if(!file)return;
  const info=$("cloudPortableFileInfo"),targets=$("cloudPortableTargets");
  if(!info||!targets)return;
  info.replaceChildren();targets.replaceChildren();
  const summary=portableFileSummary(file);
  info.append(create("strong",null,t().fileInfo+": "+originalFileName));
  const date=new Date(file.created_at);
  info.append(create("p",null,
   (Number.isFinite(date.getTime())?date.toLocaleString(language==="de"?"de-AT":"en-GB"):"")+
   " · "+summary.groups.length+" "+t().fileClans+
   " · "+summary.totalRows+" "+t().fileRows));
  info.append(create("p",null,file.server_receipt?t().fileServer:t().fileMissingServer));
  info.append(create("p",null,t().sourceWarning));
  info.hidden=false;
  const x=context(),destinations=owned(x);
  summary.groups.forEach(source=>{
   const row=create("div","cloud-portable-target-row");
   const label=create("label",null,source.name+" · "+source.tag+
    " · "+source.rows+" "+t().fileRows+
    " · "+source.archiveRows+" "+t().archives);
   const select=create("select");
   select.dataset.sourceClanId=source.id;
   select.setAttribute("aria-label",t().chooseTarget+" – "+source.name);
   const first=new Option(t().choose,"");select.add(first);
   for(const target of destinations.filter(c=>c.id!==source.id&&c.clash_tag===source.tag)){
    select.add(new Option(target.name+" · "+target.clash_tag,target.id));
   }
   select.value=selected[source.id]||"";
   select.disabled=busy;
   const note=create("p","small",select.options.length===1?t().noTarget:t().chooseTarget);
   row.append(label,select,note);targets.append(row);
  });
  targets.hidden=false;
  const preview=$("cloudPortablePreview");
  if(preview){preview.hidden=false;preview.disabled=busy||!file.server_receipt;}
 }
 async function download(){
  if(busy)return;
  const x=ownerContext(),identity=token(x),stamp=sequence;
  const scope=$("cloudPortableScope")?.value||"all";
  const ids=scope==="current"?[x.clanId]:x.ownerClanIds.slice();
  if(scope==="current"&&!x.ownerClanIds.includes(x.clanId)){
   announce(t().noOwner,true);return;
  }
  if(!ids.length||ids.length>10){
   announce(t().tooMany,true);return;
  }
  busy=true;render();announce(t().exportBusy);
  try{
   await ensureSaved();stable(identity,stamp);
   const exported=await exportWitnessedOwnerCloudSnapshot({sb,clanIds:ids});
   stable(identity,stamp);
   if(exported.clans?.length!==ids.length||!exported.server_receipt)
    throw Error(t().readError);
   const filename="CWL-Cloud-vollstaendig-"+new Date().toISOString().slice(0,10)+
    "-"+ids.length+"-Clans.json";
   const url=URL.createObjectURL(new Blob([JSON.stringify(exported,null,2)],
    {type:"application/json;charset=utf-8"}));
   try{
    const a=document.createElement("a");
    a.href=url;a.download=filename;
    document.body.append(a);a.click();a.remove();
   }finally{setTimeout(()=>URL.revokeObjectURL(url),5000);}
   announce(t().exported);toast?.(t().exported);
  }catch(e){announce(t().failed+(e?.message||String(e)),true);}
  finally{busy=false;render();}
 }
 function pick(){
  if(busy)return;
  try{ownerContext();$("cloudPortableFile").value="";$("cloudPortableFile").click();}
  catch(e){announce(e.message,true);}
 }
 async function readFile(inputFile){
  if(busy)return;
  reset();if(!inputFile)return;
  const identity=token(ownerContext()),stamp=sequence;
  busy=true;render();announce(t().busy);
  try{
   if(inputFile.size<1||inputFile.size>PORTABLE_BACKUP_BYTE_LIMIT)throw Error(t().fileTooLarge);
   const parsed=JSON.parse(await inputFile.text());
   const verified=await verifyPortableCloudBackup(parsed);
   stable(identity,stamp);
   if(verified.clans.length>10)throw Error(t().invalidCount);
   file=parsed;originalFileName=String(inputFile.name||"Backup.json").slice(0,110);
   selected=Object.create(null);clearPreview();renderFile();
   announce(t().sourceWarning);
  }catch(e){reset();announce(t().failed+(e?.message||t().readError),true);}
  finally{busy=false;render();}
 }
 function targetChanged(element){
  if(!file||busy||!element?.dataset?.sourceClanId)return;
  const id=element.dataset.sourceClanId;
  if(!file.clans.some(x=>x.source_clan_id===id))return;
  selected[id]=element.value;
  sequence++;clearPreview();
  announce(t().sourceWarning);
 }
 async function preview(){
  if(!file||busy)return;
  const x=ownerContext(),identity=token(x),stamp=sequence;
  let mapping;
  try{mapping=portableRestoreMapping(file,selected,owned(x));}
  catch{announce(t().mappingError,true);return;}
  busy=true;render();announce(t().previewBusy);
  try{
   const result=file.clans.length===1?
    await previewWitnessedPristineClanRestore({
     sb,file,sourceClanId:file.clans[0].source_clan_id,
     targetClanId:mapping[file.clans[0].source_clan_id]}):
    await previewWitnessedMultiClanRestore({sb,file,mapping});
   stable(identity,stamp);
   const rows=file.clans.length===1?[result]:result.previews;
   if(!rows||rows.length!==file.clans.length||
      rows.some(r=>r.restored_table_count!==17||r.applied!==false))
     throw Error(t().readError);
   previewState={mapping,identity,stamp,rows};
   const detail=$("cloudPortablePreviewResult");
   detail.replaceChildren();
   detail.append(create("strong",null,t().previewOk));
   rows.forEach((r,i)=>{
    const source=file.clans[i];
    detail.append(create("p",null,source.name+" → "+
     (owned(x).find(c=>c.id===mapping[source.source_clan_id])?.name||"")+
     ": "+r.source_rows+" "+t().fileRows+", "+
     r.source_locked_days+" "+t().played+", "+
     r.source_archive_rows+" "+t().archives));
   });
   detail.hidden=false;
   $("cloudPortableApply").hidden=false;
   announce(t().previewOk);
  }catch(e){clearPreview();announce(t().failed+(e?.message||String(e)),true);}
  finally{busy=false;render();}
 }
 async function apply(){
  if(!file||!previewState||busy)return;
  const state=previewState,identity=token(ownerContext());
  if(identity!==state.identity||sequence!==state.stamp){
   clearPreview();announce(t().contextChanged,true);return;
  }
  const agreed=await confirmAction(t().confirmMessage,{
   title:t().confirmTitle,confirmText:t().confirmText,danger:true
  });
  if(!agreed){announce(t().cancelled);return;}
  const answer=await askAction({
   title:t().typeTitle,message:t().typeMessage,
   inputLabel:t().typeLabel,inputValue:"",
   buttons:[{value:"confirm",text:t().typeButton,danger:true},
    {value:"cancel",text:language==="de"?"Abbrechen":"Cancel"}]
  });
  if(answer?.value!=="confirm"||answer.input!==t().typeWord){
   announce(t().cancelled);return;
  }
  if(busy)return;
  busy=true;render();announce(t().applyBusy);
  try{
   stable(state.identity,state.stamp);
   await ensureSaved();stable(state.identity,state.stamp);
   const restored=file.clans.length===1?
    await applyWitnessedPristineClanRestore({
     sb,file,sourceClanId:file.clans[0].source_clan_id,
     targetClanId:state.mapping[file.clans[0].source_clan_id],
     expectedRevision:state.rows[0].expected_revision,
     expectedTargetFingerprint:state.rows[0].target_fingerprint,
     confirmation:"RESTORE_ORIGINAL_TO_EMPTY_CLAN"}):
    await applyWitnessedMultiClanRestore({
     sb,file,mapping:state.mapping,
     expectedRevisions:state.rows.map(r=>r.expected_revision),
     expectedTargetFingerprints:state.rows.map(r=>r.target_fingerprint),
     confirmation:"RESTORE_ALL_VERIFIED_EMPTY_CLANS"});
   if(!restored?.applied)throw Error(t().readError);
   const current=ownerContext().clanId;
   if(Object.values(state.mapping).includes(current))await loadProfile();
   reset();announce(t().applyOk);toast?.(t().applyOk);
  }catch(e){clearPreview();announce(t().failed+(e?.message||String(e)),true);}
  finally{busy=false;render();}
 }
 function init(){
  const root=$("cloudPortableBackupSection");
  if(!root)return;
  $("cloudPortableDownload").addEventListener("click",download);
  $("cloudPortableRestore").addEventListener("click",pick);
  $("cloudPortableFile").addEventListener("change",event=>{
   void readFile(event.target.files?.[0]||null);
  });
  $("cloudPortableTargets").addEventListener("change",event=>{
   if(event.target.matches("select[data-source-clan-id]"))targetChanged(event.target);
  });
  $("cloudPortablePreview").addEventListener("click",preview);
  $("cloudPortableApply").addEventListener("click",apply);
  $("cloudPortableLanguage").addEventListener("change",event=>{
   language=event.target.value==="en"?"en":"de";
   // Localized confirmation token and stale prompt must never be reused.
   sequence++;clearPreview();render();
  });
  render();
 }
 return {init,render,reset,download,pick,readFile,preview,apply,
  targetChanged,inspect:()=>({hasFile:!!file,previewReady:!!previewState,busy})};
}
