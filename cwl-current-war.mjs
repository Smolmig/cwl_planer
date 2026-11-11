// Current normal Clan War on the Cloud Plan page.
// No guesses about the game's "heroic" award: Top-Angriff is a transparent
// local comparison of the actual stars and damage that Supercell exposes.
import {safeBadgeUrl,clashTime} from "./cwl-live-core.mjs?v=1.16.62";
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));
const stars=n=>Number.isInteger(n)&&n>=0&&n<=150?String(n):"–";
const percentage=value=>typeof value==="number"&&Number.isFinite(value)&&
 value>=0&&value<=100?value.toLocaleString("de-AT",{maximumFractionDigits:2})+" %":"–";
const badges=side=>{
 const url=safeBadgeUrl(side?.badgeUrl);
 return url?'<img class="cw-now-badge" src="'+esc(url)+
  '" alt="Clanwappen von '+esc(side?.name||"Clan")+
  '" loading="lazy" referrerpolicy="no-referrer">':
  '<span class="cw-now-shield" aria-hidden="true">🛡️</span>';
};
const dateText=value=>{
 const time=clashTime(value);
 return Number.isFinite(time)?new Date(time).toLocaleString("de-AT",{
  day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"Noch unbekannt";
};
const states={preparation:"Vorbereitung",inWar:"Kampftag läuft",warEnded:"Krieg beendet"};
const validAttack=a=>a&&Number.isInteger(a.stars)&&a.stars>=0&&a.stars<=3&&
 typeof a.destructionPercentage==="number"&&Number.isFinite(a.destructionPercentage)&&
 a.destructionPercentage>=0&&a.destructionPercentage<=100;
// Keep both attacks grouped under their player. Clash's global order determines
// which was first; if order is absent, preserve the server's given order.
const orderedMemberAttacks=attacks=>{
 if(!Array.isArray(attacks))return [];
 const rows=[...attacks];
 return rows.every(a=>Number.isInteger(a?.order)&&a.order>0)?
  rows.sort((a,b)=>a.order-b.order):rows;
};
const durationText=seconds=>Number.isInteger(seconds)&&seconds>=0&&seconds<=600?
 Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0")+" Min.":null;
export function summarizeCurrentWar(war) {
 if(!war||!["preparation","inWar","warEnded"].includes(war.state))return null;
 const size=Number.isInteger(war.teamSize)&&war.teamSize>0&&war.teamSize<=50?
  war.teamSize:0;
 const per=Number.isInteger(war.attacksPerMember)&&
  war.attacksPerMember>=1&&war.attacksPerMember<=2?war.attacksPerMember:2;
 const sides=[war.clan||{},war.opponent||{}];
 const rosters=sides.map(side=>Array.isArray(side.members)?side.members:[]);
 const rows=rosters.map((members,i)=>{
  const targets=new Map(rosters[1-i].map(m=>[m.tag,m]));
  const attacks=members.flatMap(m=>(Array.isArray(m.attacks)?m.attacks:[])
   .filter(validAttack).map(a=>({
    ...a,attacker:m.name||m.tag,attackerTag:m.tag,attackerTH:m.townHallLevel,
    defender:targets.get(a.defenderTag)?.name||a.defenderTag||"Ziel unbekannt",
    defenderTH:targets.get(a.defenderTag)?.townHallLevel??null
   })));
  const used=members.reduce((count,m)=>count+(Array.isArray(m.attacks)?m.attacks.length:0),0);
  const completeRoster=!!size&&members.length===size&&
   new Set(members.map(m=>m.tag)).size===size;
  const threeStars=attacks.filter(a=>a.stars===3).length;
  const avgDestruction=attacks.length?
    attacks.reduce((sum,a)=>sum+a.destructionPercentage,0)/attacks.length:null;
  const rank=(a,b)=>b.stars-a.stars||
   b.destructionPercentage-a.destructionPercentage||
   ((b.defenderTH||0)-(b.attackerTH||0))-
   ((a.defenderTH||0)-(a.attackerTH||0));
  const top=[...attacks].sort(rank)[0]||null;
  return {members,attacks,used,possible:completeRoster?size*per:null,
   threeStars,avgDestruction,top,completeRoster};
 });
 const recent=rows.flatMap((side,i)=>side.attacks.map(a=>({
  ...a,side:i}))).filter(a=>Number.isInteger(a.order)&&a.order>=1)
  .sort((a,b)=>b.order-a.order).slice(0,6);
 return {size,per,clan:sides[0],opponent:sides[1],
  own:rows[0],enemy:rows[1],recent};
}
function kpi(name,value,description=""){
 return '<div class="cw-now-kpi"><small>'+esc(name)+'</small><strong>'+
  esc(value)+'</strong>'+(description?'<span>'+esc(description)+'</span>':'')+'</div>';
}
export function createCurrentWarOverview({context,refresh}){
 const host=document.getElementById("currentWarCard");
 const content=document.getElementById("currentWarContent");
 const button=document.getElementById("currentWarRefresh");
 if(!host||!content)return {update(){},reset(){}};
 function positionForWar(battle){
  const view=host.closest("#view-plan");
  if(!view)return;
  const recap=view.querySelector("#planCwlPostseason"),
   overview=view.querySelector("#planOverview");
  if(battle&&overview&&host.nextElementSibling!==overview)
   view.insertBefore(host,overview);
  else if(!battle&&recap&&recap.nextElementSibling!==host)
   recap.after(host);
  view.classList.toggle("plan-current-war-live",battle);
 }
 function reset(){
  host.hidden=true;content.replaceChildren();host.dataset.warKey="";
  positionForWar(false);
 }
 function update(payload){
  const ctx=context(),war=payload?.currentWar;
  if(!ctx.active||!ctx.clanId||!ctx.hasClanTag||!war||
     !["preparation","inWar","warEnded"].includes(war.state)){reset();return}
  const summary=summarizeCurrentWar(war);
  if(!summary){reset();return}
  const battle=war.state==="inWar"||war.state==="warEnded";
  positionForWar(battle);
  const title=host.querySelector(".section-title h3");
  if(title)title.textContent=war.state==="inWar"?"Clankrieg live":
   war.state==="preparation"?"Nächster Clankrieg":"Letzter Clankrieg";
  const status=host.querySelector(".section-title .statusline");
  if(status)status.textContent=states[war.state]+
   " · "+(war.state==="preparation"?"Start ":"Ende ")+
   dateText(war.state==="preparation"?war.startTime:war.endTime);
  const warKey=ctx.clanId+"|"+(war.clan?.tag||"")+"|"+
   (war.opponent?.tag||"")+"|"+(war.startTime||"");
  const sameWar=host.dataset.warKey===warKey;
  const open=new Set(sameWar?[...content.querySelectorAll(".cw-now-details")]
    .filter(el=>el.open).map(el=>el.dataset.team):[]);
  const focused=sameWar&&content.contains(document.activeElement)?
   document.activeElement.closest(".cw-now-details")?.dataset.team:null;
  const own=summary.own,enemy=summary.enemy;
  const countText=side=>side.possible===null?
   side.used+" Angriffe erfasst":side.used+"/"+side.possible+" Angriffe";
  const headline='<div class="cw-now-head"><div class="cw-now-clan">'+
   badges(summary.clan)+'<strong>'+esc(summary.clan.name||"Unser Clan")+
   '</strong></div><div class="cw-now-score" aria-label="Kriegssterne '+
   stars(summary.clan.stars)+' zu '+stars(summary.opponent.stars)+'">'+
   (war.state==="preparation"?"–":stars(summary.clan.stars))+
   ' <span>:</span> '+
   (war.state==="preparation"?"–":stars(summary.opponent.stars))+
   '<small>★ Sterne</small></div><div class="cw-now-clan">'+
   badges(summary.opponent)+'<strong>'+esc(summary.opponent.name||"Gegner")+
   '</strong></div></div>';
  const metrics='<div class="cw-now-kpis">'+
   kpi("Unsere Angriffe",war.state==="preparation"?"–":countText(own),
     war.state==="preparation"?"Vorbereitung":"")+
   kpi("Gegnerische Angriffe",war.state==="preparation"?"–":countText(enemy))+
   kpi("Unsere Zerstörung",war.state==="preparation"?"–":
     percentage(summary.clan.destructionPercentage))+
   kpi("Zerstörung Gegner",war.state==="preparation"?"–":
     percentage(summary.opponent.destructionPercentage))+'</div>';
  const attackLine=a=>'<span class="cw-now-stars">'+
   "★".repeat(a.stars)+"☆".repeat(3-a.stars)+'</span> · '+
   esc(a.attacker)+' → '+esc(a.defender)+' · '+
   percentage(a.destructionPercentage)+
   (durationText(a.duration)?' · '+durationText(a.duration):'');
  const highlight=war.state!=="preparation"?
   '<div class="cw-now-highlights">'+
    kpi("3-Sterne-Angriffe",String(own.threeStars),
      own.attacks.length?"aus "+own.attacks.length+" dokumentierten Angriffen":"")+
    kpi("Ø Zerstörung pro Angriff",
      own.avgDestruction===null?"–":percentage(own.avgDestruction))+
    '<div class="cw-now-top"><small>Top-Angriff</small><strong>'+
      (own.top?attackLine(own.top):"Noch kein Angriff erfasst")+'</strong></div>'+
    '</div>':"";
  const playerDetails=(side,targetSide,label,key)=>{
   const targets=new Map(targetSide.members.map(m=>[m.tag,m]));
   const members=[...side.members].sort((a,b)=>
    (Number.isInteger(a.mapPosition)?a.mapPosition:999)-
    (Number.isInteger(b.mapPosition)?b.mapPosition:999));
   const entries=members.map(m=>{
    const attacks=orderedMemberAttacks(m.attacks);
    const results=attacks.map((a,index)=>{
     const target=targets.get(a.defenderTag);
     const values=validAttack(a)?
      '<span class="cw-now-stars">'+
      "★".repeat(a.stars)+"☆".repeat(3-a.stars)+'</span> · '+
      percentage(a.destructionPercentage):"Ergebnis noch offen";
     return '<div class="cw-now-attack"><span class="cw-now-attack-label">'+
      (index+1)+'. Angriff</span> · '+values+' gegen '+
      esc(target?.name||a.defenderTag||"Ziel unbekannt")+'</div>';
    }).join("");
    return '<div class="cw-now-player"><span class="cw-now-player-name">'+
     (Number.isInteger(m.mapPosition)?'<small>#'+m.mapPosition+' · </small>':"")+
     '<strong>'+esc(m.name||m.tag)+'</strong> <small>RH '+
     esc(m.townHallLevel??"–")+'</small></span><span>'+
     attacks.length+'/'+summary.per+' Angriffe'+
     (results?'<div>'+results+'</div>':
      '<small>'+(war.state==="preparation"?"Noch in Vorbereitung":
       "Noch kein Angriff erfasst")+'</small>')+'</span></div>';
   }).join("");
   return '<details class="cw-now-details" data-team="'+key+'"><summary>'+
    esc(label)+' · '+(side.possible===null?side.used+" Angriffe":
      side.used+"/"+side.possible+" Angriffe")+'</summary>'+
    (entries||'<p>Aufstellung noch nicht von Clash verfügbar.</p>')+
    '</details>';
  };
  const events=war.state!=="preparation"&&summary.recent.length?
   '<details class="cw-now-details cw-now-events" data-team="events">'+
    '<summary>Letzte Angriffe · '+summary.recent.length+'</summary>'+
    '<ol class="cw-now-event-list">'+summary.recent.map(a=>
     '<li><small>'+(a.side===0?"Wir":"Gegner")+' · #'+a.order+'</small> '+
      attackLine(a)+'</li>').join("")+'</ol></details>':"";
  const info='<details class="cw-now-info"><summary>Was bedeuten diese Werte?</summary>'+
   '<p>Sterne und Gesamtzerstörung bestimmen den Kriegsstand. Bei gleichen Sternen '+
   'entscheidet die Gesamtzerstörung. Die Ø Zerstörung bezieht sich auf '+
   'unsere dokumentierten Einzelangriffe, nicht auf den Kriegsstand. '+
   '„Top-Angriff“ ist unsere Rangfolge nach Sternen und Schaden, '+
   'keine offizielle Auszeichnung aus Clash. Die einzelnen Angriffe je Spieler '+
   'erscheinen, sobald Clash sie meldet. Ein noch fehlender Eintrag beweist '+
   'keinen verpassten Angriff. Während des Kampfes ändern sich die Werte.</p>'+
   '</details>';
  content.innerHTML=headline+metrics+highlight+events+
   playerDetails(own,enemy,"Unser Team","own")+
   playerDetails(enemy,own,"Gegner","enemy")+info;
  content.querySelectorAll(".cw-now-details").forEach(node=>{
   if(open.has(node.dataset.team))node.open=true;
  });
  if(focused)content.querySelector('.cw-now-details[data-team="'+focused+'"] summary')
   ?.focus({preventScroll:true});
  content.querySelectorAll("img.cw-now-badge").forEach(img=>
   img.addEventListener("error",()=>{
    const fallback=document.createElement("span");
    fallback.className="cw-now-shield";fallback.setAttribute("aria-hidden","true");
    fallback.textContent="🛡️";img.replaceWith(fallback);
   },{once:true}));
  host.dataset.warKey=warKey;
  host.hidden=false;
 }
 button?.addEventListener("click",()=>{if(context().active)refresh?.()});
 return {update,reset};
}
