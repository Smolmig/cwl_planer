import { reconcileCwl, sanitizeSnapshot, tagOf } from "./cwl-live-core.mjs";

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const statusLabel={preparation:"Vorbereitung",inWar:"Krieg läuft",warEnded:"Beendet"};
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
  const effective=()=>{
    const ctx=context();
    if (!ctx.active || !ctx.clanId)return null;
    if (current && activeClan===ctx.clanId && current.active && ctx.profile?.cwlLiveIgnoredSeason!==current.season)return sanitizeSnapshot(current);
    if (confirmedNoCwl)return null;
    const prior=ctx.profile?.cwlLive;
    if (!prior?.season)return null;
    const month=Number(prior.season.slice(0,4))*12+Number(prior.season.slice(5,7));
    const now=new Date(),diff=now.getFullYear()*12+now.getMonth()+1-month;
    return diff>=0&&diff<=1?prior:null;
  };
  function renderDay(round,dayCard,profile) {
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
    const players=own.map(m=>{
      const at=m.attacks?.[0];
      const target=at?opponentMap.get(tagOf(at.defenderTag)):null;
      const score=at?esc(String(at.stars))+"★ · "+esc(String(at.destructionPercentage))+" %":
        round.state==="preparation"?"–":"Noch kein Angriff";
      return "<div class='cwl-live-attack'><span><b>"+esc(m.name)+"</b> <small>RH"+esc(m.townHallLevel||"?")+
        (target?" → "+esc(target.name)+" (RH"+esc(target.townHallLevel||"?")+")":"")+
        "</small></span><strong>"+score+"</strong></div>";
    }).join("");
    section.innerHTML="<div class='cwl-live-header'><div><span class='cwl-live-label'>⚔️ Gegner · Tag "+round.day+
      "</span><div><b>"+esc(round.opponent?.name||"Unbekannt")+"</b> <small>"+esc(round.opponent?.tag)+"</small></div></div>"+
      "<span class='badge "+(round.state==="warEnded"?"ok":"warn")+"'>"+esc(statusLabel[round.state]||round.state)+"</span></div>"+
      "<div class='cwl-live-ths'>"+townHallSummary(enemy)+"</div>"+
      "<div class='statusline'>"+(round.startTime?"Start "+esc(stateDate(round.startTime))+" · ":"")+
      attacks+"/"+own.length+" Angriffe erfasst"+(round.state==="warEnded"?" · API-Ergebnis":"")+"</div>"+
      "<details class='cwl-live-details'><summary>Spieler und Angriffe anzeigen</summary>"+
      (players||"<div class='statusline'>Aufstellung noch nicht verfügbar.</div>")+"</details>";
    dayCard.querySelector(".day-head")?.after(section);
  }
  function render() {
    const ctx=context(),view=document.getElementById("view-plan");
    const old=document.getElementById("cwlLiveOverview");
    const button=document.getElementById("cwlLiveRefresh");
    if(!ctx.active || !ctx.clanId || !view){
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
    if(!ctx.active||!ctx.clanId||!navigator.onLine||fetching)return;
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
    render();
  }
  function start(){
    stop();const ctx=context();
    if(!ctx.active||!ctx.clanId)return;
    activeClan=ctx.clanId;
    refreshNow();
    interval=setInterval(()=>{if(!document.hidden&&navigator.onLine)refreshNow()},300000);
  }
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden&&context().active)refreshNow();
  });
  return {start,stop,render,refresh:()=>refreshNow(true)};
}
