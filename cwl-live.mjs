import { reconcileCwl, sanitizeSnapshot, tagOf, safeBadgeUrl, cwlAttackRows } from "./cwl-live-core.mjs?v=1.2.2";

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const statusLabel={preparation:"Vorbereitung",inWar:"Krieg läuft",warEnded:"Beendet"};
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
export function createCwlLive({sb,context,storage,notify}) {
  let activeClan=null,interval=null,current=null,requestId=0,fetching=false,offlineReason="",confirmedNoCwl=false;
  const expandedDays=new Set();
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
    const wasOpen=expandedDays.has(round.day)||!!dayCard.querySelector(".cwl-live-details[open]");
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
    const players=round.state==="preparation"
      ?"<div class='cwl-live-attack-empty'>Die Angriffe erscheinen mit Kriegsbeginn.</div>"
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
      destruct+"<div class='cwl-live-ths'>"+townHallSummary(enemy)+"</div>"+
      "<div class='statusline'>"+(round.startTime?"Start "+esc(stateDate(round.startTime))+" · ":"")+
      attacks+"/"+own.length+" Angriffe erfasst"+(round.state==="warEnded"?" · API-Ergebnis":"")+"</div>"+
      "<details class='cwl-live-details'"+(wasOpen?" open":"")+"><summary>Spieler und Angriffe anzeigen"+
      "<span class='cwl-live-attack-count'>"+(round.state==="preparation"?"Bereit":missing+" offen · "+(own.length-missing)+" erledigt")+
      "</span></summary>"+
      (players||"<div class='statusline'>Aufstellung noch nicht verfügbar.</div>")+"</details>";
    section.querySelector(".cwl-live-details")?.addEventListener("toggle",event=>{
      if(event.target.open)expandedDays.add(round.day);
      else expandedDays.delete(round.day);
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
      (offlineReason?" · ⚠ "+esc(offlineReason):"")+"</span>";
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
      current=data;offlineReason="";confirmedNoCwl=!data.active;
      if(data.active && ctx.role!=="viewer" && context().canApply) {
        const result=reconcileCwl(storage.getProfile(),data,name=>storage.newMember(name));
        if(result.changed) {
          storage.rerender();
          if(result.lockedDays.length)
            notify("✓ CWL-Tag "+result.lockedDays.join(", ")+" automatisch mit tatsächlicher Aufstellung abgeschlossen");
        }
      }
      if(manual && !data.active)notify("Derzeit keine CWL-Daten verfügbar – der manuelle Planer bleibt aktiv.");
    }catch(err){
      if(req!==requestId)return;
      offlineReason="CWL-API nicht erreichbar; gespeicherter Plan bleibt unverändert";
      if(manual)notify("⚠ "+offlineReason);
      console.warn("CWL status:",String(err?.message||err));
    }finally{
      if(req===requestId){fetching=false;render()}
    }
  }
  function stop(){
    requestId++;if(interval!==null){clearInterval(interval);interval=null}
    activeClan=null;current=null;fetching=false;offlineReason="";confirmedNoCwl=false;
    expandedDays.clear();
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
