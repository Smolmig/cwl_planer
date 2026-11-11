import { reconcileCwl, sanitizeSnapshot, tagOf, safeBadgeUrl, cwlAttackRows, reviewPreparationLineup, formatClashSwapText, compareConsecutiveCwlLineups, cwlAttackReminder, cwlMissedRotationReview, recordedCwlAttackResults } from "./cwl-live-core.mjs?v=1.16.68";
import { evaluateEightStarGoals, findReadOnlyMedalSwap } from "./cwl-medal-goals.mjs?v=1.16.68";
import { previewVerifiedCwlPause } from "./cwl-verified-pause.mjs?v=1.16.68";
import { assessCwlLifecycle, preservedCwlRound } from "./cwl-season-lifecycle.mjs?v=1.16.68";
import { renderInlineCwlPostseason } from "./cwl-season-view.mjs?v=1.16.68";

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const statusLabel={preparation:"Vorbereitung",inWar:"Krieg läuft",warEnded:"Beendet"};
// Keep user-facing errors actionable while logging the original API reason for diagnosis.
export function cwlErrorMessage(reason) {
  const messages={
    war_details_unavailable:"CWL-Kriegsdetails gerade nicht verfügbar. Dein Plan bleibt gespeichert.",
    upstream_timeout:"CWL-Abruf dauert gerade zu lange. Bitte später erneut versuchen.",
    missing_server_configuration:"Die CWL-Verbindung ist noch nicht vollständig eingerichtet.",
    missing_linked_clan_tag:"Für den CWL-Abruf fehlt der Clan-Tag.",
    not_a_member:"Du hast keinen Zugriff auf die CWL-Daten dieses Clans.",
    supercell_status_403:"Clash gibt die CWL-Daten derzeit nicht frei. Dein Plan bleibt gespeichert.",
    supercell_status_429:"Clash verarbeitet gerade zu viele Anfragen. Bitte später erneut versuchen.",
    supercell_status_500:"Die Clash-API meldet einen Serverfehler. Dein Plan bleibt erhalten.",
    supercell_status_520:"Die Verbindung zum Clash-API-Server ist gerade gestört. Dein Plan bleibt erhalten.",
    supercell_status_525:"Die sichere Verbindung zum Clash-API-Server schlägt derzeit fehl. Dein Plan bleibt erhalten."
  };
  return messages[reason]||"CWL-Daten gerade nicht verfügbar. Dein gespeicherter Plan bleibt erhalten.";
}
const badgeArt=side=>{
  const src=safeBadgeUrl(side?.badgeUrl);
  return src
    ?"<img class='cwl-live-badge' src='"+esc(src)+"' alt='Clanwappen "+esc(side?.name||"Clan")+"' loading='lazy' decoding='async' referrerpolicy='no-referrer'>"
    :"<span class='cwl-live-badge-placeholder' aria-hidden='true'>🛡️</span>";
};
const scoreText=value=>Number.isInteger(value)?String(value):"–";
const pctText=value=>typeof value==="number"?value.toLocaleString("de-AT",{maximumFractionDigits:2})+" %":"–";
const stateDate=s=>{
  const m=/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)(?:\.\d+)?Z$/.exec(String(s||""));
  if(!m)return "";
  const d=new Date(m[1]+"-"+m[2]+"-"+m[3]+"T"+m[4]+":"+m[5]+":"+m[6]+"Z");
  return Number.isFinite(d.getTime())?d.toLocaleString("de-AT",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"";
};
// A reminder receipt is local to this browser; it never changes a Clash attack.
function cwlReminderAckKey(ctx,season,note){
 if(!ctx?.clanId||!/^\d{4}-\d{2}$/.test(String(season||""))||
    !note?.warTag||!Number.isInteger(note.day)||!Array.isArray(note.players))return null;
 const tags=note.players.map(p=>tagOf(p.tag)).filter(Boolean).sort();
 if(!tags.length)return null;
 return "cwl_planer_reminder_v1:"+[String(ctx.clanId),season,String(note.day),
  note.warTag,tags.join(",")].map(encodeURIComponent).join(":");
}
function readCwlReminderAck(key,now=Date.now()){
 if(!key)return null;
 try{
  const time=Number(localStorage.getItem(key));
  return Number.isFinite(time)&&time>0&&time<=now&&now-time<=7*86400000?time:null;
 }catch{return null}
}
function writeCwlReminderAck(key,time=Date.now()){
 if(!key)return false;
 try{localStorage.setItem(key,String(time));return true}catch{return false}
}
function clearCwlReminderAck(key){
 if(!key)return;
 try{localStorage.removeItem(key)}catch{}
}
function townHallSummary(members) {
  const counts=new Map();
  for (const m of members||[]) {
    const level=m.townHallLevel;
    const key=level?"RH "+level:"RH ?";
    counts.set(key,(counts.get(key)||0)+1);
  }
  return [...counts].sort((a,b)=>(parseInt(b[0].slice(3))||0)-(parseInt(a[0].slice(3))||0))
    .map(([key,n])=>"<span class='cwl-live-th'>"+esc(key)+" <b>×"+n+"</b></span>").join("");
}
export function createCwlLive({sb,context,storage,notify,onStatus,onSnapshot,onInitialSettled,ensureCloudSaved,applyVerifiedPause}) {
  let activeClan=null,interval=null,current=null,requestId=0,fetching=false,offlineReason="",confirmedNoCwl=false,lastSuccessfulAt=0;
  let staleRoundDays=new Set(),lastSuccessfulProfile=null; // A saved fallback is never a fresh API observation.
  let lastKnownGroup=null; // Last validated group from THIS linked clan only.
  const FRESH_WINDOW_MS=10*60*1000; // A recent browser fetch; upstream may still cache preparation data.
  const expandedDays=new Set(),expandedOpponentDays=new Set(),expandedMissReviews=new Set();
  let ownerDecisions=[],decisionScope="",decisionBusy=false,decisionError="";
  let selectedMissReviewKey="";
  const decisionKey=(season,warKey,playerTag)=>
    [season,String(warKey||""),tagOf(playerTag)].join("|");
  // Only this clan's server-authorized audit rows are shown; cache never
  // authorizes writes and is reset across clan/profile/session changes.
  function decisionIndex(season,clan){
    const result=new Map();
    if(decisionScope!==clan+"|"+season)return result;
    for(const row of ownerDecisions){
      const key=decisionKey(row.season,row.war_key,row.player_tag);
      if(!result.has(key))result.set(key,row);
    }
    return result;
  }
  async function loadOwnerDecisions(expectedClan,season){
    if(typeof sb.from!=="function"||!expectedClan||!/^\d{4}-\d{2}$/.test(season))return;
    const scope=expectedClan+"|"+season;
    const {data,error}=await sb.from("cwl_missed_owner_decisions")
      .select("id,season,war_key,day,target_day,player_tag,decision,note,actor_id,created_at")
      .eq("clan_id",expectedClan).eq("season",season)
      .order("id",{ascending:false}).limit(350);
    if(context().clanId!==expectedClan||!context().active)return;
    if(error){decisionError="Entscheidungsverlauf derzeit nicht verfügbar";throw error}
    ownerDecisions=Array.isArray(data)?data:[];
    decisionScope=scope;decisionError="";
    render();
  }
  async function makeOwnerDecision(review,decision){
    const ctx=context(),source=effective();
    if(decisionBusy||ctx.role!=="owner"||!ctx.active||!ctx.clanId||!navigator.onLine||
       !source||source.season!==ctx.profile?.cwlLive?.season||
       !["excused","later","review_pause"].includes(decision))return;
    const fresh=activeClan===ctx.clanId&&lastSuccessfulProfile===ctx.profile&&
      current?.season===source.season&&lastSuccessfulAt>0&&
      Date.now()-lastSuccessfulAt<=FRESH_WINDOW_MS&&!offlineReason&&!fetching&&
      !staleRoundDays.has(review.day);
    if(!fresh){notify("Bitte zuerst die CWL-Daten aktualisieren.");return}
    const currentReview=cwlMissedRotationReview(source,ctx.profile,
      storage.getPlannedLineups?.()||[],{
        planningOk:storage.getPlanningState?.()?.ok===true,
        staleDays:[...staleRoundDays]
      }).find(row=>row.day===review.day&&row.warTag===review.warTag&&
        row.tag===review.tag);
    if(!currentReview){notify("Missed-Nachweis geändert. Bitte CWL-Daten neu laden.");return}
    const labels={excused:"Entschuldigung akzeptieren",later:"Später prüfen",
      review_pause:"Pause prüfen"};
    const details=decision==="review_pause"?
      "Nur die Empfehlung dokumentieren. Kein Spieler wird pausiert, keine Tagesregel verändert und kein Clash-Wechsel ausgeführt.":
      decision==="excused"?"Die Entschuldigung wird dokumentiert. Der belegte Missed-Angriff bleibt in der Statistik erhalten.":
      "Die Prüfung wird für später vorgemerkt. Bisherige Aufstellungen bleiben bestehen.";
    const response=await storage.askAction({
      title:labels[decision],message:"Tag "+review.day+" · "+review.name+" ("+review.tag+")\n"+
        details+"\n\nEntscheidung für alle berechtigten Clanmitglieder im Verlauf sichtbar.",
      inputLabel:"Begründung / Notiz (optional, max. 300 Zeichen)",
      inputValue:"",
      buttons:[{value:"confirm",text:"Verbindlich dokumentieren",primary:true},
        {value:"cancel",text:"Abbrechen"}]
    });
    if(response?.value!=="confirm")return;
    const note=String(response.input||"").trim();
    if(note.length>300){notify("Notiz darf höchstens 300 Zeichen enthalten.");return}
    decisionBusy=true;
    const ownerClan=ctx.clanId,ownerProfile=ctx.profile,season=source.season;
    try{
      await ensureCloudSaved?.();
      const latest=context(),now=Date.now();
      if(latest.role!=="owner"||!latest.active||latest.clanId!==ownerClan||
         latest.profile!==ownerProfile||current?.season!==season||
         lastSuccessfulProfile!==ownerProfile||
         now-lastSuccessfulAt>FRESH_WINDOW_MS||!navigator.onLine||
         staleRoundDays.has(review.day))
        throw Error("Clan, Rolle oder Datenstand verändert. Bitte erneut prüfen.");
      const round=effective()?.rounds?.find(x=>x.day===review.day);
      const confirmed=cwlAttackReminder(round,now);
      if(confirmed?.kind!=="confirmed"||confirmed.warTag!==review.warTag||
         !confirmed.players.some(p=>p.tag===review.tag))
        throw Error("Missed-Ereignis nicht mehr eindeutig bestätigt.");
      const {error}=await sb.from("cwl_missed_owner_decisions").insert({
        clan_id:ownerClan,season,war_key:"cwl:"+review.warTag,
        day:review.day,player_tag:review.tag,decision,note
      });
      if(error)throw error;
      await loadOwnerDecisions(ownerClan,season);
      notify("✓ Owner-Entscheidung für den Clan dokumentiert. Keine Planänderung.");
    }catch(err){
      console.warn("CWL decision rejected:",String(err?.message||err));
      notify("Entscheidung nicht gespeichert. Bitte Collector-Nachweis, Berechtigung und Cloud-Stand prüfen.");
    }finally{decisionBusy=false;render()}
  }

  // An owner may *apply* one conservatively reviewed preparation-day pause.
  // This mutates neither local members nor the solver. The Cloud bridge runs
  // a single verified transactional RPC with optimistic revision control.
  async function makeOwnerPause(review,targetDay){
    const start=context(),info=effective();
    const key=decisionKey(info?.season,"cwl:"+review.warTag,review.tag);
    const approval=decisionIndex(info?.season,start.clanId).get(key);
    const fresh=start.active&&start.role==="owner"&&start.clanId===activeClan&&
      lastSuccessfulProfile===start.profile&&lastSuccessfulAt>0&&
      Date.now()-lastSuccessfulAt<=FRESH_WINDOW_MS&&!fetching&&!offlineReason&&
      !staleRoundDays.has(review.day)&&!staleRoundDays.has(targetDay)&&
      current?.season===info?.season&&navigator.onLine;
    if(decisionBusy||!fresh||approval?.decision!=="review_pause"||
       typeof applyVerifiedPause!=="function"){
      notify("Pause nicht freigegeben oder Datenstand veraltet. Bitte CWL erneut prüfen.");
      return;
    }
    const planPreview=()=>{
      const ctx=context(),snap=effective();
      if(!snap||ctx.clanId!==start.clanId||ctx.role!=="owner")return {ok:false,reason:"Clan oder Rolle geändert."};
      const latest=cwlMissedRotationReview(snap,ctx.profile,
        storage.getPlannedLineups?.()||[],{
          planningOk:storage.getPlanningState?.()?.ok===true,
          staleDays:[...staleRoundDays]
        }).find(row=>row.tag===review.tag&&row.warTag===review.warTag&&row.day===review.day);
      return previewVerifiedCwlPause({
        profile:ctx.profile,snapshot:snap,review:latest,targetDay,
        dayPlans:storage.getPlannedLineups?.()||[],staleDays:[...staleRoundDays],
        planningFn:window.CWLPlanningCore?.planCwl,
        medalFn:evaluateEightStarGoals
      });
    };
    const preview=planPreview();
    if(!preview.ok){notify("Pausierung nicht möglich: "+preview.reason);return}
    const details=preview.changed.map(d=>
      "Tag "+d.day+": "+(d.out.length?"raus "+d.out.join(", "):"–")+
      (d.incoming.length?" · rein "+d.incoming.join(", "):"")
    ).join("\n");
    const changedTotals=preview.impact.countsChanged;
    const totalSummary=changedTotals.length?
      changedTotals.map(r=>r.name+": "+r.before+" → "+r.after).join("\n"):
      "Gesamte Einsatzzahlen bleiben gleich (nur Tagesverteilung ändert sich).";
    const spread=preview.impact.rotationSpread;
    const spreadSummary=spread.before===null?"":(
      "\nRotationsspanne: "+spread.before+" → "+spread.after+
      " Einsätze (nur teilnehmende Nicht-Fixspieler; keine Fairnessgarantie).");
    const answer=await storage.askAction({
      title:"Tagespause verbindlich übernehmen",
      message:"CWL Tag "+review.day+": bestätigter Miss von "+review.name+
        " ("+review.tag+").\n\n"+
        "Es wird NUR Tag "+targetDay+" im Plan auf RAUS gesetzt. Der Solver "+
        "berechnet die anderen noch offenen Aufstellungen neu:\n"+details+
        "\n\nEinsätze gesamt im Solver (vorher → nachher): "+totalSummary+spreadSummary+
        "\n\nFixe Clash-Aufstellungen bleiben unangetastet. "+
        "Die Umstellung der Vorbereitung MUSST du zusätzlich direkt in Clash durchführen."+
        (preview.medalUnknown?"\n8★-Daten teilweise unvollständig – keine Bonusgarantie.":"")+
        "\nEs entsteht ein gemeinsamer, unveränderlicher Audit-Eintrag.",
      inputLabel:"Begründung (optional, max. 300 Zeichen)",
      inputValue:"",
      buttons:[{value:"confirm",text:"Tag "+targetDay+" verbindlich auf RAUS",primary:true},
        {value:"cancel",text:"Abbrechen"}]
    });
    if(answer?.value!=="confirm")return;
    const note=String(answer.input||"").trim();
    if(note.length>300){notify("Notiz darf höchstens 300 Zeichen enthalten.");return}
    decisionBusy=true;
    try{
      const last=context();
      if(last.role!=="owner"||!last.active||last.clanId!==start.clanId||
         last.profile!==start.profile||activeClan!==start.clanId||
         Date.now()-lastSuccessfulAt>FRESH_WINDOW_MS||fetching||offlineReason)
        throw Error("Cloud-/Clash-Daten haben sich geändert.");
      const latest=planPreview();
      if(!latest.ok||JSON.stringify(latest.changed)!==JSON.stringify(preview.changed)||
         JSON.stringify(latest.draft.members)!==JSON.stringify(preview.draft.members))
        throw Error("Die Planung hat sich seit der Vorschau geändert.");
      const result=await applyVerifiedPause({preview:latest,note});
      if(result?.switched)return;
      if(!result?.saved)throw Error("Übernahme nicht bestätigt.");
      notify("✓ Tag "+targetDay+" im gemeinsamen Plan auf RAUS gesetzt. Bitte Clash-Aufstellung ebenfalls ändern.");
      await refreshNow(true);
    }catch(e){
      console.warn("CWL pause not applied:",String(e?.message||e));
      notify("Pause nicht bestätigt: "+String(e?.message||e).slice(0,160)+
        " Bitte den gemeinsamen Plan überprüfen.");
    }finally{decisionBusy=false;render()}
  }

  const getLifecycle=()=>{
    const ctx=context();
    if(!ctx.active||!ctx.clanId||!ctx.hasClanTag)
      return {mode:"idle",snapshot:null,verifiedSeven:false};
    return assessCwlLifecycle({
      profile:ctx.profile,
      liveSnapshot:current?.active&&activeClan===ctx.clanId?current:null,
      groupState:current?.groupState||"",
      confirmedNoCwl:confirmedNoCwl&&activeClan===ctx.clanId,
      clanTag:ctx.clanTag,now:Date.now()
    });
  };
  // Keep the chosen CWL tab stable across live refreshes and re-renders.
  // A new clan/season resets the disclosure only once, not every API poll.
  const postseasonTabByScope=new Map();
  function renderPostseason(){
    const view=document.getElementById("view-plan"),
      host=document.getElementById("planCwlPostseason"),
      body=document.getElementById("planCwlPostseasonContent"),
      summary=document.getElementById("planCwlPostseasonSummary");
    if(!view||!host||!body||!summary)return false;
    const ctx=context(),model=getLifecycle();
    const transition=ctx.active&&model.mode==="transition";
    const postseason=ctx.active&&(model.mode==="postseason"||transition);
    const between=ctx.active&&model.mode==="idle"&&confirmedNoCwl;
    view.classList.toggle("plan-postseason-mode",!!postseason);
    view.classList.toggle("plan-between-cwl-mode",!!between);
    host.hidden=!postseason&&!between;
    if(!postseason&&!between){
      host.dataset.renderKey="";host.dataset.scope="";host.dataset.warMode="";
      host.open=true;body.replaceChildren();return false;
    }
    if(between){
      const scope=ctx.clanId+"|between";
      if(host.dataset.scope!==scope){
        host.dataset.scope=scope;host.open=true;host.dataset.renderKey="";
      }
      summary.textContent="CWL-Pause";
      if(host.dataset.renderKey!==scope){
        body.innerHTML='<div class="plan-postseason-results">'+
          '<h3>Gerade keine CWL</h3>'+
          '<p class="plan-postseason-hint">Der nächste CWL-Plan startet automatisch, sobald Clash die neue Liga meldet. Ein laufender Clankrieg wird hier separat angezeigt.</p></div>';
        host.dataset.renderKey=scope;
      }
      return true;
    }
    const season=model.season||model.oldSeason||model.snapshot?.season;
    const scope=ctx.clanId+"|"+season;
    const group=lastKnownGroup?.season===season&&
      lastKnownGroup.clanTag===model.snapshot?.clanTag?lastKnownGroup:null;
    const battleState=current?.currentWar?.state||"";
    const battleOngoing=battleState==="inWar"||battleState==="warEnded";
    const warMode=battleOngoing?"battle":"preparation";
    if(host.dataset.scope!==scope){
      host.dataset.scope=scope;
      host.open=!battleOngoing;
      host.dataset.warMode=warMode;
      host.dataset.renderKey="";
    }else if(host.dataset.warMode!==warMode){
      // Collapse only on the transition into battle day. A user opening it
      // during battle keeps it open through all ordinary auto-refreshes.
      host.open=!battleOngoing;
      host.dataset.warMode=warMode;
    }
    const dateMatch=/^(20\d\d)-(0[1-9]|1[0-2])$/.exec(season||"");
    const date=dateMatch?new Date(Date.UTC(+dateMatch[1],+dateMatch[2]-1,1)):null;
    const label=date?date.toLocaleDateString("de-AT",{
      month:"long",year:"numeric",timeZone:"UTC"}):"Letzte Liga";
    summary.textContent="Letzte CWL · "+label;
    const tab=postseasonTabByScope.get(scope)||"rounds";
    const key=ctx.clanId+"|"+JSON.stringify({
      mode:model.mode,season,verifiedSeven:model.verifiedSeven,
      savedDays:model.savedDays,rounds:model.snapshot?.rounds,
      group:group||null,tab
    });
    if(host.dataset.renderKey!==key){
      const priorFocus=body.contains(document.activeElement)?
        document.activeElement.closest("[data-postseason-tab]")?.dataset.postseasonTab:null;
      body.innerHTML=(transition?
        '<p class="plan-postseason-hint">Eine neue CWL wurde erkannt. Der vorherige Saisonstand bleibt erhalten, bis der neue Plan sicher übernommen ist.</p>':'')+
        renderInlineCwlPostseason(ctx.profile,model.snapshot,group,{
         ...model,mode:"postseason",season,savedDays:model.savedDays??0
        },tab);
      if(priorFocus)body.querySelector('[data-postseason-tab="'+priorFocus+'"]')
        ?.focus({preventScroll:true});
      host.dataset.renderKey=key;
    }
    return true;
  }
  // One delegated handler; no duplicated handlers or lost selected tabs.
  const postHost=document.getElementById("planCwlPostseason");
  postHost?.addEventListener("click",event=>{
    const button=event.target.closest?.("[data-postseason-tab]");
    if(!button||!postHost.contains(button))return;
    const scope=postHost.dataset.scope;
    const tab=button.dataset.postseasonTab;
    if(!scope||!["rounds","group","players"].includes(tab))return;
    postseasonTabByScope.set(scope,tab);
    postHost.dataset.renderKey="";
    renderPostseason();
    postHost.querySelector('[data-postseason-tab="'+tab+'"]')
      ?.focus({preventScroll:true});
  });
  postHost?.addEventListener("keydown",event=>{
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
    const target=event.target.closest?.("[data-postseason-tab]");
    if(!target)return;
    const order=["rounds","group","players"];
    let index=order.indexOf(target.dataset.postseasonTab);
    if(index<0)return;
    index=event.key==="Home"?0:event.key==="End"?2:
      (index+(event.key==="ArrowRight"?1:2))%3;
    const next=postHost.querySelector('[data-postseason-tab="'+order[index]+'"]');
    if(next){event.preventDefault();next.click();next.focus({preventScroll:true})}
  });

  const effective=()=>{
    const ctx=context();
    if (!ctx.active || !ctx.clanId || !ctx.hasClanTag)return null;
    if (current && activeClan===ctx.clanId && current.active && ctx.profile?.cwlLiveIgnoredSeason!==current.season)return sanitizeSnapshot(current);
    if (confirmedNoCwl)return null;
    const prior=ctx.profile?.cwlLive;
    if (!prior?.season||ctx.profile?.cwlLiveIgnoredSeason===prior.season)return null;
    const month=Number(prior.season.slice(0,4))*12+Number(prior.season.slice(5,7));
    const now=new Date(),diff=now.getFullYear()*12+now.getMonth()+1-month;
    return diff>=0&&diff<=1?prior:null;
  };
  // The live Clash roster occupies the original grid. Swaps never modify
  // the solver plan; the optional candidate view is a floating popover and
  // never pushes the next row of player cards down.
  const openedOutgoing=new Set();
  let activeSwap=null;
  function closeSwapPopover({preserve=false}={}){
    if(!activeSwap)return;
    const {key,anchor,popup,doc,win,onOutside,onEscape,onScroll,onResize}=activeSwap;
    if(preserve)openedOutgoing.add(key);else openedOutgoing.delete(key);
    anchor.setAttribute("aria-expanded","false");
    anchor.removeAttribute("aria-controls");
    doc.removeEventListener("pointerdown",onOutside,true);
    doc.removeEventListener("keydown",onEscape,true);
    win?.removeEventListener("scroll",onScroll,true);
    win?.removeEventListener("resize",onResize);
    popup.remove();
    activeSwap=null;
  }
  function positionSwapPopover(anchor,popup){
    const doc=anchor.ownerDocument,win=doc.defaultView;
    if(!win||!anchor.isConnected){closeSwapPopover();return}
    const rect=anchor.getBoundingClientRect();
    const width=Math.min(Math.max(164,rect.width),win.innerWidth-16);
    const left=Math.max(8,Math.min(rect.left,win.innerWidth-width-8));
    popup.style.width=width+"px";
    popup.style.left=left+"px";
    const safeBottom=win.innerHeight-90; // keep the mobile bottom navigation free
    const topbarBottom=doc.querySelector(".topbar")?.getBoundingClientRect().bottom||0;
    const safeTop=Math.max(8,topbarBottom+6);
    const below=Math.max(0,safeBottom-rect.bottom-8);
    const above=Math.max(0,rect.top-safeTop-8);
    const preferredHeight=Math.min(360,popup.scrollHeight||300);
    const openAbove=below<Math.min(preferredHeight,165)&&above>below;
    const available=openAbove?above:below;
    const maximum=Math.max(80,Math.min(360,available));
    popup.style.maxHeight=maximum+"px";
    const height=Math.min(popup.scrollHeight,maximum);
    const desired=openAbove?rect.top-height-8:rect.bottom+8;
    popup.style.top=Math.max(safeTop,Math.min(desired,Math.max(safeTop,safeBottom-height)))+"px";
  }
  function showSwapPopover(anchor,dayCard,review,profile){
    const tag=tagOf(anchor.dataset.playerTag),key=dayCard.id+"|"+tag;
    if(activeSwap?.key===key){closeSwapPopover();return}
    closeSwapPopover();
    const doc=anchor.ownerDocument,win=doc.defaultView;
    const popup=doc.createElement("div");
    popup.className="cwl-swap-popover";
    popup.id="cwl-swap-"+dayCard.id+"-"+tag.replace(/[^a-zA-Z0-9]/g,"");
    popup.setAttribute("role","dialog");
    popup.setAttribute("aria-label","Geplante Einwechselspieler");
    const header=doc.createElement("div");
    header.className="cwl-swap-popover-header";
    const heading=doc.createElement("strong");
    heading.textContent="In Clash aufnehmen";
    const close=doc.createElement("button");
    close.type="button";close.className="cwl-swap-popover-close";
    close.textContent="×";close.setAttribute("aria-label","Wechselanzeige schließen");
    close.onclick=()=>closeSwapPopover();
    header.append(heading,close);popup.append(header);
    const cards=doc.createElement("div");
    cards.className="cwl-swap-popover-cards";
    const known=[...(profile?.members||[]),...(profile?.archivedMembers||[])];
    for(const candidate of review.toAdd||[]){
      const tag=tagOf(candidate.tag);
      const knownMember=known.find(m=>tagOf(m.playerTag)===tag);
      const member=knownMember||{name:candidate.name||tag,playerTag:tag,townHall:candidate.townHallLevel};
      const card=storage.createPlanPlayerChip?.(member)||doc.createElement("div");
      if(!card.classList.contains("player-chip")){
        card.className="player-chip";
        card.textContent=member.name||tag;
        const rh=doc.createElement("span");rh.className="player-meta";rh.textContent="RH "+(member.townHall||"?");
        card.append(rh);
      }
      card.classList.add("cwl-plan-incoming");
      const status=doc.createElement("span");
      status.className="cwl-plan-state";status.textContent="↑ In Clash aufnehmen";
      card.append(status);cards.append(card);
    }
    popup.append(cards);
    const hint=doc.createElement("p");
    hint.className="cwl-swap-popover-note";
    hint.textContent=(review.toAdd||[]).length===1?
      "Geplanter Ersatz laut Aufstellung. Wechsel direkt in Clash durchführen.":
      "Geplante Einwechselspieler. Keine fest zugewiesenen 1:1-Tauschpaare.";
    popup.append(hint);
    doc.body.append(popup);
    const onOutside=e=>{if(!popup.contains(e.target)&&!anchor.contains(e.target))closeSwapPopover()};
    const onEscape=e=>{if(e.key==="Escape"){e.preventDefault();closeSwapPopover();anchor.focus()}};
    const onScroll=e=>{if(!popup.contains(e.target))positionSwapPopover(anchor,popup)};
    const onResize=()=>positionSwapPopover(anchor,popup);
    activeSwap={key,anchor,popup,doc,win,onOutside,onEscape,onScroll,onResize};
    openedOutgoing.add(key);
    anchor.setAttribute("aria-expanded","true");
    anchor.setAttribute("aria-controls",popup.id);
    positionSwapPopover(anchor,popup);
    doc.addEventListener("pointerdown",onOutside,true);
    doc.addEventListener("keydown",onEscape,true);
    win?.addEventListener("scroll",onScroll,true);
    win?.addEventListener("resize",onResize);
  }
  function annotatePlannedLineup(dayCard,review,verified,round,profile){
    const lineup=dayCard.querySelector(".lineup");
    if(!lineup)return;
    lineup.querySelectorAll(".cwl-plan-state,.cwl-plan-actual-exit").forEach(el=>el.remove());
    const chips=[...lineup.querySelectorAll(".player-chip[data-player-tag]")];
    chips.forEach((chip,i)=>{
      if(!chip.dataset.planOrder)chip.dataset.planOrder=String(i+1);
      chip.classList.remove("cwl-plan-chip-enter","cwl-plan-chip-present","cwl-plan-candidate-hidden");
    });
    chips.sort((a,b)=>Number(a.dataset.planOrder)-Number(b.dataset.planOrder))
      .forEach(chip=>lineup.append(chip));
    if(!verified||!["match","changes"].includes(review?.status))return;
    const incoming=new Set((review.toAdd||[]).map(m=>tagOf(m.tag)));
    const outgoing=new Set((review.toRemove||[]).map(m=>tagOf(m.tag)));
    const planned=new Map(chips.map(chip=>[tagOf(chip.dataset.playerTag),chip]));
    const known=[...(profile?.members||[]),...(profile?.archivedMembers||[])];
    const exits=[];
    for(const member of round?.clan?.members||[]){
      const tag=tagOf(member.tag);
      let chip=planned.get(tag);
      if(chip&&!incoming.has(tag)){
        chip.classList.add("cwl-plan-chip-present");
        const status=document.createElement("span");
        status.className="cwl-plan-state";
        status.textContent="✓ Bereits in Clash";
        chip.append(status);
      }else if(outgoing.has(tag)){
        const knownMember=known.find(m=>tagOf(m.playerTag)===tag)||
          {name:member.name||tag,playerTag:tag,townHall:member.townHallLevel};
        const base=storage.createPlanPlayerChip?.(knownMember);
        chip=document.createElement("button");
        chip.type="button";
        chip.className=(base?.className||"player-chip")+" cwl-plan-actual-exit";
        chip.dataset.playerTag=tag;
        if(base)chip.innerHTML=base.innerHTML;
        else{
          const name=document.createElement("b");name.textContent=member.name||tag;
          const rh=document.createElement("span");rh.className="player-meta";
          rh.textContent="RH "+(member.townHallLevel??"?");
          chip.append(name,rh);
        }
        chip.setAttribute("aria-expanded","false");
        chip.setAttribute("aria-label",(member.name||tag)+" aus Clash nehmen. Einwechselspieler anzeigen");
        const state=document.createElement("span");state.className="cwl-plan-state";
        state.textContent="↓ Aus Clash nehmen · Wechsel anzeigen";
        chip.append(state);
        chip.onclick=()=>showSwapPopover(chip,dayCard,review,profile);
        exits.push(chip);
      }
      if(chip)lineup.append(chip);
    }
    for(const chip of chips)
      if(incoming.has(tagOf(chip.dataset.playerTag)))
        chip.classList.add("cwl-plan-candidate-hidden");
    for(const chip of exits){
      const key=dayCard.id+"|"+tagOf(chip.dataset.playerTag);
      if(openedOutgoing.has(key)){showSwapPopover(chip,dayCard,review,profile);break}
    }
  }
  function renderDay(round,dayCard,profile,{fresh=false,checkedAt=0,previousRound=null,previousFresh=false}={}) {
    const wasOpen=expandedDays.has(round?.day)||!!dayCard.querySelector(".cwl-live-details[open]");
    const wasOpponentOpen=expandedOpponentDays.has(round?.day)||!!dayCard.querySelector(".cwl-opponent-details[open]");
    dayCard.querySelector(".cwl-live-day")?.remove();
    annotatePlannedLineup(dayCard,null,false);
    const section=document.createElement("section");
    section.className="cwl-live-day";
    if(!round?.available){
      section.innerHTML="<span class='cwl-live-label'>⚔️ CWL-Gegner</span> <span class='statusline'>Noch nicht von Clash freigegeben</span>";
      dayCard.querySelector(".day-head")?.after(section);
      return;
    }
    const own=round.clan?.members||[],enemy=round.opponent?.members||[];
    const attacks=own.reduce((sum,m)=>sum+(m.attacks?.length||0),0);
    const enemyAttacks=enemy.reduce((sum,m)=>sum+(m.attacks?.length||0),0);
    const missing=own.filter(m=>!m.attacks?.length).length;
    const enemyMissing=enemy.filter(m=>!m.attacks?.length).length;
    const attackRows=cwlAttackRows(round);
    const opponentAttackRows=cwlAttackRows(round,"opponent");
    const rosterLine=m=>"<li class='cwl-roster-member'><span class='cwl-live-rh'>RH"+
      esc(m.townHallLevel??"?")+"</span><span class='cwl-roster-name'>"+esc(m.name||"Unbekannt")+
      "</span><span class='cwl-roster-tag'>"+esc(tagOf(m.tag))+"</span></li>";
    const rosterReady=list=>Array.isArray(list)&&Number.isInteger(round.teamSize)&&round.teamSize>0&&
      list.length===round.teamSize&&list.every(m=>/^#[0289PYLQGRJCUV]{3,15}$/.test(tagOf(m?.tag)))&&
      new Set(list.map(m=>tagOf(m.tag))).size===round.teamSize;
    const opponentRoster=rosterReady(enemy)
      ?"<ol class='cwl-roster-list'>"+enemy.map(rosterLine).join("")+"</ol>"
      :"<p class='cwl-live-attack-empty'>Gegnerische Aufstellung noch nicht vollständig verfügbar.</p>";
    const planning=storage.getPlanningState?.();
    const dayPlan=storage.getPlannedLineups?.().find(dp=>dp.day===round.day);
    const review=reviewPreparationLineup(profile,dayPlan,round,{planningOk:planning?.ok!==false});
    const reviewFresh=fresh&&round.state==="preparation";
    const usableReview=reviewFresh&&["match","changes"].includes(review?.status);
    const completedSwaps=reviewFresh&&review?.status==="match"&&previousFresh
      ?compareConsecutiveCwlLineups(previousRound,round):null;
    annotatePlannedLineup(dayCard,review,usableReview,round,profile);
    const reviewHtml=!review?"":!reviewFresh
      ?"<div class='cwl-prep-review'><span class='statusline'>Clash-Abgleich derzeit nicht aktuell. "+
        "Die geplante Aufstellung bleibt sichtbar; bitte vor einem Wechsel CWL-Daten aktualisieren.</span></div>"
      :review.status==="unavailable"
      ?"<div class='cwl-prep-review'><span class='statusline'>"+esc(review.reason)+"</span></div>"
      :"<div class='cwl-prep-review'><div class='cwl-prep-heading'><b>"+
        (review.status==="match"?"✓ Aufstellung stimmt mit Clash überein":
         "Wechsel nötig · "+review.toRemove.length+" raus, "+review.toAdd.length+" rein")+
        "</b></div>"+
        (review.status==="changes"?"<div class='cwl-prep-swap-lines'>"+
          "<span class='cwl-prep-out'>↓ Raus: "+esc(review.toRemove.map(m=>m.name||tagOf(m.tag)).join(", "))+"</span>"+
          "<span class='cwl-prep-in'>↑ Rein: "+esc(review.toAdd.map(m=>m.name||tagOf(m.tag)).join(", "))+"</span>"+
          "</div>":"")+
        "<div class='statusline cwl-prep-meta'>Details in „Aufstellung“ · Stand "+
        esc(new Date(checkedAt).toLocaleTimeString("de-AT",{hour:"2-digit",minute:"2-digit"}))+
        "</div>"+
        (review.status==="match"&&completedSwaps?.status==="changes"?
         "<div class='statusline cwl-prep-completed'>Seit Tag "+(round.day-1)+": "+
         completedSwaps.toRemove.length+" raus · "+completedSwaps.toAdd.length+
         " rein (bereits in Clash)</div>":"")+
        (review.status==="changes"||completedSwaps?.status==="changes"?
         "<div class='cwl-prep-actions'><button type='button' class='btn small cwl-copy-live-swaps'>"+
         (review.status==="changes"?"Aufstellungswechsel kopieren":"Wechseltext kopieren")+
         "</button></div>":"")+
        "</div>";
    // Preparation has a separate optional Clash peek, but the planned chips
    // above are the primary place for additions and removals. Keep this quiet:
    // medal progress and season assessment live in 'Einsätze', not every card.
    const actualReady=rosterReady(own);
    const renderAttackRow=({player,attack,target})=>{
      const didAttack=!!attack;
      const stars=didAttack?attack.stars:null;
      const starIcons=didAttack?"★".repeat(stars)+"☆".repeat(3-stars):"☆☆☆";
      const targetName=target?.name||"Ziel unbekannt",targetLevel=target?.townHallLevel??null;
      return "<div class='cwl-live-attack"+(didAttack?"":" pending")+"'>"+
        "<div class='cwl-live-attack-result'>"+
        "<span class='cwl-live-stars"+(didAttack?"":" no-attack")+"' aria-label='"+
        (didAttack?stars+" von 3 Sternen":"Noch nicht angegriffen")+"'>"+starIcons+"</span>"+
        "<span class='cwl-live-percent"+(didAttack?"":" no-attack")+"'>"+
        (didAttack?pctText(attack.destructionPercentage):"–")+"</span></div>"+
        "<div class='cwl-live-fight'><div class='cwl-live-player'>"+
        "<span class='cwl-live-rh'>RH"+esc(player.townHallLevel??"?")+"</span>"+
        "<b>"+esc(player.name)+"</b></div>"+
        (didAttack?"<div class='cwl-live-target'><span class='cwl-live-vs'>vs</span>"+
          "<span class='cwl-live-rh'>RH"+esc(targetLevel??"?")+"</span>"+
          "<span>"+esc(targetName)+"</span></div>"
          :"<div class='cwl-live-attack-pending'>"+(round.state==="warEnded"?
            "Kein Angriff erfasst":"Angriff offen")+"</div>")+
        "</div></div>";
    };
    const players=round.state==="preparation"
      ?(actualReady?"<ol class='cwl-roster-list'>"+own.map(rosterLine).join("")+"</ol>":
        "<p class='cwl-live-attack-empty'>Eigene Aufstellung noch nicht vollständig verfügbar.</p>")
      :(attackRows.length?attackRows.map(renderAttackRow).join(""):
        "<p class='cwl-live-attack-empty'>Noch keine eigenen Spieler-/Angriffsdaten verfügbar.</p>");
    const opponentPlayers=round.state==="preparation"
      ?opponentRoster
      :(opponentAttackRows.length?opponentAttackRows.map(renderAttackRow).join(""):
        "<p class='cwl-live-attack-empty'>Noch keine gegnerischen Spieler-/Angriffsdaten verfügbar.</p>");
    const plannedSlots=round.teamSize||Math.max(own.length,enemy.length);
    const sideSummary=(side,list,count,unplayed)=>{
      if(round.state==="preparation")
        return rosterReady(list)?list.length+" Spieler · vorläufig":"Aufstellung unvollständig";
      return count+"/"+plannedSlots+" Angriffe · "+scoreText(side?.stars)+" ★"+
        (!rosterReady(list)?" · Teilstand":"");
    };
    const ownScore=scoreText(round.clan?.stars),enemyScore=scoreText(round.opponent?.stars);
    const destruct=round.clan?.destructionPercentage!==null&&round.clan?.destructionPercentage!==undefined&&
      round.opponent?.destructionPercentage!==null&&round.opponent?.destructionPercentage!==undefined
      ?"<div class='cwl-live-score-detail'>Zerstörung: "+pctText(round.clan.destructionPercentage)+
        " : "+pctText(round.opponent.destructionPercentage)+"</div>":"";
    const sideHtml=(side,label)=>"<div class='cwl-live-side'>"+badgeArt(side)+
      "<span class='cwl-live-side-label'>"+label+"</span>"+
      "<b class='cwl-live-clan-name'>"+esc(side?.name||"Unbekannt")+"</b></div>";
    section.innerHTML="<div class='cwl-live-header'><span class='cwl-live-label'>⚔️ CWL · Tag "+round.day+
      "</span><span class='badge "+(round.state==="warEnded"?"ok":"warn")+"'>"+
      esc(statusLabel[round.state]||round.state)+"</span></div>"+
      "<div class='cwl-live-scoreboard' role='group' aria-label='Kriegssterne "+esc(round.clan?.name||"Clan")+" "+
      ownScore+" zu "+enemyScore+" "+esc(round.opponent?.name||"Gegner")+"'>"+
      sideHtml(round.clan,"Wir")+
      "<div class='cwl-live-score-middle'><div class='cwl-live-score' aria-hidden='true'>"+
      "<span>"+ownScore+"</span><span class='cwl-live-score-colon'>:</span><span>"+enemyScore+"</span></div>"+
      "<div class='cwl-live-score-caption'>★ Kriegssterne</div></div>"+
      sideHtml(round.opponent,"Gegner")+"</div>"+
      destruct+"<div class='cwl-live-ths' aria-label='Rathausverteilung der gegnerischen Aufstellung'><strong>Gegner-Aufstellung</strong> "+townHallSummary(enemy)+"</div>"+
      reviewHtml+
      "<div class='statusline'>"+(round.startTime?"Start "+esc(stateDate(round.startTime))+" · ":"")+
      (round.state==="preparation"?(fresh?
        "Aufstellung vorläufig · Wechsel in Clash bis Kriegsbeginn möglich":
        "Clash-Aufstellung gespeichert · vor Wechseln bitte aktualisieren"):
        "Aufstellung fix · Angriffsstand "+(fresh?"aus Clash":"gespeichert")+
        (round.state==="warEnded"?" · Krieg beendet":""))+"</div>"+
      "<div class='cwl-live-team-grid' role='group' aria-label='Eigene und gegnerische CWL-Aufstellungen'>"+
      "<details class='cwl-live-team-details cwl-live-details cwl-live-team-own'"+(wasOpen?" open":"")+"><summary>"+
      "<span class='cwl-team-summary-title'>Unser Team</span>"+
      "<span class='cwl-live-attack-count'>"+esc(sideSummary(round.clan,own,attacks,missing))+"</span></summary>"+
      players+"</details>"+
      "<details class='cwl-live-team-details cwl-opponent-details cwl-live-team-enemy'"+(wasOpponentOpen?" open":"")+"><summary>"+
      "<span class='cwl-team-summary-title'>Gegnerteam</span>"+
      "<span class='cwl-live-attack-count'>"+esc(sideSummary(round.opponent,enemy,enemyAttacks,enemyMissing))+"</span></summary>"+
      opponentPlayers+"</details></div>";
    section.querySelector(".cwl-copy-live-swaps")?.addEventListener("click",()=>{
      const ctx=context(),now=Date.now(),activeSnapshot=current?.active&&activeClan===ctx.clanId&&
        current.season===ctx.profile?.cwlLive?.season&&lastSuccessfulProfile===ctx.profile&&
        now-lastSuccessfulAt<=FRESH_WINDOW_MS&&!offlineReason&&!staleRoundDays.has(round.day);
      if(!activeSnapshot){notify("Bitte zuerst CWL-Daten aktualisieren – keine Wechsel aus einem gespeicherten Stand übernehmen.");return;}
      const currentRound=current.rounds?.find(r=>r.day===round.day);
      const dp=storage.getPlannedLineups?.().find(p=>p.day===round.day);
      const latest=reviewPreparationLineup(ctx.profile,dp,currentRound,{planningOk:storage.getPlanningState?.()?.ok!==false});
      if(!latest||latest.status==="unavailable"){notify("Abgleich derzeit nicht eindeutig. Bitte CWL-Daten aktualisieren.");return;}
      let changes=latest;
      if(latest.status==="match"){
        const prior=current.rounds?.find(r=>r.day===round.day-1);
        if(staleRoundDays.has(round.day-1)||!prior){
          notify("Die vorherige Clash-Aufstellung ist nicht aktuell genug für den Wechseltext.");
          return;
        }
        changes=compareConsecutiveCwlLineups(prior,currentRound);
      }
      const message=changes?.status==="changes"?formatClashSwapText(round.day,changes):null;
      if(!message){notify("Die durchgeführten Wechsel sind nicht eindeutig nachvollziehbar.");return;}
      storage.copyText?.(message,"Clash-Wechseltext kopiert");
    });
    section.querySelector(".cwl-live-details")?.addEventListener("toggle",event=>{
      if(event.target.open)expandedDays.add(round.day);
      else expandedDays.delete(round.day);
    });
    section.querySelector(".cwl-opponent-details")?.addEventListener("toggle",event=>{
      if(event.target.open)expandedOpponentDays.add(round.day);
      else expandedOpponentDays.delete(round.day);
    });
    section.querySelectorAll("img.cwl-live-badge").forEach(img=>{
      img.addEventListener("error",()=>{
        const fallback=document.createElement("span");
        fallback.className="cwl-live-badge-placeholder";
        fallback.setAttribute("aria-hidden","true");fallback.textContent="🛡️";
        img.replaceWith(fallback);
      },{once:true});
    });
    dayCard.querySelector(".day-head")?.after(section);
  }
  function render() {
    // Re-rendering after an API refresh must not discard a user's open swap.
    closeSwapPopover({preserve:true});
    const ctx=context(),view=document.getElementById("view-plan");
    const postMode=renderPostseason();
    const old=document.getElementById("cwlLiveOverview");
    const button=document.getElementById("cwlLiveRefresh");
    if(!ctx.active || !ctx.clanId || !ctx.hasClanTag || !view){
      old?.remove();button?.remove();
      document.querySelectorAll(".cwl-live-day").forEach(n=>n.remove());
      document.querySelectorAll(".day-card .lineup").forEach(lineup=>{
        lineup.querySelectorAll(".cwl-plan-state,.cwl-plan-outgoing").forEach(node=>node.remove());
        lineup.querySelectorAll(".player-chip").forEach(node=>node.classList.remove(
          "cwl-plan-chip-enter","cwl-plan-chip-present"));
      });return;
    }
    let refresh=button;
    if (!refresh) {
      refresh=document.createElement("button");
      refresh.type="button";refresh.id="cwlLiveRefresh";refresh.className="btn small";
      refresh.onclick=()=>refreshNow(true);
      view.querySelector(".plan-actions")?.append(refresh);
    }
    refresh.textContent=fetching?"CWL wird geladen …":"↻ CWL-Daten";
    refresh.disabled=fetching;
    const info=effective();
    const detailsWarning=current?.detailsStatus==="unavailable"
      ?" · ⚠ Kriegsdetails derzeit nicht abrufbar"
      :current?.detailsStatus==="partial"
        ?" · ⚠ Einige Kriegsdetails fehlen noch":"";
    let node=old;
    if(!node){
      node=document.createElement("section");node.id="cwlLiveOverview";node.className="cwl-live-overview";
      view.querySelector(".plan-overview")?.append(node);
    }
    if(postMode){
      node.hidden=true;node.textContent="";
      document.querySelectorAll(".cwl-live-day").forEach(n=>n.remove());
      return;
    }
    if(!info){
      node.hidden=!offlineReason;
      node.textContent=offlineReason||"";
      document.querySelectorAll(".cwl-live-day").forEach(n=>n.remove());
      document.querySelectorAll(".day-card .lineup").forEach(lineup=>{
        lineup.querySelectorAll(".cwl-plan-state,.cwl-plan-outgoing").forEach(node=>node.remove());
        lineup.querySelectorAll(".player-chip").forEach(node=>node.classList.remove(
          "cwl-plan-chip-enter","cwl-plan-chip-present"));
      });
      return;
    }
    node.hidden=false;
    const fresh=!!(current?.active&&activeClan===ctx.clanId&&
      current.season===info.season&&lastSuccessfulProfile===ctx.profile&&lastSuccessfulAt>0&&
      Date.now()-lastSuccessfulAt<=FRESH_WINDOW_MS&&!offlineReason);
    const ended=info.rounds.filter(r=>r.state==="warEnded").length;
    // Alert only from a fresh API snapshot, not an older cached league.
    // No auto-pause, no schedule mutation, no pretended push notifications.
    const verifiedNotices=fresh?info.rounds
      .filter(r=>!staleRoundDays.has(r.day))
      .map(r=>cwlAttackReminder(r))
      .filter(a=>a&&(a.kind==="open"||a.kind==="confirmed")):[];
    // A newer miss or a live last-hour warning must NOT hide older confirmed
    // incidents. Keep one compact day-selected review, rather than card stacks.
    const attention=[...verifiedNotices].sort((a,b)=>
      Number(b.kind==="open")-Number(a.kind==="open")||b.day-a.day)[0]||null;
    const confirmedMisses=verifiedNotices
      .filter(a=>a.kind==="confirmed"&&a.day<ctx.profile.config.days)
      .sort((a,b)=>b.day-a.day);
    const selectedConfirmed=confirmedMisses.find(a=>
      selectedMissReviewKey===info.season+"|"+a.day)||confirmedMisses[0]||null;
    // A stale source never establishes a forgotten attack.
    const staleAttention=!attention?info.rounds
      .map(r=>cwlAttackReminder(r)).filter(Boolean)
      .find(a=>a.kind==="open"&&(!fresh||staleRoundDays.has(a.day))):null;
    const attentionKey=attention?.kind==="open"?cwlReminderAckKey(ctx,info.season,attention):null;
    const acknowledgedAt=readCwlReminderAck(attentionKey);
    // A confirmed miss starts a review, NEVER a change to the plan.
    const reviewKey=selectedConfirmed?
      [ctx.clanId,info.season,selectedConfirmed.warTag,selectedConfirmed.day].join("|"):null;
    const reviewRows=reviewKey?cwlMissedRotationReview(info,ctx.profile,
      storage.getPlannedLineups?.()||[],{
        planningOk:storage.getPlanningState?.()?.ok===true,
        staleDays:[...staleRoundDays]
      }).filter(x=>x.day===selectedConfirmed.day&&x.warTag===selectedConfirmed.warTag):[];
    const decisionMap=decisionIndex(info.season,ctx.clanId);
    const reviewHtml=reviewKey?(()=>{
      const list=reviewRows.length?reviewRows.map(x=>{
        const checkDays=x.reviewable.map(v=>"Tag "+v.day+" ("+v.stage+")").join(", ");
        const blocked=x.protectedDays.map(v=>"Tag "+v.day+" ("+v.reason+")").join(", ");
        const constraints=[
          x.isFixed?"Fixspieler":"",
          x.targetDays?"Einsatzziel "+x.targetDays:"",
          x.mustDays.length?"MUSS an Tag "+x.mustDays.join(", "):""
        ].filter(Boolean).join(" · ");
        const decision=decisionMap.get(decisionKey(info.season,"cwl:"+x.warTag,x.tag));
        const decisionNames={excused:"Entschuldigung akzeptiert",
          later:"Später prüfen",review_pause:"Pauseprüfung vorgemerkt",
          applied_pause:"Tagespause im Plan übernommen"};
        const decisionStamp=decision?.created_at?new Date(decision.created_at).toLocaleString(
          "de-AT",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"";
        const decisionText=decision?.decision?
          "<small class='cwl-miss-decision-state'>Letzte Owner-Entscheidung: "+
          esc(decisionNames[decision.decision]||"Geprüft")+" · "+esc(decisionStamp)+
          (decision.target_day?" · Tag "+decision.target_day:"")+
          (decision.note?" · "+esc(decision.note):"")+"</small>":"";
        const history=decisionScope===ctx.clanId+"|"+info.season?
          ownerDecisions.filter(e=>decisionKey(e.season,e.war_key,e.player_tag)===
            decisionKey(info.season,"cwl:"+x.warTag,x.tag)):[];
        const historyHtml=history.length>1?
          "<details class='cwl-miss-audit-history'><summary>Alle "+
          history.length+" Owner-Entscheidungen</summary><ul>"+
          history.map(e=>{
            const stamp=e.created_at?new Date(e.created_at).toLocaleString(
              "de-AT",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"–";
            return "<li>"+esc(stamp)+" · "+
              esc(decisionNames[e.decision]||"Prüfung")+
              (e.target_day?" · Tag "+e.target_day:"")+
              (e.note?" · "+esc(e.note):"")+"</li>";
          }).join("")+"</ul></details>":"";
        const decisionButtons=ctx.role==="owner"&&!decisionBusy&&!x.unknownMember?
          "<div class='cwl-miss-decision-actions'>"+
          "<button class='btn small cwl-miss-owner-action' data-action='excused' data-tag='"+esc(x.tag)+
          "' type='button'>Entschuldigen</button>"+
          "<button class='btn small cwl-miss-owner-action' data-action='later' data-tag='"+esc(x.tag)+
          "' type='button'>Später</button>"+
          "<button class='btn small cwl-miss-owner-action' data-action='review_pause' data-tag='"+esc(x.tag)+
          "' type='button'>Pause prüfen</button></div>":"";
        const candidateDays=decision?.decision==="review_pause"&&ctx.role==="owner"&&
          !decisionBusy&&typeof applyVerifiedPause==="function"?
          x.reviewable.filter(v=>info.rounds.some(r=>r.day===v.day&&
            r.state==="preparation"&&!staleRoundDays.has(v.day))).map(v=>v.day):[];
        const applyButtons=candidateDays.length?
          "<div class='cwl-miss-apply-actions'>"+
          candidateDays.map(day=>"<button type='button' class='btn small cwl-miss-apply' "+
            "data-day='"+day+"' data-tag='"+esc(x.tag)+"'>Tag "+day+
            ": Pause im Plan übernehmen</button>").join("")+"</div>":"";
        const msg=x.unknownMember?"Nicht eindeutig im aktuellen Plan zugeordnet – keine Pausenempfehlung.":
          checkDays?"Nur mögliche Planprüfung: "+checkDays+". Clash-Aufstellung vor Wechsel prüfen.":
          "Kein eindeutig änderbarer künftiger Einsatz im aktuellen Plan.";
        return "<li class='cwl-miss-review-row'><b>"+esc(x.name)+
          " <span class='cwl-miss-review-tag'>"+esc(x.tag)+"</span></b>"+
          "<div>"+esc(msg)+"</div>"+
          (blocked?"<small>Geschützt: "+esc(blocked)+"</small>":"")+
          (constraints?"<small>Regeln beachten: "+esc(constraints)+"</small>":"")+
          decisionText+historyHtml+decisionButtons+applyButtons+"</li>";
      }).join(""):"<li>Prüfung aus Plan und Spieler-Tags derzeit nicht eindeutig möglich. Keine automatische Empfehlung.</li>";
      const dayPicker=confirmedMisses.length>1?
        "<div class='cwl-miss-decision-actions cwl-miss-day-choices' role='group' aria-label='Bestätigten CWL-Tag auswählen'>"+
        confirmedMisses.map(item=>"<button type='button' class='btn small cwl-miss-day-select' "+
          "data-day='"+item.day+"' aria-pressed='"+(item.day===selectedConfirmed.day?"true":"false")+"'>Tag "+item.day+"</button>").join("")+
        "</div>":"";
      return dayPicker+"<details class='cwl-miss-review'"+(expandedMissReviews.has(reviewKey)?" open":"")+">"+
        "<summary>Tag "+selectedConfirmed.day+": künftige Einsätze prüfen (nur Vorschau)</summary>"+
        "<p>Bestätigter fehlender Angriff. Ob ein Spieler später pausiert, entscheidet die Clanführung "+
        "nach Prüfung von Fix/MUSS, Einsatzziel, 8★-Bonus und Clash-Aufstellungen. "+
        "Eine Pause für einen eindeutig prüfbaren Vorbereitungstag ist nur mit erneutem "+
        "Clash-Abgleich, vorheriger Owner-Entscheidung und ausdrücklicher Bestätigung möglich. "+
        "Der Wechsel in Clash selbst bleibt manuell.</p>"+
        "<ul>"+list+"</ul></details>";
    })():"";
    const attentionHtml=attention?(()=>{
      const names=attention.players.slice(0,8).map(p=>esc(p.name)).join(", ")+
        (attention.players.length>8?" und "+(attention.players.length-8)+" weitere":"");
      const open=attention.kind==="open";
      const when=acknowledgedAt?new Date(acknowledgedAt).toLocaleString("de-AT",
        {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"";
      const action=open&&ctx.role!=="viewer"?
        "<div class='cwl-attack-actions'><button class='btn small "+
        (acknowledgedAt?"cwl-attention-reset":"cwl-attention-ack")+
        "' type='button'>"+(acknowledgedAt?"Erinnerung erneut anzeigen":"Im Spiel erinnert · hier quittieren")+
        "</button></div>":"";
      return "<div class='cwl-attack-attention' data-kind='"+attention.kind+"'"+
        (acknowledgedAt?" data-acknowledged='true'":"")+">"+
        "<strong>"+(open?(acknowledgedAt?
          "Tag "+attention.day+": Erinnerung auf diesem Gerät quittiert · "+esc(when):
          "Tag "+attention.day+": "+attention.players.length+" Angriffe noch offen · "+
          attention.minutesLeft+" Min. bis Kriegsende"):
          "Tag "+attention.day+": "+attention.players.length+" Angriffe nach Kriegsende nicht erfolgt")+
        "</strong>"+(!acknowledgedAt||!open?"<span>"+names+"</span>":"")+
        "<small>"+(open?(acknowledgedAt?
          "Nur eine lokale Markierung; der Angriff ist damit nicht ausgeführt. Neue offene Spieler werden erneut angezeigt.":
          "Bitte in Clash prüfen und gegebenenfalls erinnern. Ein Angriff ist bis zum Ende noch möglich."):
          (attention.day>=ctx.profile.config.days?
           "Diese CWL hat keine weiteren Kriegstage; kein späterer Einsatz kann geändert werden.":
           "Vor der nächsten Kriegsaufstellung bewusst entscheiden, ob diese Spieler wieder eingeplant werden."))+
        " Nur Hinweis, kein automatischer Wechsel. Stand aus Clash; bitte vor Entscheidungen aktualisieren."+
        "</small>"+action+"</div>";
    })():staleAttention?(()=>{
      const checkedAt=lastSuccessfulAt&&activeClan===ctx.clanId?
        new Date(lastSuccessfulAt).toLocaleString("de-AT",
        {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"nicht bekannt";
      return "<div class='cwl-attack-attention' data-kind='stale'>"+
        "<strong>Tag "+staleAttention.day+": mögliche offene Angriffe – Datenstand unklar</strong>"+
        "<small>Letzter Live-Abgleich: "+esc(checkedAt)+
        ". Ein Angriff könnte bereits erfolgt sein. Bitte zuerst CWL-Daten aktualisieren; keine Missed- oder Erinnerungsbestätigung aus gespeicherten Angaben.</small></div>";
    })():"";
    node.innerHTML="<strong>CWL "+esc(info.season)+" · Live</strong> <span class='statusline'>"+
      ended+" Kriege beendet · "+info.rounds.filter(r=>r.available).length+"/7 Gegner verfügbar"+
      (offlineReason?" · ⚠ "+esc(offlineReason):"")+esc(detailsWarning)+"</span>"+attentionHtml+reviewHtml;
    node.querySelector(".cwl-attention-ack")?.addEventListener("click",()=>{
      const active=context(),latest=effective();
      const ready=active.active&&active.role!=="viewer"&&active.clanId===ctx.clanId&&
        activeClan===active.clanId&&lastSuccessfulProfile===active.profile&&
        lastSuccessfulAt>0&&Date.now()-lastSuccessfulAt<=FRESH_WINDOW_MS&&
        !offlineReason&&!staleRoundDays.has(attention.day)&&!fetching&&
        latest?.season===info.season;
      const currentRound=latest?.rounds?.find(r=>r.day===attention.day);
      const latestNote=ready?cwlAttackReminder(currentRound):null;
      if(!ready||cwlReminderAckKey(active,info.season,latestNote)!==attentionKey){
        notify("Angriffsstand geändert oder nicht aktuell. Bitte CWL-Daten aktualisieren.");
        render();return;
      }
      if(!writeCwlReminderAck(attentionKey)){
        notify("Lokale Quittierung konnte nicht gespeichert werden.");return;
      }
      render();
    });
    node.querySelector(".cwl-attention-reset")?.addEventListener("click",()=>{
      if(context().clanId!==ctx.clanId)return;
      clearCwlReminderAck(attentionKey);render();
    });
    node.querySelectorAll(".cwl-miss-day-select").forEach(button=>{
      button.addEventListener("click",()=>{
        const day=Number(button.dataset.day);
        const notice=confirmedMisses.find(a=>a.day===day);
        if(!notice)return;
        selectedMissReviewKey=info.season+"|"+day;
        expandedMissReviews.add([ctx.clanId,info.season,notice.warTag,day].join("|"));
        render();
        node.querySelector(".cwl-miss-day-select[data-day='"+day+"']")?.focus({preventScroll:true});
      });
    });
    node.querySelector(".cwl-miss-review")?.addEventListener("toggle",event=>{
      if(!reviewKey)return;
      if(event.target.open)expandedMissReviews.add(reviewKey);
      else expandedMissReviews.delete(reviewKey);
    });
    node.querySelectorAll(".cwl-miss-owner-action").forEach(button=>{
      button.addEventListener("click",()=>{
        const tag=tagOf(button.dataset.tag);
        const row=reviewRows.find(x=>x.tag===tag);
        if(row)makeOwnerDecision(row,button.dataset.action).catch(err=>{
          console.warn("CWL owner action:",err);
          notify("Entscheidung konnte nicht geöffnet werden.");
        });
      });
    });
    node.querySelectorAll(".cwl-miss-apply").forEach(button=>{
      button.addEventListener("click",()=>{
        const row=reviewRows.find(x=>x.tag===tagOf(button.dataset.tag));
        const day=Number(button.dataset.day);
        if(row&&Number.isInteger(day))makeOwnerPause(row,day).catch(err=>{
          console.warn("CWL pause:",String(err));
          notify("Pause konnte nicht geöffnet werden.");
        });
      });
    });
    const byDay=new Map(info.rounds.map(r=>[r.day,r]));

    for (let i=0;i<ctx.profile.config.days;i++){
      const dayCard=document.getElementById("day-card-"+i);
      if(dayCard)renderDay(byDay.get(i+1),dayCard,ctx.profile,
        {fresh:fresh&&!staleRoundDays.has(i+1),checkedAt:lastSuccessfulAt,
         previousRound:byDay.get(i),previousFresh:fresh&&!staleRoundDays.has(i)});
    }
  }
  async function refreshNow(manual=false) {
    const ctx=context();
    if(!ctx.active||!ctx.clanId||!ctx.hasClanTag||!navigator.onLine||fetching)return;
    // A manual first refresh must establish its own clan session, too.
    // Never carry fresh-state flags or round snapshots over from another clan.
    if(activeClan!==ctx.clanId){
      activeClan=ctx.clanId;current=null;lastSuccessfulAt=0;lastSuccessfulProfile=null;staleRoundDays.clear();
    }
    const req=++requestId,id=ctx.clanId,profileAtRequest=ctx.profile,roleAtRequest=ctx.role;
    const stillCurrent=()=>{
      const now=context();
      return req===requestId&&id===now.clanId&&now.active&&now.hasClanTag&&
        profileAtRequest===now.profile&&roleAtRequest===now.role;
    };
    fetching=true;render();
    try {
      const {data,error}=await sb.functions.invoke("coc-cwl-status",{body:{clanId:id}});
      if(error||!data?.ok) {
        let msg=data?.error||error?.message||"API nicht erreichbar";
        if(error?.context?.json)try{msg=(await error.context.json())?.error||msg}catch{}
        throw new Error(msg);
      }
      if(!stillCurrent())return;
      // Official new season is the only trigger for a fresh Cloud plan.
      // Preserve a partial previous season (6/7 stays 6/7) in the existing
      // archive before requesting the owner's Cloud cycle transition.
      let previous=ctx.profile?.cwlLive;
      if(data.active&&previous?.season&&data.season>previous.season&&
         previous.clanTag===ctx.clanTag&&
         ctx.role==="owner"&&ctx.canApply&&typeof ensureCloudSaved==="function"){
        if(storage.archivePriorCwlForRollover?.(previous.season)){
          await ensureCloudSaved();
          if(!stillCurrent())return;
          if(await storage.autoAdvanceCwl?.(previous.season,data.season)){
            notify("Neue CWL erkannt · die vorherige Saison ist gespeichert.");
            previous=ctx.profile?.cwlLive;
          }
        }
      }
      // A temporary failure to fetch individual wars must not wipe previously
      // confirmed, same-season information saved by another clan leader.
      const nextStaleDays=new Set();
      if(data.active && data.detailsStatus && data.detailsStatus!=="complete" &&
         previous?.season===data.season && previous?.clanTag===data.clanTag &&
         Array.isArray(previous.rounds) && Array.isArray(data.rounds)){
        data.rounds=data.rounds.map((round,i)=>{
          if(round?.available)return round;
          if(previous.rounds[i]?.available){
            nextStaleDays.add(i+1);
            return previous.rounds[i];
          }
          return round;
        });
      }
      if(data.active&&previous?.season===data.season&&
         previous?.clanTag===data.clanTag){
        const preserved=preservedCwlRound(previous,data);
        data.rounds=preserved.rounds;
      }
      staleRoundDays=nextStaleDays;
      if(data.active&&data.group?.season===data.season&&
         data.group.clanTag===data.clanTag)lastKnownGroup=data.group;
      if(!data.active&&!data.pending&&previous?.season&&
         previous.clanTag===ctx.clanTag&&
         !lastKnownGroup&&typeof sb.from==="function"){
        // Existing cloud group archive is tenant-RLS protected; do not
        // silently lose standings on a new device after leaguegroup closes.
        const {data:savedGroup,error:groupError}=await sb.from("cwl_group_archives")
          .select("group_json").eq("clan_id",id).eq("season",previous.season)
          .maybeSingle();
        if(!stillCurrent())return;
        const archive=savedGroup?.group_json;
        if(!groupError&&archive?.season===previous.season&&
           archive.clanTag===ctx.clanTag&&Array.isArray(archive.rounds)&&
           Array.isArray(archive.clans))lastKnownGroup=archive;
      }
      current=data;lastSuccessfulAt=Date.now();lastSuccessfulProfile=ctx.profile;offlineReason=data.pending?
        "CWL-Gruppendaten noch nicht vollständig verfügbar. Bitte später erneut prüfen.":"";confirmedNoCwl=!data.active&&!data.pending;
      // Live war placement and page panels must update on EVERY successful
      // API state, including new preparation rounds with incomplete group
      // details. Recording finalized statistics remains separately gated.
      try{onStatus?.(data)}catch(e){console.warn(
       "Live-CW-Anzeige:",String(e?.message||e))}
      // Optional statistics sink only; a failed stats save must never break planning.
      if(onSnapshot && !data.pending && (!data.active || data.detailsStatus==="complete" || data.detailsStatus==="partial"))
        Promise.resolve().then(()=>stillCurrent()?onSnapshot(data):undefined)
          .catch(e=>console.warn("Statistik-Abgleich:",String(e?.message||e)));
      if(data.active && ctx.role!=="viewer" && context().canApply) {
        const result=reconcileCwl(storage.getProfile(),data,name=>storage.newMember(name));
        if(result.changed) {
          storage.rerender();
          if(result.lockedDays.length)
            notify("✓ CWL-Tag "+result.lockedDays.join(", ")+" automatisch mit tatsächlicher Aufstellung abgeschlossen");
        }
      }
      if(ctx.role==="owner"&&ctx.canApply&&
         getLifecycle().canAutoArchive&&
         storage.archiveConfirmedCwl?.(getLifecycle().season))
        Promise.resolve(ensureCloudSaved?.()).catch(e=>console.warn(
         "CWL auto archive save:",String(e?.message||e)));
      if(data.active&&data.season&&typeof sb.from==="function")
        await loadOwnerDecisions(id,data.season).catch(e=>console.warn(
          "CWL owner decisions unavailable:",String(e?.message||e)));
      if(manual && data.pending)notify("Die CWL-Auslosung ist noch nicht vollständig verfügbar. Dein Plan bleibt erhalten.");
      else if(manual && !data.active)notify(getLifecycle().mode==="postseason"?
       "✓ CWL beendet. Gespeicherte Ergebnisse sind im Plan-Rückblick sichtbar; fehlende Finalnachweise bleiben offen.":
       "Derzeit keine aktive CWL. Normale Clankriege erscheinen im Plan.");
    }catch(err){
      if(!stillCurrent())return;
      offlineReason=cwlErrorMessage(String(err?.message||""));
      if(manual)notify("⚠ "+offlineReason);
      console.warn("CWL status:",String(err?.message||err));
    }finally{
      if(req===requestId){
        fetching=false;render();storage.refreshSummary?.();
        // First observed success OR failure: reveal the current saved Cloud
        // state rather than leaving the cold-start shield up indefinitely.
        try{onInitialSettled?.(id)}catch(e){console.warn("Cloud start view:",e)}
      }
    }
  }
  function stop(){
    requestId++;if(interval!==null){clearInterval(interval);interval=null}
    activeClan=null;current=null;fetching=false;offlineReason="";confirmedNoCwl=false;lastSuccessfulAt=0;lastSuccessfulProfile=null;lastKnownGroup=null;
    closeSwapPopover();openedOutgoing.clear();
    expandedDays.clear();expandedOpponentDays.clear();expandedMissReviews.clear();staleRoundDays.clear();
    ownerDecisions=[];decisionScope="";decisionBusy=false;decisionError="";
    selectedMissReviewKey="";
    render();
  }
  function start(){
    stop();const ctx=context();
    if(!ctx.active||!ctx.clanId||!ctx.hasClanTag)return;
    activeClan=ctx.clanId;
    refreshNow();
    interval=setInterval(()=>{if(!document.hidden&&navigator.onLine)refreshNow()},300000);
  }
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden&&context().active)refreshNow();
  });
  const observedAttackResults=()=>{
    // Read-only. Both in-war evidence and ended results belong to this clan.
    const ctx=context(),snapshot=effective();
    return ctx.active&&ctx.clanId&&snapshot?.rounds?
      recordedCwlAttackResults(snapshot):{};
  };
  return {start,stop,render,refresh:()=>refreshNow(true),
   getLifecycle,getPostseasonSnapshot:()=>getLifecycle().mode==="postseason"?getLifecycle().snapshot:null,
   getPlayedAttackResults:()=>{
    // Backward-compatible completed-war contract for legacy statistics/viewers.
    // Live operational progress calls getObservedCwlAttackResults instead.
    const completed={};
    for(const [day,entries] of Object.entries(observedAttackResults())){
      const ended={};
      for(const [tag,result] of Object.entries(entries)){
        if(result.state!=="warEnded")continue;
        ended[tag]=result.missed?{missed:true}:
          {stars:result.stars,percent:result.percent,missed:false};
      }
      if(Object.keys(ended).length)completed[day]=ended;
    }
    return completed;
  },getObservedCwlAttackResults:observedAttackResults,getMedalOverview:()=>{
    const ctx=context(),info=effective();
    if(!info?.season||!ctx.active||!ctx.clanId)return null;
    // effective() already returned a validated snapshot; re-sanitizing
    // sanitized data as raw API payload incorrectly produced null.
    const clean={...info,rounds:[...(info.rounds||[])]};
    if(staleRoundDays.size)clean.rounds=clean.rounds.map(round=>
      staleRoundDays.has(round.day)?{day:round.day,available:false}:round);
    const assessment=evaluateEightStarGoals({
      snapshot:clean,profile:ctx.profile,dayPlans:storage.getPlannedLineups?.()||[]
    });
    const fresh=!!(current?.active&&activeClan===ctx.clanId&&
      current.season===info.season&&lastSuccessfulProfile===ctx.profile&&
      lastSuccessfulAt>0&&Date.now()-lastSuccessfulAt<=FRESH_WINDOW_MS&&
      !offlineReason&&!staleRoundDays.size&&current.detailsStatus==="complete");
    const suggestion=assessment?.hasResults&&fresh?
      findReadOnlyMedalSwap({
        assessment,profile:ctx.profile,snapshot:clean,dayPlans:storage.getPlannedLineups?.()||[]
      }):null;
    return {assessment,fresh,suggestion,partial:!!(current?.detailsStatus&&
      current.detailsStatus!=="complete")||!!staleRoundDays.size};
  },getGroupSnapshot:()=>{
    const ctx=context();
    const group=current?.active&&activeClan===ctx.clanId?current.group:lastKnownGroup;
    if(!ctx.active||activeClan!==ctx.clanId||
       !group?.season||
       ctx.profile?.cwlLiveIgnoredSeason===group.season||
       group.clanTag!==ctx.clanTag)return null;
    return group;
  },getSnapshot:()=>{
    if(!current?.active||activeClan!==context().clanId)return null;
    const clean=sanitizeSnapshot(current);
    if(clean&&staleRoundDays.size)clean.rounds=clean.rounds.map(r=>
      staleRoundDays.has(r.day)?{day:r.day,available:false}:r);
    return clean;
  }};
}
