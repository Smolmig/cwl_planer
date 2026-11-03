import { reconcileCwl, sanitizeSnapshot, tagOf, safeBadgeUrl, cwlAttackRows, reviewPreparationLineup } from "./cwl-live-core.mjs?v=1.3.6";

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
    supercell_status_429:"Clash verarbeitet gerade zu viele Anfragen. Bitte später erneut versuchen."
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
  let activeClan=null,interval=null,current=null,requestId=0,fetching=false,offlineReason="",confirmedNoCwl=false;
  const expandedDays=new Set(),expandedOpponentDays=new Set();
  const effective=()=>{
    const ctx=context();
    if (!ctx.active || !ctx.clanId || !ctx.hasClanTag)return null;
    if (current && activeClan===ctx.clanId && current.active && ctx.profile?.cwlLiveIgnoredSeason!==current.season)return sanitizeSnapshot(current);
    if (confirmedNoCwl)return null;
    const prior=ctx.profile?.cwlLive;
    if (!prior?.season)return null;
    const month=Number(prior.season.slice(0,4))*12+Number(prior.season.slice(5,7));
    const now=new Date(),diff=now.getFullYear()*12+now.getMonth()+1-month;
    return diff>=0&&diff<=1?prior:null;
  };
  function renderDay(round,dayCard,profile) {
    const wasOpen=expandedDays.has(round?.day)||!!dayCard.querySelector(".cwl-live-details[open]");
    const wasOpponentOpen=expandedOpponentDays.has(round?.day)||!!dayCard.querySelector(".cwl-opponent-details[open]");
    dayCard.querySelector(".cwl-live-day")?.remove();
    const section=document.createElement("section");
    section.className="cwl-live-day";
    if(!round?.available){
      section.innerHTML="<span class='cwl-live-label'>⚔️ CWL-Gegner</span> <span class='statusline'>Noch nicht von Clash freigegeben</span>";
      dayCard.querySelector(".day-head")?.after(section);
      return;
    }
    const own=round.clan?.members||[],enemy=round.opponent?.members||[];
    const opponentMap=new Map(enemy.map(m=>[tagOf(m.tag),m]));
    const attacks=own.reduce((sum,m)=>sum+(m.attacks?.length||0),0);
    const missing=own.filter(m=>!m.attacks?.length).length;
    const attackRows=cwlAttackRows(round);
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
    const group=(title,items,kind)=>"<div class='cwl-prep-group "+kind+"'><b>"+title+"</b><ul>"+
      items.map(m=>"<li><span class='cwl-live-rh'>RH"+esc(m.townHallLevel??"?")+
        "</span><span class='cwl-roster-name'>"+esc(m.name)+
        "</span><span class='cwl-roster-tag'>"+esc(tagOf(m.tag))+"</span></li>").join("")+"</ul></div>";
    const reviewHtml=!review?"":review.status==="unavailable"
      ?"<div class='cwl-prep-review'><b>Abgleich mit dem CWL-Plan</b><p class='statusline'>"+
        esc(review.reason)+"</p></div>"
      :"<div class='cwl-prep-review'><div class='cwl-prep-heading'><b>Abgleich mit dem CWL-Plan</b>"+
        "<span class='cwl-prep-result "+(review.status==="match"?"matched":"changes")+"'>"+
        (review.status==="match"?"Aufstellung stimmt überein":review.toAdd.length+" Wechsel nötig")+
        "</span></div>"+
        (review.status==="changes"?"<div class='cwl-prep-groups'>"+
          group("Aus Clash raus",review.toRemove,"remove")+
          group("In Clash rein",review.toAdd,"add")+"</div>":"")+
        "<p class='statusline'>Clash-Aufstellung ist vorläufig. Nur Anzeige – bitte Wechsel direkt im Spiel durchführen.</p></div>";
    const players=round.state==="preparation"
      ?(rosterReady(own)?"<ol class='cwl-roster-list'>"+own.map(rosterLine).join("")+"</ol>":
        "<p class='cwl-live-attack-empty'>Eigene Aufstellung noch nicht vollständig verfügbar.</p>")
      :attackRows.map(({player,attack,target})=>{
        const didAttack=!!attack;
        const stars=didAttack?attack.stars:null;
        const starIcons=didAttack?"★".repeat(stars)+"☆".repeat(3-stars):"☆☆☆";
        const targetName=target?.name||"Ziel unbekannt";
        const targetLevel=target?.townHallLevel??null;
        return "<div class='cwl-live-attack"+(didAttack?"":" pending")+"'>"+
          "<div class='cwl-live-attack-result'>"+
          "<span class='cwl-live-stars"+(didAttack?"":" no-attack")+"' aria-label='"+
          (didAttack?stars+" von 3 Sternen":"Noch nicht angegriffen")+"'>"+
          starIcons+"</span>"+
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
      }).join("");
    const ownScore=scoreText(round.clan?.stars),enemyScore=scoreText(round.opponent?.stars);
    const destruct=round.clan?.destructionPercentage!==null&&round.clan?.destructionPercentage!==undefined&&
      round.opponent?.destructionPercentage!==null&&round.opponent?.destructionPercentage!==undefined
      ?"<div class='cwl-live-score-detail'>Zerstörung: "+pctText(round.clan.destructionPercentage)+
        " : "+pctText(round.opponent.destructionPercentage)+"</div>":"";
    const sideHtml=side=>"<div class='cwl-live-side'>"+badgeArt(side)+
      "<b class='cwl-live-clan-name'>"+esc(side?.name||"Unbekannt")+"</b></div>";
    section.innerHTML="<div class='cwl-live-header'><span class='cwl-live-label'>⚔️ CWL · Tag "+round.day+
      "</span><span class='badge "+(round.state==="warEnded"?"ok":"warn")+"'>"+
      esc(statusLabel[round.state]||round.state)+"</span></div>"+
      "<div class='cwl-live-scoreboard' role='group' aria-label='Kriegssterne "+esc(round.clan?.name||"Clan")+" "+
      ownScore+" zu "+enemyScore+" "+esc(round.opponent?.name||"Gegner")+"'>"+
      sideHtml(round.clan)+"<div class='cwl-live-score-middle'><div class='cwl-live-score' aria-hidden='true'>"+
      "<span>"+ownScore+"</span><span class='cwl-live-score-colon'>:</span><span>"+enemyScore+"</span></div>"+
      "<div class='cwl-live-score-caption'>★ Kriegssterne</div></div>"+sideHtml(round.opponent)+"</div>"+
      destruct+"<div class='cwl-live-ths' aria-label='Rathausverteilung der gegnerischen Aufstellung'><strong>Gegner-Aufstellung</strong> "+townHallSummary(enemy)+"</div>"+
      reviewHtml+
      "<details class='cwl-opponent-details'"+(wasOpponentOpen?" open":"")+"><summary>Gegnerteam ansehen <span class='cwl-live-attack-count'>"+
      (rosterReady(enemy)?enemy.length+" Spieler":"Noch nicht vollständig")+"</span></summary>"+
      opponentRoster+"</details>"+
      "<div class='statusline'>"+(round.startTime?"Start "+esc(stateDate(round.startTime))+" · ":"")+
      (round.state==="preparation"?"Aufstellung vorläufig · Wechsel in Clash bis Kriegsbeginn möglich":
        attacks+"/"+own.length+" Angriffe erfasst"+(round.state==="warEnded"?" · API-Ergebnis":""))+"</div>"+
      "<details class='cwl-live-details'"+(wasOpen?" open":"")+"><summary>"+
      (round.state==="preparation"?"Clash-Aufstellung ansehen":"Spieler und Angriffe anzeigen")+
      "<span class='cwl-live-attack-count'>"+(round.state==="preparation"?
        (rosterReady(own)?own.length+" Spieler · vorläufig":"Noch nicht vollständig"):missing+" offen · "+(own.length-missing)+" erledigt")+
      "</span></summary>"+
      (players||"<div class='statusline'>Aufstellung noch nicht verfügbar.</div>")+"</details>";
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
    const ctx=context(),view=document.getElementById("view-plan");
    const old=document.getElementById("cwlLiveOverview");
    const button=document.getElementById("cwlLiveRefresh");
    if(!ctx.active || !ctx.clanId || !ctx.hasClanTag || !view){
      old?.remove();button?.remove();
      document.querySelectorAll(".cwl-live-day").forEach(n=>n.remove());return;
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
      return;
    }
    node.hidden=false;
    const ended=info.rounds.filter(r=>r.state==="warEnded").length;
    node.innerHTML="<strong>CWL "+esc(info.season)+" · Live</strong> <span class='statusline'>"+
      ended+" Kriege beendet · "+info.rounds.filter(r=>r.available).length+"/7 Gegner verfügbar"+
      (offlineReason?" · ⚠ "+esc(offlineReason):"")+esc(detailsWarning)+"</span>";
    const byDay=new Map(info.rounds.map(r=>[r.day,r]));
    for (let i=0;i<ctx.profile.config.days;i++){
      const dayCard=document.getElementById("day-card-"+i);
      if(dayCard)renderDay(byDay.get(i+1),dayCard,ctx.profile);
    }
  }
  async function refreshNow(manual=false) {
    const ctx=context();
    if(!ctx.active||!ctx.clanId||!ctx.hasClanTag||!navigator.onLine||fetching)return;
    const req=++requestId,id=ctx.clanId;
    fetching=true;render();
    try {
      const {data,error}=await sb.functions.invoke("coc-cwl-status",{body:{clanId:id}});
      if(error||!data?.ok) {
        let msg=data?.error||error?.message||"API nicht erreichbar";
        if(error?.context?.json)try{msg=(await error.context.json())?.error||msg}catch{}
        throw new Error(msg);
      }
      if(req!==requestId||id!==context().clanId)return;
      // A temporary failure to fetch individual wars must not wipe previously
      // confirmed, same-season information saved by another clan leader.
      const previous=ctx.profile?.cwlLive;
      if(data.active && data.detailsStatus && data.detailsStatus!=="complete" &&
         previous?.season===data.season && previous?.clanTag===data.clanTag &&
         Array.isArray(previous.rounds) && Array.isArray(data.rounds)){
        data.rounds=data.rounds.map((round,i)=>round?.available?round:
          previous.rounds[i]?.available?previous.rounds[i]:round);
      }
      current=data;offlineReason=data.pending?
        "CWL-Gruppendaten noch nicht vollständig verfügbar. Bitte später erneut prüfen.":"";confirmedNoCwl=!data.active&&!data.pending;
      // Optional statistics sink only; a failed stats save must never break planning.
      if(onSnapshot && !data.pending && (!data.active || data.detailsStatus==="complete" || data.detailsStatus==="partial"))
        Promise.resolve().then(()=>onSnapshot(data)).catch(e=>console.warn("Statistik-Abgleich:",String(e?.message||e)));
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
      if(req!==requestId)return;
      offlineReason=cwlErrorMessage(String(err?.message||""));
      if(manual)notify("⚠ "+offlineReason);
      console.warn("CWL status:",String(err?.message||err));
    }finally{
      if(req===requestId){fetching=false;render()}
    }
  }
  function stop(){
    requestId++;if(interval!==null){clearInterval(interval);interval=null}
    activeClan=null;current=null;fetching=false;offlineReason="";confirmedNoCwl=false;
    expandedDays.clear();expandedOpponentDays.clear();
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
  return {start,stop,render,refresh:()=>refreshNow(true)};
}
