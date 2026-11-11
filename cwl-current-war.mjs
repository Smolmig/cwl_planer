// Live normal Clan War on the Cloud Plan page. Read-only; Cloud clan scope
// and permissions are enforced by the existing authenticated Edge proxy.
import {safeBadgeUrl,clashTime} from "./cwl-live-core.mjs?v=1.16.60";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const star=n=>Number.isInteger(n)&&n>=0&&n<=150?String(n):"–";
const badge=side=>{
 const url=safeBadgeUrl(side?.badgeUrl);
 return url?'<img class="cw-now-badge" src="'+esc(url)+'" alt="Wappen von '+esc(side?.name||"Clan")+'" loading="lazy" referrerpolicy="no-referrer">':
  '<span class="cw-now-shield" aria-hidden="true">🛡️</span>';
};
const formatPct=p=>typeof p==="number"&&Number.isFinite(p)&&p>=0&&p<=100?
 p.toLocaleString("de-AT",{maximumFractionDigits:2})+" %":"–";
const dateText=s=>{
 const time=clashTime(s);
 return Number.isFinite(time)?new Date(time).toLocaleString("de-AT",{
  day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"Noch unbekannt";
};
const states={preparation:"Vorbereitung",inWar:"Kampftag",warEnded:"Beendet"};
const details=(members,targets,per,label,state)=>{
 const targetMap=new Map(targets.filter(m=>m?.tag).map(m=>[m.tag,m]));
 const sorted=[...members].sort((a,b)=>
   (a.mapPosition??999)-(b.mapPosition??999));
 return '<details class="cw-now-details" open><summary>'+esc(label)+
  ' · '+members.reduce((n,m)=>n+(m.attacks?.length||0),0)+
  ' erfasste Angriffe</summary><div class="cw-now-roster">'+
  (sorted.length?sorted.map(m=>{
   const used=Array.isArray(m.attacks)?m.attacks:[];
   const score=used.map(a=>{
     const opponent=targetMap.get(a.defenderTag);
     const stars=Number.isInteger(a.stars)&&a.stars>=0&&a.stars<=3?
       "★".repeat(a.stars)+"☆".repeat(3-a.stars):"–";
     const targetPosition=Number.isInteger(opponent?.mapPosition)?
       "#"+opponent.mapPosition+" · ":"";
     return '<span class="cw-now-hit"><b>'+esc(stars)+'</b> '+
       esc(targetPosition+(opponent?.name||"Ziel unbekannt"))+
       ' · '+formatPct(a.destructionPercentage)+'</span>';
   }).join("");
   const position=Number.isInteger(m.mapPosition)?"#"+m.mapPosition+" · ":"";
   return '<div class="cw-now-player"><span><strong>'+esc(position+(m.name||m.tag))+
    '</strong><small>RH '+esc(m.townHallLevel??"?")+'</small></span>'+
    '<span class="cw-now-player-stats">'+used.length+"/"+per+" Angriffe"+
    (score?'<span class="cw-now-hits">'+score+'</span>':
      '<span class="cw-now-none">'+(state==="preparation"?
        "Noch in Vorbereitung":"Kein Angriff erfasst")+'</span>')+
    '</span></div>';
  }).join(""):'<p class="statusline">Clash hat noch keine vollständige Aufstellung freigegeben.</p>')+
  '</div></details>';
};
const collectAttacks=(members,targets,team)=>{
 const targetMap=new Map(targets.filter(m=>m?.tag).map(m=>[m.tag,m]));
 return members.flatMap(member=>(Array.isArray(member.attacks)?member.attacks:[]).map((hit,index)=>({
  team,attacker:member.name||member.tag||"Spieler",
  attackerTH:member.townHallLevel,defender:targetMap.get(hit.defenderTag)?.name||"Unbekanntes Ziel",
  defenderTH:targetMap.get(hit.defenderTag)?.townHallLevel,
  stars:Number.isInteger(hit.stars)&&hit.stars>=0&&hit.stars<=3?hit.stars:null,
  destruction:typeof hit.destructionPercentage==="number"&&
   Number.isFinite(hit.destructionPercentage)?hit.destructionPercentage:null,
  order:Number.isInteger(hit.order)?hit.order:null,index
 })));
};
const attackItem=a=>{
 const th=Number.isInteger(a.attackerTH)&&Number.isInteger(a.defenderTH)?
  " · RH "+a.attackerTH+" → "+a.defenderTH:"";
 const grade=a.stars===null?"–":"★".repeat(a.stars)+"☆".repeat(3-a.stars);
 return '<div class="cw-now-attack"><span><strong>'+esc(a.attacker)+'</strong>'+
  '<small>'+esc(a.team)+" · gegen "+esc(a.defender)+esc(th)+'</small></span>'+
  '<span class="cw-now-attack-result"><b>'+esc(grade)+'</b><small>'+
  formatPct(a.destruction)+'</small></span></div>';
};
function moveWarInPlan(host,state){
 const view=document.getElementById("view-plan"),
   overview=document.getElementById("planOverview"),
   recap=document.getElementById("planCwlPostseason");
 if(!view||!overview||!recap||!view.contains(host)||
    !view.contains(recap))return;
 const outsideCwl=view.classList.contains("plan-postseason-mode")||
  view.classList.contains("plan-between-cwl-mode");
 view.classList.toggle("plan-cw-battle-mode",outsideCwl&&state==="inWar");
 if(!outsideCwl)return;
 // DOM order instead of CSS order keeps keyboard focus and VoiceOver
 // navigation aligned with the visual hierarchy. A live battle comes first;
 // preparation belongs after the previous CWL summary.
 if(state==="inWar"||state==="warEnded"){
  if(host.nextElementSibling!==recap||recap.nextElementSibling!==overview){
   view.insertBefore(recap,overview);
   view.insertBefore(host,recap);
  }
 }else if(recap.nextElementSibling!==host||host.nextElementSibling!==overview){
  view.insertBefore(host,overview);
  view.insertBefore(recap,host);
 }
}
export function createCurrentWarOverview({context,refresh}){
 const host=document.getElementById("currentWarCard");
 const content=document.getElementById("currentWarContent");
 const button=document.getElementById("currentWarRefresh");
 if(!host||!content)return {update(){},reset(){}};
 let lastWar="",lastHTML="",selectedTab="activity";
 const setTab=(tab,focus=false)=>{
  if(!["activity","ours","enemy"].includes(tab))return;
  selectedTab=tab;
  for(const node of content.querySelectorAll("[data-cw-tab]")){
   const active=node.dataset.cwTab===tab;
   node.setAttribute("aria-selected",String(active));node.tabIndex=active?0:-1;
   if(active&&focus)node.focus({preventScroll:true});
  }
  for(const node of content.querySelectorAll(".cw-now-panel"))
   node.hidden=node.dataset.cwPanel!==tab;
 };
 function reset(){
  host.hidden=true;content.replaceChildren();lastHTML="";lastWar="";
  document.getElementById("view-plan")?.classList.remove("plan-cw-battle-mode");
 }
 function update(payload){
  const ctx=context(),war=payload?.currentWar;
  if(!ctx.active||!ctx.clanId||!ctx.hasClanTag||!war||
   !["preparation","inWar","warEnded"].includes(war.state)){reset();return}
  const identity=String(ctx.clanId)+"|"+String(war.startTime||"")+"|"+
   String(war.endTime||"")+"|"+String(war.clan?.tag||"");
  if(identity!==lastWar){selectedTab="activity";lastWar=identity}
  moveWarInPlan(host,war.state);
  const own=war.clan||{},enemy=war.opponent||{},
    size=Number.isInteger(war.teamSize)?war.teamSize:0,
    per=[1,2].includes(war.attacksPerMember)?war.attacksPerMember:2,
    ours=Array.isArray(own.members)?own.members:[],
    theirs=Array.isArray(enemy.members)?enemy.members:[];
  const count=players=>players.reduce((n,m)=>n+(Array.isArray(m.attacks)?m.attacks.length:0),0);
  const oursUsed=count(ours),enemyUsed=count(theirs),
    attackMax=size*per,
    ownAttacks=collectAttacks(ours,theirs,"Unser Clan"),
    enemyAttacks=collectAttacks(theirs,ours,"Gegner");
  const all=[...ownAttacks,...enemyAttacks],
    ordered=all.every(a=>a.order!==null),
    latest=[...all].sort((a,b)=>ordered?b.order-a.order:0).slice(0,8),
    strongest=[...ownAttacks].sort((a,b)=>
      (b.stars??-1)-(a.stars??-1)||
      (b.destruction??-1)-(a.destruction??-1)).slice(0,3);
  const header=host.querySelector("h3");
  if(header)header.textContent=war.state==="preparation"?"Nächster Clankrieg":
    war.state==="inWar"?"Clankrieg läuft":"Clankrieg beendet";
  const note=host.querySelector(".section-title .statusline");
  if(note)note.textContent=war.state==="preparation"?
    "Vorbereitung · die Teams stehen vor dem Kampf noch nicht endgültig fest":
    war.state==="inWar"?"Aktueller Stand aus Clash of Clans":
      "Ergebnis aus Clash of Clans";
  const time=war.state==="preparation"?war.startTime:war.endTime;
  const metric=(name,side,players,used)=>
   '<div class="cw-now-metric"><small>'+name+'</small><b>'+
   formatPct(side?.destructionPercentage)+'</b><span>'+
   used+"/"+attackMax+' Angriffe erfasst</span></div>';
  const overview='<div class="cw-now-status">'+
    '<span class="cw-now-state">'+esc(states[war.state])+'</span>'+
    '<span>'+size+" gegen "+size+'</span><span>'+
     (war.state==="preparation"?"Start":war.state==="warEnded"?"Ende":"Noch bis")+
     " "+esc(dateText(time))+'</span></div>'+
   '<div class="cw-now-head"><div class="cw-now-clan">'+badge(own)+
   '<strong>'+esc(own.name||"Unser Clan")+'</strong></div>'+
   '<div class="cw-now-score" aria-label="Kriegssterne '+star(own.stars)+
   " zu "+star(enemy.stars)+'">'+star(own.stars)+
   ' <span>:</span> '+star(enemy.stars)+'<small>★ Sterne</small></div>'+
   '<div class="cw-now-clan">'+badge(enemy)+
   '<strong>'+esc(enemy.name||"Gegner")+'</strong></div></div>'+
   '<div class="cw-now-meta">'+
    '<span>Wir: '+oursUsed+"/"+attackMax+" Angriffe</span>"+
    '<span>Gegner: '+enemyUsed+"/"+attackMax+" Angriffe</span></div>"+
   '<div class="cw-now-metrics">'+metric("Unsere Zerstörung",own,ours,oursUsed)+
     metric("Gegnerische Zerstörung",enemy,theirs,enemyUsed)+'</div>';
  const hint='<details class="cw-now-hint"><summary>ⓘ Was bedeuten die Zahlen?</summary>'+
    '<p>Sterne und Zerstörung entscheiden über den Krieg. Gezählt werden die bisher '+
    'von Clash übertragenen Angriffe; offene Angriffe sind während des Kampftags '+
    'nicht automatisch vergessen. „Beste Angriffe“ ist eine sortierte Übersicht, '+
    'nicht die offizielle Auszeichnung „Heroischster Angriff“ aus dem Spiel.</p></details>';
  const nav='<div class="cw-now-tabs" role="tablist" aria-label="Clankrieg-Details">'+
    [["activity","Angriffe"],["ours","Unser Team"],["enemy","Gegner"]].map(([id,label])=>
    '<button type="button" role="tab" data-cw-tab="'+id+'" '+
    'aria-selected="'+(id===selectedTab?"true":"false")+
    '" tabindex="'+(id===selectedTab?"0":"-1")+'">'+label+'</button>').join("")+
    '</div>';
  const recent=latest.length?
   '<div class="cw-now-subtitle">'+(ordered?"Letzte Angriffe":"Erfasste Angriffe")+'</div>'+
    latest.map(attackItem).join(""):
   '<p class="statusline">'+(war.state==="preparation"?
    "Die Angriffe beginnen mit dem Kampftag.":
    "Noch keine Angriffe von Clash übertragen.")+"</p>";
  const top=strongest.length?
   '<div class="cw-now-subtitle">Beste Angriffe unseres Clans <small>nach Sternen &amp; Zerstörung</small></div>'+
   strongest.map(attackItem).join(""):"";
  const activity='<div class="cw-now-panel" data-cw-panel="activity" role="tabpanel">'+
   (top?top:'')+recent+'</div>';
  const teams='<div class="cw-now-panel" data-cw-panel="ours" role="tabpanel" hidden>'+
   details(ours,theirs,per,"Unser Team",war.state)+'</div>'+
   '<div class="cw-now-panel" data-cw-panel="enemy" role="tabpanel" hidden>'+
   details(theirs,ours,per,"Gegnerteam",war.state)+'</div>';
  const rendered=overview+nav+activity+teams+hint;
  if(rendered!==lastHTML){
   const oldFocused=content.querySelector('[data-cw-tab][aria-selected="true"]');
   const focused=oldFocused===document.activeElement;
   content.innerHTML=rendered;
   for(const tab of content.querySelectorAll("[data-cw-tab]")){
    tab.addEventListener("click",()=>setTab(tab.dataset.cwTab));
    tab.addEventListener("keydown",event=>{
     if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
     const tabs=["activity","ours","enemy"],index=tabs.indexOf(tab.dataset.cwTab);
     const next=event.key==="Home"?0:event.key==="End"?2:
      (index+(event.key==="ArrowRight"?1:2))%3;
     setTab(tabs[next],true);event.preventDefault();
    });
   }
   setTab(selectedTab,focused);
   for(const img of content.querySelectorAll("img.cw-now-badge")){
    img.addEventListener("error",()=>{
      const fallback=document.createElement("span");
      fallback.className="cw-now-shield";fallback.setAttribute("aria-hidden","true");
      fallback.textContent="🛡️";img.replaceWith(fallback);
    },{once:true});
   }
   lastHTML=rendered;
  }
  host.hidden=false;
 }
 button?.addEventListener("click",()=>{if(context().active)refresh?.()});
 return {update,reset};
}
