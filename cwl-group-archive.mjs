// Durable, read-only CWL group histories. Separate from the planner's own
// archived lineups. All queries use the logged-in Supabase session and RLS.
import {summarizeCwlGroup} from "./cwl-group-core.mjs?v=1.11.0";
import {safeBadgeUrl} from "./cwl-live-core.mjs?v=1.11.0";
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
function groupRounds(data){
  return '<div class="season-group-archive-rounds">'+data.rounds.map(round=>
    '<details class="season-archive-round"><summary>Runde '+round.day+' · '+
    round.matches.filter(m=>m.available).length+' Begegnungen bekannt</summary>'+
    '<div class="season-group-matches">'+(round.matches.length?round.matches.map(m=>{
      if(!m.available)return '<div class="season-group-match season-missing">Begegnung nicht gespeichert</div>';
      return '<div class="season-group-match'+
        (m.clan.tag===data.clanTag||m.opponent.tag===data.clanTag?' season-own-match':'')+'">'+
        '<span class="season-clan">'+badge(m.clan)+'<strong>'+esc(m.clan.name)+'</strong></span>'+
        '<span class="season-group-score"><b>'+score(m.clan,m.state)+' : '+score(m.opponent,m.state)+'</b>'+
        '<small>'+({warEnded:"Beendet",inWar:"Läuft",preparation:"Vorbereitung"}[m.state]||"Unbekannt")+'</small></span>'+
        '<span class="season-clan right">'+badge(m.opponent)+'<strong>'+esc(m.opponent.name)+'</strong></span></div>';
    }).join(""):'<p class="season-empty">Keine Begegnungen gespeichert.</p>')+'</div></details>').join("")+'</div>';
}
export function createCwlGroupArchiveView({sb,getClanId,isConnected}){
  let rows=[],loadedId=null,requestSerial=0,busy=false;
  const host=$("cwlGroupArchiveContent"),refresh=$("cwlGroupArchiveRefresh");
  if(!host)return {open(){},invalidate(){}};
  const current=()=>isConnected()?getClanId():null;
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
    host.innerHTML='<div class="season-group-archive-list">'+rows.map(row=>{
      const d=summarizeCwlGroup(row.group_json);
      if(!d||d.clanTag!==row.group_json?.clanTag||row.season!==d.season)return "";
      const checked=new Date(row.updated_at);
      const date=Number.isNaN(checked.getTime())?"Stand unbekannt":checked.toLocaleString("de-AT",{dateStyle:"short",timeStyle:"short"});
      return '<details class="season-archive-item"><summary><span><strong>'+esc(month(d.season))+'</strong>'+
        '<small>'+d.clans.length+' Clans · '+d.ended+' / '+d.expected+' Kriege abgeschlossen</small></span>'+
        '<span class="season-archive-chip">'+(d.complete?"Abgeschlossen":"Gespeicherter Zwischenstand")+'</span></summary>'+
        '<div class="season-archive-body"><p class="statusline">Zuletzt gesichert: '+esc(date)+
        '. Die Rangfolge ist bei offenen oder fehlenden Kriegen vorläufig. Einzelne Angreifer werden im Gruppenarchiv nicht gespeichert.</p>'+
        groupTable(d)+
        '<h4>Runden</h4>'+groupRounds(d)+'</div></details>';
    }).join("")+'</div>';
  }
  async function open(force=false){
    const id=current(),token=++requestSerial;
    if(!id){loadedId=null;rows=[];busy=false;render();return}
    if(!force&&loadedId===id&&!busy){render();return}
    busy=true;render();
    try{
      const {data,error}=await sb.from("cwl_group_archives")
        .select("season,group_json,updated_at")
        .eq("clan_id",id).order("season",{ascending:false}).limit(18);
      if(token!==requestSerial||id!==current())return;
      if(error)throw error;
      loadedId=id;rows=Array.isArray(data)?data:[];busy=false;render();
    }catch(error){
      if(token!==requestSerial||id!==current())return;
      loadedId=null;rows=[];busy=false;
      host.innerHTML='<p class="season-empty">Das Gruppenarchiv konnte nicht geladen werden. Bitte Verbindung und Anmeldung prüfen und erneut versuchen. Deine bisherigen Plan-Archive bleiben erhalten.</p>';
    }
  }
  refresh?.addEventListener("click",()=>open(true));
  return {open,invalidate(){requestSerial++;loadedId=null;rows=[];busy=false;if($("view-archive")?.classList.contains("active"))open(true)}};
}
