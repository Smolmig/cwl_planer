import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const sb=createClient("https://yjldnvfwposfwmzmcsow.supabase.co",
 "sb_publishable_ej03YPfIYRjQZuASAWi1yg_I0VLmayy",
 {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const text=(id,value)=>{if($(id))$(id).textContent=value};
const toggle=(id,show)=>{if($(id))$(id).hidden=!show};
const storage=window.CWLLegacy;
let user=null,clanId=null,clans=[],role=null,revision=null,lastSerial=null,changedSerial=null;
let saving=false,blocked=false,hydrating=false,debounce=null,channel=null,roster=null,rosterDiff=null,inviteLink=null,accountEpoch=0;
let clanRoles=new Map(),presenceTimer=null,lastVersionCheck=0,appUpdatePending=false;
let pollTimer=null,syncInFlight=false,lastNotifiedRevision=0,remotePending=false,notifyTimer=null;
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
  $("cloudOpen").textContent=this.active?"☁️ "+(label.length>15?label.slice(0,13)+"…":label)+" ▾":"👤 Anmelden";
  $("cloudOpen").title=this.active?"Clan und Konto verwalten":"Anmelden oder registrieren";
  $("cloudOpen").setAttribute("aria-label",this.active?"Clan und Konto verwalten":"Anmelden oder registrieren");
  const cta=$("cloudMembersSyncBtn");if(cta)cta.textContent=storage.getProfile().members.length?"↻ Mitglieder aktualisieren":"↓ Mitglieder importieren";
  $("cloudOpen").classList.toggle("cloud-on",this.active);
  toggle("cloudMembersTools",!!this.active&&!!clanId);
  toggle("guestMembersTools",!this.active);
  toggle("cloudHelpSection",this.active);
  installNameEditors();
  if(!this.active)return;
  // The UI is deliberately non-editable for viewers; RLS also enforces this server-side.
  const keep=new Set(["copyFullPlanBtn","singleDayMode","allDaysMode","nextDayBtn",
    "mobileOverviewToggle","memberSearch","memberFilter","summarySearch","summaryFilter","themeSelect","updateAppBtn",
    "exportProfileBtn","exportAllBtn"]);
  for(const el of document.querySelectorAll("#view-plan button,#view-plan input,#view-plan select,#view-members button,#view-members input,#view-members select,#view-summary button,#view-summary input,#view-summary select")){
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
function installNameEditors(){
 for(const wrap of document.querySelectorAll("#memberList .name-wrap")){
   const input=wrap.querySelector(".member-name"),button=wrap.querySelector(".member-name-edit");
   if(!input||!button)continue;
   input.readOnly=true;
   if(cloud.active&&role==="viewer"){button.hidden=true;continue}
   if(button.dataset.editReady==="1")continue;
   button.dataset.editReady="1";
   button.addEventListener("click",event=>{
     event.stopPropagation();
     if(cloud.active&&role==="viewer")return;
     input.readOnly=false;
     input.focus({preventScroll:true});
     input.setSelectionRange(input.value.length,input.value.length);
   });
   input.addEventListener("blur",()=>{input.readOnly=true});
   input.addEventListener("keydown",event=>{
     if(event.key==="Enter"){event.preventDefault();input.blur()}
     if(event.key==="Escape"){
       event.preventDefault();
       input.value=storage.getProfile().members.find(m=>m.id===wrap.closest(".member")?.dataset.id)?.name||input.value;
       input.blur();
     }
   });
 }
}
function status(value,isError=false){text("saveBadge",value);$("saveBadge").className="badge "+(isError?"warn":"ok")}
function msg(value,isError=false){text("cloudMsg",value);$("cloudMsg").classList.toggle("error",isError)}
function error(e){msg(e?.message||String(e),true);console.warn("Cloud alpha:",e)}
function open(){const o=$("cloudOverlay");o.classList.add("open");o.setAttribute("aria-hidden","false")}
function close(){const o=$("cloudOverlay");o.classList.remove("open");o.setAttribute("aria-hidden","true");if(pendingRelease)setTimeout(installPendingRelease,0)}
function resetRoster(){roster=null;rosterDiff=null;toggle("cloudRosterDiff",false);toggle("cloudApplyRoster",false);toggle("cloudDepartedWrap",false)}
function showSignedIn(){toggle("cloudAuth",!user);toggle("cloudAccount",!!user);text("cloudIdentity",user?user.email:"")}
function cleanTag(raw){const s=String(raw||"").trim().toUpperCase();return s.startsWith("#")?s:"#"+s}
async function sign(kind){
 const email=$("cloudEmail").value.trim(),password=$("cloudPassword").value;
 if(!email||password.length<8)throw Error("Bitte E-Mail und mindestens 8 Zeichen Passwort eingeben.");
 const out=kind==="signup"?
  await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}}):
  await sb.auth.signInWithPassword({email,password});
 if(out.error)throw out.error;
 if(!out.data.session){msg("Registrierung angelegt. Bitte Bestätigungs-Mail öffnen, danach anmelden.");return}
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
}
async function leaveCloud(){
 clearTimeout(debounce);
 stopPresence();stopRemoteChecks();hideChangeToast();
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
 stopPresence();stopRemoteChecks();hideChangeToast();
 if(channel){await sb.removeChannel(channel);channel=null}
 clanId=$("cloudClanSelect").value||null;revision=null;role=null;
 lastSerial=null;changedSerial=null;blocked=false;remotePending=false;resetRoster();
 if(!clanId){toggle("cloudMembersTools",false);$("cloudNewClanDetails").open=true;cloud.active=true;role="viewer";hydrating=true;storage.switchToCloud(storage.blank("Clan verbinden"));hydrating=false;lastSerial=JSON.stringify(storage.getProfile());toggle("cloudInviteBox",false);toggle("cloudRosterBox",false);text("cloudRole","Noch kein Clan verbunden.");text("cloudActiveMembers","");
 toggle("cloudClanActions",false);cloud.afterRender();open();msg("Noch kein Clan verknüpft. Erstelle deinen eigenen Bereich oder gib einen Einladungscode ein.");return}
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
 toggle("cloudInviteBox",role==="owner");
 toggle("cloudRosterBox",true);
 toggle("cloudMembersTools",true);
 $("cloudNewClanDetails").open=false;
 toggle("cloudImportProfile",role!=="viewer");
 toggle("cloudImportFile",role!=="viewer");
 // Switch modes before rendering so cloud records never enter localStorage.
 cloud.active=true;hydrating=true;
 await loadCloudProfile(false);
 if(epoch!==accountEpoch)return;
 text("cloudSyncFeedback",(revision==null?"✓ Noch kein gemeinsames Profil gespeichert":"✓ Cloud-Stand geladen · Revision "+revision)+" · "+new Date().toLocaleTimeString("de-AT",{hour:"2-digit",minute:"2-digit"}));
 await audit();
 channel=sb.channel("cloud-profile-"+clanId)
 .on("postgres_changes",{event:"*",schema:"public",table:"cwl_cloud_profiles",filter:"clan_id=eq."+clanId},
   ()=>{checkRemoteChanges("realtime").catch(error)})
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
 if(!automatic && changedSerial && !confirm("Nicht gespeicherte Änderungen verwerfen und Cloud-Stand laden?"))return false;
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
async function createInvite(){
 if(role!=="owner")throw Error("Nur der Clan-Besitzer kann einladen.");
 const {data,error:err}=await sb.rpc("cwl_create_short_invite",{p_clan:clanId,p_role:$("cloudInviteRole").value});
 if(err)throw err;
 inviteLink=location.origin+location.pathname+"?invite="+encodeURIComponent(data);
 toggle("cloudInviteOutput",true);
 text("cloudInviteOutput","Einladungscode: "+data+" · gültig 7 Tage, einmal verwendbar.");
 toggle("cloudCopyInvite",true);
}
async function joinInvite(){
 if(clanId)await ensureSaved();
 const code=$("cloudJoinCode").value.trim();
 if(!/^[a-zA-Z0-9_-]{12}$/.test(code))throw Error("Bitte einen gültigen Einladungscode eingeben.");
 const {data,error:err}=await sb.rpc("cwl_redeem_short_invite",{p_code:code});
 if(err)throw err;
 history.replaceState(null,"",location.pathname);
 msg("Einladung eingelöst, willkommen im Clan.");
 await listClans(accountEpoch,data);
}
function normalizeTag(t){return String(t||"").trim().toUpperCase()}
async function getRoster(){
 if(!clanId)throw Error("Bitte Clan auswählen");
 await ensureSaved();
 resetRoster();open();
 $("cloudRosterBox").scrollIntoView({behavior:"smooth",block:"start"});
 msg("Mitglieder werden aus Clash of Clans geladen …");
 const {data,error:err}=await sb.functions.invoke("coc-clan-members",{body:{clanId}});
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
 const incoming=data.members||[];
 const rosterMap=new Map(incoming.filter(m=>/^#[0-9A-Z]+$/.test(normalizeTag(m.tag))).map(m=>[normalizeTag(m.tag),m]));
 const existing=storage.getProfile().members;
 const initialImport=existing.length===0;
 const existingMap=new Map(existing.filter(m=>m.playerTag).map(m=>[normalizeTag(m.playerTag),m]));
 const added=[...rosterMap.values()].filter(m=>!existingMap.has(normalizeTag(m.tag)));
 const departed=existing.filter(m=>m.playerTag&&!rosterMap.has(normalizeTag(m.playerTag))&&m.cocSyncState!=="former");
 const updated=[...rosterMap.values()].filter(m=>{
   const current=existingMap.get(normalizeTag(m.tag));
   return current&&(current.cocSyncState==="former"||current.name!==m.name||(m.townHallLevel!=null&&current.townHall!==m.townHallLevel));
 });
 roster=incoming;rosterDiff={added,departed,updated,received:incoming.length,initialImport};
 const diff=$("cloudRosterDiff");diff.replaceChildren();
 function group(title,items){
  const head=document.createElement("p");head.textContent=title+" ("+items.length+")";head.style.fontWeight="bold";diff.append(head);
  for(const x of items.slice(0,50)){const line=document.createElement("p");line.textContent="• "+x.name+" "+(x.tag||x.playerTag||"");diff.append(line)}
 }
 group("NEU IM CLAN",added);group("NAMEN/RH GEÄNDERT",updated);group("NICHT MEHR IM CLAN",departed);
 toggle("cloudRosterDiff",true);toggle("cloudDepartedWrap",false);
 toggle("cloudApplyRoster",role!=="viewer"&&(added.length+updated.length+departed.length)>0);
 msg("Abgleich: "+incoming.length+" Mitglieder · "+added.length+" neu · "+updated.length+" geändert · "+departed.length+" nicht mehr dabei. Noch nichts übernommen.");
}
async function applyRoster(){
 if(!roster||!rosterDiff||!["owner","editor"].includes(role))return;
 await ensureSaved();
 const currentRoster=roster;
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
  } else if(m.cocSyncState==="former") {
    delete m.cocSyncState; // rejoined the clan
  }
  m.name=r.name;
  m.cocOrder=i;
  if(Number.isInteger(r.townHallLevel)&&r.townHallLevel>=3&&r.townHallLevel<=20)m.townHall=r.townHallLevel;
 }
 for(const m of members){
  if(m.playerTag&&!remoteTags.has(normalizeTag(m.playerTag))){
    m.cocSyncState="former";
    m.participating=false; // retain player/history, but do not schedule automatically
  }
 }
 storage.rerender();
 await ensureSaved();
 msg("Mitgliederliste aktualisiert. Neue Spieler sind markiert und ausgetretene Spieler stehen ausgegraut am Listenende.");
 resetRoster();close();
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
    " · Rev. "+e.revision+(pieces.length?" · "+pieces.join(" · "):"");
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
 text("cloudActiveMembers",(count?"● "+count+" im Clan aktiv (letzte 2 Min.)":"Niemand kürzlich aktiv")+
  (others.length?" · Mit dir: "+others.map(x=>names.get(x.user_id)||"Clanmitglied").join(", "):" · Nur du"));
}
async function heartbeat(expected=clanId){
 if(!user||!expected||expected!==clanId||document.hidden)return;
 const {error:err}=await sb.rpc("cwl_touch_presence",{p_clan:expected});
 if(err)throw err;
 await refreshPresence(expected);
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
function editingDialog(){return Boolean(document.querySelector(".modal.open,.inline-action-panel.open"))}
async function refreshCloud(){
 hideChangeToast();
 if(!clanId){msg("Noch kein Clan ausgewählt.");return}
 if(editingDialog()){msg("Bitte zuerst die offene Bearbeitung schließen, dann aktualisieren.",true);return}
 const prior=revision;
 const loaded=await loadCloudProfile();
 if(!loaded){msg("Aktualisierung abgebrochen, deine Änderungen bleiben bestehen.");return}
 remotePending=false;lastNotifiedRevision=Math.max(lastNotifiedRevision,Number(revision||0));
 await Promise.all([audit(),refreshPresence()]);
 const stamp=new Date().toLocaleTimeString("de-AT",{hour:"2-digit",minute:"2-digit"});
 const message=prior===revision?"✓ Alles aktuell · keine neuen Änderungen · "+stamp:
  "✓ Neuer Cloud-Stand übernommen · Revision "+(revision??"–")+" · "+stamp;
 text("cloudSyncFeedback",message);
 msg(message);
}
async function leaveSharedClan(){
 if(!clanId||role==="owner")throw Error("Nur Vize oder Beobachter können den Clan verlassen.");
 const name=clans.find(c=>c.id===clanId)?.name||"diesen Clan";
 if(!confirm("Möchtest du "+name+" verlassen? Der Clan und seine Daten bleiben für die anderen erhalten."))return;
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
 const typed=prompt("Dauerhaft löschen: alle Cloud-Profile, Einladungen, Mitgliederzugänge und der Verlauf dieses Clans gehen verloren.\n\nZur Bestätigung den Clannamen exakt eingeben:", "");
 if(typed!==name){if(typed!==null)msg("Löschen abgebrochen – Clanname stimmt nicht überein.");return}
 if(!confirm("Letzte Bestätigung: den gesamten Cloud-Clan „"+name+"“ und alle zugehörigen gemeinsamen Daten UNWIDERRUFLICH löschen? Vorher JSON-Backup empfohlen."))return;
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
 if(!confirm("Dieses JSON-Profil wird den aktuellen gemeinsamen Clanstand ersetzen. Wirklich fortfahren?"))return;
 await ensureSaved();hydrating=true;
 try{storage.switchToCloud(p)}finally{hydrating=false}
 cloud.onLocalChange();
 await writeCloud();close();
}
function bind(id,event,handler){$(id).addEventListener(event,async(e)=>{try{e.preventDefault();await handler(e)}catch(err){error(err)}})}
bind("cloudOpen","click",open);bind("cloudClose","click",close);
bind("cloudLogin","click",()=>sign("login"));bind("cloudSignup","click",()=>sign("signup"));
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
bind("cloudCopyInvite","click",async()=>{if(inviteLink){await navigator.clipboard.writeText(inviteLink);msg("Einladungslink kopiert.")}});
bind("cloudFetchRoster","click",getRoster);bind("cloudApplyRoster","click",applyRoster);
bind("cloudMembersSyncBtn","click",getRoster);
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
  const installed=$("appVersion")?.textContent?.trim()||"v1.1.0-alpha.5";
  if(!remote||!/^v[0-9]+\.[0-9]+\.[0-9]+-alpha\.[0-9]+$/.test(remote)||
     remote===installed)return;
  pendingRelease=remote;appUpdatePending=true;
  if(!installPendingRelease())
    text("autoUpdateStatus","Update auf "+remote+" verfügbar · nach Bearbeitung automatisch laden");
 }catch(err){console.warn("Updateprüfung nicht erreichbar:",err)}
}
setInterval(()=>checkForAppUpdate().catch(console.warn),60000);
window.addEventListener("pageshow",()=>checkForAppUpdate().catch(console.warn));
document.addEventListener("visibilitychange",()=>{
 if(!document.hidden){
  checkForAppUpdate().catch(console.warn);
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
if(linkCode){$("cloudJoinCode").value=linkCode;open()}
const {data:{session},error:sessionErr}=await sb.auth.getSession();
if(sessionErr)error(sessionErr);
else if(session)try{await useSession(session)}catch(e){error(e)}
else{showSignedIn();cloud.afterRender()}
sb.auth.onAuthStateChange((event,session)=>{
 if(event==="SIGNED_OUT"&&user)queueMicrotask(()=>useSession(null).catch(error));
 if(event==="SIGNED_IN"&&session?.user?.id!==user?.id)queueMicrotask(()=>useSession(session).catch(error));
});
