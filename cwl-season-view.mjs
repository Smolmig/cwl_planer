// CWL season overview: a read-only companion to the operational day planner.
// Group standings and all pairings come from the verified group feed.
// No missing scores are ever interpreted as a valid zero.
import {summarizeCwlSeason} from "./cwl-season-core.mjs?v=1.18.0";
import {safeBadgeUrl} from "./cwl-live-core.mjs?v=1.18.0";
import {summarizeCwlGroup} from "./cwl-group-core.mjs?v=1.18.0";
const $=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,k=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[k]));
const stars=x=>x===null||x===undefined?"–":String(x);
const badge=side=>{const src=safeBadgeUrl(side?.badgeUrl);
 return src?'<img class="season-badge" src="'+esc(src)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">':
 '<span class="season-badge-fallback" aria-hidden="true">◇</span>'};
const dateLabel=season=>{const [year,month]=String(season).split("-").map(Number);
 const date=new Date(Date.UTC(year,month-1,1));
 return Number.isFinite(date.valueOf())?date.toLocaleDateString("de-AT",{month:"long",year:"numeric",timeZone:"UTC"}):season};
const stateLabel=round=>round.state==="warEnded"?"Abgeschlossen":round.state==="inWar"?"Läuft":round.state==="preparation"?"Vorbereitung":"Noch offen";
const score=round=>round.state==="preparation"?"– : –":stars(round.own?.stars??round.clan?.stars)+" : "+stars(round.opponent?.stars);
export function viewGroup(s,g){
 if(g){
   const intro='<div class="season-info"><strong>'+(g.complete?"Gruppenergebnis":"Gruppenstand · vorläufig")+'</strong>'+
     '<p>'+g.ended+' von '+g.expected+' Kriegen beendet'+
     (g.missing?' · '+g.missing+' Paarungen noch nicht verfügbar':'')+
     '.</p><details class="season-explain"><summary>Wie wird die Tabelle gewertet?</summary>'+ '<p>Siege bringen zehn zusätzliche Sterne. Bei gleicher Sternzahl entscheidet die Gesamtzerstörung. Offene Kriege können die Reihenfolge noch verändern.</p></details></div>';
   const rows=g.clans.map(r=>'<tr'+(r.tag===g.clanTag?' class="season-own-clan"':'')+'>'+
     '<td><strong>'+r.position+'.</strong></td><td><span class="season-clan">'+badge(r)+
     '<strong>'+esc(r.name)+'</strong></span></td><td>'+r.wins+'</td><td><strong>'+r.stars+'</strong>'+
     (r.bonusStars?'<small>+ '+r.bonusStars+' Bonus</small>':'')+'</td>'+
     '<td>'+r.totalDestruction.toLocaleString("de-AT",{maximumFractionDigits:1})+'</td></tr>').join("");
   return intro+'<div class="season-group-scroll"><table class="season-group-table"><thead>'+
     '<tr><th>Platz</th><th>Clan</th><th>Siege</th><th>Sterne</th><th>Zerstörung Σ</th></tr></thead>'+
     '<tbody>'+rows+'</tbody></table></div>';
 }

 const intro='<div class="season-info"><strong>Unsere Gegner</strong><p>Unsere bisherigen Begegnungen.</p>'+ '<details class="season-explain"><summary>Warum fehlt die Tabelle?</summary>'+ '<p>Clash hat noch nicht alle Ergebnisse der Ligagruppe geliefert. Fehlende Plätze werden nicht geschätzt.</p></details></div>';
 const list=s.opponents.length?'<div class="season-opponents">'+s.opponents.map(p=>
   '<div class="season-opponent">'+badge(p)+'<span><strong>'+esc(p.name)+'</strong><small>Gegner in Runde '+p.day+'</small></span></div>').join("")+'</div>':
   '<p class="season-empty">Noch keine Gegner von Clash freigegeben.</p>';
 return intro+list;
}
export function viewRounds(s,g){
 if(g?.expected){
   return '<div class="season-info"><p>'+g.known+' von '+g.expected+
     ' Begegnungen verfügbar.</p></div>'+ 
     '<div class="season-rounds">'+g.rounds.map(round=>
       '<div class="season-round"><div class="season-round-heading"><strong>Runde '+round.day+'</strong>'+
       '<span class="season-state">'+round.matches.filter(m=>m.available).length+
       ' Paarungen bekannt</span></div>'+
       '<div class="season-group-matches">'+(round.matches.length?round.matches.map(match=>{
         if(!match.available)return '<div class="season-group-match season-missing">Ergebnis noch offen</div>';
         return '<div class="season-group-match'+
           (match.clan.tag===g.clanTag||match.opponent.tag===g.clanTag?' season-own-match':'')+'">'+
           '<span class="season-clan">'+badge(match.clan)+'<strong>'+esc(match.clan.name)+'</strong></span>'+
           '<span class="season-group-score"><b>'+score(match)+'</b>'+
           '<small>'+stateLabel(match)+'</small></span>'+
           '<span class="season-clan right">'+badge(match.opponent)+'<strong>'+esc(match.opponent.name)+
           '</strong></span></div>';
       }).join(""):'<div class="season-empty">Noch keine Paarungen bekannt.</div>')+'</div></div>').join("")+'</div>';
 }

 return '<div class="season-rounds">'+s.rounds.map(r=>{
   if(!r.available)return '<div class="season-round season-missing"><strong>Kriegstag '+r.day+'</strong><span>Ergebnis noch nicht verfügbar</span></div>';
   const total=r.teamSize?'<span>'+r.teamSize+' gegen '+r.teamSize+'</span>':"";
   const attacks=r.state==="preparation"?"Aufstellungen vorläufig":r.own.attacks+' eigene Angriffe · '+r.opponent.attacks+' gegnerische Angriffe';
   return '<div class="season-round"><div class="season-round-heading"><strong>Kriegstag '+r.day+'</strong><span class="season-state '+esc(r.state)+'">'+stateLabel(r)+'</span></div>'+
     '<div class="season-round-match"><span class="season-clan">'+badge(r.own)+'<strong>'+esc(r.own.name)+'</strong></span>'+
     '<b class="season-score">'+score(r)+'</b>'+
     '<span class="season-clan right">'+badge(r.opponent)+'<strong>'+esc(r.opponent.name)+'</strong></span></div>'+
     '<div class="season-round-meta">'+total+'<span>'+attacks+'</span></div></div>';
 }).join("")+'</div>';
}
export function viewPlayers(s){
 if(!s.players.length)return '<p class="season-empty">Spielerleistungen erscheinen, sobald ein CWL-Krieg begonnen hat und seine Aufstellung verfügbar ist. Vorbereitungsteams werden noch nicht als Einsatz gezählt.</p>';
 return '<div class="season-info"><p>So haben unsere Spieler in dieser CWL abgeschnitten.</p><details class="season-explain"><summary>Welche Angriffe zählen?</summary><p>Nur bekannte CWL-Angriffe dieser Saison. Laufende Kriege zeigen Zwischenstände; weitere Filter findest du unter „Statistik“.</p></details></div>'+
 '<div class="season-player-scroll"><table class="season-player-table"><thead><tr><th>Spieler</th><th>Kriege</th><th>Angriffe</th><th>Sterne</th><th>Ø</th></tr></thead><tbody>'+
 s.players.map(p=>'<tr><td><strong>'+esc(p.name)+'</strong><small>RH '+esc(p.townHallLevel??"–")+'</small></td><td>'+p.days+'</td><td>'+p.attacks+'</td><td>'+p.stars+'</td><td>'+
   (p.averageStars===null?"–":p.averageStars.toLocaleString("de-AT",{minimumFractionDigits:2,maximumFractionDigits:2}))+'</td></tr>').join("")+'</tbody></table></div>';
}
// Inline, read-only postseason recap in the original Plan view. Reuses the
// existing CWL-season source of truth; no player/lock/archival mutation.
// Three clear tabs replace the long all-in-one post-season scroll. The
// same underlying season/group functions power the existing full season view.
export function renderInlineCwlPostseason(profile,snapshot,group,lifecycle,selectedTab="rounds"){
 if(lifecycle?.mode!=="postseason"||!snapshot?.season)return "";
 const model=summarizeCwlSeason({...profile,cwlLive:snapshot});
 if(!model)return "";
 const sameGroup=group?.season===model.season&&group?.clanTag===model.clanTag?group:null;
 const ranking=sameGroup?summarizeCwlGroup(sameGroup):null;
 const complete=lifecycle.verifiedAll===true||lifecycle.verifiedSeven===true;
 const total=model.warCount||7;
 const saved=Number.isInteger(lifecycle.savedDays)?lifecycle.savedDays:0;
 const status=complete?"Alle "+total+" Kriegstage abgeschlossen":
  saved===total?total+" von "+total+" Tagen gespeichert · einzelne Ergebnisse werden noch geprüft":
   saved+" von "+total+" Tagen gespeichert · letztes Ergebnis noch offen";
 const tabs=[["rounds","Kriegstage"],["group","Tabelle"],["players","Spieler"]];
 const selected=tabs.some(t=>t[0]===selectedTab)?selectedTab:"rounds";
 const nav='<div class="plan-postseason-tabs" role="tablist" aria-label="CWL-Rückblick">'+
  tabs.map(([id,label])=>'<button type="button" role="tab" data-postseason-tab="'+id+
   '" aria-selected="'+(id===selected)+'" tabindex="'+(id===selected?0:-1)+'"'+
   ' class="plan-postseason-tab'+(id===selected?' active':'')+'">'+label+'</button>').join("")+
  '</div>';
 const body=selected==="group"?viewGroup(model,ranking):
  selected==="players"?viewPlayers(model):viewRounds(model,ranking);
 return '<section class="plan-postseason-results" aria-label="CWL-Saisonrückblick">'+
  '<div class="plan-postseason-heading"><span class="view-lead-kicker">LETZTE CWL</span>'+
  '<h3>'+esc(dateLabel(model.season))+'</h3>'+
  '<p class="statusline">'+esc(status)+'</p></div>'+
  nav+'<div class="plan-postseason-panel" role="tabpanel" data-postseason-panel="'+selected+'">'+
  body+'</div>'+
  (!complete?'<p class="plan-postseason-hint">Noch nicht alle Ergebnisse von Clash bestätigt. Die gespeicherten Werte bleiben sichtbar.</p>':'')+
  '</section>';
}
export function createCwlSeasonView({getProfile,getSnapshot,getGroup,isConnected,refresh}){
 let tab="rounds";
 const host=$("cwlSeasonContent"),caption=$("cwlSeasonCaption"),switcher=$("cwlSeasonTabs");
 if(!host||!caption||!switcher)return {render(){}};
 const buttons=[...switcher.querySelectorAll("[data-season-tab]")];
 function setTab(next){
   if(!["group","rounds","players"].includes(next))return;
   tab=next;for(const button of buttons){
     const selected=button.dataset.seasonTab===tab;
     button.classList.toggle("active",selected);
     button.setAttribute("aria-selected",String(selected));
     button.tabIndex=selected?0:-1;
   }
   render();
 }
 buttons.forEach(button=>button.addEventListener("click",()=>setTab(button.dataset.seasonTab)));
 switcher.addEventListener("keydown",e=>{
   if(!["ArrowLeft","ArrowRight"].includes(e.key))return;
   const index=["group","rounds","players"].indexOf(tab);
   const next=["group","rounds","players"][(index+(e.key==="ArrowRight"?1:2))%3];
   setTab(next);switcher.querySelector('[data-season-tab="'+next+'"]')?.focus();e.preventDefault();
 });
 $("cwlSeasonRefresh")?.addEventListener("click",()=>{if(isConnected())refresh?.()});
 function render(){
   const connected=isConnected(),profile=getProfile(),snapshot=connected?getSnapshot?.():null;
   const model=summarizeCwlSeason(snapshot?.season?{...profile,cwlLive:snapshot}:profile);
   const groupRaw=connected?getGroup?.():null;
   const group=model&&groupRaw?.season===model.season&&
      groupRaw?.clanTag===model.clanTag?summarizeCwlGroup(groupRaw):null;
   const shortcut=$("planCwlSeasonEntry"),hint=$("planCwlSeasonHint");
   if(shortcut)shortcut.hidden=!(connected&&model&&
     profile?.cwlLiveIgnoredSeason!==model.season);
   if(hint&&model)hint.textContent=dateLabel(model.season)+
     (group?" · "+group.clans.length+" Clans · "+group.known+" von "+group.expected+" Paarungen":" · "+model.available+" von "+(model.warCount||7)+" Gegnern bekannt");
   $("cwlSeasonRefresh").hidden=!connected;
   if(!connected){
     caption.textContent="Saisoninformationen sind mit einem verbundenen Cloud-Clan verfügbar.";
     host.innerHTML='<p class="season-empty">Verbinde einen Clan unter „Mehr → Clan & Konto“, um die CWL-Saison anzuzeigen. Dein lokales CWL-Archiv bleibt davon unabhängig.</p>';
     return;
   }
   if(!model){
     caption.textContent="Für diesen Clan wurden noch keine CWL-Gruppendaten gespeichert.";
     host.innerHTML='<p class="season-empty">Noch keine CWL verfügbar. Prüfe unter „Plan“, ob Clash die laufende Saison bereits freigegeben hat.</p>';
     return;
   }
   const fresh=!!snapshot?.season&&snapshot.season===model.season;
   caption.textContent=dateLabel(model.season)+' · '+
     (group?group.clans.length+' Clans · '+group.known+' von '+group.expected+' Paarungen bekannt':
      model.ended+' Kriege beendet · '+model.available+' von '+(model.warCount||7)+' Gegnern bekannt')+
      (fresh?' · aus Clash abgerufen':' · zuletzt gespeichert');
   host.innerHTML=tab==="group"?viewGroup(model,group):tab==="players"?viewPlayers(model):viewRounds(model,group);
 }
 return {render,setTab};
}
