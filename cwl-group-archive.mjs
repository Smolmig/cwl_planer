// Durable, read-only CWL group histories. Separate from the planner's own
// archived lineups. All queries use the logged-in Supabase session and RLS.
import {summarizeCwlGroup} from "./cwl-group-core.mjs?v=1.18.1";
import {unifyCwlArchiveSeasons} from "./cwl-unified-archive-core.mjs?v=1.18.1";
import {summarizeCwlSeason} from "./cwl-season-core.mjs?v=1.18.1";
import {viewRounds,viewPlayers} from "./cwl-season-view.mjs?v=1.18.1";

import {safeBadgeUrl} from "./cwl-live-core.mjs?v=1.18.1";
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
// Group standings and the saved planner are separate sources. In particular,
// one confirmed own final war must never imply 28 finished group encounters.
function archiveStatus(data,ownRows){
  const inWar=data.rounds.reduce((n,r)=>n+r.matches.filter(m=>m.available&&m.state==="inWar").length,0);
  const outstanding=Math.max(0,data.expected-data.ended);
  const ownGroupBehind=data.rounds.some(r=>r.matches.some(m=>
    m.available&&m.state!=="warEnded"&&
    (m.clan.tag===data.clanTag||m.opponent.tag===data.clanTag)&&
    ownRows.some(saved=>saved.season===data.season&&saved.day===r.day&&
      saved.war_tag===m.warTag&&saved.state==="warEnded")));
  if(data.complete)return {label:"Abgeschlossen",note:"Alle Gruppenspiele sind mit Endstand gespeichert."};
  if(ownGroupBehind)return {label:"Gruppenstand veraltet",
    note:"Euer eigener letzter Krieg ist bereits als beendet gespeichert. Die Gruppenübersicht zeigt für ihn noch einen älteren Stand. "+
      "Die übrigen Gruppenspiele werden erst nach bestätigtem Endstand als abgeschlossen gezählt."};
  if(data.missing>0)return {label:"Ergebnisse fehlen",
    note:"Für "+data.missing+" Begegnung"+(data.missing===1?"":"en")+" fehlen gespeicherte Clash-Ergebnisse. "+
      "Die Tabelle ist deshalb noch vorläufig."};
  if(inWar>0)return {label:outstanding+" Ergebnisse offen",
    note:"Im zuletzt gespeicherten Clash-Gruppenstand sind noch "+inWar+
      " Begegnung"+(inWar===1?"":"en")+" als laufend eingetragen. "+
      "Der eigene Plan kann trotzdem bereits abgeschlossen sein."};
  return {label:"Stand vorläufig",
    note:"Der gespeicherte Gruppenstand reicht noch nicht für eine endgültige Tabelle."};
}

function ownWarsFromGroup(group){
  if(!group)return null;
  const rounds=group.rounds.map(round=>{
    const match=round.matches.find(m=>m.available&&
      (m.clan.tag===group.clanTag||m.opponent.tag===group.clanTag));
    if(!match)return {day:round.day,available:false,state:"unknown"};
    const ourSide=match.clan.tag===group.clanTag?match.clan:match.opponent;
    const opponent=ourSide===match.clan?match.opponent:match.clan;
    return {day:round.day,available:true,state:match.state,warTag:match.warTag,
      teamSize:match.teamSize,own:{...ourSide},opponent:{...opponent}};
  });
  return {season:group.season,clanTag:group.clanTag,warCount:group.warCount,
    rounds,available:rounds.filter(r=>r.available).length,
    ended:rounds.filter(r=>r.state==="warEnded").length,players:[],opponents:[]};
}
function ownVerifiedRows(group,rows){
  if(!group)return [];
  const officialTags=new Set(group.rounds.flatMap(r=>r.matches
    .filter(m=>m.available&&(m.clan.tag===group.clanTag||
      m.opponent.tag===group.clanTag)).map(m=>m.warTag)));
  return rows.filter(r=>r.season===group.season&&officialTags.has(r.war_tag)&&
    ["warEnded","inWar"].includes(r.state)&&Array.isArray(r.lineup_json?.members)&&
    r.lineup_json.members.length===r.team_size);
}
function playersFromRows(rows){
  const byTag=new Map();
  for(const r of rows){
    for(const p of r.lineup_json.members){
      if(!validTag(p?.tag))continue;
      let record=byTag.get(p.tag);
      if(!record){record={tag:p.tag,name:String(p.name||p.tag),
        townHallLevel:p.townHallLevel??null,days:0,attacks:0,stars:0};
        byTag.set(p.tag,record)}
      record.days++;
      for(const a of (Array.isArray(p.attacks)?p.attacks:[])){
        if(!Number.isInteger(a?.stars)||a.stars<0||a.stars>3)continue;
        record.attacks++;record.stars+=a.stars;
      }
    }
  }
  return [...byTag.values()].map(r=>({...r,averageStars:r.attacks?r.stars/r.attacks:null}))
    .sort((a,b)=>b.stars-a.stars||b.attacks-a.attacks||
      a.name.localeCompare(b.name,"de"));
}
function selectSeasonModel(item,ownRows){
  const source=item.plans.find(p=>p.cwlLive?.season===item.season&&
    p.cwlLive?.clanTag===item.clanTag)?.cwlLive;
  const archive=source?item.plans.find(p=>p.cwlLive===source):null;
  const saved=source?summarizeCwlSeason({name:archive?.label||"",cwlLive:source}):null;
  const verified=item.group?ownWarsFromGroup(item.group):null;
  if(!saved)return verified;
  if(!verified)return saved;
  // A finished official group score takes precedence over an older,
  // still-in-war planner snapshot of the exact same war.
  const rounds=saved.rounds.map(r=>{
    const fromGroup=verified.rounds.find(m=>m.day===r.day&&m.available&&
      m.warTag===r.warTag&&m.state==="warEnded");
    return fromGroup?{...r,...fromGroup}:r;
  });
  return {...saved,rounds,ended:rounds.filter(r=>r.state==="warEnded").length};
}
function renderSavedPlan(plan,index,showDelete){
  const lineups=(Array.isArray(plan.lineups)?plan.lineups:[])
    .filter(x=>Number.isInteger(x?.day)&&Array.isArray(x.lineup))
    .sort((a,b)=>a.day-b.day);
  const players=Array.isArray(plan.players)?plan.players:[];
  const names=new Map(players.map(p=>[String(p.id),String(p.name||"Unbekannt")]));
  const counts=new Map();
  for(const lineup of lineups)for(const id of lineup.lineup)
    counts.set(String(id),(counts.get(String(id))||0)+1);
  const people=[...counts.entries()].map(([id,count])=>({
    id,name:names.get(id)||String(id),count
  })).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,"de"));
  const roster=lineups.map(lineup=>'<details class="season-archive-lineup" data-archive-key="saved:'+esc(plan.id)+':'+lineup.day+'">'+
    '<summary>Kriegstag '+lineup.day+' · '+lineup.lineup.length+' Spieler</summary>'+
    '<div class="season-archive-roster">'+lineup.lineup.map(id=>{
      const name=lineup.snapshots?.[id]?.name||names.get(String(id))||"Unbekannt";
      return '<div class="season-archive-player"><strong>'+esc(name)+'</strong></div>';
    }).join("")+'</div></details>').join("");
  const details='<p class="statusline">'+Number(plan.playedCount||lineups.length)+
    '/'+Number(plan.days||7)+' Tage gespielt · '+Number(plan.slots||15)+'vs'+
    Number(plan.slots||15)+(plan.complete?' · Plan abgeschlossen':' · Planstand gespeichert')+'</p>'+
    '<div class="season-group-archive-rounds">'+roster+'</div>'+
    '<h4>Einsatzhäufigkeit</h4>'+
    (people.length?'<div class="archive-deployment-list">'+people.map(p=>
      '<div class="archive-count"><span>'+esc(p.name)+'</span><strong>'+p.count+'×</strong></div>'
    ).join("")+'</div>':'<p class="season-empty">Keine Einsätze gespeichert.</p>')+
    (showDelete?'<div class="archive-plan-danger"><button type="button" class="btn small danger" data-unified-delete-id="'+
      esc(plan.id)+'">Diesen gespeicherten Plan löschen</button></div>':"");
  return '<details class="archive-saved-plan" data-archive-key="plan:'+esc(plan.id)+'"'+
    (index===0?' open':'')+'><summary>'+esc(plan.label||"Gespeicherter Plan")+
    ' · '+lineups.length+' Einsatztage</summary>'+details+'</details>';
}
function renderOwnLineups(item,ownRows,profile){
  if(!item.group)return '<p class="season-empty">Keine bestätigten Clash-Aufstellungen archiviert.</p>';
  const dayRows=item.group.rounds.map(r=>{
    const lineup=ownLineupForDay(item.group,r.day,ownRows,profile);
    return lineup?lineupDetail(lineup,item.group.season,r.day):"";
  }).filter(Boolean);
  return dayRows.length?'<div class="season-group-archive-rounds">'+dayRows.join("")+'</div>':
    '<p class="season-empty">Keine bestätigten Clash-Aufstellungen archiviert.</p>';
}
function seasonPane(item,tab,ownRows,profile,viewer){
  const group=item.group,model=selectSeasonModel(item,ownRows);
  if(tab==="rounds")return model?viewRounds(model,null):
    '<p class="season-empty">Für diese CWL wurden keine Kriegsergebnisse gespeichert. Aufstellungen findest du unter „Einsätze“.</p>';
  if(tab==="group")return group?
    groupTable(group)+
    '<details class="archive-all-matches" data-archive-key="matches:'+esc(item.id)+'"><summary>Alle Begegnungen ansehen</summary>'+
    groupRounds(group,ownRows,profile)+'</details>'+
    (!group.complete?'<p class="statusline">Die Tabelle ist vorläufig: '+group.ended+
      ' von '+group.expected+' Gruppenspielen sind mit Endstand gespeichert.</p>':""):
    '<p class="season-empty">Für diese CWL wurde keine Gruppentabelle gespeichert. Deine eigenen Aufstellungen bleiben erhalten.</p>';
  if(tab==="players"){
    const verified=playersFromRows(ownVerifiedRows(group,ownRows));
    const rows=verified.length?verified:model?.players||[];
    return rows.length?viewPlayers({...model,players:rows}):
      '<p class="season-empty">Keine einzelnen Spielerangriffe aus dieser CWL gespeichert. Die Einsatzhäufigkeit findest du unter „Einsätze“.</p>';
  }
  return item.plans.length?
    '<div class="archive-deployment-content">'+item.plans.map((p,i)=>
      renderSavedPlan(p,i,!viewer)).join("")+'</div>':
    renderOwnLineups(item,ownRows,profile);
}
const archiveTabs=[["rounds","Kriegstage"],["group","Tabelle"],
  ["players","Spieler"],["deployments","Einsätze"]];
export function createCwlGroupArchiveView({
  sb,getClanId,isConnected,getClanTag=()=>null,getProfile=()=>null,
  isViewer=()=>false,onDeletePlan=null,refreshFromClash=null
}){
  let rows=[],ownRows=[],loadedId=null,requestSerial=0,busy=false,loadError=false;
  const selected=new Map();
  const host=$("cwlGroupArchiveContent"),refresh=$("cwlGroupArchiveRefresh");
  if(!host)return {open(){},invalidate(){}};
  const current=()=>isConnected()?getClanId():null;
  function replaceContent(html){
    const previous=new Map([...host.querySelectorAll('details[data-archive-key]')]
      .map(node=>[node.dataset.archiveKey,node.open]));
    const active=host.contains(document.activeElement)?document.activeElement:null;
    const focusKey=active?.closest?.('details[data-archive-key]')?.dataset.archiveKey;
    const onSummary=active?.tagName==="SUMMARY";
    host.innerHTML=html;
    for(const node of host.querySelectorAll('details[data-archive-key]'))
      if(previous.has(node.dataset.archiveKey))node.open=previous.get(node.dataset.archiveKey);
    if(focusKey&&onSummary){
      const node=[...host.querySelectorAll('details[data-archive-key]')]
        .find(n=>n.dataset.archiveKey===focusKey);
      node?.querySelector(":scope > summary")?.focus({preventScroll:true});
    }
  }
  function render(){
    if(refresh)refresh.hidden=!current();
    const profile=getProfile?.()||{};
    const entries=unifyCwlArchiveSeasons(rows,profile.archives,getClanTag?.());
    if(busy&&!entries.length){
      replaceContent('<p class="season-empty">Gespeicherte CWLs werden geladen …</p>');
      return;
    }
    if(!entries.length){
      replaceContent('<p class="season-empty">Noch keine CWL archiviert. Nach einer CWL findest du hier die Ergebnisse und gespeicherten Aufstellungen.</p>');
      return;
    }
    replaceContent((loadError?'<p class="statusline">Die Gruppendaten konnten derzeit nicht geladen werden. Deine gespeicherten Pläne bleiben verfügbar.</p>':"")+
      '<div class="season-group-archive-list">'+entries.map(item=>{
      const group=item.group,plan=item.plans[0];
      const status=group?archiveStatus(group,ownRows):{
        label:"Plan gespeichert",note:"Für diesen Plan liegt keine verbundene Gruppentabelle vor."};
      const model=selectSeasonModel(item,ownRows);
      const played=plan?Number(plan.playedCount)||0:null;
      const total=plan?Number(plan.days)||7:group?.warCount||7;
      const meta=[
        group?group.clans.length+' Clans · '+group.ended+'/'+group.expected+' Gruppenspiele':null,
        played!==null?played+'/'+total+' eigene Tage':null,
        plan?plan.slots+'vs'+plan.slots:null
      ].filter(Boolean).join(' · ');
      const tab=selected.get(item.id)||"rounds";
      const checked=group?new Date(item.groupRow?.updated_at):null;
      const savedAt=checked&&!Number.isNaN(checked.getTime())?
        checked.toLocaleString("de-AT",{dateStyle:"short",timeStyle:"short"}):null;
      const intro=group?'<p class="statusline">'+esc(status.note)+
        (savedAt?' · Gruppenstand: '+esc(savedAt):"")+'</p>':
        '<p class="statusline">Aus deinem Planarchiv. Keine Gruppendaten mit derselben bestätigten Clan-Kennung vorhanden.</p>';
      const tabs='<div class="plan-postseason-tabs archive-season-tabs" role="tablist" aria-label="Saisonrückblick">'+
        archiveTabs.map(([id,label])=>'<button type="button" role="tab" data-unified-archive-tab="'+id+
          '" class="plan-postseason-tab'+(id===tab?' active':'')+'" aria-selected="'+
          (id===tab)+'" tabindex="'+(id===tab?0:-1)+'">'+label+'</button>').join("")+'</div>';
      return '<details class="season-archive-item" data-archive-key="'+esc(item.id)+'">'+
        '<summary><span><strong>'+esc(item.label)+'</strong><small>'+esc(meta||"Gespeicherter CWL-Plan")+
        '</small></span><span class="season-archive-chip">'+esc(status.label)+'</span></summary>'+
        '<div class="season-archive-body">'+intro+tabs+
        '<div class="plan-postseason-panel archive-season-panel" role="tabpanel" data-unified-panel="'+tab+'">'+
        seasonPane(item,tab,ownRows,profile,isViewer?.())+'</div></div></details>';
    }).join("")+'</div>');
  }
  host.addEventListener("click",async event=>{
    const tabButton=event.target.closest("[data-unified-archive-tab]");
    if(tabButton&&host.contains(tabButton)){
      const box=tabButton.closest("details[data-archive-key]");
      if(!box)return;
      const tab=tabButton.dataset.unifiedArchiveTab;
      if(!archiveTabs.some(([id])=>id===tab))return;
      selected.set(box.dataset.archiveKey,tab);
      const key=box.dataset.archiveKey;
      render();
      const currentBox=[...host.querySelectorAll('details.season-archive-item')]
        .find(node=>node.dataset.archiveKey===key);
      currentBox?.querySelector('[data-unified-archive-tab="'+tab+'"]')
        ?.focus({preventScroll:true});
      return;
    }
    const remove=event.target.closest("[data-unified-delete-id]");
    if(remove&&host.contains(remove)&&!isViewer?.()&&typeof onDeletePlan==="function"){
      event.preventDefault();
      const key=remove.dataset.unifiedDeleteId;
      const changed=await onDeletePlan(key);
      if(changed){render()}
    }
  });
  async function open(force=false){
    const id=current(),token=++requestSerial;
    if(!id){
      loadedId=null;rows=[];ownRows=[];busy=false;loadError=false;
      render();return;
    }
    if(!force&&loadedId===id&&!busy){render();return}
    const sameClan=loadedId===id;
    if(!sameClan){rows=[];ownRows=[];selected.clear()}
    busy=!sameClan||!rows.length;loadError=false;
    if(busy)render();
    try{
      const {data,error}=await sb.from("cwl_group_archives")
        .select("season,group_json,updated_at")
        .eq("clan_id",id).order("season",{ascending:false}).limit(18);
      if(token!==requestSerial||id!==current())return;
      if(error)throw error;
      let rosters={data:[],error:null};
      try{rosters=await sb.from("cwl_own_lineup_archives")
        .select("season,day,war_tag,state,team_size,lineup_json,updated_at")
        .eq("clan_id",id).order("season",{ascending:false}).limit(140)}
      catch{rosters={data:[],error:true}}
      if(token!==requestSerial||id!==current())return;
      loadedId=id;rows=Array.isArray(data)?data:[];
      ownRows=!rosters.error&&Array.isArray(rosters.data)?rosters.data:ownRows;
      busy=false;loadError=false;render();
    }catch(error){
      if(token!==requestSerial||id!==current())return;
      busy=false;loadError=true;
      if(loadedId===id&&rows.length){
        if(refresh)refresh.title="Clash-Abgleich gerade nicht möglich; gespeicherte Daten bleiben sichtbar.";
        return;
      }
      loadedId=id;rows=[];ownRows=[];render();
    }
  }
  refresh?.addEventListener("click",async()=>{
    if(refresh.disabled)return;
    refresh.disabled=true;
    try{
      if(typeof refreshFromClash==="function")await refreshFromClash();
      await open(true);
    }finally{refresh.disabled=false}
  });
  return {open,invalidate(){
    requestSerial++;
    const id=current(),changed=loadedId!==null&&loadedId!==id;
    if(changed){loadedId=null;rows=[];ownRows=[];busy=false;selected.clear()}
    if($("view-archive")?.classList.contains("active"))void open(true);
  },render};
}
