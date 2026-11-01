// Isolated cloud backup UI. No secrets or whole-database access in the browser.
export function createCloudBackups({sb,context,ensureSaved,loadProfile,audit,toast,confirmAction,askAction}){
 const el=id=>document.getElementById(id);
 let entries=[],forClan=null;
 const reset=()=>{
  entries=[];forClan=null;
  const select=el("cloudSnapshotSelect");
  select.replaceChildren(new Option("Sicherungspunkte bei Bedarf laden",""));
  buttons();
  el("cloudBackupStatus").textContent="";
 };
 const buttons=()=>{
  const {role}=context(),chosen=Boolean(el("cloudSnapshotSelect").value);
  el("cloudDownloadSnapshot").disabled=!chosen;
  el("cloudRestoreSnapshot").disabled=!chosen||role!=="owner";
 };
 async function list(){
  const {clanId}=context();if(!clanId)return;
  const {data,error}=await sb.from("cwl_profile_snapshots").select("id,revision,created_at")
    .eq("clan_id",clanId).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(5);
  if(error)throw error;
  if(clanId!==context().clanId)return;
  entries=data||[];forClan=clanId;
  const select=el("cloudSnapshotSelect");
  select.replaceChildren(new Option(entries.length?"Sicherungspunkt auswählen":"Noch keine Sicherung vorhanden",""));
  for(const entry of entries){
   select.add(new Option(new Date(entry.created_at).toLocaleString("de-AT",{dateStyle:"medium",timeStyle:"medium"}),String(entry.id)));
  }
  el("cloudBackupStatus").textContent=entries.length?
   entries.length+" Wiederherstellungspunkte verfügbar. Nur der Planstand wird gesichert; nicht die Kriegsstatistiken oder Benutzerzugänge.":
   "Noch keine Sicherung vorhanden. Sicherungen werden automatisch bei Änderungen angelegt.";
  buttons();
 }
 async function selected(){
  const {clanId}=context(),id=el("cloudSnapshotSelect").value;
  if(!id||forClan!==clanId||!entries.some(x=>String(x.id)===id))throw Error("Bitte erst einen Sicherungspunkt auswählen.");
  const {data,error}=await sb.from("cwl_profile_snapshots").select("revision,profile_json,created_at")
    .eq("clan_id",clanId).eq("id",id).single();
  if(error)throw error;
  if(context().clanId!==clanId)throw Error("Der Clan wurde gewechselt.");
  if(!data?.profile_json||!Array.isArray(data.profile_json.members)||
     !Array.isArray(data.profile_json.locks)||!Array.isArray(data.profile_json.archives))
   throw Error("Der gewählte Sicherungspunkt ist kein gültiges CWL-Profil.");
  return {data,id,clanId};
 }
 async function download(){
  const {data,clanId}=await selected(),{clans}=context();
  const payload={kind:"cwl-profile",dataVersion:9,profile:data.profile_json,
   backupMetadata:{source:"cwl-cloud-checkpoint",revision:data.revision,createdAt:data.created_at}};
  const name=(clans.find(x=>x.id===clanId)?.name||"Clan").replace(/[^a-z0-9_-]+/gi,"-").slice(0,40);
  const date=new Date(data.created_at).toISOString().replace(/[:.]/g,"-");
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="CWL-"+name+"-"+date+".json";
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
  toast("✓ Sicherungspunkt heruntergeladen");
 }
 async function restore(){
  const ctx=context();
  if(ctx.role!=="owner")throw Error("Nur der Besitzer kann den Clanstand zurücksetzen.");
  await ensureSaved();
  const {data,id,clanId}=await selected(),{revision,clans}=context();
  const clan=clans.find(x=>x.id===clanId)?.name;
  if(!clan||revision==null||clanId!==ctx.clanId)throw Error("Kein aktueller Clanstand vorhanden.");
  const when=new Date(data.created_at).toLocaleString("de-AT",{dateStyle:"medium",timeStyle:"short"});
  if(!await confirmAction("Den gemeinsamen CWL-Stand von „"+clan+"“ auf "+when+
    " zurücksetzen? Neuere Mitgliederänderungen und Kriegsarchive werden ersetzt. Der aktuelle Stand wird vorher gesichert.",
    {title:"CWL-Sicherung wiederherstellen",confirmText:"Weiter",danger:true}))return;
  const answer=await askAction({
    title:"Wiederherstellung bestätigen",
    message:"Gib den Clannamen „"+clan+"“ exakt ein, um diesen Stand für alle Clanmitglieder wiederherzustellen.",
    inputLabel:"Clanname",inputValue:"",
    buttons:[{value:"confirm",text:"Wiederherstellen",danger:true},{value:"cancel",text:"Abbrechen"}]
  });
  if(answer.value!=="confirm")return;
  if(answer.input!==clan){toast("Clanname stimmt nicht überein. Keine Daten geändert.");return;}
  const {error}=await sb.rpc("cwl_restore_profile_snapshot",{
   p_clan:clanId,p_id:Number(id),p_expected_revision:revision
  });
  if(error)throw error;
  if(context().clanId!==clanId)return;
  await loadProfile();
  await Promise.all([list(),audit()]);
  el("cloudBackupStatus").textContent="Wiederherstellung erfolgreich. Der zuvor aktuelle Stand ist ebenfalls gesichert.";
  toast("✓ CWL-Sicherung wiederhergestellt");
 }
 return {reset,buttons,list,download,restore};
}
