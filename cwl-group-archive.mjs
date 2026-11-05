// Durable, read-only CWL group histories. Separate from the planner's own
// archived lineups. All queries use the logged-in Supabase session and RLS.
import {summarizeCwlGroup} from "./cwl-group-core.mjs?v=1.15.4";
import {safeBadgeUrl} from "./cwl-live-core.mjs?v=1.15.4";
const $=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Number(n).toLocaleString("de-AT",{maximumFractionDigits:1});
const month=season=>{
  const [y,m]=String(season).split("-").map(Number);
  return y&&m>=1&&m<=12?new Date(Date.UTC(y,m-1,1)).toLocaleDateString("de-AT",
    {month:"long",year:"numeric",timeZone:"UTC"}):String(season);
};
const badge=x=>{
  const uri=safeBadgeUrl(x?.badgeUrl);
  return uri?'<img class="season-badge" src="'+esc(uri)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':
    '<span class="season-badge-fallback" aria-hidden="true">◇</span>';
};
const score=(m,s)=>s==="preparation"?"–":m?.stars===null||m?.stars===undefined?"–":String(m.stars);
function groupTable(data){
  return '<div class="season-group-scroll"><table class="season-group-table">'+
    '<thead><tr><th>Platz</th><th>Clan</th><th>Siege</th><th>Sterne</th><th>Zerstörung Σ</th></tr></thead><tbody>'+
    data.clans.map(c=>'<tr'+(c.tag===data.clanTag?' class="season-own-clan"':'')+'>'+
    '<td>'+c.position+'.</td><td><span class="season-clan">'+badge(c)+'<strong>'+esc(c.name)+'</strong></span></td>'+
    '<td>'+c.wins+'</td><td><strong>'+c.stars+'</strong></td><td>'+fmt(c.totalDestruction)+'</td></tr>').join("")+
    '</tbody></table></div>';
}
// A lineage-safe lookup. Never match a roster just by a displayed month name.
const key=(season,day)=>String(season)+"|"+Number(day);
const validTag=x=>/^#[0289PYLQGRJCUV]{3,15}$/.test(String(x||""));
function extractLineup(profile,season,day,warTag,clanTag){
  const snapshots=[];
  if(profile?.cwlLive?.season===season)snapshots.push(profile.cwlLive);
  for(const archived of (Array.isArray(profile?.archives)?profile.archives:[]))
    if(archived?.cwlLive?.season===season)snapshots.push(archived.cwlLive);
  const candidates=snapshots.map(s=>{
    if(s.clanTag!==clanTag)return null;
    const r=(s.rounds||[]).find(x=>x?.day===day&&x.available&&x.warTag===warTag&&
      ["inWar","warEnded"].includes(x.state));
    if(!r||r.clan?.tag!==clanTag||!Array.isArray(r.clan?.members)||
       r.clan.members.length!==r.teamSize)return null;
    return {source:"clash",state:r.state,members:r.clan.members};
  }).filter(Boolean).sort((a,b)=>Number(b.state==="warEnded")-Number(a.state==="warEnded")||
    b.members.reduce((n,m)=>n+(m.attacks?.length||0),0)-
    a.members.reduce((n,m)=>n+(m.attacks?.length||0),0));
  if(candidates.length)return candidates[0];
  // A manually locked lineup from an older plan is still useful, but is
  // labelled as planning data, never misrepresented as an API-confirmed team.
  for(const archived of (Array.isArray(profile?.archives)?profile.archives:[])){
    if(archived?.cwlLive?.season!==season)continue;
    const dayLineup=(archived.lineups||[]).find(l=>l?.day===day);
    if(!dayLineup||!Array.isArray(dayLineup.lineup))continue;
    const players=new Map((archived.players||[]).map(p=>[p.id,p]));
    const members=dayLineup.lineup.map(id=>{
      const m=dayLineup.snapshots?.[id]||players.get(id);
      return m?{name:m.name||"Unbekannt",tag:m.playerTag||"",townHallLevel:m.townHall??null,
        attacks:null}:null;
    }).filter(Boolean);
    if(members.length)return {source:"plan",state:"archived",members};
  }
  return null;
}
function ownLineupForDay(group,day,rows,profile){
  const round=group.rounds.find(r=>r.day===day);
  const own=round?.matches.find(m=>m.available&&["inWar","warEnded"].includes(m.state)&&
    (m.clan.tag===group.clanTag||m.opponent.tag===group.clanTag));
  if(!own)return null;
  const server=rows.find(x=>x.season===group.season&&x.day===day&&
    x.war_tag===own.warTag&&["inWar","warEnded"].includes(x.state)&&
    Array.isArray(x.lineup_json?.members)&&x.lineup_json.members.length===x.team_size);
  if(server)return {source:"clash",state:server.state,members:server.lineup_json.members};
  return extractLineup(profile,group.season,day,own.warTag,group.clanTag);
}
function lineupDetail(lineup,season,day){
  if(!lineup?.members?.length)return "";
  const trusted=lineup.source==="clash";
  const status=trusted?(lineup.state==="warEnded"?"Clash · Krieg abgeschlossen":"Clash · Aufstellung fix"):
    "Aus dem Planarchiv · nicht mit Clash abgeglichen";
  const rows=lineup.members.map(m=>{
    const hasAttacks=Array.isArray(m.attacks);
    const hits=hasAttacks?m.attacks.filter(a=>Number.isInteger(a?.stars)&&a.stars>=0&&a.stars<=3):[];
    const th=Number.isInteger(m.townHallLevel)?"RH "+m.townHallLevel:"";
    const stat=hasAttacks?hits.length+" Angr. · "+hits.reduce((sum,a)=>sum+a.stars,0)+"★":"";
    const meta=[th,stat].filter(Boolean).join(" · ");
    return '<div class="season-archive-player"><strong>'+esc(m.name||m.tag||"Spieler")+'</strong>'+
      (meta?'<small>'+esc(meta)+'</small>':"")+'</div>';
  }).join("");
  return '<details class="season-archive-lineup" data-archive-key="roster:'+esc(season)+':'+day+'"><summary><span>Unser Team · '+
    lineup.members.length+' Spieler</span><small>'+esc(status)+'</small></summary>'+
    '<div class="season-archive-roster">'+rows+'</div></details>';
}
function groupRounds(data,ownRows,profile){
  return '<div class="season-group-archive-rounds">'+data.rounds.map(round=>
    '<details class="season-archive-round" data-archive-key="round:'+esc(data.season)+':'+round.day+'"><summary>Runde '+round.day+' · '+
    round.matches.filter(m=>m.available).length+' Begegnungen bekannt</summary>'+
    '<div class="season-group-matches">'+(round.matches.length?round.matches.map(m=>{
      if(!m.available)return '<div class="season-group-match season-missing">Begegnung nicht gespeichert</div>';
      return '<div class="season-group-match'+
        (m.clan.tag===data.clanTag||m.opponent.tag===data.clanTag?' season-own-match':'')+'">'+
        '<span class="season-clan">'+badge(m.clan)+'<strong>'+esc(m.clan.name)+'</strong></span>'+
        '<span class="season-group-score"><b>'+score(m.clan,m.state)+' : '+score(m.opponent,m.state)+'</b>'+
        '<small>'+({warEnded:"Beendet",inWar:"Läuft",preparation:"Vorbereitung"}[m.state]||"Unbekannt")+'</small></span>'+
        '<span class="season-clan right">'+badge(m.opponent)+'<strong>'+esc(m.opponent.name)+'</strong></span></div>';
    }).join(""):'<p class="season-empty">Keine Begegnungen gespeichert.</p>')+'</div>'+
    (ownLineupForDay(data,round.day,ownRows,profile)?
      lineupDetail(ownLineupForDay(data,round.day,ownRows,profile),data.season,round.day):
      round.matches.some(m=>m.available&&["inWar","warEnded"].includes(m.state)&&
        (m.clan.tag===data.clanTag||m.opponent.tag===data.clanTag))?
        '<p class="statusline">Unsere Aufstellung ist für diese Runde noch nicht archiviert.</p>':"")+
    '</details>').join("")+'</div>';
}
export function createCwlGroupArchiveView({sb,getClanId,isConnected,getProfile=()=>null}){
  let rows=[],ownRows=[],loadedId=null,requestSerial=0,busy=false;
  const host=$("cwlGroupArchiveContent"),refresh=$("cwlGroupArchiveRefresh");
  if(!host)return {open(){},invalidate(){}};
  const current=()=>isConnected()?getClanId():null;
  // A live API poll can refresh the archive while a user is reading it.
  // Remember *every* open disclosure, including nested rounds/rosters,
  // then restore them synchronously after replacing data. Only a real clan
  // switch clears this state. Do not store it in the shared planner profile.
  function captureOpen(){
    return new Set([...host.querySelectorAll('details[data-archive-key][open]')]
      .map(node=>node.getAttribute("data-archive-key")).filter(Boolean));
  }
  function restoreOpen(keys){
    for(const node of host.querySelectorAll('details[data-archive-key]'))
      if(keys.has(node.getAttribute("data-archive-key")))node.open=true;
  }
  function replaceContent(html){
    const keys=captureOpen();
    const active=host.contains(document.activeElement)?document.activeElement:null;
    const focusedKey=active?.closest?.('details[data-archive-key]')?.getAttribute("data-archive-key");
    const summaryWasFocused=active?.tagName==="SUMMARY";
    host.innerHTML=html;
    restoreOpen(keys);
    if(focusedKey&&summaryWasFocused){
      // Keyboard users must not lose their place when a new API snapshot
      // replaces a section they were currently inspecting.
      const target=[...host.querySelectorAll('details[data-archive-key]')]
        .find(node=>node.getAttribute("data-archive-key")===focusedKey);
      target?.querySelector(":scope > summary")?.focus({preventScroll:true});
    }
  }
  function render(){
    const id=current();
    if(!id){
      host.innerHTML='<p class="season-empty">Das Gruppenarchiv ist für angemeldete Mitglieder eines Cloud-Clans verfügbar. Deine bereits gespeicherten Plan-Archive stehen darunter weiterhin bereit.</p>';
      if(refresh)refresh.hidden=true;
      return;
    }
    if(refresh)refresh.hidden=false;
    if(busy){host.innerHTML='<p class="season-empty">Gruppensaisons werden geladen …</p>';return}
    if(!rows.length){host.innerHTML='<p class="season-empty">Noch keine Gruppensaison gespeichert. Beim nächsten erfolgreichen Clash-Abruf wird die aktuelle Saison automatisch gesichert.</p>';return}
    replaceContent('<div class="season-group-archive-list">'+rows.map(row=>{
      const d=summarizeCwlGroup(row.group_json);
      if(!d||d.clanTag!==row.group_json?.clanTag||row.season!==d.season)return "";
      const checked=new Date(row.updated_at);
      const date=Number.isNaN(checked.getTime())?"Stand unbekannt":checked.toLocaleString("de-AT",{dateStyle:"short",timeStyle:"short"});
      return '<details class="season-archive-item" data-archive-key="season:'+esc(d.season)+'"><summary><span><strong>'+esc(month(d.season))+'</strong>'+
        '<small>'+d.clans.length+' Clans · '+d.ended+' / '+d.expected+' Kriege abgeschlossen</small></span>'+
        '<span class="season-archive-chip">'+(d.complete?"Abgeschlossen":"Gespeicherter Zwischenstand")+'</span></summary>'+
        '<div class="season-archive-body"><p class="statusline">Zuletzt gesichert: '+esc(date)+
        '. Die Rangfolge ist bei offenen oder fehlenden Kriegen vorläufig. Einzelne Angreifer werden im Gruppenarchiv nicht gespeichert.</p>'+
        groupTable(d)+
        '<h4>Runden</h4>'+groupRounds(d,ownRows,getProfile?.())+'</div></details>';
    }).join("")+'</div>');
  }
  async function open(force=false){
    const id=current(),token=++requestSerial;
    if(!id){loadedId=null;rows=[];ownRows=[];busy=false;render();return}
    if(!force&&loadedId===id&&!busy){render();return}
    // Keep visible rows and expanded panels in place during a background
    // refresh. A spinner-only replacement loses both focus and scroll position.
    const keepVisible=loadedId===id&&rows.length>0;
    busy=!keepVisible;
    if(!keepVisible){rows=[];ownRows=[];render()}
    try{
      const {data,error}=await sb.from("cwl_group_archives")
        .select("season,group_json,updated_at")
        .eq("clan_id",id).order("season",{ascending:false}).limit(18);
      if(token!==requestSerial||id!==current())return;
      if(error)throw error;
      // A temporary roster-storage error must not hide the historical group.
      let rosterQuery={data:[],error:null};
      try{rosterQuery=await sb.from("cwl_own_lineup_archives")
        .select("season,day,war_tag,state,team_size,lineup_json,updated_at")
        .eq("clan_id",id).order("season",{ascending:false}).limit(140)}
      catch{rosterQuery={data:[],error:true}}
      if(token!==requestSerial||id!==current())return;
      if(refresh)refresh.title="";
      loadedId=id;rows=Array.isArray(data)?data:[];
      ownRows=!rosterQuery.error&&Array.isArray(rosterQuery.data)?rosterQuery.data:[];busy=false;render();
    }catch(error){
      if(token!==requestSerial||id!==current())return;
      busy=false;
      if(loadedId===id&&rows.length){
        // A transient refresh failure must not close a single open round.
        if(refresh)refresh.title="Aktualisierung derzeit nicht möglich – der gespeicherte Stand bleibt sichtbar.";
        return;
      }
      loadedId=null;rows=[];ownRows=[];
      host.innerHTML='<p class="season-empty">Das Gruppenarchiv konnte nicht geladen werden. Bitte Verbindung und Anmeldung prüfen und erneut versuchen. Deine bisherigen Plan-Archive bleiben erhalten.</p>';
    }
  }
  refresh?.addEventListener("click",()=>open(true));
  return {open,invalidate(){
    requestSerial++;
    const id=current(),changed=loadedId!==null&&loadedId!==id;
    if(changed){loadedId=null;rows=[];ownRows=[];busy=false}
    // A periodic live refresh is not a navigation event: keep rows, opened
    // panels and the current reading position until new data arrives.
    if($("view-archive")?.classList.contains("active"))void open(true);
  }};
}
