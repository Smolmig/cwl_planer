import { reconcileCwl, sanitizeSnapshot, tagOf, safeBadgeUrl, cwlAttackRows, reviewPreparationLineup, formatClashSwapText, compareConsecutiveCwlLineups, cwlAttackReminder, cwlMissedRotationReview, recordedCwlAttackResults } from "./cwl-live-core.mjs?v=1.16.45";
import { evaluateEightStarGoals, findReadOnlyMedalSwap } from "./cwl-medal-goals.mjs?v=1.16.45";

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
export function createCwlLive({sb,context,storage,notify,onSnapshot}) {
  let activeClan=null,interval=null,current=null,requestId=0,fetching=false,offlineReason="",confirmedNoCwl=false,lastSuccessfulAt=0;
  let staleRoundDays=new Set(),lastSuccessfulProfile=null; // A saved fallback is never a fresh API observation.
  const FRESH_WINDOW_MS=10*60*1000; // A recent browser fetch; upstream may still cache preparation data.
  const expandedDays=new Set(),expandedOpponentDays=new Set(),expandedMissReviews=new Set();
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
    const attention=fresh?info.rounds
      .filter(r=>!staleRoundDays.has(r.day))
      .map(r=>cwlAttackReminder(r))
      .filter(Boolean)
      .filter(a=>a.kind==="open"||a.kind==="confirmed")
      .sort((a,b)=>Number(b.kind==="open")-Number(a.kind==="open")||b.day-a.day)[0]:null;
    // A stale source never establishes a forgotten attack.
    const staleAttention=!attention?info.rounds
      .map(r=>cwlAttackReminder(r)).filter(Boolean)
      .find(a=>a.kind==="open"&&(!fresh||staleRoundDays.has(a.day))):null;
    const attentionKey=attention?.kind==="open"?cwlReminderAckKey(ctx,info.season,attention):null;
    const acknowledgedAt=readCwlReminderAck(attentionKey);
    // A confirmed miss starts a review, NEVER a change to the plan.
    const reviewKey=attention?.kind==="confirmed"?
      [ctx.clanId,info.season,attention.warTag,attention.day].join("|"):null;
    const reviewRows=reviewKey?cwlMissedRotationReview(info,ctx.profile,
      storage.getPlannedLineups?.()||[],{
        planningOk:storage.getPlanningState?.()?.ok===true,
        staleDays:[...staleRoundDays]
      }).filter(x=>x.day===attention.day&&x.warTag===attention.warTag):[];
    const reviewHtml=reviewKey?(()=>{
      const list=reviewRows.length?reviewRows.map(x=>{
        const checkDays=x.reviewable.map(v=>"Tag "+v.day+" ("+v.stage+")").join(", ");
        const blocked=x.protectedDays.map(v=>"Tag "+v.day+" ("+v.reason+")").join(", ");
        const constraints=[
          x.isFixed?"Fixspieler":"",
          x.targetDays?"Einsatzziel "+x.targetDays:"",
          x.mustDays.length?"MUSS an Tag "+x.mustDays.join(", "):""
        ].filter(Boolean).join(" · ");
        const msg=x.unknownMember?"Nicht eindeutig im aktuellen Plan zugeordnet – keine Pausenempfehlung.":
          checkDays?"Nur mögliche Planprüfung: "+checkDays+". Clash-Aufstellung vor Wechsel prüfen.":
          "Kein eindeutig änderbarer künftiger Einsatz im aktuellen Plan.";
        return "<li class='cwl-miss-review-row'><b>"+esc(x.name)+
          " <span class='cwl-miss-review-tag'>"+esc(x.tag)+"</span></b>"+
          "<div>"+esc(msg)+"</div>"+
          (blocked?"<small>Geschützt: "+esc(blocked)+"</small>":"")+
          (constraints?"<small>Regeln beachten: "+esc(constraints)+"</small>":"")+"</li>";
      }).join(""):"<li>Prüfung aus Plan und Spieler-Tags derzeit nicht eindeutig möglich. Keine automatische Empfehlung.</li>";
      return "<details class='cwl-miss-review'"+(expandedMissReviews.has(reviewKey)?" open":"")+">"+
        "<summary>Künftige Einsätze prüfen (nur Vorschau)</summary>"+
        "<p>Bestätigter fehlender Angriff. Ob ein Spieler später pausiert, entscheidet die Clanführung "+
        "nach Prüfung von Fix/MUSS, Einsatzziel, 8★-Bonus und Clash-Aufstellungen. "+
        "Diese Ansicht ändert nichts und speichert keine Entscheidung.</p>"+
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
          "Vor der nächsten Kriegsaufstellung bewusst entscheiden, ob diese Spieler wieder eingeplant werden.")+
        " Nur Hinweis, kein automatischer Wechsel. Stand aus Clash; bitte vor Entscheidungen aktualisieren."+
        "</small>"+(open?"":reviewHtml)+action+"</div>";
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
      (offlineReason?" · ⚠ "+esc(offlineReason):"")+esc(detailsWarning)+"</span>"+attentionHtml;
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
    node.querySelector(".cwl-miss-review")?.addEventListener("toggle",event=>{
      if(!reviewKey)return;
      if(event.target.open)expandedMissReviews.add(reviewKey);
      else expandedMissReviews.delete(reviewKey);
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
      // A temporary failure to fetch individual wars must not wipe previously
      // confirmed, same-season information saved by another clan leader.
      const previous=ctx.profile?.cwlLive;
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
      staleRoundDays=nextStaleDays;
      current=data;lastSuccessfulAt=Date.now();lastSuccessfulProfile=ctx.profile;offlineReason=data.pending?
        "CWL-Gruppendaten noch nicht vollständig verfügbar. Bitte später erneut prüfen.":"";confirmedNoCwl=!data.active&&!data.pending;
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
      if(manual && data.pending)notify("Die CWL-Auslosung ist noch nicht vollständig verfügbar. Dein Plan bleibt erhalten.");
      else if(manual && !data.active)notify("Derzeit keine CWL-Daten verfügbar – der manuelle Planer bleibt aktiv.");
    }catch(err){
      if(!stillCurrent())return;
      offlineReason=cwlErrorMessage(String(err?.message||""));
      if(manual)notify("⚠ "+offlineReason);
      console.warn("CWL status:",String(err?.message||err));
    }finally{
      if(req===requestId){fetching=false;render();storage.refreshSummary?.()}
    }
  }
  function stop(){
    requestId++;if(interval!==null){clearInterval(interval);interval=null}
    activeClan=null;current=null;fetching=false;offlineReason="";confirmedNoCwl=false;lastSuccessfulAt=0;lastSuccessfulProfile=null;
    closeSwapPopover();openedOutgoing.clear();
    expandedDays.clear();expandedOpponentDays.clear();expandedMissReviews.clear();staleRoundDays.clear();
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
  return {start,stop,render,refresh:()=>refreshNow(true),getPlayedAttackResults:()=>{
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
    if(!current?.active||activeClan!==ctx.clanId||
       current.group?.season!==current.season||
       ctx.profile?.cwlLiveIgnoredSeason===current.season)return null;
    return current.group||null;
  },getSnapshot:()=>{
    if(!current?.active||activeClan!==context().clanId)return null;
    const clean=sanitizeSnapshot(current);
    if(clean&&staleRoundDays.size)clean.rounds=clean.rounds.map(r=>
      staleRoundDays.has(r.day)?{day:r.day,available:false}:r);
    return clean;
  }};
}
