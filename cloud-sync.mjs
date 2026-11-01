import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { createCloudBackups } from "./cloud-backups.mjs?v=1.4.0";
import { createCwlLive } from "./cwl-live.mjs?v=1.4.0";
import { createCloudStats } from "./cwl-stats.mjs?v=1.4.0";
import { createCurrentWarOverview } from "./cwl-current-war.mjs?v=1.4.0";

const SUPABASE_URL="https://yjldnvfwposfwmzmcsow.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_ej03YPfIYRjQZuASAWi1yg_I0VLmayy";
const sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,
 {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const text=(id,value)=>{if($(id))$(id).textContent=value};
const toggle=(id,show)=>{if($(id))$(id).hidden=!show};
const storage=window.CWLLegacy;
let user=null,clanId=null,clans=[],role=null,revision=null,lastSerial=null,changedSerial=null;
const INVITE_TOKEN_KEY="cwl_pending_invite_v1",INVITE_ALIAS_KEY="cwl_pending_invite_name_v1";
const isInviteCode=v=>/^(?:[a-zA-Z0-9_-]{12}|[a-zA-Z0-9_-]{24})$/.test(String(v||""));
// Keep an invitation across the new tab opened by email confirmation.
const storedInvite=(key)=>{try{return localStorage.getItem(key)||sessionStorage.getItem(key)||""}catch{return""}};
const saveInvite=(key,value)=>{
 for(const area of [localStorage,sessionStorage]){
  try{if(value)area.setItem(key,value);else area.removeItem(key)}catch{/* private mode */}
 }
};
const pendingInviteCode=()=>{const input=document.getElementById("cloudJoinCode")?.value?.trim();
 const query=new URLSearchParams(location.search).get("invite");
 const code=input||query||storedInvite(INVITE_TOKEN_KEY);
 return isInviteCode(code)?code:"";
};
let saving=false,blocked=false,hydrating=false,debounce=null,channel=null,roster=null,rosterDiff=null,inviteLink=null,accountEpoch=0,rosterAutoBusy=false;
let clanRoles=new Map(),presenceTimer=null,lastVersionCheck=0,appUpdatePending=false;
let recoveryMode=location.hash.includes("type=recovery")||new URLSearchParams(location.search).get("type")==="recovery";
let forgotOpen=false;
let pollTimer=null,syncInFlight=false,lastNotifiedRevision=0,remotePending=false,notifyTimer=null;
const backups=createCloudBackups({
 sb,
 context:()=>({clanId,role,revision,clans}),
 ensureSaved:()=>ensureSaved(),
 loadProfile:()=>loadCloudProfile(true),
 audit:()=>audit(),
 toast:message=>storage.toast(message),
 confirmAction:(message,options)=>storage.confirmAction(message,options),
 askAction:options=>storage.askAction(options)
});
const cloud={
 active:false,
 onLocalChange(){
  if(!this.active||hydrating||role==="viewer")return;
  if(!navigator.onLine){msg("Cloud ist offline. Bearbeiten ist nicht möglich; bitte neu laden, wenn die Verbindung zurück ist.",true);blocked=true;return}
  if(blocked){status("Cloud: Konflikt – neu laden",true);return}
  const serialized=JSON.stringify(storage.getProfile());
  if(serialized===lastSerial || serialized===changedSerial)return;
  changedSerial=serialized;
  status("Cloud: nicht gespeichert",true);
  clearTimeout(debounce);
  debounce=setTimeout(()=>writeCloud().catch(err=>msg("Speichern fehlgeschlagen: "+err.message,true)),600);
 },
 afterRender(){
  document.body.classList.toggle("cloud-mode",this.active);
  document.body.classList.toggle("cloud-role-viewer",this.active&&role==="viewer");
  const activeClan=clans.find(c=>c.id===clanId);
  const label=activeClan?.name||"Clan";
  const accountBtn=$("cloudOpen");
  accountBtn.querySelector(".cloud-toggle-icon").textContent=this.active?"☁️":"👤";
  accountBtn.querySelector(".cloud-toggle-label").textContent=this.active?"Clan":"Login";
  accountBtn.title=this.active?label+" · Clan und Konto öffnen":"Anmelden oder registrieren";
  accountBtn.setAttribute("aria-label",this.active?label+" · Clan und Konto öffnen":"Anmelden oder registrieren");
  const cta=$("cloudMembersSyncBtn");if(cta)cta.textContent=storage.getProfile().members.length?"↻ Mitglieder aktualisieren":"↓ Mitglieder importieren";
  $("cloudOpen").classList.toggle("cloud-on",this.active);
  toggle("cloudMembersTools",!!this.active&&!!clanId);
  toggle("guestMembersTools",!this.active);
  toggle("cloudHelpSection",this.active);
  toggle("statsNav",!!this.active&&!!clanId);
  installNameEditors();
  live.render();
  if(!this.active)return;
  // The UI is deliberately non-editable for viewers; RLS also enforces this server-side.
  const keep=new Set(["copyFullPlanBtn","singleDayMode","allDaysMode","nextDayBtn",
    "mobileOverviewToggle","cwlLiveRefresh","memberSearch","memberFilter","summarySearch","summaryFilter","themeSelect","updateAppBtn",
    "exportProfileBtn","exportAllBtn","settingsCloudManage"]);
  for(const el of document.querySelectorAll("#view-plan button,#view-plan input,#view-plan select,#view-members button,#view-members input,#view-members select,#view-summary button,#view-summary input,#view-summary select,#view-settings button,#view-settings input,#view-settings select")){
    if(el.dataset.cloudDisabled==="1"){el.disabled=false;delete el.dataset.cloudDisabled}
    if(role==="viewer" && !keep.has(el.id) && !el.closest(".mobile-day-tabs") && !el.closest(".archive-list")){
      el.disabled=true;el.dataset.cloudDisabled="1";
    }
  }
  if(role==="viewer"){
    for(const id of ["modalSave","bulkSave","inlineMemberSave","resetBtn","deleteProfileBtn"]){
      const el=$(id);if(el)el.disabled=true;
    }
  }
 }
};
window.CWLCloud=cloud;
const stats=createCloudStats({
 sb,notify:message=>storage.toast(message),
 confirmAction:(message,options)=>storage.confirmAction(message,options),
 context:()=>({active:cloud.active,clanId,role,clanTag:clans.find(c=>c.id===clanId)?.clash_tag,
  memberTags:storage.getProfile()?.members?.map(m=>m.playerTag).filter(Boolean)||[]})
});
let currentWarOverview=null;
const live=createCwlLive({
 sb,storage,notify:message=>storage.toast(message),
 onSnapshot:data=>{
  currentWarOverview?.update(data);
  return stats.captureCwl(data);
 },
 context:()=>({active:cloud.active,clanId,role,hasClanTag:!!clans.find(c=>c.id===clanId)?.clash_tag,profile:storage.getProfile(),
   canApply:!changedSerial&&!saving&&!blocked&&!hydrating&&!editingDialog()&&navigator.onLine})
});
currentWarOverview=createCurrentWarOverview({
 context:()=>({active:cloud.active,clanId,hasClanTag:!!clans.find(c=>c.id===clanId)?.clash_tag}),
 refresh:()=>live.refresh()
});
/* Delegate to the persistent list, not individual cards. Search, filters and
   expanding a card re-create card DOM without re-running the cloud bootstrap. */
function installNameEditors(){
 const list=$("memberList");
 if(!list||list.dataset.editorDelegated==="1")return;
 list.dataset.editorDelegated="1";
 list.addEventListener("click",event=>{
  const pencil=event.target.closest(".member-name-edit");
  if(!pencil)return;
  event.preventDefault();event.stopPropagation();
  if(cloud.active&&role==="viewer")return;
  const input=pencil.closest(".name-wrap")?.querySelector(".member-name");
  if(!input)return;
  input.readOnly=false;
  pencil.setAttribute("aria-pressed","true");
  input.focus({preventScroll:true});
  try{input.setSelectionRange(input.value.length,input.value.length)}catch{}
 });
 list.addEventListener("focusout",event=>{
  const input=event.target;
  if(!input.matches?.(".member-name"))return;
  input.readOnly=true;
  input.closest(".name-wrap")?.querySelector(".member-name-edit")?.setAttribute("aria-pressed","false");
 },true);
 list.addEventListener("keydown",event=>{
  const input=event.target;
  if(!input.matches?.(".member-name"))return;
  if(event.key==="Enter"){event.preventDefault();input.blur()}
  if(event.key==="Escape"){
   event.preventDefault();
   input.value=storage.getProfile().members.find(m=>m.id===input.closest(".member")?.dataset.id)?.name||input.value;
   input.blur();
  }
 });
}
function status(value,isError=false){text("saveBadge",value);$("saveBadge").className="badge "+(isError?"warn":"ok")}
function msg(value,isError=false){
 const element=$("cloudMsg");
 element.hidden=!isError;
 if(isError){text("cloudMsg",value);element.classList.add("error")}
 else element.classList.remove("error");
 if(value)storage.toast((isError?"⚠ ":"")+value);
}
function error(e){msg(e?.message||String(e),true);
 if($("cloudRosterBox")&&!$("cloudRosterBox").hidden){
  text("cloudRosterStatus",e?.message||String(e));$("cloudRosterStatus").classList.add("error")
 }
 console.warn("Cloud Planner:",e)}
function open(){const o=$("cloudOverlay");o.classList.add("open");o.setAttribute("aria-hidden","false")}
function close(){const o=$("cloudOverlay");o.classList.remove("open");o.setAttribute("aria-hidden","true");if(pendingRelease)setTimeout(installPendingRelease,0)}
function resetRoster(){roster=null;rosterDiff=null;toggle("cloudRosterDiff",false);toggle("cloudApplyRoster",false);toggle("cloudDepartedWarnings",false)}
function showSignedIn(){
 toggle("cloudAuth",!user&&!recoveryMode&&!forgotOpen);
 toggle("cloudForgotRequest",!user&&!recoveryMode&&forgotOpen);
 toggle("cloudAccount",!!user&&!recoveryMode);
 toggle("cloudRecovery",recoveryMode);
 text("cloudIdentity",user?user.email:"");
 const invited=!user&&!!pendingInviteCode();
 toggle("cloudAuthInvite",invited);
 toggle("cloudAuthNameWrap",invited);
}
function cleanTag(raw){const s=String(raw||"").trim().toUpperCase();return s.startsWith("#")?s:"#"+s}
function showForgotPassword(){
 forgotOpen=true;recoveryMode=false;
 $("cloudRecoveryEmail").value=$("cloudEmail").value.trim();
 toggle("cloudResetSent",false);
 showSignedIn();open();$("cloudRecoveryEmail").focus({preventScroll:true});
}
function backToLogin(){
 forgotOpen=false;showSignedIn();toggle("cloudResetSent",false);
}
async function sendPasswordReset(){
 const email=$("cloudRecoveryEmail").value.trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error("Bitte zuerst eine gültige E-Mail-Adresse eingeben.");
 const {error:err}=await sb.auth.resetPasswordForEmail(email,{
  redirectTo:location.origin+location.pathname
 });
 if(err)throw err;
 toggle("cloudResetSent",true);
 storage.toast("✓ Wiederherstellungsanfrage gesendet");
}
function beginRecovery(){
 forgotOpen=false;
 recoveryMode=true;
 showSignedIn();
 open();
 $("cloudNewPassword").focus({preventScroll:true});
}
async function completeRecovery(){
 if(!recoveryMode)throw Error("Kein Wiederherstellungslink aktiv.");
 const first=$("cloudNewPassword").value,second=$("cloudConfirmPassword").value;
 if(first.length<8)throw Error("Bitte ein Passwort mit mindestens 8 Zeichen eingeben.");
 if(first!==second)throw Error("Die beiden Passwörter stimmen nicht überein.");
 const {error:err}=await sb.auth.updateUser({password:first});
 if(err)throw err;
 recoveryMode=false;
 $("cloudNewPassword").value="";$("cloudConfirmPassword").value="";
 const {error:signoutError}=await sb.auth.signOut();
 if(signoutError)throw signoutError;
 await useSession(null);
 showSignedIn();open();
 storage.toast("✓ Passwort geändert. Bitte neu anmelden.");
}
async function sign(kind){
 const email=$("cloudEmail").value.trim(),password=$("cloudPassword").value;
 if(!email||password.length<8)throw Error("Bitte E-Mail und mindestens 8 Zeichen Passwort eingeben.");
 const invite=pendingInviteCode();
 if(invite){
  const name=$("cloudAuthName").value.trim()||$("cloudJoinName").value.trim()||storedInvite(INVITE_ALIAS_KEY);
  if(!name||name.length>60)throw Error("Bitte zuerst deinen Ingame-Namen eingeben, damit du dem Clan beitreten kannst.");
  $("cloudJoinName").value=name;
  saveInvite(INVITE_TOKEN_KEY,invite);
  saveInvite(INVITE_ALIAS_KEY,name);
 }
 const redirect=new URL(location.pathname,location.origin);
 if(invite)redirect.searchParams.set("invite",invite);
 const out=kind==="signup"?
  await sb.auth.signUp({email,password,options:{emailRedirectTo:redirect.href}}):
  await sb.auth.signInWithPassword({email,password});
 if(out.error)throw out.error;
 if(!out.data.session){msg("Registrierung angelegt. Bitte deine E-Mail bestätigen. Deine Einladung bleibt für die anschließende Anmeldung erhalten.");return}
 await useSession(out.data.session);
}
async function useSession(session){
 const epoch=++accountEpoch;
 user=session?.user||null;showSignedIn();
 if(!user){
  await leaveCloud();
  return;
 }
 await listClans(epoch);
 const code=pendingInviteCode();
 if(code){
  $("cloudJoinCode").value=code;
  const name=$("cloudJoinName").value.trim()||storedInvite(INVITE_ALIAS_KEY);
  if(name){
   $("cloudJoinName").value=name;
   try{await joinInvite()}catch(e){
    open();msg("Beitritt noch nicht abgeschlossen: "+(e.message||e),true);
    $("cloudJoinName").focus({preventScroll:true});
   }
  }else{
   open();msg("Einladung erkannt: Bitte noch deinen Ingame-Namen eintragen und „Clan beitreten“ wählen.");
   $("cloudJoinName").focus({preventScroll:true});
  }
 }
}
async function leaveCloud(){
 // Immediately leave the Cloud-only statistics view. Otherwise logging out
 // can strand the guest on a private screen with no visible navigation tab.
 toggle("statsNav",false);
 document.querySelector('.navbtn[data-view="plan"]')?.click();
 clearTimeout(debounce);
 live.stop();currentWarOverview?.reset();stats.reset();stopPresence();stopRemoteChecks();hideChangeToast();backups.reset();
 toggle("cloudMembersTools",false);
 toggle("guestMembersTools",true);
 if(channel){await sb.removeChannel(channel);channel=null}
 cloud.active=false;clanId=null;role=null;revision=null;lastSerial=null;changedSerial=null;
 blocked=false;hydrating=false;resetRoster();
 storage.restoreGuest();cloud.afterRender();
 msg("Lokaler Modus. Deine bisherigen lokalen Daten bleiben auf diesem Gerät.");
}
async function listClans(epoch=accountEpoch,selected){
 if(!user||epoch!==accountEpoch)return;
 const [{data,error:err},{data:links,error:membershipError}]=await Promise.all([
  sb.from("cwl_clans").select("id,name,clash_tag").order("name"),
  sb.from("cwl_clan_memberships").select("clan_id,role").eq("user_id",user.id)
 ]);
 if(err)throw err;if(membershipError)throw membershipError;
 clanRoles=new Map((links||[]).map(m=>[m.clan_id,m.role]));
 if(epoch!==accountEpoch)return;
 clans=data||[];
 const s=$("cloudClanSelect");s.replaceChildren(new Option(clans.length?"Clan wählen":"Noch kein Clan",""));
 clans.forEach(c=>{
   const kind=clanRoles.get(c.id)==="owner"?"Mein Clan":clanRoles.get(c.id)==="editor"?"Gemeinsam · Vize":"Gemeinsam · Beobachter";
   s.add(new Option(c.name+" · "+kind,c.id));
 });
 const desired=selected||clanId;
 s.value=clans.find(x=>x.id===desired)?.id||clans[0]?.id||"";
 await chooseClan(epoch);
}
async function chooseClan(epoch=accountEpoch){
 if(epoch!==accountEpoch)return;
 clearTimeout(debounce);
 live.stop();currentWarOverview?.reset();stats.reset();stopPresence();stopRemoteChecks();hideChangeToast();
 if(channel){await sb.removeChannel(channel);channel=null}
 clanId=$("cloudClanSelect").value||null;revision=null;role=null;
 lastSerial=null;changedSerial=null;blocked=false;remotePending=false;lastNotifiedRevision=0;resetRoster();
 if(!clanId){toggle("cloudMembersTools",false);$("cloudNewClanDetails").open=true;cloud.active=true;role="viewer";hydrating=true;storage.switchToCloud(storage.blank("Clan verbinden"));hydrating=false;lastSerial=JSON.stringify(storage.getProfile());toggle("cloudInviteBox",false);toggle("cloudRosterBox",false);text("cloudRole","Noch kein Clan verbunden.");text("cloudActiveMembers","");
 toggle("cloudClanActions",false);toggle("cloudBackupPanel",false);cloud.afterRender();open();msg("Noch kein Clan verknüpft. Erstelle deinen eigenen Bereich oder gib einen Einladungscode ein.");return}
 const {data,error:err}=await sb.from("cwl_clan_memberships").select("role,display_name")
  .eq("clan_id",clanId).eq("user_id",user.id).single();
 if(err)throw err;
 if(epoch!==accountEpoch)return;
 role=data.role;
 const kind=role==="owner"?"Mein Clan · Besitzer":role==="editor"?"Gemeinsamer Clan · Vize (Bearbeiten)":"Gemeinsamer Clan · Beobachter (Lesen)";
 text("cloudRole",kind);
 toggle("cloudClanActions",true);
 toggle("cloudLeaveBtn",role!=="owner");
 toggle("cloudDeleteBtn",role==="owner");
 $("cloudAlias").value=data.display_name||"";
 toggle("cloudInviteBox",role==="owner"||role==="editor");
 toggle("cloudRosterBox",false);
 toggle("cloudMembersTools",true);
 $("cloudNewClanDetails").open=false;
 await loadAccessList(clanId);
 toggle("cloudBackupPanel",true);
 toggle("cloudRestoreSnapshot",role==="owner");
 backups.reset();
 toggle("cloudImportProfile",role!=="viewer");
 toggle("cloudImportFile",role!=="viewer");
 // Switch modes before rendering so cloud records never enter localStorage.
 cloud.active=true;hydrating=true;
 await loadCloudProfile(false);
 if(epoch!==accountEpoch)return;
 text("cloudSyncFeedback",(revision==null?"✓ Noch kein gemeinsames Profil gespeichert":"✓ Gemeinsamer Stand geladen")+" · "+new Date().toLocaleTimeString("de-AT",{hour:"2-digit",minute:"2-digit"}));
 await audit();
 channel=sb.channel("cloud-profile-"+clanId)
 .on("postgres_changes",{event:"*",schema:"public",table:"cwl_cloud_profiles",filter:"clan_id=eq."+clanId},
   ()=>{checkRemoteChanges("realtime").catch(error)})
 .on("postgres_changes",{event:"*",schema:"public",table:"cwl_clan_memberships",filter:"clan_id=eq."+clanId},
   ()=>{loadAccessList(clanId).catch(console.warn)})
 .on("postgres_changes",{event:"INSERT",schema:"public",table:"cwl_change_events",filter:"clan_id=eq."+clanId},
   ()=>{checkRemoteChanges("activity").catch(error);audit().catch(console.warn)})
 .subscribe((state,err)=>{
   if(state==="SUBSCRIBED"){
     checkRemoteChanges("reconnected").catch(error);
   }else if(state==="CHANNEL_ERROR"||state==="TIMED_OUT"){
     text("cloudSyncFeedback","Verbindung unterbrochen · automatische Abgleichprüfung bleibt aktiv");
     console.warn("CWL Realtime",state,err);
   }
 });
 startRemoteChecks();
 cloud.afterRender();
 await startPresence();
 live.start();
 stats.load().catch(console.warn);
 syncAutoRosterSetting();
 setTimeout(()=>maybeAutoRoster().catch(console.warn),1500);
 msg((clans.find(c=>c.id===clanId)?.name||"Clan")+" ist verbunden. Deine Änderungen werden gemeinsam gespeichert.");
}

function stopRemoteChecks(){
 if(pollTimer!==null){clearInterval(pollTimer);pollTimer=null}
 remotePending=false;
}
function startRemoteChecks(){
 stopRemoteChecks();
 pollTimer=setInterval(()=>{
  if(cloud.active&&clanId&&navigator.onLine&&!document.hidden)
   checkRemoteChanges("interval").catch(error);
 },15000);
}
function hideChangeToast(){
 if(notifyTimer!==null){clearTimeout(notifyTimer);notifyTimer=null}
 toggle("cloudChangeNotice",false);
}
function showChangeToast(message,sticky=false){
 if(!cloud.active)return;
 hideChangeToast();
 text("cloudChangeText",message);
 toggle("cloudChangeNotice",true);
 if(!sticky)notifyTimer=setTimeout(()=>toggle("cloudChangeNotice",false),9500);
}
function formatChangeSummary(entry){
 const changes=entry?.details||{};
 if(changes.archiv_geaendert)return "das CWL-Archiv geändert";
 if(changes.plan_geaendert)return "eine gespielte Aufstellung geändert";
 if(changes.config_geaendert)return "die CWL-Einstellungen geändert";
 const affected=changes.spieleraenderungen||[];
 if(affected.length){
  const target=affected[0];
  const fields=Object.keys(target.felder||{});
  const field=fields[0];
  const terms={fixed:"FIX-Status",participating:"Teilnahme",priority:"Priorität",townHall:"Rathaus",threeStar:"3★-Stärke",statuses:"Tagesregeln",firstDay:"Erst-ab",outFromDay:"Raus-ab"};
  if(field==="hinzugefuegt")return target.name+" hinzugefügt";
  if(field==="entfernt")return target.name+" entfernt";
  return (target.name||"einen Spieler")+" · "+(terms[field]||"Spielerdaten")+" geändert"+(affected.length>1?" (und weitere)":"");
 }
 return "den gemeinsamen CWL-Plan geändert";
}
async function remoteChangeMessage(id,oldRevision){
 const {data:events,error:err}=await sb.from("cwl_change_events")
  .select("actor_id,revision,details,event_type")
  .eq("clan_id",id).gt("revision",oldRevision)
  .order("revision",{ascending:false}).limit(5);
 if(err)throw err;
 const foreign=(events||[]).find(e=>e.actor_id!==user?.id);
 if(!foreign)return null;
 const {data:member,error:memberError}=await sb.from("cwl_clan_memberships")
  .select("display_name,role").eq("clan_id",id).eq("user_id",foreign.actor_id).maybeSingle();
 if(memberError)throw memberError;
 const byRole={owner:"Clanführer",editor:"Vize",viewer:"Beobachter"};
 const actor=member?.display_name||byRole[member?.role]||"Ein Clanmitglied";
 return actor+" hat "+formatChangeSummary(foreign);
}
async function checkRemoteChanges(reason="poll"){
 const id=clanId,epoch=accountEpoch;
 if(!cloud.active||!id||!user||syncInFlight||!navigator.onLine)return;
 syncInFlight=true;
 try{
  const {data:myAccess,error:accessError}=await sb.from("cwl_clan_memberships")
   .select("role").eq("clan_id",id).eq("user_id",user.id).maybeSingle();
  if(accessError)throw accessError;
  if(id!==clanId||epoch!==accountEpoch)return;
  if(!myAccess){
   stopRemoteChecks();stopPresence();
   await listClans(accountEpoch);
   storage.toast("Dein Zugriff auf den bisherigen Clan wurde beendet.");
   return;
  }
  if(myAccess.role!==role){
   role=myAccess.role;
   const label=role==="owner"?"Mein Clan · Besitzer":role==="editor"?
    "Gemeinsamer Clan · Vize (Bearbeiten)":"Gemeinsamer Clan · Beobachter (Lesen)";
   text("cloudRole",label);
   toggle("cloudInviteBox",role==="owner"||role==="editor");
   toggle("cloudImportProfile",role!=="viewer");
   toggle("cloudImportFile",role!=="viewer");
   cloud.afterRender();
   loadAccessList(id).catch(console.warn);
   storage.toast("Deine Berechtigung wurde geändert: "+(role==="editor"?"Vize":role==="viewer"?"Beobachter":"Besitzer"));
  }
 const {data,error:err}=await sb.from("cwl_cloud_profiles")
   .select("revision").eq("clan_id",id).maybeSingle();
  if(err)throw err;
  if(id!==clanId||epoch!==accountEpoch)return;
  const remoteRev=Number(data?.revision||0),localRev=Number(revision||0);
  if(remoteRev<=localRev)return;
  const isConflict=Boolean(changedSerial||saving||blocked);
  const isEditing=editingDialog();
  if(isConflict||isEditing){
   remotePending=true;
   if(isConflict){blocked=true;status("Cloud: gemeinsame Änderung – Konflikt",true)}
   if(remoteRev>lastNotifiedRevision){
    lastNotifiedRevision=remoteRev;
    const message=await remoteChangeMessage(id,localRev).catch(()=>null);
    if(id===clanId)showChangeToast((message||"Der Clanplan wurde auf einem anderen Gerät geändert")+
      (isConflict?" · Deine offenen Änderungen bleiben geschützt.":" · Nach der Bearbeitung aktualisieren."),true);
   }
   text("cloudSyncFeedback",isConflict?"Konflikt: Ein anderer Stand liegt vor":"Neuer Stand verfügbar · Bearbeitung zuerst schließen");
   return;
  }
  const fromRevision=localRev;
  const applied=await loadCloudProfile(true);
  if(!applied||id!==clanId||epoch!==accountEpoch)return;
  remotePending=false;
  const message=await remoteChangeMessage(id,fromRevision).catch(()=>null);
  if(Number(revision||0)>lastNotifiedRevision){
   lastNotifiedRevision=Number(revision||0);
   showChangeToast(message||"Der gemeinsame CWL-Plan wurde aktualisiert");
  }
  text("cloudSyncFeedback","✓ Automatisch synchronisiert · "+new Date().toLocaleTimeString("de-AT",{hour:"2-digit",minute:"2-digit"}));
  await audit();
 }finally{syncInFlight=false}
}

async function loadCloudProfile(automatic=false){
 if(!clanId)return;
 if(changedSerial&&automatic)return;
 const target=clanId;
 const {data,error:err}=await sb.from("cwl_cloud_profiles")
  .select("profile_json,revision").eq("clan_id",target).maybeSingle();
 if(err)throw err;
 if(target!==clanId)return false;
 if(!automatic && changedSerial && !await storage.confirmAction("Nicht gespeicherte Änderungen verwerfen und Cloud-Stand laden?",{title:"Änderungen verwerfen?",confirmText:"Cloud-Stand laden",danger:true}))return false;
 const profile=data?.profile_json||storage.blank(clans.find(c=>c.id===clanId)?.name||"Neuer Clan");
 revision=data?.revision??null;
 blocked=false;changedSerial=null;hydrating=true;
 try{storage.switchToCloud(profile);lastSerial=JSON.stringify(storage.getProfile())}finally{hydrating=false}
 status(data?"Cloud: gespeichert":"Cloud: noch leer",!data);
 return true;
}
async function writeCloud(){
 if(!cloud.active||blocked||hydrating||saving||role==="viewer"||!changedSerial||!clanId)return;
 if(!navigator.onLine){blocked=true;status("Cloud: offline – nicht gespeichert",true);return}
 const snapshot=changedSerial,id=clanId,expectedRevision=revision;
 saving=true;status("Cloud: speichert …",false);
 try{
  let out;
  const profile=JSON.parse(snapshot);
  if(expectedRevision==null){
   out=await sb.from("cwl_cloud_profiles").insert({clan_id:id,profile_json:profile})
     .select("revision").single();
  }else{
   const res=await sb.from("cwl_cloud_profiles").update({profile_json:profile})
     .eq("clan_id",id).eq("revision",expectedRevision).select("revision");
   if(!res.error && (res.data||[]).length!==1){
    blocked=true;throw Error("Konflikt: Jemand hat den Cloud-Stand inzwischen geändert. Bitte Cloud neu laden.");
   }
   out={data:res.data?.[0],error:res.error};
  }
  if(out.error)throw out.error;
  if(id!==clanId)return;
  revision=out.data.revision;lastSerial=snapshot;
  if(changedSerial===snapshot)changedSerial=null;
  status(changedSerial?"Cloud: neue Änderungen offen":"Cloud: gespeichert");
  audit().catch(console.warn);
 }catch(e){
  if(/duplicate key|23505|revision|Konflikt/i.test(String(e.message)))blocked=true;
  status("Cloud: nicht gespeichert",true);
  error(e);
 }finally{
  saving=false;
  if(!blocked&&changedSerial&&changedSerial!==lastSerial)debounce=setTimeout(()=>writeCloud(),250);
 }
}
async function ensureSaved(){
 clearTimeout(debounce);
 if(blocked)throw Error("Speicherkonflikt: bitte Cloud neu laden.");
 if(changedSerial&&!saving)await writeCloud();
 let tries=0;
 while(saving&&tries++<30)await new Promise(resolve=>setTimeout(resolve,100));
 if(saving||changedSerial)throw Error("Nicht alle Änderungen sind in der Cloud gespeichert.");
}
async function createClan(){
 if(clanId)await ensureSaved();
 const name=$("cloudClanName").value.trim(),tag=cleanTag($("cloudClanTag").value);
 if(!name||!/^#[0289PYLQGRJCUV]{3,15}$/.test(tag))throw Error("Bitte Clanname und gültigen Clash-Clan-Tag angeben.");
 const {data,error:err}=await sb.from("cwl_clans")
  .insert({name,clash_tag:tag,owner_user_id:user.id}).select("id").single();
 if(err)throw err;
 msg("Clan hinzugefügt.");
 await listClans(accountEpoch,data.id);
}
async function saveAlias(){
 if(!clanId||!user)throw Error("Kein Clan ausgewählt.");
 const name=$("cloudAlias").value.trim();
 const {error:err}=await sb.rpc("cwl_set_my_alias",{p_clan:clanId,p_name:name});
 if(err)throw err;msg("Anzeigename gespeichert.");await audit();
}

async function loadAccessList(expected=clanId){
 if(!expected||!user)return;
 const canInvite=["owner","editor"].includes(role);
 const [{data:members,error:e1},{data:invites,error:e2},{data:blocks,error:e3}]=await Promise.all([
  sb.from("cwl_clan_memberships").select("user_id,role,display_name,joined_at").eq("clan_id",expected).order("joined_at"),
  canInvite?sb.from("cwl_clan_invites").select("id,role,created_by,expires_at,reusable,link_label,use_count")
   .eq("clan_id",expected).is("used_at",null)
   .or("expires_at.is.null,expires_at.gt."+new Date().toISOString())
   .order("created_at",{ascending:false}).limit(100):Promise.resolve({data:[],error:null}),
  canInvite?sb.from("cwl_access_blocks").select("user_id,blocked_by,blocked_role,display_name,blocked_at,permanent")
   .eq("clan_id",expected).order("blocked_at",{ascending:false}).limit(100):
   Promise.resolve({data:[],error:null})
 ]);
 if(e1)throw e1;if(e2)throw e2;if(e3)throw e3;if(expected!==clanId)return;
 const list=$("cloudAccessList");list.replaceChildren();
 for(const m of members||[]){
  const row=document.createElement("div");row.className="cloud-access-row";
  const name=document.createElement("strong");
  name.textContent=(m.display_name||({owner:"Besitzer",editor:"Vize",viewer:"Beobachter"}[m.role]||"Clanmitglied"))+(m.user_id===user.id?" (du)":"");
  row.append(name);
  const canRemove=m.role!=="owner"&&m.user_id!==user.id&&
    (role==="owner"||(role==="editor"&&m.role==="viewer"));
  if(canRemove){
   const actions=document.createElement("div");actions.className="cloud-access-controls";
   if(role==="owner"){
    const select=document.createElement("select");select.setAttribute("aria-label","Berechtigung für "+name.textContent);
    select.add(new Option("Vize · Bearbeiten","editor"));select.add(new Option("Beobachter · Lesen","viewer"));
    select.value=m.role;
    select.onchange=async()=>{
     const previous=m.role;select.disabled=true;
     try{const changed=await changeAccessRole(expected,m,select.value);if(!changed)select.value=previous}
     catch(e){select.value=previous;error(e)}
     finally{select.disabled=false}
    };
    actions.append(select);
   }
   const remove=document.createElement("button");remove.className="btn small danger";remove.type="button";remove.textContent="Entfernen";
   remove.onclick=()=>removeAccessMember(expected,m).catch(error);
   actions.append(remove);row.append(actions);
  }else{
   const label=document.createElement("span");
   label.textContent=m.role==="owner"?"Besitzer · volle Rechte":
      m.role==="editor"?"Vize · bearbeiten":"Beobachter · lesen";
   row.append(label);
  }
  list.append(row);
 }
 if(!members?.length)list.textContent="Noch keine Personen mit Zugriff.";
 text("cloudAccessCount","("+(members||[]).length+")");
 const pending=invites||[];
 toggle("cloudPendingDetails",canInvite);
 text("cloudPendingCount","("+pending.length+")");
 const root=$("cloudPendingList");root.replaceChildren();
 if(canInvite&&!pending.length)root.textContent="Keine offenen Einladungen.";
 for(const inv of pending){
  const row=document.createElement("div");row.className="cloud-invite-row";
  const details=document.createElement("div"),title=document.createElement("strong"),date=document.createElement("span");
  title.textContent=(inv.link_label?inv.link_label+" · ":"")+
   (inv.reusable?"Gruppenlink":"Einmaliger Link")+" · "+(inv.role==="editor"?"Vize":"Beobachter");
  date.textContent=(inv.reusable?"Beliebig viele Beitritte"+(inv.use_count?" · "+inv.use_count+" beigetreten":""):
    "Einmalige Einladung")+
    (inv.expires_at?" · gültig bis "+new Date(inv.expires_at).toLocaleString("de-AT",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):" · gültig bis Widerruf")+
   (inv.created_by===user.id?" · von dir":" · anderer Clanführer");
  details.append(title,date);row.append(details);
  if(role==="owner"||role==="editor"&&inv.created_by===user.id){
   const actions=document.createElement("div");actions.className="cloud-access-controls";
   if(inv.reusable){
    const edit=document.createElement("button");edit.type="button";edit.className="btn small";edit.textContent="Bearbeiten";
    edit.onclick=()=>editReusableInvite(expected,inv).catch(error);actions.append(edit);
   }
   const button=document.createElement("button");button.type="button";button.className="btn small danger";button.textContent="Widerrufen";
   button.onclick=()=>revokeInvite(expected,inv).catch(error);
   actions.append(button);row.append(actions);
  }
  root.append(row);
 }
 toggle("cloudBlockedDetails",canInvite);
 text("cloudBlockedCount","("+(blocks||[]).length+")");
 const blockedList=$("cloudBlockedList");blockedList.replaceChildren();
 if(canInvite&&!(blocks||[]).length)blockedList.textContent="Keine entfernten oder gesperrten Zugänge.";
 for(const item of blocks||[]){
  const row=document.createElement("div");row.className="cloud-access-row";
  const label=document.createElement("strong");
  label.textContent=(item.permanent?"Gesperrt: ":"Entfernt: ")+(item.display_name||"Unbekannte Person");
  const meta=document.createElement("span");
  meta.textContent=" · "+(item.permanent?"Alle künftigen Einladungen gesperrt":"Vorherige Einladungen ungültig");
  row.append(label,meta);
  if(role==="owner"||(role==="editor"&&item.blocked_by===user.id&&item.blocked_role==="viewer")){
   const undo=document.createElement("button");undo.className="btn small";undo.type="button";
   undo.textContent=item.permanent?"Sperre aufheben":"Frühere Links freigeben";
   undo.onclick=()=>unblockAccessMember(expected,item).catch(error);
   row.append(undo);
  }
  blockedList.append(row);
 }
}
async function changeAccessRole(expected,m,next){
 if(role!=="owner"||m.role==="owner"||!["editor","viewer"].includes(next))throw Error("Keine Berechtigung.");
 if(!await storage.confirmAction("Berechtigung von "+(m.display_name||"Clanmitglied")+" auf "+(next==="editor"?"Vize":"Beobachter")+" ändern?",{title:"Berechtigung ändern",confirmText:"Ändern"}))return false;
 const {data,error:e}=await sb.from("cwl_clan_memberships").update({role:next})
 .eq("clan_id",expected).eq("user_id",m.user_id).neq("role","owner").select("user_id");
 if(e)throw e;if(!data?.length)throw Error("Änderung nicht übernommen. Bitte neu laden.");
 if(expected===clanId){storage.toast("✓ Berechtigung geändert");await loadAccessList(expected)}
 return true;
}
async function removeAccessMember(expected,m){
 if(m.role==="owner"||m.user_id===user.id||!(role==="owner"||role==="editor"&&m.role==="viewer"))
  throw Error("Keine Berechtigung.");
 const choice=await storage.askAction({
  title:"Planer-Zugang verwalten",
  message:(m.display_name||"Diese Person")+" hat danach keinen Zugriff mehr. Beim Entfernen funktionieren bisherige Links für diese Person nicht mehr. Mit einer neu erstellten Einladung kann sie wieder beitreten. Sperren verhindert auch neue Einladungen.",
  buttons:[{value:"remove",text:"Zugriff entfernen",primary:true},
   {value:"ban",text:"Dauerhaft sperren",danger:true},{value:"cancel",text:"Abbrechen"}]
 });
 if(!["remove","ban"].includes(choice.value))return;
 const {error:e}=await sb.rpc(choice.value==="ban"?"cwl_ban_clan_member":"cwl_remove_clan_member",
  {p_clan:expected,p_user:m.user_id});
 if(e)throw e;
 if(expected===clanId){storage.toast(choice.value==="ban"?"✓ Person gesperrt":"✓ Zugang entfernt");await loadAccessList(expected)}
}
async function unblockAccessMember(expected,m){
 if(!(role==="owner"||(role==="editor"&&m.blocked_role==="viewer"&&m.blocked_by===user.id)))
   throw Error("Keine Berechtigung zum Entsperren.");
 if(!await storage.confirmAction((m.display_name||"Diese Person")+" wieder für Einladungen freigeben? Danach kann sie einen gültigen Einladungslink verwenden.",{title:"Sperre aufheben",confirmText:"Freigeben"}))return;
 const {error:e}=await sb.rpc("cwl_unblock_clan_member",{p_clan:expected,p_user:m.user_id});
 if(e)throw e;
 if(expected===clanId){storage.toast("✓ Sperre aufgehoben");await loadAccessList(expected)}
}
async function editReusableInvite(expected,inv){
 if(!inv.reusable||!(role==="owner"||role==="editor"&&inv.created_by===user.id))
  throw Error("Nur der Besitzer oder der erstellende Vize darf diesen Link bearbeiten.");
 const name=await storage.askAction({
  title:"Gruppenlink bearbeiten",message:"Bezeichnung des Links ändern. Danach legst du Berechtigung und Gültigkeit fest.",
  inputLabel:"Bezeichnung (maximal 60 Zeichen)",inputValue:inv.link_label||"",
  buttons:[{value:"confirm",text:"Weiter",primary:true},{value:"cancel",text:"Abbrechen"}]
 });
 if(name.value!=="confirm")return;
 const label=name.input.trim();
 if(label.length>60)throw Error("Bezeichnung darf maximal 60 Zeichen haben.");
 const rights=await storage.askAction({
  title:"Berechtigung für neue Beitritte",
  message:"Bereits beigetretene Personen behalten ihre Rolle.",
  buttons:[{value:"editor",text:"Vize"},{value:"viewer",text:"Beobachter",primary:true},{value:"cancel",text:"Abbrechen"}]
 });
 if(!["editor","viewer"].includes(rights.value))return;
 const expiry=await storage.askAction({
  title:"Gültigkeit ab jetzt",
  message:"Die neue Gültigkeit beginnt ab dem Speichern.",
  buttons:[{value:"24h",text:"24 Stunden"},{value:"7d",text:"7 Tage"},{value:"never",text:"Bis Widerruf",primary:true},{value:"cancel",text:"Abbrechen"}]
 });
 if(!["24h","7d","never"].includes(expiry.value))return;
 const {error:e}=await sb.rpc("cwl_update_reusable_invite",
  {p_id:inv.id,p_role:rights.value,p_duration:expiry.value,p_label:label||null});
 if(e)throw e;
 if(expected===clanId){storage.toast("✓ Gruppenlink aktualisiert");await loadAccessList(expected)}
}
async function revokeInvite(expected,inv){
 if(!["owner","editor"].includes(role)||role==="editor"&&inv.created_by!==user.id)throw Error("Keine Berechtigung.");
 if(!await storage.confirmAction("Diese offene Einladung zurückziehen? Der Link wird sofort ungültig.",{title:"Einladung zurückziehen",confirmText:"Zurückziehen",danger:true}))return;
 const {data,error:e}=await sb.from("cwl_clan_invites").delete().eq("id",inv.id)
 .eq("clan_id",expected).is("used_at",null).select("id");
 if(e)throw e;if(!data?.length)throw Error("Einladung bereits eingelöst oder nicht mehr verfügbar.");
 if(expected===clanId){storage.toast("✓ Einladung zurückgezogen");await loadAccessList(expected)}
}
async function createInvite(){
 if(!["owner","editor"].includes(role))throw Error("Nur Besitzer und Vize können einladen.");
 const reusable=$("cloudInviteKind").value==="reusable";
 const label=$("cloudInviteLabel").value.trim();
 if(label.length>60)throw Error("Die Bezeichnung darf maximal 60 Zeichen haben.");
 const {data,error:err}=reusable?
  await sb.rpc("cwl_create_reusable_invite",{
   p_clan:clanId,p_role:$("cloudInviteRole").value,
   p_duration:$("cloudInviteDuration").value,p_label:label||null
  }):await sb.rpc("cwl_create_short_invite",{p_clan:clanId,p_role:$("cloudInviteRole").value});
 if(err)throw err;
 inviteLink=location.origin+location.pathname+"?invite="+encodeURIComponent(data);
 toggle("cloudInviteOutput",true);
 text("cloudInviteOutput",reusable?
  "Gruppenlink erstellt · beliebig viele Beitritte während der eingestellten Gültigkeit. Link jetzt kopieren und teilen.":
  "Einmaliger Einladungslink erstellt · 7 Tage gültig. Link jetzt kopieren.");
 toggle("cloudCopyInvite",true);
 await loadAccessList(clanId);
}
async function joinInvite(){
 if(clanId)await ensureSaved();
 const code=$("cloudJoinCode").value.trim();
 if(!isInviteCode(code))throw Error("Bitte einen gültigen Einladungscode eingeben.");
 const name=$("cloudJoinName").value.trim();
 if(!name||name.length>60)throw Error("Bitte zuerst deinen Ingame-Namen eingeben.");
 const {data,error:err}=await sb.rpc(code.length===24?"cwl_redeem_reusable_invite":"cwl_redeem_named_invite",
  {p_code:code,p_name:name});
 if(err)throw err;
 const current=new URL(location.href);
 current.searchParams.delete("invite");
 history.replaceState(null,"",current.pathname+current.search+current.hash);
 $("cloudJoinCode").value="";
 $("cloudJoinName").value="";
 $("cloudAuthName").value="";
 saveInvite(INVITE_TOKEN_KEY,"");
 saveInvite(INVITE_ALIAS_KEY,"");
 msg("Du bist "+name+" und hast jetzt Zugriff auf den Clan.");
 storage.toast("✓ Dem Clan beigetreten");
 await listClans(accountEpoch,data);
}
function normalizeTag(t){return String(t||"").trim().toUpperCase()}
const autoRosterChecks=new Map();
function isAutoRosterEnabled(){
 if(!clanId)return false;
 try{return localStorage.getItem("cwl_auto_roster_"+clanId)!=="off"}catch{return true}
}
function syncAutoRosterSetting(){
 const toggle=$("settingsAutoRoster"),hint=$("autoRosterStatus");
 if(toggle){toggle.checked=isAutoRosterEnabled();toggle.disabled=!["owner","editor"].includes(role)}
 if(hint&&!["owner","editor"].includes(role))hint.textContent="Automatischer Import ist für die Clanführung verfügbar.";
}
async function maybeAutoRoster(force=false){
 if(!clanId||!user||!cloud.active||!["owner","editor"].includes(role)||!isAutoRosterEnabled()||
    !navigator.onLine||document.hidden||rosterAutoBusy||blocked||changedSerial||saving)return;
 const now=Date.now();
 if(!force&&now-(autoRosterChecks.get(clanId)||0)<900000)return;
 autoRosterChecks.set(clanId,now);
 try{await getRoster({automatic:true})}
 catch(e){text("autoRosterStatus","Automatischer Abgleich vorübergehend nicht verfügbar. Manuell erneut prüfen.");
  console.warn("Automatischer Mitgliederabgleich:",e?.message||e)}
}
async function getRoster({automatic=false}={}){
 let stage="Vorbereitung";
 try{
 if(!clanId)throw Error("Bitte Clan auswählen");
 if(automatic&&(role==="viewer"||changedSerial||saving||blocked||rosterAutoBusy))return;
 await ensureSaved();
 if(automatic)rosterAutoBusy=true;
 resetRoster();
 if(!automatic)toggle("cloudRosterBox",true);
 const status=$("cloudRosterStatus");status.textContent="Clanmitglieder werden verglichen …";status.classList.remove("error");
 if(!automatic)$("cloudRosterBox").scrollIntoView({behavior:"auto",block:"nearest"});
 stage="Clash-Daten abrufen";
 let {data,error:err}=await sb.functions.invoke("coc-clan-members",{body:{clanId}});
 if(err && (err.name==="FunctionsFetchError" ||
    (err.name==="TypeError" && /type error|failed to fetch|load failed/i.test(err.message||"")))){
   // Read-only fallback for WebKit when the SDK cannot finish reading the
   // response. The server always checks this user's JWT and clan membership.
   const original=err;
   try{
     const {data:auth,error:authError}=await sb.auth.getSession();
     if(authError)throw authError;
     if(!auth?.session?.access_token)
       throw Error("Bitte erneut anmelden und den Clanvergleich wiederholen.");
     const res=await fetch(SUPABASE_URL+"/functions/v1/coc-clan-members",{
       method:"POST",cache:"no-store",
       headers:{
         "Authorization":"Bearer "+auth.session.access_token,
         "apikey":SUPABASE_PUBLISHABLE_KEY,
         "Content-Type":"application/json"
       },
       body:JSON.stringify({clanId})
     });
     const payload=await res.text();
     let json;
     try{json=JSON.parse(payload)}catch{
       throw Error("Die Clash-Antwort konnte nicht gelesen werden (HTTP "+res.status+").");
     }
     data=json;err=res.ok?null:{name:"FunctionsHttpError",message:json?.error||"HTTP "+res.status};
   }catch(fallbackError){
     console.warn("Safari-Clanvergleich: Alternativer Abruf fehlgeschlagen",{
       original:original?.name||"Transportfehler",
       fallback:fallbackError?.name||"Unbekannt"
     });
     throw Error("Die Clanmitglieder konnten nicht geladen werden. Bitte Safari neu öffnen und erneut versuchen. (Verbindung/Antwort)");
   }
 }
 stage="Serverantwort prüfen";
 if(err){
   let reason=err.message||"unknown_error";
   if(err.context?.json)try{const info=await err.context.json();reason=info?.error||reason}catch{}
   const descriptions={
     not_a_member:"Kein Zugriff auf diesen Clan. Bitte erneut anmelden und den Clan auswählen.",
     missing_server_configuration:"Die API-Verbindung ist noch nicht vollständig eingerichtet.",
     missing_linked_clan_tag:"Dieser Clan hat noch keinen hinterlegten Clan-Tag.",
     upstream_timeout:"Die Clash-API antwortet gerade zu langsam. Bitte erneut versuchen.",
     upstream_unreachable:"Die Clash-API ist derzeit nicht erreichbar.",
     unexpected_response:"Die Clash-API hat unerwartete Daten geliefert."
   };
   if(reason.startsWith("supercell_status_"))reason="Supercell meldet HTTP "+reason.split("_").pop()+". Bitte API-Verbindung prüfen.";
   throw Error(descriptions[reason]||reason+" (API-Anfrage fehlgeschlagen)");
 }
 if(!data?.ok)throw Error(data?.error||"Abruf fehlgeschlagen.");
 text("cloudRosterStatus","Vergleich abgeschlossen. Bitte die Unterschiede prüfen.");
 stage="Mitglieder vergleichen";
 if(!Array.isArray(data.members))throw Error("Die Clan-Mitgliederliste wurde nicht vollständig übertragen.");
 const incoming=data.members.filter(m=>m&&typeof m==="object");
 const rosterMap=new Map(incoming.filter(m=>/^#[0-9A-Z]+$/.test(normalizeTag(m.tag))).map(m=>[normalizeTag(m.tag),m]));
 const existing=storage.getProfile().members;
 const initialImport=existing.length===0;
 const existingMap=new Map(existing.filter(m=>m.playerTag).map(m=>[normalizeTag(m.playerTag),m]));
 const added=[...rosterMap.values()].filter(m=>!existingMap.has(normalizeTag(m.tag)));
 const departed=existing.filter(m=>m.playerTag&&!rosterMap.has(normalizeTag(m.playerTag))&&m.cocSyncState!=="former"&&m.cocSyncState!=="kept");
 const planDays=storage.getPlannedLineups();
 const safeDays=Array.isArray(planDays)?planDays:[];
 const critical=departed.map(m=>({member:m,days:safeDays.filter(d=>Array.isArray(d?.lineup)&&d.lineup.includes(m.id)).map(d=>d.day)}))
   .filter(item=>item.days.length>0);
 const criticalTags=new Set(critical.map(item=>normalizeTag(item.member.playerTag)));
 const normalDeparted=departed.filter(m=>!criticalTags.has(normalizeTag(m.playerTag)));
 const updated=[...rosterMap.values()].filter(m=>{
   const current=existingMap.get(normalizeTag(m.tag));
   return current&&(current.cocSyncState==="former"||current.name!==m.name||(m.townHallLevel!=null&&current.townHall!==m.townHallLevel));
 });
 roster=incoming;rosterDiff={added,departed,updated,normalDeparted,critical,received:incoming.length,initialImport};
 stage="Unterschiede anzeigen";
 const diff=$("cloudRosterDiff");diff.replaceChildren();
 function group(title,items){
  const head=document.createElement("p");head.textContent=title+" ("+items.length+")";head.style.fontWeight="bold";diff.append(head);
  for(const x of items.slice(0,50)){const line=document.createElement("p");line.textContent="• "+x.name+" "+(x.tag||x.playerTag||"");diff.append(line)}
 }
 group("NEU IM CLAN",added);
 group("NAMEN/RH GEÄNDERT",updated);
 group("NICHT MEHR IM CLAN · OHNE AUFSTELLUNG",normalDeparted);
 const warn=$("cloudDepartedWarnings");warn.replaceChildren();
 if(critical.length){
  const title=document.createElement("strong");
  title.textContent="⚠️ "+critical.length+" Spieler nicht mehr im Clan, aber noch in der CWL-Aufstellung";
  const description=document.createElement("p");
  description.textContent="Diese Spieler werden nicht automatisch pausiert oder entfernt. Bitte für jeden entscheiden:";
  warn.append(title,description);
  for(const item of critical){
   const label=document.createElement("label");
   label.textContent=item.member.name+" · Tag "+item.days.join(", ");
   const select=document.createElement("select");
   select.className="cloud-missing-choice";select.dataset.playerId=item.member.id;
   select.add(new Option("Bitte auswählen",""));
   select.add(new Option("Vorerst nichts ändern","defer"));
   select.add(new Option("Weiterhin als Dabei bestätigen","keep"));
   label.append(select);warn.append(label);
  }
 }
 toggle("cloudDepartedWarnings",critical.length>0);
 toggle("cloudRosterDiff",true);
 toggle("cloudApplyRoster",role!=="viewer"&&(added.length+updated.length+departed.length)>0);
 text("cloudRosterStatus",incoming.length+" Mitglieder geprüft · "+added.length+" neu · "+updated.length+" geändert · "+departed.length+" ausgetreten"+(critical.length?" · ⚠️ Aufstellungen prüfen":""));
 if(automatic){
  if(critical.length){
   toggle("cloudRosterBox",true);
   text("autoRosterStatus","Aufstellung prüfen: "+critical.length+" ausgetretene Spieler sind noch eingeplant.");
   storage.toast("⚠ Mitgliederabgleich: Aufstellungen prüfen");
  }else{
   const changes=added.length+updated.length+normalDeparted.length;
   if(changes)await applyRoster();
   text("autoRosterStatus","Letzter Abgleich: "+new Date().toLocaleTimeString("de-AT",{hour:"2-digit",minute:"2-digit"})+
     (changes?" · "+changes+" Änderungen übernommen":" · aktuell"));
  }
 }
 }catch(err){
   console.warn("Clanvergleich fehlgeschlagen",{
     stage,name:err?.name||"Fehler",message:String(err?.message||err).slice(0,200)
   });
   if(err instanceof TypeError || /^(type error|load failed)$/i.test(String(err?.message||"")))
     throw Error("Der Mitgliedervergleich konnte bei „"+stage+"“ nicht abgeschlossen werden. Bitte Seite neu laden und erneut versuchen.");
   throw err;
 }finally{if(automatic)rosterAutoBusy=false}
}
async function applyRoster(){
 if(!roster||!rosterDiff||!["owner","editor"].includes(role))return;
 await ensureSaved();
 const currentRoster=roster;
 const decisions=new Map([...document.querySelectorAll("#cloudDepartedWarnings .cloud-missing-choice")]
   .map(select=>[select.dataset.playerId,select.value]));
 if(rosterDiff.critical.some(item=>!decisions.get(item.member.id)))
  throw Error("Bitte für alle Spieler in einer Aufstellung entscheiden, bevor du den Abgleich übernimmst.");
 const protectedIds=new Set(rosterDiff.critical.map(item=>item.member.id));
 const p=storage.getProfile(),members=p.members;
 const map=new Map(members.filter(m=>m.playerTag).map(m=>[normalizeTag(m.playerTag),m]));
 const remoteTags=new Set();
 for(const [i,r] of currentRoster.entries()){
  const tag=normalizeTag(r.tag);if(!tag)continue;remoteTags.add(tag);
  let m=map.get(tag);
  if(!m){
    m=storage.newMember(r.name);
    m.playerTag=tag;m.participating=false;m.fixed=false;m.priority=0;
    if(!rosterDiff.initialImport)m.cocSyncState="new"; // no NEW badges on first complete import
    members.push(m);map.set(tag,m);
  } else if(m.cocSyncState==="former"||m.cocSyncState==="kept") {
    delete m.cocSyncState; // rejoined the clan
  }
  m.name=r.name;
  m.cocOrder=i;
  if(Number.isInteger(r.townHallLevel)&&r.townHallLevel>=3&&r.townHallLevel<=20)m.townHall=r.townHallLevel;
 }
 for(const m of members){
  if(!m.playerTag||remoteTags.has(normalizeTag(m.playerTag)))continue;
  if(protectedIds.has(m.id)){
    if(decisions.get(m.id)==="keep"){
      m.participating=true;
      m.cocSyncState="kept"; // expressly retain a missing member's eligibility
    }
    // "defer" means preserve everything and review again at the next import.
    continue;
  }
  if(m.cocSyncState==="kept")continue; // explicit user decision remains in force
  m.cocSyncState="former";
  m.participating=false; // no planned lineups reference this person
 }
 storage.rerender();
 await ensureSaved();
 msg("Mitgliederliste übernommen ✓");resetRoster();toggle("cloudRosterBox",false);
}
async function audit(){
 if(!clanId)return;
 const [{data:rows,error:err},{data:people,error:e2}]=await Promise.all([
  sb.from("cwl_change_events").select("actor_id,event_type,details,revision,created_at").eq("clan_id",clanId).order("id",{ascending:false}).limit(100),
  sb.from("cwl_clan_memberships").select("user_id,display_name,role").eq("clan_id",clanId)
 ]);
 if(err)throw err;if(e2)throw e2;
 const aliases=new Map((people||[]).map(x=>[x.user_id,x.display_name||"Clanmitglied "+x.user_id.slice(0,6)]));
 const root=$("cloudAudit");root.replaceChildren();
 if(!rows?.length){root.textContent="Noch keine gemeinsamen Änderungen.";return}
 for(const e of rows){
  const item=document.createElement("div");item.className="cloud-actor";
  const head=document.createElement("b");head.textContent=(e.actor_id===user.id?"Du":aliases.get(e.actor_id)||"Ehemaliges Clanmitglied")+" · "+new Date(e.created_at).toLocaleString("de-AT");
  const detail=document.createElement("span");const d=e.details||{};
  const label={name:"Name",participating:"Dabei",fixed:"FIX",priority:"Priorität",
    townHall:"Rathaus",threeStar:"3★-Stärke",statuses:"Tagesregeln",
    firstDay:"Erst ab",outFromDay:"Raus ab"};
  const fmt=v=>v==null?"–":typeof v==="boolean"?(v?"Ja":"Nein"):String(v);
  const pieces=[];
  for(const entry of (d.spieleraenderungen||[])){
    const fields=entry.felder||{};
    if(fields.hinzugefuegt){pieces.push(entry.name+" hinzugefügt");continue}
    if(fields.entfernt){pieces.push(entry.name+" entfernt");continue}
    for(const [key,pair] of Object.entries(fields)){
      if(!Array.isArray(pair))continue;
      if(key==="statuses" && Array.isArray(pair[0]) && Array.isArray(pair[1])){
        const changed=pair[1].map((v,i)=>v!==pair[0][i]?"Tag "+(i+1)+": "+fmt(pair[0][i])+" → "+fmt(v):null).filter(Boolean);
        pieces.push(entry.name+": "+changed.join(", "));continue;
      }
      pieces.push(entry.name+": "+(label[key]||key)+" "+fmt(pair[0])+" → "+fmt(pair[1]));
    }
  }
  if(d.plan_geaendert)pieces.push("Gespielte Aufstellungen / Tagesspeicher geändert");
  if(d.config_geaendert)pieces.push("CWL-Grunddaten geändert");
  if(d.weitere_spieler)pieces.push("+"+d.weitere_spieler+" weitere Spieleränderungen");
  if(!pieces.length && d.aenderungen_mitglieder?.length)pieces.push("Betroffen: "+d.aenderungen_mitglieder.join(", "));
  detail.textContent=(e.event_type==="profile_created"?"Profil erstellt":"Profil geändert")+
    (pieces.length?" · "+pieces.join(" · "):"");
  item.append(head,detail);root.append(item);
 }
}

function stopPresence(){
 if(presenceTimer!==null){clearInterval(presenceTimer);presenceTimer=null;}
 text("cloudActiveMembers","");
}
async function refreshPresence(expected=clanId){
 if(!user||!expected||expected!==clanId)return;
 const since=new Date(Date.now()-120000).toISOString();
 const [{data:recent,error:presenceError},{data:people,error:membersError}]=await Promise.all([
  sb.from("cwl_clan_presence").select("user_id,seen_at").eq("clan_id",expected).gte("seen_at",since),
  sb.from("cwl_clan_memberships").select("user_id,display_name,role").eq("clan_id",expected)
 ]);
 if(presenceError)throw presenceError;if(membersError)throw membersError;
 if(expected!==clanId)return;
 const names=new Map((people||[]).map(x=>[x.user_id,x.display_name||({owner:"Besitzer",editor:"Vize",viewer:"Beobachter"}[x.role]||"Clanmitglied")]));
 const others=(recent||[]).filter(x=>x.user_id!==user.id);
 const count=(recent||[]).length;
 text("cloudActiveMembers",count?
  (others.length?"● Du und "+others.length+" weitere Person"+(others.length===1?"":"en")+" gerade im Planer · "+
    others.map(x=>names.get(x.user_id)||"Anderes Teammitglied").join(", "):
    "● Du bist gerade im Planer · sonst niemand online"):
    "○ Online-Status wird geprüft");
}
async function heartbeat(expected=clanId){
 if(!user||!expected||expected!==clanId||document.hidden)return;
 const {error:err}=await sb.rpc("cwl_touch_presence",{p_clan:expected});
 if(err)throw err;
 await refreshPresence(expected);
 await loadAccessList(expected).catch(console.warn);
}
async function startPresence(){
 stopPresence();
 if(!clanId||!user)return;
 const current=clanId;
 await heartbeat(current).catch(console.warn);
 presenceTimer=setInterval(()=>{
  if(clanId===current)heartbeat(current).catch(console.warn);
 },45000);
}
function editingDialog(){
 if(document.querySelector(".modal.open,.inline-action-panel.open"))return true;
 const active=document.activeElement;
 return Boolean(active?.matches("input:not([readonly]),textarea,select,[contenteditable='true']")&&
  active.closest("#view-members,#view-plan,#view-summary"));
}
async function refreshCloud(){
 hideChangeToast();
 if(!clanId){msg("Noch kein Clan ausgewählt.");return}
 if(editingDialog()){msg("Bitte zuerst die offene Bearbeitung schließen, dann aktualisieren.",true);return}
 const prior=revision;
 const loaded=await loadCloudProfile();
 if(!loaded){msg("Aktualisierung abgebrochen, deine Änderungen bleiben bestehen.");return}
 remotePending=false;lastNotifiedRevision=Math.max(lastNotifiedRevision,Number(revision||0));
 await Promise.all([audit(),refreshPresence(),loadAccessList(clanId)]);
 const stamp=new Date().toLocaleTimeString("de-AT",{hour:"2-digit",minute:"2-digit"});
 const message=prior===revision?"✓ Alles aktuell · keine neuen Änderungen · "+stamp:
  "✓ Neueste Änderungen übernommen · "+stamp;
 text("cloudSyncFeedback",message);
 msg(message);
}
async function leaveSharedClan(){
 if(!clanId||role==="owner")throw Error("Nur Vize oder Beobachter können den Clan verlassen.");
 const name=clans.find(c=>c.id===clanId)?.name||"diesen Clan";
 if(!await storage.confirmAction("Möchtest du "+name+" verlassen? Der Clan und seine Daten bleiben für die anderen erhalten.",{title:"Clan verlassen",confirmText:"Clan verlassen",danger:true}))return;
 await ensureSaved();
 const id=clanId;
 const {error:err}=await sb.from("cwl_clan_memberships").delete().eq("clan_id",id).eq("user_id",user.id);
 if(err)throw err;
 await listClans(accountEpoch);
 msg("Du hast den gemeinsamen Clan verlassen.");
}
async function deleteOwnedClan(){
 if(!clanId||role!=="owner")throw Error("Nur der Besitzer darf seinen eigenen Clan löschen.");
 const name=clans.find(c=>c.id===clanId)?.name;
 if(!name)return;
 const answer=await storage.askAction({
  title:"Cloud-Clan löschen",
  message:"Alle gemeinsamen Profile, Zugänge, Einladungen und der Änderungsverlauf von „"+name+"“ gehen dauerhaft verloren. Zur Bestätigung den Clannamen genau eingeben.",
  inputLabel:"Clanname",inputValue:"",
  buttons:[{value:"confirm",text:"Weiter",primary:true},{value:"cancel",text:"Abbrechen"}]
 });
 if(answer.value!=="confirm")return;
 const typed=answer.input;
 if(typed!==name){if(typed!==null)msg("Löschen abgebrochen – Clanname stimmt nicht überein.");return}
 if(!await storage.confirmAction("Den gesamten gemeinsamen Clan „"+name+"“ und alle zugehörigen Daten endgültig löschen? Vorher ein JSON-Backup erstellen.",{title:"Clan endgültig löschen",confirmText:"Clan löschen",danger:true}))return;
 await ensureSaved();
 const id=clanId;
 const {error:err}=await sb.from("cwl_clans").delete().eq("id",id);
 if(err)throw err;
 await listClans(accountEpoch);
 msg("Eigener Cloud-Clan gelöscht. Andere Clans sind unverändert.");
}

async function logout(){
 await ensureSaved();
 const {error:err}=await sb.auth.signOut();if(err)throw err;
 await useSession(null);close();
}
async function exportCloud(){if(!clanId)throw Error("Kein Cloud-Clan ausgewählt.");
 await ensureSaved();storage.saveJson();
}
async function importCloud(){
 if(!clanId||role==="viewer")throw Error("Kein Bearbeitungszugriff.");
 const f=$("cloudImportFile").files[0];if(!f)throw Error("Bitte eine JSON-Backup-Datei auswählen.");
 const b=JSON.parse(await f.text());if(Number(b.dataVersion)!==9)throw Error("Nur Datenformat 9 ist unterstützt.");
 const p=b.kind==="cwl-profile"?b.profile:b.kind==="cwl-app-backup"?(b.app?.profiles?.find(x=>x.id===b.app?.activeProfileId)||b.app?.profiles?.[0]):null;
 if(!p||!Array.isArray(p.members)||!Array.isArray(p.locks)||!Array.isArray(p.archives))throw Error("Kein gültiges CWL-Profil in dieser Datei.");
 if(!await storage.confirmAction("Dieses Backup ersetzt den aktuellen gemeinsamen Clanplan für alle Mitglieder.",{title:"Gemeinsamen Plan ersetzen?",confirmText:"Plan ersetzen",danger:true}))return;
 await ensureSaved();hydrating=true;
 try{storage.switchToCloud(p)}finally{hydrating=false}
 cloud.onLocalChange();
 await writeCloud();close();
}
function bind(id,event,handler){$(id).addEventListener(event,async(e)=>{try{e.preventDefault();await handler(e)}catch(err){error(err)}})}
bind("cloudOpen","click",async()=>{open();if(clanId)await loadAccessList(clanId)});bind("cloudClose","click",close);
bind("cloudLogin","click",()=>sign("login"));bind("cloudSignup","click",()=>sign("signup"));
bind("cloudForgotPassword","click",showForgotPassword);
bind("cloudSendReset","click",sendPasswordReset);
bind("cloudBackToLogin","click",backToLogin);
bind("cloudChangePassword","click",completeRecovery);
bind("cloudLogout","click",logout);
bind("cloudClanSelect","change",async()=>{try{await ensureSaved();await chooseClan()}catch(e){$("cloudClanSelect").value=clanId||"";throw e}});
bind("cloudReload","click",refreshCloud);
bind("cloudChangeDismiss","click",hideChangeToast);
bind("cloudChangeDetails","click",()=>{
 hideChangeToast();open();$("cloudAudit").scrollIntoView({behavior:"smooth",block:"center"});
});
bind("cloudLeaveBtn","click",leaveSharedClan);
bind("cloudDeleteBtn","click",deleteOwnedClan);
bind("cloudCreateClan","click",createClan);bind("cloudSaveAlias","click",saveAlias);

bind("cloudJoin","click",joinInvite);bind("cloudMakeInvite","click",createInvite);
function toggleInviteKind(){
 const box=$("cloudInviteReusableOptions");
 if(box)box.hidden=$("cloudInviteKind").value!=="reusable";
}
$("cloudInviteKind").addEventListener("change",toggleInviteKind);
toggleInviteKind();
bind("cloudCopyInvite","click",async()=>{
 if(!inviteLink)throw Error("Bitte zuerst eine Einladung erstellen.");
 await navigator.clipboard.writeText(inviteLink);
 storage.toast("✓ Einladungslink kopiert");
 
});
async function safeRosterRefresh(){
 try{await getRoster()}catch(err){
  const status=$("cloudRosterStatus");
  if(status){
   status.textContent=err instanceof TypeError?
     "Die Mitglieder konnten nicht geladen werden. Bitte die Seite neu laden und erneut versuchen.":
     (err?.message||"Die Mitglieder konnten nicht abgerufen werden. Bitte erneut versuchen.");
   status.classList.add("error");
  }
  throw err;
 }
}
bind("cloudFetchRoster","click",safeRosterRefresh);bind("cloudApplyRoster","click",applyRoster);
bind("cloudMembersSyncBtn","click",safeRosterRefresh);
bind("settingsRosterRefresh","click",async()=>{
 $("settingsClose").click();
 document.querySelector('.navbtn[data-view="members"]')?.click();
 await safeRosterRefresh();
});
$("settingsAutoRoster").addEventListener("change",ev=>{
 if(!clanId)return;
 try{localStorage.setItem("cwl_auto_roster_"+clanId,ev.target.checked?"on":"off")}catch{}
 if(ev.target.checked){autoRosterChecks.delete(clanId);maybeAutoRoster(true).catch(console.warn)}
 else text("autoRosterStatus","Automatischer Abgleich deaktiviert · manuelle Prüfung weiterhin möglich.");
});
bind("cloudManualOne","click",()=>{ $("addMemberBtn").click(); });
bind("cloudManualMany","click",()=>{ $("multiAddBtn").click(); });
bind("cloudManualFile","click",()=>{ $("membersFile").click(); });
bind("guestImportMembersBtn","click",()=>{ $("membersFile").click(); });
bind("guestManualOne","click",()=>{ $("addMemberBtn").click(); });
bind("guestManualMany","click",()=>{ $("multiAddBtn").click(); });
bind("bulkDoneBtn","click",()=>{ if($("bulkBar").classList.contains("hidden"))return; $("selectMembersBtn").click(); });

$("memberList").addEventListener("click",event=>{
  if(!cloud.active||role==="viewer")return;
  const row=event.target.closest(".member[data-id]");if(!row)return;
  const member=storage.getProfile().members.find(m=>m.id===row.dataset.id);
  if(!member||member.cocSyncState!=="new")return;
  delete member.cocSyncState; row.classList.remove("member-new");
  row.querySelector(".cloud-roster-flag")?.remove();
  cloud.onLocalChange();
});
bind("cloudLoadSnapshots","click",()=>backups.list());
bind("cloudSnapshotSelect","change",()=>backups.buttons());
bind("cloudDownloadSnapshot","click",()=>backups.download());
bind("cloudRestoreSnapshot","click",()=>backups.restore());
bind("cloudExportProfile","click",exportCloud);bind("cloudImportProfile","click",importCloud);
$("cloudOverlay").addEventListener("click",e=>{if(e.target===$("cloudOverlay"))close()});
window.addEventListener("online",()=>{if(cloud.active&&blocked)msg("Wieder online. Bitte Cloud-Stand neu laden, bevor du weiterbearbeitest.",true)});

let pendingRelease=null;
function safeForReload(){
 return !changedSerial&&!saving&&!blocked&&!editingDialog()&&
   !document.querySelector(".cloud-overlay.open")&&
   !document.activeElement?.matches("input,textarea,select,[contenteditable='true']");
}
function installPendingRelease(){
 if(!pendingRelease||!safeForReload()||document.hidden||!navigator.onLine)return false;
 const next=new URL(location.href);
 if(next.searchParams.get("appv")===pendingRelease)return false;
 next.searchParams.set("appv",pendingRelease);
 text("autoUpdateStatus","Neue Version erkannt · wird jetzt geladen …");
 location.replace(next.toString());
 return true;
}
async function checkForAppUpdate(){
 if(document.hidden||!navigator.onLine)return;
 if(pendingRelease){installPendingRelease();return}
 if(Date.now()-lastVersionCheck<9000)return;
 lastVersionCheck=Date.now();
 try{
  const response=await fetch("./cloud-version.json?check="+Date.now(),{cache:"no-store"});
  if(!response.ok)return;
  const payload=await response.json();
  const remote=typeof payload?.version==="string"?payload.version:null;
  const installed=$("appVersion")?.textContent?.trim()||"v1.4.0";
  if(!remote||!/^v[0-9]+\.[0-9]+\.[0-9]+(?:-(?:alpha|beta|rc)\.[0-9]+)?$/.test(remote)||
     remote===installed)return;
  pendingRelease=remote;appUpdatePending=true;
  if(!installPendingRelease())
    text("autoUpdateStatus","Update auf "+remote+" verfügbar · nach Bearbeitung automatisch laden");
 }catch(err){console.warn("Updateprüfung nicht erreichbar:",err)}
}
setInterval(()=>checkForAppUpdate().catch(console.warn),60000);
setInterval(()=>maybeAutoRoster().catch(console.warn),900000);
window.addEventListener("pageshow",()=>checkForAppUpdate().catch(console.warn));
document.addEventListener("visibilitychange",()=>{
 if(!document.hidden){
  checkForAppUpdate().catch(console.warn);
  maybeAutoRoster().catch(console.warn);
  heartbeat().catch(console.warn);
  checkRemoteChanges("foreground").catch(console.warn);
 }
});
window.addEventListener("focus",()=>{
 checkForAppUpdate().catch(console.warn);
 checkRemoteChanges("focus").catch(console.warn);
});
document.addEventListener("pointerdown",()=>checkForAppUpdate().catch(console.warn),{passive:true});
document.addEventListener("keydown",()=>checkForAppUpdate().catch(console.warn));
setTimeout(()=>checkForAppUpdate().catch(console.warn),0);

const linkCode=new URLSearchParams(location.search).get("invite");
if(linkCode&&isInviteCode(linkCode))saveInvite(INVITE_TOKEN_KEY,linkCode);
const resumedInvite=isInviteCode(linkCode)?linkCode:storedInvite(INVITE_TOKEN_KEY);
if(isInviteCode(resumedInvite)){
 $("cloudJoinCode").value=resumedInvite;
 const alias=storedInvite(INVITE_ALIAS_KEY);
 if(alias){$("cloudJoinName").value=alias;$("cloudAuthName").value=alias}
 open();
}
sb.auth.onAuthStateChange((event,session)=>{
 if(event==="PASSWORD_RECOVERY"){
  queueMicrotask(beginRecovery);
  return;
 }
 if(event==="SIGNED_OUT"&&user)queueMicrotask(()=>useSession(null).catch(error));
 if(event==="SIGNED_IN"&&session?.user?.id!==user?.id&&!recoveryMode)
  queueMicrotask(()=>useSession(session).catch(error));
});
const {data:{session},error:sessionErr}=await sb.auth.getSession();
if(sessionErr)error(sessionErr);
else if(recoveryMode)beginRecovery();
else if(session)try{await useSession(session)}catch(e){error(e)}
else{showSignedIn();cloud.afterRender()}
