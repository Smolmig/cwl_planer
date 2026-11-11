// Read-only historical CWL recap inside a saved plan archive.
// Uses the same three renderers as the Plan page, but only saved season data.
// Historical group standings remain provisional until every match is verified.
import {summarizeCwlSeason} from "./cwl-season-core.mjs?v=1.18.0";
import {summarizeCwlGroup} from "./cwl-group-core.mjs?v=1.18.0";
import {viewGroup,viewRounds,viewPlayers} from "./cwl-season-view.mjs?v=1.18.0";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const tabs=[["rounds","Kriegstage"],["group","Tabelle"],["players","Spieler"]];
function fallbackFromGroup(group){
 const days=group?.warCount||7;
 const rounds=group.rounds.map(round=>{
   const match=round.matches.find(m=>m.available&&
     (m.clan.tag===group.clanTag||m.opponent.tag===group.clanTag));
   if(!match)return {day:round.day,available:false,state:"unknown"};
   const own=match.clan.tag===group.clanTag?match.clan:match.opponent;
   const enemy=own===match.clan?match.opponent:match.clan;
   return {day:round.day,available:true,state:match.state,
     teamSize:match.teamSize,warTag:match.warTag,
     own:{...own},opponent:{...enemy}};
 });
 return {season:group.season,clanTag:group.clanTag,warCount:days,rounds,
   ended:rounds.filter(r=>r.state==="warEnded").length,players:[],opponents:[]};
}
export function createArchivedCwlRecapView({sb,getClanId}){
 const host=$("archiveRecap");
 if(!host)return {open:async()=>{}};
 let serial=0,archive=null,tab="rounds",group=null,loading=false;
 function render(){
   if(!archive)return;
   const model=archive.cwlLive?.season?
     summarizeCwlSeason({name:archive.label,cwlLive:archive.cwlLive}):null;
   const viewModel=model|| (group?fallbackFromGroup(group):null);
   const ownEnded=model?.ended??0,ownTotal=model?.warCount||archive.days||7;
   const complete=!!model&&ownEnded===ownTotal;
   const info=complete?ownTotal+"/"+ownTotal+" eigene Kriege beendet":
     model?ownEnded+"/"+ownTotal+" eigene Kriege mit Endstand":
       "Nur gespeicherte Aufstellungen vorhanden";
   const nav='<div class="plan-postseason-tabs" role="tablist" aria-label="Archivierter CWL-Rückblick">'+
     tabs.map(([key,title])=>'<button type="button" role="tab" data-archive-recap-tab="'+key+
       '" class="plan-postseason-tab'+(tab===key?' active':'')+'" aria-selected="'+
       (tab===key)+'" tabindex="'+(tab===key?0:-1)+'">'+title+'</button>').join("")+'</div>';
   let body="";
   if(tab==="rounds"){
     body=viewModel?viewRounds(viewModel,null):
       '<p class="season-empty">Für diese ältere CWL sind keine Kriegsergebnisse gespeichert. Die damaligen Aufstellungen und Einsätze stehen darunter.</p>';
   }else if(tab==="group"){
     body=group&&viewModel?viewGroup(viewModel,group):
       '<p class="season-empty">Für diese CWL ist keine Gruppentabelle gespeichert. Frühere Einsätze bleiben im Planarchiv erhalten.</p>';
   }else{
     body=model?viewPlayers(model):
       '<p class="season-empty">Für diese CWL sind keine bestätigten einzelnen Spielerangriffe gespeichert. Die damalige Einsatzverteilung steht darunter.</p>';
   }
   const groupNote=tab==="group"&&group&&!group.complete?
     '<p class="statusline">Die Tabelle zeigt '+group.ended+' von '+group.expected+
     ' bestätigten Gruppenspielen. Fehlende Endstände werden nicht geschätzt.</p>':"";
   host.innerHTML='<section class="archive-recap-section"><div class="archive-recap-intro">'+
     '<h4>Saisonrückblick</h4><p class="statusline">'+esc(info)+
     ' · aus dem gespeicherten Stand dieser CWL</p></div>'+nav+
     '<div class="plan-postseason-panel" role="tabpanel">'+body+groupNote+'</div>'+
     (loading&&tab==="group"?'<p class="statusline">Gespeicherte Gruppentabelle wird geladen …</p>':"")+
     '</section>';
 }
 host.addEventListener("click",event=>{
   const button=event.target.closest("[data-archive-recap-tab]");
   if(!button||!host.contains(button))return;
   const next=button.dataset.archiveRecapTab;
   if(!tabs.some(([id])=>id===next))return;
   tab=next;render();
   host.querySelector('[data-archive-recap-tab="'+next+'"]')?.focus({preventScroll:true});
 });
 async function open(next){
   const request=++serial;
   archive=next||null;tab="rounds";group=null;
   if(!archive){host.innerHTML="";return}
   loading=!!getClanId()&&!!(archive.sourceSeason||archive.cwlLive?.season);
   render();
   const clan=getClanId(),season=archive.sourceSeason||archive.cwlLive?.season;
   if(!clan||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(String(season||""))){loading=false;render();return}
   try{
     const {data,error}=await sb.from("cwl_group_archives")
       .select("season,group_json").eq("clan_id",clan).eq("season",season).maybeSingle();
     if(request!==serial||!archive)return;
     if(!error&&data?.season===season&&data.group_json?.season===season&&
       data.group_json?.clanTag===(archive.cwlLive?.clanTag||data.group_json.clanTag))
       group=summarizeCwlGroup(data.group_json);
   }catch{
     // A failed optional historical group read must not hide saved lineups.
   }
   if(request!==serial)return;
   loading=false;render();
 }
 return {open,close(){serial++;archive=null;host.innerHTML="";}};
}
