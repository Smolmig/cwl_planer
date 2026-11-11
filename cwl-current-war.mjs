// Normal Clan War dashboard on Plan, separate from CWL planning data.
// Only confirmed fields from the clan-scoped Clash API; no penalties or writes.
import {safeBadgeUrl,clashTime} from "./cwl-live-core.mjs?v=1.16.61";
import {summarizeNormalWar} from "./cwl-normal-war-core.mjs?v=1.16.61";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pct=n=>typeof n==="number"&&Number.isFinite(n)?
 n.toLocaleString("de-AT",{maximumFractionDigits:1})+" %":"–";
const badge=side=>{
 const url=safeBadgeUrl(side?.badgeUrl);
 return url?'<img class="cw-now-badge" src="'+esc(url)+'" alt="Wappen von '+
  esc(side?.name||"Clan")+'" loading="lazy" referrerpolicy="no-referrer">':
  '<span class="cw-now-shield" aria-hidden="true">🛡️</span>';
};
const dateText=s=>{
 const time=clashTime(s);
 return Number.isFinite(time)?new Date(time).toLocaleString("de-AT",{
  day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"Noch unbekannt";
};
const timeLeft=ms=>{
 if(ms===null)return "";
 const mins=Math.ceil(ms/60000);
 return mins>=1440?"Noch "+Math.ceil(mins/1440)+" Tage":
  mins>=60?"Noch "+Math.floor(mins/60)+" Std. "+(mins%60)+" Min.":
  "Noch "+mins+" Min.";
};
const stars=a=>Number.isInteger(a?.stars)?"★".repeat(a.stars)+
 "☆".repeat(3-a.stars):"–";
const score=side=>Number.isInteger(side?.stars)?side.stars:"–";
const formatAttack=(a,showOrder=false)=>{
 const order=showOrder&&a.order!==null?'<small class="cw-now-order">#'+a.order+'</small>':"";
 const differential=a.attackerTH!==null&&a.defenderTH!==null?
  "RH "+a.attackerTH+" → RH "+a.defenderTH:"";
 return '<div class="cw-now-attack">'+
   '<span class="cw-now-attack-names">'+order+'<strong>'+esc(a.attackerName)+
   '</strong><small>gegen '+esc(a.defenderName)+
   (differential?" · "+esc(differential):"")+'</small></span>'+
   '<span class="cw-now-attack-result"><strong>'+stars(a)+'</strong>'+
   '<small>'+pct(a.destruction)+
   (a.duration!==null?" · "+Math.floor(a.duration/60)+":"+
     String(a.duration%60).padStart(2,"0")+" Min.":"")+'</small></span></div>';
};
const groupBoard=(group,sideLabel,capacity)=>'<div class="cw-now-team-metric">'+
 '<span>'+esc(sideLabel)+'</span><strong>'+group.used+'/'+capacity+
 '</strong><small>Angriffe</small>'+
 (group.destruction!==null?'<span>'+pct(group.destruction)+' Zerstörung</span>':"")+'</div>';
const percentAsBar=(used,max)=>max>0?Math.min(100,100*used/max):0;
const rank=(a,b)=>b.stars-a.stars||b.destruction-a.destruction||
 a.attackerName.localeCompare(b.attackerName);
const roster=(group,enemy,per,state)=>{
 const records=new Map(group.attacks.map(a=>[a.attackerTag,[]]));
 for(const a of group.attacks)records.get(a.attackerTag).push(a);
 const opponentByBase=new Map(enemy.attacks.map(a=>[a.defenderTag,[]]));
 for(const a of enemy.attacks)opponentByBase.get(a.defenderTag).push(a);
 const sorted=[...group.members].sort((a,b)=>
  (a.mapPosition||99)-(b.mapPosition||99)||
  String(a.name||"").localeCompare(String(b.name||"")));
 if(!sorted.length)return '<p class="cw-now-empty">Aufstellung von Clash noch nicht verfügbar.</p>';
 return '<div class="cw-now-roster">'+sorted.map(m=>{
  const own=records.get(m.tag)||[],against=opponentByBase.get(m.tag)||[];
  const used=own.length;const best=against.sort(rank)[0];
  const defense=state==="preparation"?"Vorbereitungsphase":
   best?"Bester Angriff des Gegners: "+best.stars+"★ · "+pct(best.destruction):
   "Noch kein gegnerischer Angriff auf diese Basis erfasst";
  return '<div class="cw-now-roster-row">'+
   '<span class="cw-now-roster-player"><small>'+(m.mapPosition?"#"+m.mapPosition:"–")+
   ' · RH '+esc(m.townHallLevel??"?")+'</small><strong>'+
   esc(m.name||m.tag)+'</strong></span>'+
   '<span class="cw-now-roster-results"><strong>'+used+'/'+per+
   ' Angriffe</strong><small>'+esc(defense)+'</small></span></div>';
 }).join("")+'</div>';
};
export function createCurrentWarOverview({context,refresh}){
 const host=document.getElementById("currentWarCard");
 const content=document.getElementById("currentWarContent");
 const button=document.getElementById("currentWarRefresh");
 const page=document.getElementById("view-plan");
 const overview=document.getElementById("planOverview");
 const recap=document.getElementById("planCwlPostseason");
 if(!host||!content)return {update(){},reset(){},getState(){return null}};
 let activeTab="overview",warState=null,lastWarKey=null;
 const tabs=["overview","attacks","rosters"];
 const names={overview:"Überblick",attacks:"Angriffe",rosters:"Aufstellungen"};
 function switchTab(tab,focus=false){
  if(!tabs.includes(tab))return;
  activeTab=tab;
  for(const t of tabs){
   const selected=t===tab;
   const button=content.querySelector('[data-cw-tab="'+t+'"]');
   if(button){
    button.classList.toggle("active",selected);
    button.setAttribute("aria-selected",String(selected));
    button.tabIndex=selected?0:-1;
    if(selected&&focus)button.focus({preventScroll:true});
   }
   const panel=content.querySelector('[data-cw-panel="'+t+'"]');
   if(panel)panel.hidden=!selected;
  }
 }
 function reset(){
  host.hidden=true;host.classList.remove("cw-now-featured");
  page?.classList.remove("plan-cw-live-mode");
  content.replaceChildren();warState=null;lastWarKey=null;
  delete host.dataset.warState;
  activeTab="overview";
 }
 content.addEventListener("click",event=>{
  const tab=event.target.closest("button[data-cw-tab]");
  if(tab)switchTab(tab.dataset.cwTab);
 });
 content.addEventListener("keydown",event=>{
  if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
  const tab=event.target.closest("button[data-cw-tab]");
  if(!tab)return;
  const i=tabs.indexOf(tab.dataset.cwTab);
  const next=event.key==="Home"?tabs[0]:event.key==="End"?tabs[2]:
   tabs[(i+(event.key==="ArrowRight"?1:2))%3];
  switchTab(next,true);event.preventDefault();
 });
 function update(payload){
  const ctx=context(),war=payload?.currentWar;
  if(!ctx.active||!ctx.clanId||!ctx.hasClanTag||!war||
   !["preparation","inWar","warEnded"].includes(war.state)){reset();return}
  const model=summarizeNormalWar(war);
  if(!model){reset();return}
  const previousDetails=[...content.querySelectorAll("details")].map(d=>({
   key:d.dataset.cwDetail,open:d.open
  }));
  const key=ctx.clanId+"|"+war.state+"|"+war.startTime+"|"+
   String(war.opponent?.tag||"");
  if(key!==lastWarKey){
   activeTab=war.state==="preparation"?"rosters":"overview";
   lastWarKey=key;
  }
  const live=war.state==="inWar"||war.state==="warEnded";
  const enteredWar=war.state==="inWar"&&warState!=="inWar";
  warState=war.state;
  host.dataset.warState=war.state;
  // The CW becomes the primary screen when the battle begins. The CWL
  // history remains accessible underneath, never removed or reset.
  if(enteredWar){
   const disclosure=recap?.querySelector(".plan-postseason-disclosure");
   if(disclosure)disclosure.open=false;
  }
  if(live&&page&&overview){
   page.insertBefore(host,overview);
  }else if(!live&&page&&recap){
   recap.insertAdjacentElement("afterend",host);
  }
  page?.classList.toggle("plan-cw-live-mode",live);
  host.classList.toggle("cw-now-featured",live);
  const g=model.groups,our=g[0],enemy=g[1];
  const stateLabel=war.state==="preparation"?"Vorbereitung":
   war.state==="inWar"?"Krieg läuft":"Krieg beendet";
  const timing=war.state==="preparation"?
   "Kriegsbeginn: "+dateText(war.startTime):
   war.state==="inWar"?"Kriegsende: "+dateText(war.endTime):
   "Beendet am "+dateText(war.endTime);
  const badgeState='<span class="cw-now-phase">'+stateLabel+'</span>';
  const heading=host.querySelector(".section-title h3");
  if(heading)heading.textContent=war.state==="preparation"?
   "Nächster Clankrieg":war.state==="inWar"?"Clankrieg live":"Letzter Clankrieg";
  const helper=host.querySelector(".section-title .statusline");
  if(helper)helper.textContent=war.state==="preparation"?
   "Die Teams stehen fest. Sobald der Krieg beginnt, erscheinen hier die Angriffe.":
   war.state==="inWar"?"Punktestand und Angriffe aus Clash":
   "Endergebnis und Angriffe aus Clash";
  const ourAttackData=model.ourAttacks,enemyAttackData=model.enemyAttacks;
  const recent=ourAttackData.slice(0,4);
  const leaders=[...ourAttackData].sort(rank).slice(0,3);
  const lastTitle=ourAttackData.some(a=>a.order!==null)?
   "Neueste erfasste Angriffe":"Angriffe unseres Clans";
  const note='<p class="cw-now-fineprint">Die Zahlen entsprechen den zuletzt verfügbaren Clash-Daten. '+
   'Ein nicht aufgezeichneter Angriff ist nicht automatisch versäumt.</p>';
  const overviewPanel='<div class="cw-now-panel-content">'+
   (model.isPreparation?
    '<p class="cw-now-lead">Die Vorbereitung läuft. Schau dir schon jetzt die Aufstellungen an.</p>':
    '<div class="cw-now-kpis">'+
      '<div><strong>'+model.ownThreeStars+'</strong><span>3-Sterne-Angriffe</span></div>'+
      '<div><strong>'+pct(model.ownAverage)+'</strong><span>Ø Zerstörung je Angriff</span></div>'+
      '<div><strong>'+model.ownOpen+'</strong><span>Noch verfügbare Angriffe</span></div>'+
    '</div>')+
   (model.isPreparation?"":'<div class="cw-now-highlights">'+
    '<section class="cw-now-highlight"><h4>'+lastTitle+'</h4>'+
    (recent.length?recent.map(a=>formatAttack(a,true)).join(""):
     '<p class="cw-now-empty">Noch kein eigener Angriff erfasst.</p>')+'</section>'+
    '<section class="cw-now-highlight"><h4>Stärkste Angriffe '+
    '<abbr title="Eigene Auswertung nach Sternen und Zerstörung. Clash liefert keine offizielle Wertung des heroischsten Angriffs.">ⓘ</abbr></h4>'+
    (leaders.length?leaders.map(a=>formatAttack(a)).join(""):
     '<p class="cw-now-empty">Sobald Angriffe vorliegen, erscheinen hier die besten Ergebnisse.</p>')+
    '</section></div>')+note+'</div>';
  const attacksPanel='<div class="cw-now-panel-content">'+
   '<div class="cw-now-dual-list"><section><h4>Unsere Angriffe · '+ourAttackData.length+'</h4>'+
   (ourAttackData.length?ourAttackData.map(a=>formatAttack(a,true)).join(""):
    '<p class="cw-now-empty">Noch keine Angriffe von uns verfügbar.</p>')+'</section>'+
   '<section><h4>Angriffe des Gegners · '+enemyAttackData.length+'</h4>'+
   (enemyAttackData.length?enemyAttackData.map(a=>formatAttack(a,true)).join(""):
    '<p class="cw-now-empty">Noch keine gegnerischen Angriffe verfügbar.</p>')+
   '</section></div>'+note+'</div>';
  const rostersPanel='<div class="cw-now-panel-content cw-now-rosters">'+
   '<details class="cw-now-details" data-cw-detail="own" open>'+
   '<summary>Unser Team · '+our.members.length+' Spieler</summary>'+
   roster(our,enemy,model.per,war.state)+'</details>'+
   '<details class="cw-now-details" data-cw-detail="enemy" open>'+
   '<summary>Gegnerteam · '+enemy.members.length+' Spieler</summary>'+
   roster(enemy,our,model.per,war.state)+'</details></div>';
  content.innerHTML=
   '<div class="cw-now-status">'+badgeState+
    '<span>'+esc(timing)+(model.remaining!==null?
     " · "+timeLeft(model.remaining):"")+'</span></div>'+
   '<div class="cw-now-head"><div class="cw-now-clan">'+badge(war.clan)+
   '<strong>'+esc(our.name)+'</strong></div>'+
   '<div class="cw-now-score" aria-label="Sterne '+score(our)+' zu '+score(enemy)+'">'+
   (model.isPreparation?"–":score(our))+
   ' <span>:</span> '+(model.isPreparation?"–":score(enemy))+
   '<small>★ Sterne</small></div>'+
   '<div class="cw-now-clan">'+badge(war.opponent)+
   '<strong>'+esc(enemy.name)+'</strong></div></div>'+
   '<div class="cw-now-score-foot"><span>Wir: '+pct(our.destruction)+'</span>'+
   '<span>Gegner: '+pct(enemy.destruction)+'</span></div>'+
   '<div class="cw-now-attack-progress">'+
   groupBoard(our,"Unser Clan",model.capacity)+
   '<div class="cw-now-progress-bars" aria-label="Angriffe genutzt">'+
   '<div class="cw-now-progress-row" aria-label="Unsere Angriffe genutzt">'+
   '<span style="width:'+percentAsBar(our.used,model.capacity)+'%"></span></div>'+
   '<div class="cw-now-progress-row foe" aria-label="Gegnerische Angriffe genutzt">'+
   '<span style="width:'+percentAsBar(enemy.used,model.capacity)+'%"></span></div></div>'+
   groupBoard(enemy,"Gegner",model.capacity)+'</div>'+
   '<div class="cw-now-tabs" role="tablist" aria-label="Clankrieg ansehen">'+
   tabs.map(t=>'<button type="button" role="tab" data-cw-tab="'+t+
   '" aria-controls="cwNowPanel-'+t+'" aria-selected="false">'+names[t]+'</button>').join("")+
   '</div>'+
   '<section id="cwNowPanel-overview" role="tabpanel" data-cw-panel="overview">'+
    overviewPanel+'</section>'+
   '<section id="cwNowPanel-attacks" role="tabpanel" data-cw-panel="attacks" hidden>'+
    attacksPanel+'</section>'+
   '<section id="cwNowPanel-rosters" role="tabpanel" data-cw-panel="rosters" hidden>'+
    rostersPanel+'</section>';
  for(const d of previousDetails){
   const node=content.querySelector('details[data-cw-detail="'+d.key+'"]');
   if(node)node.open=d.open;
  }
  switchTab(activeTab);
  content.querySelectorAll("img.cw-now-badge").forEach(img=>
   img.addEventListener("error",()=>{
    const fallback=document.createElement("span");
    fallback.className="cw-now-shield";
    fallback.setAttribute("aria-hidden","true");fallback.textContent="🛡️";
    img.replaceWith(fallback);
   },{once:true})
  );
  host.hidden=false;
 }
 button?.addEventListener("click",()=>{if(context().active)refresh?.()});
 return {update,reset,getState:()=>warState};
}
