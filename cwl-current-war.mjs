// Current normal Clan War, shown only in the existing Cloud Overview.
// Read-only data from the authenticated, clan-scoped proxy.
import {safeBadgeUrl,clashTime} from "./cwl-live-core.mjs?v=1.3.6";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const star=n=>Number.isInteger(n)?String(n):"–";
const badge=side=>{
  const url=safeBadgeUrl(side?.badgeUrl);
  return url?'<img class="cw-now-badge" src="'+esc(url)+'" alt="Wappen von '+esc(side?.name||"Clan")+'" loading="lazy" referrerpolicy="no-referrer">':
   '<span class="cw-now-shield" aria-hidden="true">🛡️</span>';
};
const dateText=s=>{
  const time=clashTime(s);
  return Number.isFinite(time)?new Date(time).toLocaleString("de-AT",{
    day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"Noch unbekannt";
};
const states={preparation:"Vorbereitung",inWar:"Kampftag",warEnded:"Beendet"};
export function createCurrentWarOverview({context,refresh}){
 const host=document.getElementById("currentWarCard");
 const content=document.getElementById("currentWarContent");
 const button=document.getElementById("currentWarRefresh");
 if(!host||!content)return {update(){},reset(){}};
 function reset(){host.hidden=true;content.replaceChildren()}
 function update(payload){
  const ctx=context(),war=payload?.currentWar;
  if(!ctx.active||!ctx.clanId||!ctx.hasClanTag||!war||
    !["preparation","inWar","warEnded"].includes(war.state)){reset();return}
  const own=war.clan||{},enemy=war.opponent||{};
  const members=Array.isArray(own.members)?own.members:[];
  const size=Number.isInteger(war.teamSize)?war.teamSize:members.length;
  const per=war.attacksPerMember===1?1:2;
  const used=members.reduce((n,m)=>n+(Array.isArray(m.attacks)?m.attacks.length:0),0);
  const possible=size*per;
  const targets=new Map((enemy.members||[]).map(m=>[m.tag,m]));
  const items=members.map(m=>{
    const attacks=Array.isArray(m.attacks)?m.attacks:[];
    const results=attacks.map(a=>{
      const t=targets.get(a.defenderTag);
      const score=Number.isInteger(a.stars)?Math.max(0,Math.min(3,a.stars)):0;
      return '<span class="cw-now-stars">'+"★".repeat(score)+"☆".repeat(3-score)+
        '</span><span>'+esc(t?.name||"Ziel unbekannt")+'</span>';
    }).join(" · ");
    return '<div class="cw-now-player"><span>'+esc(m.name||m.tag)+
      ' <small>RH'+esc(m.townHallLevel??"?")+'</small></span><span>'+
      attacks.length+"/"+per+(results?" · "+results:" · Noch kein Angriff")+'</span></div>';
  }).join("");
  content.innerHTML='<div class="cw-now-head"><div class="cw-now-clan">'+badge(own)+
    '<strong>'+esc(own.name||"Unser Clan")+'</strong></div>'+
    '<div class="cw-now-score" aria-label="Kriegssterne '+star(own.stars)+' zu '+star(enemy.stars)+'">'+
    star(own.stars)+' <span>:</span> '+star(enemy.stars)+'<small>★ Sterne</small></div>'+
    '<div class="cw-now-clan">'+badge(enemy)+'<strong>'+esc(enemy.name||"Gegner")+'</strong></div></div>'+
    '<div class="cw-now-meta"><span>'+esc(states[war.state])+' · '+size+' gegen '+size+'</span>'+
    '<span>'+(war.state==="warEnded"?"Beendet":war.state==="preparation"?"Beginn":"Ende")+': '+
      esc(dateText(war.state==="preparation"?war.startTime:war.endTime))+'</span>'+
    '<span>'+used+' von '+possible+' Angriffen · '+Math.max(0,possible-used)+' offen</span></div>'+
    '<details class="cw-now-details"><summary>Angriffe der Spieler anzeigen</summary>'+
      (items||"<p>Noch keine Aufstellung verfügbar.</p>")+'</details>';
  content.querySelectorAll("img.cw-now-badge").forEach(img=>img.addEventListener("error",()=>{
    const fallback=document.createElement("span");fallback.className="cw-now-shield";
    fallback.setAttribute("aria-hidden","true");fallback.textContent="🛡️";
    img.replaceWith(fallback);
  },{once:true}));
  host.hidden=false;
 }
 button?.addEventListener("click",()=>{if(context().active)refresh?.()});
 return {update,reset};
}
