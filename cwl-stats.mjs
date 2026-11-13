import {validateHistoryFile,computeWarStats,selectStatWars,computeRecentAttackStats,computeThMatchupComparison,groupCwlRuns,computeStatsTimeline,computeTrendPlotGeometry,formatTrendPeriod,computePlayerDuel,describeWarSelection,selectWarDateScope,computePlayerFormWindows,sortPlayerFormRows,cleanTag} from "./cwl-stats-core.mjs?v=1.16.43";
import {readClashPerkXlsx,parseClashPerkSheets} from "./cwl-clashperk-xlsx.mjs?v=1.19.0";
import {readAllStatWars,planClashPerkMerge,commitClashPerkMerge} from "./cwl-clashperk-import-db.mjs?v=1.19.0";
import {sanitizeSnapshot,clashTime} from "./cwl-live-core.mjs?v=1.3.6";
import {computeComparableForm} from "./cwl-comparable-form.mjs?v=1.16.3";
const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pct=x=>x===null?"–":x+"%";
const attackCount=n=>n+(n===1?" Angriff":" Angriffe");
const chunks=(xs,n)=>Array.from({length:Math.ceil(xs.length/n)},(_,i)=>xs.slice(i*n,(i+1)*n));
/* Server freshness is distinct from historical completeness. GitHub's
   scheduled collector may be delayed; an old success must not look current. */
export function collectorHealthDisplay(health,enabled,now=Date.now()){
  if(!enabled)return {state:"none",
    text:"Für die automatische Erfassung melde dich an und wähle einen Clan aus."};
  const last=health?.last_success_at?new Date(health.last_success_at):null;
  const valid=last&&!Number.isNaN(last.getTime());
  const lastText=valid?
    last.toLocaleString("de-AT",{dateStyle:"short",timeStyle:"short"}):
    "noch kein erfolgreicher Abgleich";
  if(health?.last_error)return {state:"error",
    text:"Der letzte automatische Abgleich ist fehlgeschlagen. Zuletzt erfolgreich: "+lastText+"."};
  if(!valid)return {state:"none",
    text:"Noch kein erfolgreicher automatischer Abgleich bestätigt."};
  const hoursSinceSuccess=now-last.getTime();
  if(!Number.isFinite(hoursSinceSuccess)||hoursSinceSuccess>3*60*60*1000)
    return {state:"stale",
      text:"Neue Kriegsdaten kommen möglicherweise verspätet. Zuletzt erfolgreich: "+lastText+". Neue Angriffe könnten noch fehlen."};
  return {state:"ok",
    text:"Kriegsdaten zuletzt erfolgreich geprüft: "+lastText+". Laufende Kriege bleiben bis zum Abschluss vorläufig."};
}
export function statsLoadNotice(wars=[]){
  const items=Array.isArray(wars)?wars:[];
  const finished=items.filter(w=>w?.finalized===true).length;
  const unconfirmed=items.length-finished;
  if(!items.length)return "Noch keine Kriege gespeichert.";
  const finishedText=finished?
    finished+" abgeschlossene"+(finished===1?"r Krieg":" Kriege")+" gespeichert":
    "Noch keine abgeschlossenen Kriege";
  const pendingText=unconfirmed?
    " · "+unconfirmed+(unconfirmed===1?
      " weiterer Krieg noch nicht bestätigt":" weitere Kriege noch nicht bestätigt"):"";
  return "Historie geladen · "+finishedText+pendingText+".";
}
export function createCloudStats({sb,context,notify,confirmAction}) {
  let scope=null,wars=[],attacks=[],missedEvents=[],collectorHealth=null,loading=false,loadingClan=null,importing=false,version=0,lastCapture=new Set();
  let type="all",last="all",cwlSeasons="all",sameHigher=false,showFormer=true,search="",order="attacks",section="overview";
  let formWindow=90,formSearch="",formSort="evidence",compareType="all",compareDays="all";
  let trendType="all",trendDays="all";
  let duelLeft="",duelRight="",duelSameTH=true,trendMetric="hitRate",trendGranularity="week";
  const notice=message=>{const e=$("statsFeedback");if(e)e.textContent=message||""};
  let cachedPlayerStats=new Map(),cachedRecentStats=new Map(),lastMetricSignature="";
  let comparableProfiles=new Map(),comparableSummary=null,lastComparableRowsMarkup=null;
  let lastFormRowsVersion=-1,lastFormRowsClan=null;
  let viewComparableProfiles=new Map(),viewComparableSummary=null;
  const openStatsPlayers=new Set();
  let cachedSummary=null,lastRowsMarkup=null,lastRowsHost=null,lastRowsVersion=-1,lastRowsClan=null,lastMembersNotifiedVersion=-1;
  let historyAttacksByWar=new Map();
  let lastMatchupVersion=-1,lastMatchupClan=null,lastDuelVersion=-1,lastDuelClan=null,lastTrendVersion=-1,lastTrendClan=null;

  // Preserve a focused native disclosure and its reading position only
  // during data reloads in the same clan. Explicit filter changes should
  // remain free to move the content instead of forcing an old scroll offset.
  function captureRefreshDisclosure(host,selector,priorVersion,priorClan,area){
    const element=host.querySelector(selector);
    const active=document.activeElement;
    const focused=!!element&&active===element;
    const reload=priorVersion>=0&&priorVersion!==version&&
      priorClan===context().clanId&&section===area&&
      $("view-stats")?.classList.contains("active");
    return {focused,top:reload&&element?element.getBoundingClientRect().top:null};
  }
  function restoreRefreshDisclosure(host,selector,captured){
    const element=host.querySelector(selector);
    if(captured.focused)element?.focus({preventScroll:true});
    if(captured.top!==null&&element)
      window.scrollBy(0,element.getBoundingClientRect().top-captured.top);
  }
  function getPlayerStats(tag){return scope===context().clanId?cachedPlayerStats.get(cleanTag(tag))||null:null}
  function getRecentPlayerStats(tag){return scope===context().clanId?cachedRecentStats.get(cleanTag(tag))||null:null}
  function getComparablePlayerStats(tag){return scope===context().clanId?comparableProfiles.get(cleanTag(tag))||null:null}
  window.CWLCloudStats={getPlayerStats,getRecentPlayerStats,getComparablePlayerStats,onUpdate:()=>window.CWLRefreshMembers?.()};
  // Current roster names are presentation-only. Historic attack identities and
  // former members remain unchanged; values and saved war records are untouched.
  function withCurrentRosterNames(rows,ctx=context()){
    const active=new Set((ctx.memberTags||[]).map(cleanTag));
    const names=new Map();
    for(const member of ctx.memberProfiles||[]){
      const tag=cleanTag(member?.playerTag);
      if(!active.has(tag))continue;
      const name=String(member?.name||"").trim().slice(0,80);
      if(name)names.set(tag,name);
    }
    return rows.map(p=>{
      const name=names.get(cleanTag(p.tag));
      return name&&name!==p.name?{...p,name}:p;
    });
  }
  const formPct=rate=>rate===null||!Number.isFinite(rate)?"–":rate+" %";
  const formStar=number=>number===null||!Number.isFinite(number)?"–":
    number.toLocaleString("de-AT",{minimumFractionDigits:2,maximumFractionDigits:2})+" ★";
  function renderComparableForm(){
    const host=$("statsFormRows"),desc=$("statsFormIntro");
    const ctx=context();
    if(!host||!ctx.active||scope!==ctx.clanId)return;
    const data=computePlayerFormWindows(wars,attacks,{
      windows:[30,90,180],memberTags:ctx.memberTags||[],memberProfiles:ctx.memberProfiles||[]
    });
    const term=formSearch.trim().toLocaleLowerCase("de");
    const rows=sortPlayerFormRows(data.players.filter(p=>
      !term||p.name.toLocaleLowerCase("de").includes(term)||p.tag.toLowerCase().includes(term)
    ),formWindow,formSort);
    for(const button of document.querySelectorAll("#view-stats [data-form-window]")){
      const active=Number(button.dataset.formWindow)===formWindow;
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",String(active));
    }
    const usable=rows.filter(p=>p.windows[formWindow].attacks>0).length;
    const unassessed=rows.length-usable;
    if(desc)desc.textContent="Letzte "+formWindow+" Tage · "+usable+
      " Spieler mit passenden Angriffen · "+
      unassessed+" ohne auswertbare Angriffe. "+
      (formSort==="evidence"?
        "Nach Angriffsmenge, dann 3★-Quote sortiert. ":
        formSort==="hitRate"?"Nach 3★-Quote sortiert (auch bei wenigen Angriffen). ":
        formSort==="attacks"?"Nach Angriffszahl sortiert. ":
        "Alphabetisch sortiert. ")+
      "Keine Rangliste der Spielerstärke.";
    const sameClanRefresh=section==="form"&&$("view-stats")?.classList.contains("active")&&
      lastFormRowsVersion>=0&&lastFormRowsVersion!==version&&lastFormRowsClan===ctx.clanId;
    const topMargin=Math.max(0,document.querySelector(".topbar")
      ?.getBoundingClientRect().bottom||0)+4;
    const anchor=sameClanRefresh?[...host.querySelectorAll(".stats-form-row")].find(el=>{
      const box=el.getBoundingClientRect();
      return box.bottom>topMargin&&box.top<window.innerHeight-24;
    }):null;
    const anchorTag=anchor?.dataset.formTag,anchorTop=anchor?.getBoundingClientRect().top;
    const markup=rows.length?rows.map((p,i)=>{
      const b=p.windows[formWindow],pct=b.hitRate===null?"Keine Daten":b.hitRate+" %";
      const why=b.excludedDifferentRH+b.excludedUnknownRH;
      const quality=b.attacks?b.quality:why?"Keine Angriffe gegen gleiches RH erfasst":
        "Keine erfassten Angriffe im Zeitraum";
      const few=b.attacks>0&&b.attacks<5;
      const other=why?" · "+b.excludedDifferentRH+" andere RH · "+
        b.excludedUnknownRH+" RH unbekannt":"";
      return "<div class='stats-form-row' data-form-tag='"+esc(p.tag)+"'>"+
        "<div class='stats-form-person'><span class='stats-form-rank' aria-label='Zeile "+(i+1)+"'>"+
          (i+1)+".</span><b>"+esc(p.name)+"</b>"+
        "<small>"+(p.former?"Früherer Spieler · ":"")+esc(quality)+
          (few&&!/wenige Angriffe/i.test(quality)?" · Erst wenige Angriffe":"")+"</small></div>"+
        "<div class='stats-form-results'>"+
          "<div class='stats-form-figure'><span>3★-Quote · Gegner mit gleichem RH</span>"+
            "<strong>"+pct+"</strong></div>"+
          "<div class='stats-bar-track' role='img' aria-label='"+esc(b.attacks?
            pct+" aus "+b.attacks+" Angriffen gegen gleiches RH":
            "Keine auswertbaren Angriffe gegen gleiches RH")+"'>"+
            (b.attacks?"<div class='stats-bar-fill' style='width:"+b.hitRate+"%'></div>":"")+
          "</div>"+
          "<small class='stats-form-breakdown'>"+(b.attacks?
            b.triples+" von "+b.attacks+" Angriffen mit 3★ · Ø "+
            b.averageStars.toLocaleString("de-AT",{minimumFractionDigits:2,maximumFractionDigits:2})+
            " ★ · CW "+b.normal+" / CWL "+b.cwl:
            "Keine belegte 3★-Quote")+esc(other)+"</small>"+
          (b.newest?"<small>Letzter gleich-RH-Angriff im Krieg vom "+
            esc(new Date(b.newest).toLocaleDateString("de-AT"))+"</small>":"")+
        "</div></div>";
    }).join(""):"<p class='stats-note'>"+(term?
      "Keine Spieler für diese Suche.":"Noch keine Clanmitglieder oder dokumentierten Angriffe vorhanden.")+"</p>";
    if(lastComparableRowsMarkup!==markup){
      host.innerHTML=markup;lastComparableRowsMarkup=markup;
      if(anchorTag&&Number.isFinite(anchorTop)){
        const restored=[...host.querySelectorAll(".stats-form-row")]
          .find(el=>el.dataset.formTag===anchorTag);
        if(restored)window.scrollBy(0,restored.getBoundingClientRect().top-anchorTop);
      }
    }
    lastFormRowsVersion=version;lastFormRowsClan=ctx.clanId;
  }
  function setStatsSection(next){
    if(!["overview","players","form","compare","history"].includes(next))return;
    section=next;
    for(const button of document.querySelectorAll("#statsSectionTabs [data-stats-section]")){
      const active=button.dataset.statsSection===section;
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",String(active));
    }
    for(const panel of document.querySelectorAll("#view-stats [data-stats-panel]"))
      panel.hidden=panel.dataset.statsPanel!==section;
  }
  function comparisonWars(){
    return selectWarDateScope(wars,{type:compareType,days:compareDays});
  }
  function starStack(dist,count){
    if(!count)return "<p class='stats-note'>Keine Sternverteilung dokumentiert.</p>";
    return "<div class='stats-stacked-stars' role='img' aria-label='"+
      esc([0,1,2,3].map(i=>i+" Sterne: "+dist[i]+" von "+count).join("; "))+"'>"+
      dist.map((n,i)=>"<span class='stars-"+i+"' style='width:"+
        (n/count*100).toFixed(2)+"%'></span>").join("")+"</div>"+
      "<div class='stats-star-legend'>"+dist.map((n,i)=>
        "<span class='stats-star-key stars-"+i+"'><i aria-hidden='true'></i>"+
        "<b>"+i+"★</b><span>"+n+" Angriff"+(n===1?"":"e")+"</span></span>"
      ).join("")+"</div>";
  }
  function renderMatchups(){
    const host=$("statsMatchupComparison"),label=$("statsCompareScope");
    if(!host)return;
    const chosen=comparisonWars();
    const warTypeLabel=compareType==="normal"?"normale CWs":
      compareType==="cwl"?"CWL-Kriegstage":"CW-/CWL-Kriegstage";
    if(label)label.textContent=chosen.length?
      chosen.length+" abgeschlossene "+warTypeLabel+
        " ausgewählt. Die übrige Statistik bleibt unverändert.":
      wars.length?
        "Keine abgeschlossenen Kriege für diese Auswahl. Zeitraum oder Kriegsart ändern.":
        "Noch keine abgeschlossenen Kriege erfasst.";
        const data=computeThMatchupComparison(chosen,attacks,{type:"all",last:"all",cwlSeasons:"all"});
    if(!data.some(row=>row.attacks>0)){
      host.innerHTML="<p class='stats-note'>"+(chosen.length?
        "Für diese Kriege sind noch keine Angriffe erfasst. Eine 3★-Quote ist deshalb nicht bekannt.":
        "Keine Kriege für diesen Vergleich. Wähle einen anderen Zeitraum oder eine andere Kriegsart.")+
        "</p>";
      lastMatchupVersion=version;lastMatchupClan=context().clanId;
      return;
    }
    const labels={lower:"Gegner-RH niedriger",same:"Gleiches Rathaus",higher:"Gegner-RH höher",unknown:"RH unbekannt"};
    // Only show the selected war type in the optional breakdown. A CW-only
    // filter must not leave an empty CWL panel (or vice versa).
    const kinds=compareType==="normal"?[["normal","Normale Clankriege"]]:
      compareType==="cwl"?[["cwl","CWL"]]:
      [["normal","Normale Clankriege"],["cwl","CWL"]];
    // First-glance comparison uses the same filtered attacks as the detail view.
    // Comparing a CW against lower RH with CWL at equal RH is an observation,
    // not evidence of a particular player quality or a causal league effect.
    const threeFor=kind=>[
      {kind,matchup:"lower",label:(kind==="cwl"?"CWL":"CW")+" · niedrigeres RH"},
      {kind,matchup:"same",label:(kind==="cwl"?"CWL":"CW")+" · gleiches RH"},
      {kind,matchup:"higher",label:(kind==="cwl"?"CWL":"CW")+" · höheres RH"}
    ];
    const highlights=compareType==="normal"?threeFor("normal"):
      compareType==="cwl"?threeFor("cwl"):
      [threeFor("normal")[0],threeFor("normal")[1],threeFor("cwl")[1]];
    const intro=compareType==="all"?
      "CW gegen niedrigeres und gleiches RH sowie CWL gegen gleiches RH – mit belegter Angriffszahl.":
      "3★-Quoten gegen niedrigere, gleiche und höhere Rathausstufen – nur für "+
      (compareType==="normal"?"normale Clankriege.":"CWL-Kriegstage.");
    const highlightsHtml="<p class='stats-highlight-intro'>"+intro+"</p>"+
      "<div class='stats-highlight-cols' role='group' aria-label='Drei-Sterne-Quote nach Gegnerstärke und Kriegsart'>"+
      highlights.map(item=>{
        const row=data.find(r=>r.type===item.kind&&r.matchup===item.matchup);
        const count=row?.attacks||0;
        const quote=count?row.hitRate:null;
        const height=quote===null?0:Math.max(2,Math.min(100,Number(quote)||0));
        return "<div class='stats-highlight-col'><strong>"+(quote===null?"–":quote+" %")+"</strong>"+
          "<div class='stats-highlight-plot' role='img' aria-label='"+esc(item.label+": "+
            (quote===null?"keine Daten":quote+" Prozent aus "+count+" Angriffen"))+"'>"+
            (quote===null?"":"<div class='stats-highlight-fill' style='height:"+height+"%'></div>")+
          "</div><span>"+esc(item.label)+"</span><small>"+
            (count?row.triples+" von "+count+" Angriffen": "Keine Angriffe")+
            (count>0&&count<6?" · wenige Daten":"")+"</small></div>";
      }).join("")+"</div>"+
      "<p class='stats-note'>Die Werte beschreiben eure dokumentierten Angriffe. "+
      "Unterschiedliche Gegnerbasen, Anzahl der Angriffe und CWL-Bedingungen können die Quoten beeinflussen.</p>";
    const wasBreakdownOpen=host.querySelector(".stats-matchup-breakdown")?.open===true;
    const focusContext=captureRefreshDisclosure(host,
      ".stats-matchup-breakdown > summary",lastMatchupVersion,lastMatchupClan,"compare");
    host.innerHTML=highlightsHtml+"<details class='stats-matchup-breakdown'"+
      (wasBreakdownOpen?" open":"")+"><summary>Weitere Rathaus-Kombinationen und Sternverteilungen</summary>"+
      "<div class='stats-matchup-grid'>"+kinds.map(([kind,title])=>{
      const rows=data.filter(row=>row.type===kind);
      const n=rows.reduce((sum,row)=>sum+row.attacks,0);
      return "<div class='stats-matchup-group'><h4>"+title+" · "+n+" Angriffe</h4>"+
        "<div class='stats-compare-bars'>"+
        rows.map(row=>"<div class='stats-compare-line'>"+
          "<div class='stats-compare-line-head'><span>"+labels[row.matchup]+"</span>"+
          "<strong>"+(row.attacks?row.hitRate+" % 3★":"–")+"</strong></div>"+
          "<div class='stats-bar-track' role='img' aria-label='"+esc(labels[row.matchup]+": "+
            (row.attacks?row.hitRate+" Prozent aus "+row.attacks+" Angriffen":"Keine Angriffe"))+"'>"+
            (row.attacks?"<div class='stats-bar-fill' style='width:"+row.hitRate+"%'></div>":"")+
          "</div><small>"+(row.attacks?row.triples+" von "+row.attacks+
            " Dreier · Ø "+row.averageStars.toLocaleString("de-AT",
              {minimumFractionDigits:2,maximumFractionDigits:2})+" ★":
            "Keine Angriffe dokumentiert")+"</small>"+
          (row.attacks?starStack(row.starDistribution,row.attacks):"")+
        "</div>").join("")+"</div></div>";
    }).join("")+"</div></details>";
    lastMatchupVersion=version;lastMatchupClan=context().clanId;
    restoreRefreshDisclosure(host,".stats-matchup-breakdown > summary",focusContext);
  }
  function renderDuel(){
    const host=$("statsDuelResults"),first=$("statsDuelLeft"),second=$("statsDuelRight");
    if(!host||!first||!second)return;
    const chosen=comparisonWars();
    const available=withCurrentRosterNames(computeWarStats(chosen,attacks,{
      type:"all",last:"all",cwlSeasons:"all",showFormer:true
    }).rows).filter(p=>p.tag&&p.attacks>0)
      .sort((a,b)=>a.name.localeCompare(b.name,"de"));
    const keyed=new Map(available.map(p=>[cleanTag(p.tag),p]));
    if(!keyed.has(duelLeft))duelLeft=available[0]?.tag||"";
    if(!keyed.has(duelRight)||duelRight===duelLeft)
      duelRight=available.find(p=>p.tag!==duelLeft)?.tag||"";
    const options="<option value=''>Spieler wählen</option>"+available
      .map(p=>"<option value='"+esc(p.tag)+"'>"+esc(p.name)+"</option>").join("");
    const signature=available.map(p=>p.tag+":"+p.name).join("|");
    for(const select of [first,second]){
      if(select.dataset.optionSignature!==signature){
        select.innerHTML=options;select.dataset.optionSignature=signature;
      }
    }
    first.value=duelLeft;second.value=duelRight;
    if($("statsDuelSameTH"))$("statsDuelSameTH").checked=duelSameTH;
    if(!duelLeft||!duelRight){
      host.innerHTML="<p class='stats-note'>Für einen direkten Vergleich brauchst du zwei Spieler mit erfassten Angriffen. Wähle bei Bedarf einen größeren Zeitraum.</p>";
      return;
    }
    const results=computePlayerDuel(chosen,attacks,duelLeft,duelRight,{
      type:"all",last:"all",cwlSeasons:"all",sameTH:duelSameTH
    });
    const human=n=>n===null?"–":String(n)+" %";
    const fmtAvg=n=>n===null?"–":n.toLocaleString("de-AT",{
      minimumFractionDigits:2,maximumFractionDigits:2})+" ★";
    const dataQuality=n=>n===0?"Keine Angriffe":n<6?"Wenige Daten":
      n<15?"Erste Tendenz":"Viele Angriffe erfasst";
    // Render the same underlying numbers, but with a single visible
    // comparison hierarchy. Detailed star charts belong behind one disclosure.
    const renderOne=(p,i)=>{
      const name=keyed.get(cleanTag(p.tag))?.name||p.tag;
      return "<div class='stats-duel-person'><h4><span class='stats-duel-player-key'>Spieler "+
        (i===0?"A":"B")+"</span>"+esc(name)+"</h4>"+
        "<div class='stats-form-figure'><span>3★-Quote</span><strong>"+
          human(p.hitRate)+"</strong></div>"+
        "<div class='stats-bar-track' role='img' aria-label='"+esc(
          p.attacks?p.triples+" von "+p.attacks+" Dreier, "+human(p.hitRate):
            "Keine passenden Angriffe dokumentiert")+"'>"+
          (p.attacks?"<div class='stats-bar-fill' style='width:"+
            p.hitRate+"%'></div>":"")+
        "</div><p class='stats-duel-sample'>"+
          (p.attacks?p.triples+" von "+p.attacks+" Angriffen":
            "Keine passenden Angriffe")+
        "</p><small class='stats-duel-quality'>"+dataQuality(p.attacks)+
        "</small></div>";
    };
    const row=(kind,label)=>{
      const [a,b]=results.players.map(p=>p[kind]);
      const cell=(g,side)=>{
        const value=g.attacks?human(g.hitRate)+" · "+g.triples+"/"+g.attacks+" Dreier":
          "Keine Angriffe";
        return "<span class='stats-duel-split-value' aria-label='"+
          esc("Spieler "+side+": "+label+", "+value)+"'>"+value+"</span>";
      };
      return "<div class='stats-duel-split-row'><span class='stats-duel-split-label'>"+
        label+"</span>"+cell(a,"A")+cell(b,"B")+"</div>";
    };
    const previousOpen=host.querySelector(".stats-duel-details")?.open===true;
    const focusContext=captureRefreshDisclosure(host,
      ".stats-duel-details > summary",lastDuelVersion,lastDuelClan,"compare");
    const extra=p=>{
      const name=keyed.get(cleanTag(p.tag))?.name||p.tag;
      return "<div class='stats-duel-extra'><h4>"+esc(name)+"</h4>"+
        "<p>"+p.wars+" Kriege · Ø "+fmtAvg(p.averageStars)+
        (p.lastWar?" · letzter Krieg "+
          esc(new Date(p.lastWar).toLocaleDateString("de-AT")):"")+"</p>"+
        starStack(p.starDistribution,p.attacks)+"</div>";
    };
    const lowSample=results.players.some(p=>p.attacks<6);
    host.innerHTML="<div class='stats-duel-grid'>"+
      results.players.map(renderOne).join("")+"</div>"+
      "<div class='stats-duel-splits' role='group' aria-label='CWL und normale Clankriege pro Spieler'>"+
        "<div class='stats-duel-split-head'><span>Kriegsart</span>"+
          "<span>Spieler A</span><span>Spieler B</span></div>"+
        row("normal","Normaler CW")+row("cwl","CWL")+"</div>"+
      "<p class='stats-note stats-duel-caveat'>"+
        (duelSameTH?"Nur Angriffe gegen dasselbe Rathaus.":
          "Alle Gegner-Rathäuser, auch niedrigere und höhere.")+
        " Gleiche Auswahl von "+results.selectedWars+
        " Kriegen, aber unterschiedliche Gegner und Angriffszahlen. "+
        (lowSample?"Wenige Angriffe erlauben noch keinen belastbaren Vergleich.":
          "Die Quoten sind keine allgemeine Spielstärkebewertung.")+
      "</p>"+
      "<details class='stats-duel-details'"+(previousOpen?" open":"")+">"+
        "<summary>Sternverteilung und weitere Angriffsdaten</summary>"+
        "<div class='stats-duel-extra-grid'>"+
          results.players.map(extra).join("")+"</div></details>";
    lastDuelVersion=version;lastDuelClan=context().clanId;
    restoreRefreshDisclosure(host,".stats-duel-details > summary",focusContext);
  }
  function renderTimeline(){
    const chart=$("statsTrendChart"),detail=$("statsTrendTable");
    if(!chart||!detail)return;
    const ownWars=selectWarDateScope(wars,{type:trendType,days:trendDays});
    const trend=computeStatsTimeline(ownWars,attacks,{type:"all",last:"all",cwlSeasons:"all",granularity:trendGranularity});
    const all=trend.rows,rows=all.slice(-20);
    const W=760,H=252,L=48,R=18,T=20,B=43;
    const layout=computeTrendPlotGeometry(rows,{
      granularity:trendGranularity,width:W,left:L,right:R
    });
    const missingLabel=trendGranularity==="week"?"Wochen":
      trendGranularity==="day"?"Tage":"Monate";
    const coverage=rows.length===0?
      "Noch keine Angriffe für einen Verlauf erfasst.":
      rows.length===1?
        "Nur ein beobachteter Zeitraum – ein Trend ist daraus nicht ableitbar.":
        layout.missingPeriods?
          "Zwischen den dargestellten Punkten liegen "+layout.missingPeriods+" "+
            missingLabel+" ohne dokumentierte Angriffe – keine 0-%-Werte.":
          "Zwischen den dargestellten Punkten gibt es keine ganzen unbeobachteten "+missingLabel+".";
    if($("statsTrendScope"))$("statsTrendScope").textContent=!ownWars.length?
      (wars.length?
        "Keine abgeschlossenen Kriege für diese Auswahl. Zeitraum oder Kriegsart ändern.":
        "Noch keine abgeschlossenen Kriege erfasst."):
      ownWars.length+(ownWars.length===1?" ausgewählter Krieg · ":" ausgewählte Kriege · ")+
      trend.recordedAttacks+(trend.recordedAttacks===1?
        " erfasster Angriff. ":" erfasste Angriffe. ")+coverage+
      (rows.length>1?" Lücken bleiben im Diagramm offen.":"");
        const signature=[version,trendType,trendDays,trendMetric,trendGranularity].join("|");
    if(chart.dataset.signature===signature)return;
    chart.dataset.signature=signature;
    const label=trendMetric==="hitRate"?"3★-Quote":"Ø Sterne";
    const colors={normal:"series-cw",cwl:"series-cwl"};
    if(!rows.length){
      chart.innerHTML="<p class='stats-note'>Noch kein Verlauf möglich: In dieser Auswahl sind keine Angriffe erfasst.</p>";
      detail.replaceChildren();return;
    }
    const plotH=H-T-B,maximum=trendMetric==="hitRate"?100:3;
    const x=i=>layout.positions[i];
    const y=value=>T+(maximum-value)/maximum*plotH;
    const point=(kind,i,row)=>{
      const v=row[kind][trendMetric],n=row[kind].attacks;
      if(v===null)return null;
      return {x:x(i),y:y(v),value:v,n,key:row.key,
        title:(kind==="cwl"?"CWL":"Normaler CW")+" · "+formatTrendPeriod(row.key,trendGranularity)+
          " · "+(trendMetric==="hitRate"?"3★-Quote: ":"Ø Sterne je Angriff: ")+
          v+(trendMetric==="hitRate"?" %":" ★")+
          " · "+attackCount(n)};
    };
    const grid=[0,.25,.5,.75,1].map(part=>{
      const yy=y(part*maximum),v=part*maximum;
      return "<line class='gridline' x1='"+L+"' x2='"+(W-R)+"' y1='"+yy+"' y2='"+yy+"'/>"+
        "<text class='axislabel' text-anchor='end' x='"+(L-8)+"' y='"+(yy+4)+"'>"+
        (trendMetric==="hitRate"?Math.round(v)+"%":v.toFixed(2).replace(".",","))+"</text>";
    }).join("");
    // Tick labels are spaced by actual pixels, not by number of observations.
    let previousTick=-Infinity;
    const axis=rows.map((row,i)=>{
      if(i!==0&&x(i)-previousTick<95)return "";
      previousTick=x(i);
      return "<text class='axislabel' text-anchor='middle' x='"+x(i).toFixed(1)+
        "' y='"+(H-18)+"'>"+
        esc(formatTrendPeriod(row.key,trendGranularity,{short:true}))+"</text>";
    }).join("");
    const gaps=layout.gaps.map(g=>{
      const yy=H-B+8;
      return "<path class='stats-gap-mark' d='M "+(g.midX-6).toFixed(1)+" "+
        yy+" l4 -7 m3 7 l4 -7'><title>"+
        esc(g.skipped+" "+(g.skipped===1?
          (trendGranularity==="month"?"Monat":trendGranularity==="week"?"Woche":"Tag"):
          missingLabel)+" ohne dokumentierte Angriffe")+"</title></path>";
    }).join("");
    const series=["normal","cwl"].map(kind=>{
      const pts=rows.map((row,i)=>point(kind,i,row)).filter(Boolean);
      if(!pts.length)return "";
      const lines=layout.segments[kind].map(indices=>
        "<polyline class='statline "+colors[kind]+
        "' points='"+indices.map(i=>{
          const p=point(kind,i,rows[i]);
          return p.x.toFixed(1)+","+p.y.toFixed(1);
        }).join(" ")+"'/>").join("");
      const dots=pts.map(p=>kind==="cwl"?
        "<polygon class='statpoint "+colors[kind]+"' points='"+
          [[p.x,p.y-6],[p.x+6,p.y],[p.x,p.y+6],[p.x-6,p.y]]
            .map(v=>v.map(n=>n.toFixed(1)).join(",")).join(" ")+"'><title>"+
          esc(p.title)+"</title></polygon>":
        "<circle class='statpoint "+colors[kind]+"' cx='"+
          p.x.toFixed(1)+"' cy='"+p.y.toFixed(1)+"' r='5'><title>"+
          esc(p.title)+"</title></circle>").join("");
      return lines+dots;
    }).join("");
    chart.innerHTML="<svg role='img' aria-label='"+esc(label+
      " nach "+(trendGranularity==="week"?"Wochen":trendGranularity==="day"?"Tagen":"Monaten")+
      "; Kalenderabstände maßstabsgetreu; Lücken ohne gemessene Angriffe bleiben ohne Linie. Kreise: normale CWs, Rauten: CWL. Angriffsanzahl steht in der Datentabelle")+
      "' viewBox='0 0 "+W+" "+H+"' preserveAspectRatio='xMidYMid meet'>"+
      grid+gaps+axis+series+"</svg>";
    const wasOpen=detail.querySelector("details")?.open===true;
    const focusContext=captureRefreshDisclosure(detail,
      "details > summary",lastTrendVersion,lastTrendClan,"history");
    const previousTable=detail.querySelector(".stats-war-history-scroll");
    const reloadTable=lastTrendVersion>=0&&lastTrendVersion!==version&&
      lastTrendClan===context().clanId&&section==="history"&&
      $("view-stats")?.classList.contains("active");
    const tableScrollLeft=reloadTable&&previousTable?previousTable.scrollLeft:null;
    const tableFocused=reloadTable&&document.activeElement===previousTable;
    const fmt=(data)=>{
      const val=data[trendMetric];
      return data.attacks?(val+(trendMetric==="hitRate"?" %":" ★")+
        " ("+attackCount(data.attacks)+")"):"–";
    };
    const table=all.slice().reverse().map(row=>"<tr><td>"+esc(formatTrendPeriod(row.key,trendGranularity))+
      "</td><td>"+fmt(row.normal)+"</td><td>"+fmt(row.cwl)+"</td></tr>").join("");
    detail.innerHTML="<details"+(wasOpen?" open":"")+"><summary>Alle "+all.length+
      " erfassten Zeiträume mit Angriffsanzahl anzeigen</summary>"+
      "<div class='stats-war-history-scroll' role='region' tabindex='0' "+
        "aria-label='Verlaufstabelle; auf kleinen Bildschirmen seitlich scrollen'>"+
      "<table><thead><tr><th scope='col'>Zeitraum</th><th scope='col'>CW</th><th scope='col'>CWL</th></tr></thead><tbody>"+
      table+"</tbody></table></div></details>"+
      (all.length>20?"<p class='stats-note'>Das Diagramm zeigt die letzten 20 Zeiträume. In der Tabelle stehen alle.</p>":"");
    lastTrendVersion=version;lastTrendClan=context().clanId;
    const nextTable=detail.querySelector(".stats-war-history-scroll");
    if(tableScrollLeft!==null&&nextTable)nextTable.scrollLeft=tableScrollLeft;
    if(tableFocused)nextTable?.focus({preventScroll:true});
    restoreRefreshDisclosure(detail,"details > summary",focusContext);
  }
  function render(){
    setStatsSection(section);
    const ctx=context(),view=$("view-stats");
    if(!view)return;
    const enabled=!!ctx.active&&!!ctx.clanId;
    // Capture the visible war before the timeline/table above it grows or
    // shrinks. Waiting until renderWarHistory() loses that prior position.
    let earlyHistoryAnchor=null;
    const historyHost=$("statsWarHistory");
    if(enabled&&section==="history"&&view.classList.contains("active")&&
       historyHost?.dataset.historyClan===String(ctx.clanId)&&
       historyHost.hasAttribute("data-history-version")&&
       Number(historyHost.dataset.historyVersion)!==version){
      const top=Math.max(0,document.querySelector(".topbar")
        ?.getBoundingClientRect().bottom||0)+4;
      const visible=[...historyHost.querySelectorAll(".war-history-item")].find(el=>{
        const rect=el.getBoundingClientRect();
        return rect.bottom>top&&rect.top<window.innerHeight-24;
      });
      if(visible)earlyHistoryAnchor={
        warKey:visible.dataset.warKey,top:visible.getBoundingClientRect().top
      };
    }
    const freshness=$("statsCollectorHealth");
    if(freshness){
      const presentation=collectorHealthDisplay(collectorHealth,enabled);
      freshness.textContent=presentation.text;
      freshness.dataset.health=presentation.state;
    }
    const canImport=enabled&&(ctx.role==="owner"||ctx.role==="editor");
    const ctl=$("statsImportButton");if(ctl)ctl.hidden=!canImport;
    const entry=$("statsImportEntry");if(entry)entry.hidden=!canImport;
    const copy=$("statsNoCloud");if(copy)copy.hidden=enabled;
    if(!enabled){
      $("statsSummary").innerHTML="";
      if($("statsMissedCoverage"))$("statsMissedCoverage").textContent="";
       if($("statsSeasonDetails"))$("statsSeasonDetails").textContent="";
       if($("statsSeasonDisclosure")){
         $("statsSeasonDisclosure").open=false;$("statsSeasonDisclosure").hidden=true;
       }
      if($("statsFormIntro"))$("statsFormIntro").textContent="";
      if($("statsFormRows"))$("statsFormRows").replaceChildren();
      lastComparableRowsMarkup=null;
      $("statsRows").innerHTML="";
      $("statsWarHistory").innerHTML="";
      if($("statsMatchupComparison"))$("statsMatchupComparison").replaceChildren();
      if($("statsDuelResults"))$("statsDuelResults").replaceChildren();
      if($("statsTrendChart"))$("statsTrendChart").replaceChildren();
      if($("statsTrendTable"))$("statsTrendTable").replaceChildren();
      $("statsWarHistory").removeAttribute("data-history-signature");
      $("statsWarHistory").removeAttribute("data-history-clan");
      cachedSummary=null;lastMetricSignature="";lastRowsMarkup=null;lastRowsHost=null;
      lastRowsVersion=-1;lastRowsClan=null;
      return;
    }
    const metricSignature=[ctx.clanId,version,type,last,cwlSeasons,sameHigher,showFormer,(ctx.memberTags||[]).join(",")].join("|");
    const metricsChanged=metricSignature!==lastMetricSignature||!cachedSummary;
    if(metricsChanged){
      cachedSummary=computeWarStats(wars,attacks,{type,last,cwlSeasons,sameHigher,showFormer,memberTags:ctx.memberTags||[],missedEvents});
      lastMetricSignature=metricSignature;
    }
    // The overview and member badges are never restricted by the free
    // player-statistics query. No hidden filter can change their results.
    const overviewSummary=computeWarStats(wars,attacks,{
      type:"all",last:"all",cwlSeasons:"all",sameHigher:false,showFormer:true,
      memberTags:ctx.memberTags||[],missedEvents
    });
    cachedPlayerStats=new Map(overviewSummary.rows.map(p=>[cleanTag(p.tag),p]));
    const summary=section==="overview"?overviewSummary:cachedSummary;
    syncPeriodChoices();
    const scopeInfo=describeWarSelection(wars,{type,last,cwlSeasons});
    const selected=scopeInfo.selected;
    const formatDate=value=>value?new Date(value).toLocaleDateString("de-AT"):"–";
    if($("statsPlayerScope"))$("statsPlayerScope").textContent=scopeInfo.selectedWars?
      "Diese Tabelle berücksichtigt ausschließlich "+scopeInfo.selectedWars+
      (scopeInfo.selectedWars===1?
        " ausgewählten abgeschlossenen Krieg bzw. CWL-Tag (":
        " ausgewählte abgeschlossene Kriege bzw. CWL-Tage (")+
      formatDate(scopeInfo.first)+" – "+formatDate(scopeInfo.recent)+"). "+
      "Kein zusätzliches 10- oder 90-Tage-Fenster.":
      "Für diese Auswahl sind noch keine abgeschlossenen Kriege bzw. CWL-Tage gespeichert. "+
      "Fehlende Angriffe sind keine 0-%-Quote.";
    if($("statsScopeExplainer")){
      const normal=type==="cwl"?"":last==="all"?
        "Alle "+scopeInfo.allNormal+" verfügbaren normalen "+(scopeInfo.allNormal===1?"CW":"CWs"):
        scopeInfo.selectedNormal+" von "+scopeInfo.allNormal+
        " normalen CWs (Obergrenze: "+last+")";
      const league=type==="normal"?"":cwlSeasons==="all"?
        "alle "+scopeInfo.allCwl+" vorhandenen CWL-Durchgänge":
        scopeInfo.selectedCwl+" von "+scopeInfo.allCwl+" CWL-Durchgängen";
      $("statsScopeExplainer").textContent=scopeInfo.selectedWars?
        [normal,league].filter(Boolean).join(" + ")+
        " · alle sichtbaren Spielerwerte nutzen exakt diese Datenbasis.":
        "Keine abgeschlossenen Kriege in dieser Auswahl. Noch keine Spielerwerte vorhanden.";
    }
    if(section==="compare"){renderMatchups();renderDuel();}
    if(section==="history"){renderTimeline();renderWarHistory(earlyHistoryAnchor);}
    if(section==="form")renderComparableForm();
    const displayMissed=(known,complete)=>complete?String(known):(known>0?"mind. "+known:"k. A.");
    const label=displayMissed(summary.missesKnown,summary.complete);
    // Give each war type its own denominator: 30/30 CWs can be exact even
    // when only 1/22 CWL days has a fully evidenced roster.
    const coverageDescriptions=[["normal","CW"],["cwl","CWL"]]
      .filter(([type])=>summary.missedCoverage[type].wars>0)
      .map(([type,name])=>{
        const c=summary.missedCoverage[type];
        return name+": "+displayMissed(c.missedKnown,c.complete)+
          " verpasst · "+c.coveredWars+"/"+c.wars+" "+
          (c.wars===1?"Krieg":"Kriege")+" vollständig erfasst";
      });
    const missedCoverageHost=$("statsMissedCoverage");
    if(missedCoverageHost)missedCoverageHost.textContent=summary.wars?
      "Verpasste Angriffe aus gespeicherten Kriegen: "+coverageDescriptions.join(" · "):
      "Noch keine abgeschlossenen Kriege gespeichert.";
    $("statsSummary").innerHTML=[
      ["3★-Quote",pct(summary.hitRate)],
      ["Ø Sterne / Angriff",summary.averageStars===null?"–":summary.averageStars.toLocaleString("de-AT",{minimumFractionDigits:2,maximumFractionDigits:2})+" ★"],
      ["Angriffe",String(summary.attacks)],
      ["Verpasste Angriffe",label]
    ].map(([title,value])=>"<div class='stats-kpi'><span>"+esc(title)+"</span><strong>"+esc(value)+"</strong></div>").join("");
    const count=$("statsDataCount");
    const seasonDetails=$("statsSeasonDetails");
     const seasonDisclosure=$("statsSeasonDisclosure");
     if(seasonDisclosure){
       seasonDisclosure.hidden=!summary.wars;
       if(!summary.wars)seasonDisclosure.open=false;
     }
    const displayType=section==="overview"?"all":type;
    if(displayType==="cwl"){
      if(count)count.textContent=summary.wars?
        summary.wars+" von "+summary.totalCwlDays+
        " abgeschlossenen CWL-Kriegstagen · "+summary.cwlSeasonBreakdown.length+
        " von "+summary.totalCwlSeasons+" CWL-Durchgängen · "+attackCount(summary.attacks):
        "Noch keine abgeschlossenen CWL-Kriegstage gespeichert";
      if(seasonDetails)seasonDetails.textContent=summary.cwlSeasonBreakdown.map(({from,to,days,inferred})=>{
        const fmt=value=>new Date(value+"T12:00:00Z").toLocaleDateString("de-AT",
          {day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"});
        return fmt(from)+(from!==to?" – "+fmt(to):"")+
          ": "+days+" erfasste Kriegstage"+(inferred?" (zeitlich zugeordnet)":"");
      }).join(" · ");
    }else{
      const leagueDays=summary.cwlSeasonBreakdown.reduce((n,s)=>n+s.days,0);
      const normalDays=summary.wars-leagueDays;
      if(displayType==="all"){
        const normalText=normalDays===1?"1 normaler CW":normalDays+" normale CWs";
        const leagueText=leagueDays===1?"1 CWL-Kriegstag":leagueDays+" CWL-Kriegstage";
        const seasonCount=summary.cwlSeasonBreakdown.length;
        if(count)count.textContent=summary.wars?
          normalText+" + "+leagueText+" aus "+seasonCount+
          (seasonCount===1?" Durchgang":" Durchgängen")+
          " · "+attackCount(summary.attacks):
          "Noch keine abgeschlossenen Kriege gespeichert";
        if(seasonDetails)seasonDetails.textContent=summary.wars?
          "Ausgewertet werden "+normalText+" und "+seasonCount+
          (seasonCount===1?" CWL-Durchgang":" CWL-Durchgänge")+
          " aus insgesamt "+summary.totalCwlSeasons+" gespeicherten CWL-Durchgängen. "+
          "Historische CWL-Durchgänge ohne Gruppenkennung werden nach Datumsabstand getrennt, bei Lücken nur vorläufig.":"";
      }else{
        if(count)count.textContent=scopeInfo.selectedNormal?
          (last==="all"?
            (scopeInfo.selectedNormal===1?"1 abgeschlossener normaler CW":
              "Alle "+scopeInfo.selectedNormal+" abgeschlossenen normalen CWs"):
            scopeInfo.selectedNormal+" von "+scopeInfo.allNormal+" abgeschlossenen normalen CWs")+
          " · "+attackCount(summary.attacks):
          "Noch keine abgeschlossenen normalen CWs gespeichert";
        if(seasonDetails)seasonDetails.textContent=last==="all"?
          "Alle verfügbaren abgeschlossenen normalen Clankriege werden ausgewertet.":
          last===1?"Der letzte abgeschlossene normale Clankrieg wird ausgewertet.":
          "Bis zu "+last+" zuletzt abgeschlossene normale Clankriege werden ausgewertet.";
      }
    }
    const note=$("statsMissingNote");
    if(note){
      note.textContent=summary.complete?"":(
        "Verpasste Angriffe: „mind.“ heißt mindestens belegt; „k. A.“ heißt unbekannt, auch 0 ist nicht bestätigt. "+
         "Eine CWL-Aufstellung allein ist kein Nachweis. Normale CWs können unabhängig davon vollständig sein. "+
         "Die Sortierung „Verpasst“ nutzt nur belegte Ausfälle."
      );
      note.hidden=summary.complete;
    }
    const guide=$("statsCoverageGuide");
    if(guide){
      const cwl=summary.missedCoverage.cwl;
      guide.hidden=!(cwl.wars>0&&!cwl.complete);
      if(guide.hidden)guide.open=false;
    }
    // Membership performance badges depend on loaded attack data, not search/sort/filter state.
    if(scope===ctx.clanId&&lastMembersNotifiedVersion!==version){
      lastMembersNotifiedVersion=version;
      window.CWLCloudStats?.onUpdate?.();
    }
    if(section!=="players")return;
    const term=search.trim().toLocaleLowerCase("de");
    const visible=withCurrentRosterNames(summary.rows,ctx)
      .filter(p=>!term||p.name.toLocaleLowerCase("de").includes(term)||p.tag.toLowerCase().includes(term))
      .sort((a,b)=>{
        const metric=p=>order==="missed"?p.missedKnown:p[order];
        const rawA=metric(a),rawB=metric(b);
        const av=rawA??-1,bv=rawB??-1;
        const diff=typeof av==="string"?av.localeCompare(bv,"de"):av-bv;
        // Only numeric metrics run highest first; the explicit name option is A–Z.
        return (order==="name"?diff:-diff)||b.attacks-a.attacks||a.name.localeCompare(b.name,"de");
      });
    const nextRowsMarkup=visible.length?visible.map((p,index)=>{
      // Raw hit rates are evidence, not green/red player grades.
      const missedColor=p.missedKnown>0?" warn":"";
      const reportedMiss=p.missedComplete?String(p.missedKnown):
        p.missedKnown?"mind. "+p.missedKnown:"k. A.";
      const detailsOpen=openStatsPlayers.has(p.tag)?" open":"";
      const oneWar=type==="normal"&&last===1?selectStatWars(wars,{type:"normal",last:1})[0]:null;
      const recent=oneWar?attacks.filter(a=>a.war_key===oneWar.war_key&&cleanTag(a.attacker_tag)===cleanTag(p.tag))
        .sort((a,b)=>a.attack_order-b.attack_order):[];
      const starChips=oneWar?"<small class='stats-attack-chips' aria-label='Einzelangriffe'>"+
        (recent.length?recent.map(a=>"<span title='"+esc((a.defender_name||"Gegner")+" · "+a.destruction+"% Zerstörung")+
          "'>"+("★".repeat(a.stars)+"☆".repeat(3-a.stars))+"<sup>"+a.attack_order+"</sup></span>").join(""):
          "<span>Kein Angriff</span>")+"</small>":"";
      return "<div class='stats-player-row'>"+
        "<div class='stats-player' title='"+esc(p.tag)+"'><span class='stats-row-number' aria-label='Listenposition "+(index+1)+"'>"+(index+1)+".</span><span class='stats-th'>"+
          (p.th&&Number.isInteger(p.th)&&p.th>=1&&p.th<=18?
           "<img class='stats-th-icon' src='https://assets.clashk.ing/buildings/home-village/town_hall/level_"+p.th+".webp' width='28' height='28' loading='lazy' decoding='async' alt='' onerror='this.remove()'>":"")+
          "<small>"+(p.th?"RH"+p.th:"RH?")+"</small></span><div class='stats-name'>"+
          "<b>"+esc(p.name)+"</b>"+(p.former?"<small>Ehemals</small>":"")+"</div></div>"+
        "<div class='stats-hit-cell'><small class='stats-mobile-label'>3★-Quote</small><strong class='stats-rate'>"+pct(p.hitRate)+"</strong>"+
        "<small class='stats-rate-avg' title='Durchschnittliche Sterne pro Angriff'>"+
        (p.averageStars===null?"Ø –":"Ø "+p.averageStars.toLocaleString("de-AT",{minimumFractionDigits:2,maximumFractionDigits:2})+" ★")+
        "</small></div>"+
        "<span class='stats-number'><small class='stats-mobile-label'>Angriffe</small>"+p.attacks+starChips+"</span>"+
        "<span class='stats-number stats-missed-cell"+missedColor+"' title='"+esc(
          "CW: "+displayMissed(p.missedKnownByType.normal,summary.missedCoverage.normal.complete)+
          " · CWL: "+displayMissed(p.missedKnownByType.cwl,summary.missedCoverage.cwl.complete)
        )+"' aria-label='"+esc(
          "Verpasste Angriffe. Normale CWs: "+
          (summary.missedCoverage.normal.wars?displayMissed(p.missedKnownByType.normal,summary.missedCoverage.normal.complete):"nicht ausgewählt")+
          ", CWL: "+
          (summary.missedCoverage.cwl.wars?displayMissed(p.missedKnownByType.cwl,summary.missedCoverage.cwl.complete):"nicht ausgewählt")
        )+"'><small class='stats-mobile-label'>Verpasst</small><strong>"+displayMissed(p.missedKnown,p.missedComplete)+"</strong>"+
        (type==="all"&&summary.missedCoverage.normal.wars?
          "<small>CW "+displayMissed(p.missedKnownByType.normal,summary.missedCoverage.normal.complete)+"</small>":"")+
        (type==="all"&&summary.missedCoverage.cwl.wars?
          "<small>CWL "+displayMissed(p.missedKnownByType.cwl,summary.missedCoverage.cwl.complete)+"</small>":"")+
        "</span>"+
        "<details class='stats-player-details' data-player-tag='"+esc(p.tag)+"'"+detailsOpen+">"+
        "<summary>Details dieser Auswahl · "+attackCount(p.attacks)+"</summary>"+
        "<div>"+p.threes+" von "+attackCount(p.attacks)+" mit 3★ · verpasst: "+reportedMiss+
        "</div><small>Diese Werte beziehen sich auf alle gewählten Kriege. "+
        "Bei CWL ohne bestätigten vollständigen Missed-Log bleiben weitere Ausfälle unbekannt – auch bei vorhandener Tagesaufstellung. "+
        "Die unabhängige aktuelle Form findest du im eigenen Reiter „Spielerform“.</small></details></div>";
    }).join(""):"<div class='stats-empty'>Keine passenden Spieler in dieser Auswahl.</div>";
    // Background data refresh may insert or reorder rows above the player's
    // current viewport. Keep the same visible player and the focused details
    // summary; intentional search/sort changes still reposition naturally.
    const rowsHost=$("statsRows");
    if(lastRowsHost!==rowsHost||lastRowsMarkup!==nextRowsMarkup){
      const active=rowsHost.contains(document.activeElement)?document.activeElement:null;
      const focusedTag=active?.matches?.(".stats-player-details > summary")?
        cleanTag(active.parentElement.dataset.playerTag):null;
      const backgroundUpdate=lastRowsVersion>=0&&lastRowsVersion!==version&&
        lastRowsClan===ctx.clanId&&view.classList.contains("active");
      let anchor=null;
      if(backgroundUpdate){
        const topbar=document.querySelector(".topbar");
        const top=Math.max(0,topbar?.getBoundingClientRect().bottom||0)+4;
        const row=[...rowsHost.querySelectorAll(".stats-player-row")].find(element=>{
          const rect=element.getBoundingClientRect();
          return rect.bottom>top&&rect.top<window.innerHeight-24;
        });
        const key=row?.querySelector(".stats-player-details")?.dataset.playerTag;
        if(key)anchor={tag:cleanTag(key),top:row.getBoundingClientRect().top};
      }
      rowsHost.innerHTML=nextRowsMarkup;
      const byTag=tag=>[...rowsHost.querySelectorAll(".stats-player-details")]
        .find(element=>cleanTag(element.dataset.playerTag)===tag);
      if(focusedTag)byTag(focusedTag)?.querySelector("summary")?.focus({preventScroll:true});
      if(anchor){
        const next=byTag(anchor.tag)?.closest(".stats-player-row");
        if(next)window.scrollBy(0,next.getBoundingClientRect().top-anchor.top);
      }
      lastRowsHost=rowsHost;
      lastRowsMarkup=nextRowsMarkup;
    }
    lastRowsVersion=version;lastRowsClan=ctx.clanId;
  }
  // CWL histories can contain thousands of attacks. Only summaries are mounted
  // initially; expanding a war creates its attack rows on demand.
  function renderHistoryAttacks(disclosure){
    const target=disclosure?.querySelector(".war-history-detail");
    if(!target||target.dataset.rendered==="1")return;
    const rows=(historyAttacksByWar.get(disclosure.dataset.warKey)||[]).slice().sort((a,b)=>
      String(a.attacker_name||"").localeCompare(String(b.attacker_name||""),"de")||a.attack_order-b.attack_order);
    target.innerHTML=rows.length?rows.map(a=>"<div class='war-history-attack'><span>"+
      esc(a.attacker_name)+" <small>RH"+esc(a.attacker_th??"?")+"</small></span><span>"+
      "<strong class='war-history-stars'>"+("★".repeat(a.stars)+"☆".repeat(3-a.stars))+"</strong> "+
      esc(a.destruction)+"% <small>gegen "+esc(a.defender_name||"Gegner")+" · RH"+
      esc(a.defender_th??"?")+"</small></span></div>").join(""):
      "<p class='stats-note'>Für diesen Krieg liegen noch keine Einzelangriffe vor.</p>";
    target.dataset.rendered="1";
  }
  function renderWarHistory(earlyScrollAnchor=null){
    const host=$("statsWarHistory");if(!host)return;
    const ctx=context();
    const historySignature=[ctx.clanId,version,trendType,trendDays].join("|");
    if(host.dataset.historySignature===historySignature)return;
    const sameClan=host.dataset.historyClan===String(ctx.clanId||"");
    const backgroundUpdate=sameClan&&host.hasAttribute("data-history-version")&&
      Number(host.dataset.historyVersion)!==version&&section==="history"&&
      $("view-stats")?.classList.contains("active");
    const headerBottom=Math.max(0,document.querySelector(".topbar")
      ?.getBoundingClientRect().bottom||0)+4;
    const firstVisible=backgroundUpdate?
      [...host.querySelectorAll(".war-history-item")].find(el=>{
        const rect=el.getBoundingClientRect();
        return rect.bottom>headerBottom&&rect.top<window.innerHeight-24;
      }):null;
    const scrollAnchor=earlyScrollAnchor||(firstVisible?
      {warKey:firstVisible.dataset.warKey,top:firstVisible.getBoundingClientRect().top}:null);
    const openWars=new Set(sameClan?[...host.querySelectorAll(".war-history-item[open]")].map(el=>el.dataset.warKey):[]);
    const focusedWar=sameClan&&host.contains(document.activeElement)&&
      document.activeElement?.matches?.(".war-history-item>summary")?
      document.activeElement.parentElement.dataset.warKey:null;
    const chosen=selectWarDateScope(wars,{type:trendType,days:trendDays});
    const relevant=chosen.slice().sort((a,b)=>Date.parse(b.started_at)-Date.parse(a.started_at));
    // One index pass, instead of scanning all attacks separately for every war.
    const index=new Map();
    for(const attack of attacks){
      if(!index.has(attack.war_key))index.set(attack.war_key,[]);
      index.get(attack.war_key).push(attack);
    }
    historyAttacksByWar=index;
    host.dataset.historySignature=historySignature;
    host.dataset.historyClan=String(ctx.clanId||"");
    host.dataset.historyVersion=String(version);
    if(!relevant.length){host.innerHTML="<p class='stats-note'>"+(wars.length?
      "Keine abgeschlossenen Kriege für diese Auswahl. Zeitraum oder Kriegsart ändern.":
      "Noch keine abgeschlossenen Kriege gespeichert.")+"</p>";return;}
    host.innerHTML=relevant.map(w=>{
      const entries=index.get(w.war_key)||[];
      const when=new Date(w.started_at).toLocaleDateString("de-AT",{day:"2-digit",month:"2-digit",year:"numeric"});
      const stars=entries.reduce((n,a)=>n+(Number(a.stars)||0),0);
      const kind=w.war_type==="cwl"?"CWL":"CW";
      const team=Number(w.team_size);
      const size=Number.isInteger(team)&&team>=1&&team<=50?team+" vs. "+team:"Größe unbekannt";
      const uncertainty=w.source==="import"&&!w.finalized?
        " · Import (Vollständigkeit nicht bestätigt)":"";
      return "<details class='war-history-item' data-war-key='"+esc(w.war_key)+"'"+
        (openWars.has(w.war_key)?" open":"")+"><summary><span><strong>"+
        esc(kind+" · "+when+" · "+size)+"</strong><small>gegen "+
        esc(w.opponent_name||"unbekannt")+uncertainty+"</small></span><span>"+
        entries.length+(entries.length===1?" erfasster Angriff":" erfasste Angriffe")+" · "+(entries.length?stars+" erfasste Sterne":"Sterne noch nicht bekannt")+"</span></summary>"+
        "<div class='war-history-detail'></div></details>";
    }).join("");
    for(const disclosure of host.querySelectorAll(".war-history-item[open]"))renderHistoryAttacks(disclosure);
    if(focusedWar){
      const restored=[...host.querySelectorAll(".war-history-item")].find(el=>el.dataset.warKey===focusedWar);
      restored?.querySelector("summary")?.focus({preventScroll:true});
    }
    if(scrollAnchor){
      const restored=[...host.querySelectorAll(".war-history-item")]
        .find(el=>el.dataset.warKey===scrollAnchor.warKey);
      if(restored)window.scrollBy(0,restored.getBoundingClientRect().top-scrollAnchor.top);
    }
  }
  function reset(){
    scope=null;wars=[];attacks=[];missedEvents=[];collectorHealth=null;cachedPlayerStats.clear();cachedRecentStats.clear();
    comparableProfiles.clear();comparableSummary=null;lastComparableRowsMarkup=null;
    lastFormRowsVersion=-1;lastFormRowsClan=null;
    viewComparableProfiles.clear();viewComparableSummary=null;openStatsPlayers.clear();
    duelLeft="";duelRight="";duelSameTH=true;trendMetric="hitRate";trendGranularity="week";
    formWindow=90;formSearch="";formSort="evidence";
    // Clan switch: no stale dropdown label for a reset view-model.
    if($("statsFormSort"))$("statsFormSort").value=formSort;
    if($("statsFormSearch"))$("statsFormSearch").value="";
    compareType="all";compareDays="all";trendType="all";trendDays="all";
    cachedSummary=null;lastMetricSignature="";lastRowsMarkup=null;lastRowsHost=null;
    lastRowsVersion=-1;lastRowsClan=null;historyAttacksByWar.clear();lastMembersNotifiedVersion=-1;
    // The history is now lazy-loaded per view. On clan switch it MUST
    // discard old mounted content immediately, even while the history tab
    // is hidden, to prevent stale private data from another tenant.
    for(const id of ["statsWarHistory","statsRows","statsFormRows",
      "statsMatchupComparison","statsDuelResults","statsTrendChart","statsTrendTable"]){
      $(id)?.replaceChildren();
    }
    const historyHost=$("statsWarHistory");
    historyHost?.removeAttribute("data-history-signature");
    historyHost?.removeAttribute("data-history-clan");
    historyHost?.removeAttribute("data-history-version");
    lastMatchupVersion=-1;lastMatchupClan=null;
    lastDuelVersion=-1;lastDuelClan=null;lastTrendVersion=-1;lastTrendClan=null;
    version++;lastCapture.clear();loading=false;importing=false;
    notice("");render();
  }
  async function load(force=false){
    const ctx=context();if(!ctx.active||!ctx.clanId)return;
    const id=ctx.clanId;
    // A request from the OLD clan must never block a refresh of the newly
    // selected clan. Superseding the old epoch also prevents late responses
    // and render() callbacks from presenting cross-clan statistics.
    if(loading&&loadingClan===id&&!force)return;
    const epoch=++version;
    loading=true;loadingClan=id;
    if(scope!==id){
      // An initial load has nothing to clear. Rendering an EMPTY initial
      // table too early would prime the row caches and suppress the first
      // real table render (seen in unrelated stats browser regressions).
      const hadOtherClan=scope!==null;
      scope=null;wars=[];attacks=[];missedEvents=[];collectorHealth=null;
      cachedRecentStats=new Map();comparableProfiles=new Map();
      comparableSummary=null;cachedSummary=null;lastMetricSignature="";
      if(hadOtherClan){
        // Clear Clan A's visible data before Clan B finishes its fetch.
        render();
      }
      // When the new data comes back, empty-state caches must never be
      // mistaken for the new clan's fully populated rows.
      cachedPlayerStats=new Map();lastRowsMarkup=null;lastRowsVersion=-1;
      lastRowsClan=null;lastRowsHost=null;lastMembersNotifiedVersion=-1;
      lastComparableRowsMarkup=null;lastFormRowsVersion=-1;lastFormRowsClan=null;
      lastMatchupVersion=-1;lastMatchupClan=null;
      lastDuelVersion=-1;lastDuelClan=null;
      lastTrendVersion=-1;lastTrendClan=null;
      historyAttacksByWar=new Map();openStatsPlayers.clear();
    }
    notice("Statistik wird geladen …");
    try{
      // Keep all available completed wars. A pair of ClashPerk limit-100
      // exports already fills 200 rows before the scheduled collector adds
      // any new war. Never silently call a partial sample "all history".
      const ww=[];
      for(let offset=0;offset<10000;offset+=500){
        const {data:part,error:e1}=await sb.from("cwl_stat_wars").select("*")
          .eq("clan_id",id).order("started_at",{ascending:false})
          .range(offset,offset+499);
        if(e1)throw e1;
        ww.push(...(part||[]));
        if(!part||part.length<500)break;
        if(offset+500>=10000)throw Error("Statistik umfasst mehr als 10.000 Kriege; Datenabruf bitte erweitern.");
      }
      const collected=[];
      for(let offset=0;offset<60000;offset+=800){
        const {data:aa,error:e2}=await sb.from("cwl_stat_attacks").select("*")
          .eq("clan_id",id).order("war_key").order("attacker_tag").order("attack_order")
          .range(offset,offset+799);
        if(e2)throw e2;
        collected.push(...(aa||[]));
        if(!aa||aa.length<800)break;
        if(offset+800>=60000)throw Error("Zu viele Angriffsdatensätze; vollständiger Abruf erforderlich.");
      }
      const missedRows=[];
      for(let offset=0;offset<20000;offset+=800){
        const {data:mm,error:e3}=await sb.from("cwl_stat_missed").select("*")
          .eq("clan_id",id).order("war_key").order("player_tag").range(offset,offset+799);
        if(e3)throw e3;
        missedRows.push(...(mm||[]));
        if(!mm||mm.length<800)break;
        if(offset+800>=20000)throw Error("Zu viele Missed-Datensätze; vollständiger Abruf erforderlich.");
      }
      let latestHealth=null;
      try{
        const {data:healthRows,error:healthError}=await sb.from("cwl_stat_collector_status")
          .select("last_checked_at,last_success_at,last_error,observed_wars,observed_attacks")
          .eq("clan_id",id).limit(1);
        if(!healthError)latestHealth=healthRows?.[0]||null;
      }catch{/* The stats panel stays usable during an older DB migration. */}
      if(epoch!==version||context().clanId!==id)return;
      scope=id;wars=ww||[];attacks=collected;missedEvents=missedRows;collectorHealth=latestHealth;
      cachedRecentStats=computeRecentAttackStats(wars,attacks,7);
      const comparable=computeComparableForm(wars,attacks);
      comparableProfiles=comparable.profiles;comparableSummary=comparable.summary;
      notice(statsLoadNotice(wars));
    }catch(e){
      if(epoch===version)notice("Fehler beim Laden der Statistik: "+String(e.message||e));
    }finally{if(epoch===version){loading=false;loadingClan=null;render()}}
  }
  async function importFile(file){
    const ctx=context();
    if(!ctx.active||!ctx.clanId||!["owner","editor"].includes(ctx.role))throw Error("Nur Besitzer/Vize können importieren.");
    if(importing)throw Error("Import läuft bereits.");
    if(!file||file.size>4000000)throw Error("Bitte die vorbereitete JSON-Datei auswählen (maximal 4 MB).");
    const parsed=validateHistoryFile(JSON.parse(await file.text()),ctx.clanTag);
    const missedCount=parsed.missed.reduce((sum,row)=>sum+row.missed_count,0);
    const message=parsed.wars.length+" Kriege, "+parsed.attacks.length+" Angriffe und "+
      missedCount+" dokumentierte verpasste Angriffe in "+parsed.missed.length+
      " Einträgen übernehmen? Bereits vorhandene Einträge werden aktualisiert statt doppelt angelegt. Der CWL-Plan bleibt unverändert.";
    if(!await confirmAction(message,{title:"Kampfverlauf importieren",confirmText:"Importieren"}))return;
    const id=ctx.clanId;importing=true;$("statsImportButton").disabled=true;
    try{
      notice("Import: Kriege speichern …");
      for(const batch of chunks(parsed.wars,80)){
        if(context().clanId!==id)throw Error("Clan wurde gewechselt; Import abgebrochen.");
        const {error}=await sb.from("cwl_stat_wars").upsert(
          batch.map(w=>({...w,clan_id:id,missed_log_complete:w.missed_log_complete===true})),
          {onConflict:"clan_id,war_key"});if(error)throw error;
      }
      let done=0;
      for(const batch of chunks(parsed.attacks,80)){
        if(context().clanId!==id)throw Error("Clan wurde gewechselt; Import abgebrochen.");
        const {error}=await sb.from("cwl_stat_attacks").upsert(batch.map(a=>({...a,clan_id:id})),
          {onConflict:"clan_id,war_key,attacker_tag,attack_order"});if(error)throw error;
        done+=batch.length;notice("Import: "+done+" / "+parsed.attacks.length+" Angriffe …");
      }
      for(const batch of chunks(parsed.missed,80)){
        if(context().clanId!==id)throw Error("Clan wurde gewechselt; Import abgebrochen.");
        const {error}=await sb.from("cwl_stat_missed").upsert(batch.map(m=>({...m,clan_id:id})),
          {onConflict:"clan_id,war_key,player_tag"});if(error)throw error;
      }
      await load();
      notice("✓ Historie importiert: "+parsed.wars.length+" Kriege, "+parsed.attacks.length+
        " Angriffe, "+missedCount+" verpasste Angriffe ("+parsed.missed.length+" Einträge).");
      notify("✓ Kriegsstatistik importiert");
    }finally{importing=false;$("statsImportButton").disabled=false}
  }
  async function importClashPerkFiles(files){
    const ctx=context(),clanId=ctx.clanId,initialRole=ctx.role;
    if(!ctx.active||!clanId||!["owner","editor"].includes(initialRole))
      throw Error("Nur Besitzer und Vize können die gemeinsame Statistik ergänzen.");
    if(!ctx.clanTag)throw Error("Bitte einen mit Clash verbundenen Clan auswählen.");
    if(importing)throw Error("Ein Import ist bereits aktiv.");
    if(!files.length||files.length>12||files.some(f=>f.size>7500000)||
       files.reduce((sum,f)=>sum+f.size,0)>25000000)
      throw Error("Bitte höchstens 12 XLSX-Dateien mit insgesamt maximal 25 MB auswählen.");
    importing=true;$("statsImportButton").disabled=true;
    const stillCurrent=()=>{
      const now=context();
      return now.active&&now.clanId===clanId&&
        ["owner","editor"].includes(now.role)&&cleanTag(now.clanTag)===cleanTag(ctx.clanTag);
    };
    try{
      const sheets=[];
      for(let i=0;i<files.length;i++){
        if(!stillCurrent())throw Error("Clan gewechselt. Bitte Import neu starten.");
        notice("ClashPerk-Datei "+(i+1)+" / "+files.length+" prüfen …");
        sheets.push(...await readClashPerkXlsx(files[i]));
      }
      const parsed=parseClashPerkSheets(sheets,ctx.clanTag);
      if(!stillCurrent())throw Error("Clan gewechselt. Bitte Import neu starten.");
      notice("Vorhandene Kriege abgleichen …");
      const old=await readAllStatWars(sb,clanId);
      const plan=planClashPerkMerge(parsed,old);
      if(plan.conflicts.length)throw Error(plan.conflicts.length+
        " Kriege widersprechen vorhandenen historischen Daten. Import abgebrochen; nichts wird überschrieben.");
      const totalMissed=plan.missed.reduce((n,m)=>n+m.missed_count,0);
      const summary=files.length+" ClashPerk-Datei(en) erkannt. "+
        parsed.wars.length+" Kriege, "+parsed.attacks.length+" eigene Angriffe und "+
        parsed.enemyAttacks+" gegnerische Angriffe geprüft. "+
        parsed.duplicates+" doppelte Einträge entfernt. "+
        "Neu: "+plan.insert.length+" Kriege; vorhanden: "+plan.extend.length+
        "; API-Kriege geschützt: "+plan.skip.length+". "+
        totalMissed+" dokumentierte verpasste Angriffe. "+
        parsed.completeWars+" lückenlos belegte Kriege, "+
        parsed.missingWars+" mit offener Abdeckung. "+
        (parsed.warnings.length?parsed.warnings.join(" ")+" ":"")+
        "Bestehende API-Ergebnisse und CWL-Aufstellungen bleiben unverändert. Importieren?";
      if(!plan.insert.length&&!plan.extend.length){
        notice("Alle "+plan.skip.length+" passenden Kriege sind bereits durch die offizielle API erfasst. Nichts überschrieben.");
        return;
      }
      if(!await confirmAction(summary,{title:"ClashPerk-Historie prüfen",
        confirmText:"Geprüfte Kriege übernehmen"})){
        notice("Import abgebrochen. Es wurden keine Daten verändert.");return;
      }
      if(!stillCurrent())throw Error("Clan gewechselt. Bitte Import neu starten.");
      notice("ClashPerk-Historie wird gespeichert …");
      const result=await commitClashPerkMerge(sb,plan,{clanId,
        clanTag:ctx.clanTag,assertCurrent:stillCurrent,onProgress:notice});
      // A pending pre-upload load may still return old rows. Force a fresh
      // post-commit query; the monotonic version fences its stale response.
      await load(true);
      notice("✓ "+result.inserted+" neue Kriege, "+result.attacks+
        " eigene Angriffe und "+totalMissed+
        " belegte verpasste Angriffe übernommen. "+
        result.skippedApi+" API-Kriege unverändert. "+
        (parsed.missingWars?"Unvollständige Kriege sind gekennzeichnet.":""));
      notify("✓ ClashPerk-Statistiken ergänzt");
    }finally{importing=false;$("statsImportButton").disabled=false}
  }
  async function importSelectedFiles(files){
    const chosen=Array.from(files||[]);
    if(!chosen.length)return;
    if(chosen.length===1&&/\.json$/i.test(chosen[0].name||""))
      return importFile(chosen[0]);
    if(chosen.some(f=>!/\.xlsx$/i.test(f.name||"")))
      throw Error("Bitte nur ClashPerk-XLSX-Dateien oder einzeln eine Statistik-JSON-Datei auswählen.");
    return importClashPerkFiles(chosen);
  }
  async function captureCwl(payload){
    const ctx=context();
    if(!ctx.active||!ctx.clanId||!["owner","editor"].includes(ctx.role))return;
    // Current normal-war snapshot is available only while Supercell still serves it.
    const normal=payload?.currentWar;
    if(normal?.state==="warEnded"&&Array.isArray(normal.clan?.members)&&
       normal.clan.members.length===normal.teamSize&&
       cleanTag(normal.clan.tag)===cleanTag(ctx.clanTag)&&
       Number.isFinite(clashTime(normal.startTime))&&
       Number.isFinite(clashTime(normal.endTime))&&
       clashTime(normal.endTime)<Date.now()-60000){
      const id=ctx.clanId;
      const key="normal:"+normal.startTime+":"+cleanTag(normal.opponent?.tag);
      if(key.length<=100&&!lastCapture.has(id+":"+key)){
        const war={clan_id:id,war_key:key,war_type:"normal",
          started_at:new Date(clashTime(normal.startTime)).toISOString(),
          team_size:normal.teamSize,opponent_tag:normal.opponent.tag,
          opponent_name:String(normal.opponent.name||""),source:"api",finalized:true,
          roster_tags:normal.clan.members.map(m=>m.tag)};
        const {error:e1}=await sb.from("cwl_stat_wars").upsert(war,{onConflict:"clan_id,war_key"});
        if(e1)throw e1;
        const targets=new Map((normal.opponent.members||[]).map(m=>[cleanTag(m.tag),m]));
        const rows=normal.clan.members.flatMap(m=>(m.attacks||[]).map((a,i)=>{
          const d=targets.get(cleanTag(a.defenderTag));
          return {clan_id:id,war_key:key,attacker_tag:m.tag,attack_order:i+1,
            attacker_name:m.name,attacker_th:m.townHallLevel,defender_tag:a.defenderTag,
            defender_name:d?.name||"",defender_th:d?.townHallLevel||null,
            stars:a.stars,destruction:Math.round(a.destructionPercentage)};
        }));
        for(const batch of chunks(rows,80)){
          const {error}=await sb.from("cwl_stat_attacks").upsert(batch,
            {onConflict:"clan_id,war_key,attacker_tag,attack_order"});if(error)throw error;
        }
        lastCapture.add(id+":"+key);
        if(scope===id)await load();
      }
    }
    const snap=sanitizeSnapshot(payload);
    if(!snap || cleanTag(snap.clanTag)!==cleanTag(ctx.clanTag))return;
    const id=ctx.clanId;
    for(const round of snap.rounds){
      if(!round.available||round.state!=="warEnded"||!round.warTag||
         !Array.isArray(round.clan?.members)||round.clan.members.length!==round.teamSize||
         !Number.isFinite(clashTime(round.endTime))||clashTime(round.endTime)>Date.now()-60000)continue;
      const key="cwl:"+round.warTag,cacheKey=id+":"+key;
      if(lastCapture.has(cacheKey))continue;
      const start=clashTime(round.startTime);
      if(!Number.isFinite(start))continue;
      const war={clan_id:id,war_key:key,war_type:"cwl",started_at:new Date(start).toISOString(),
        team_size:round.teamSize,opponent_tag:round.opponent.tag,opponent_name:round.opponent.name,
        source:"api",finalized:true,roster_tags:round.clan.members.map(m=>m.tag)};
      const {error:e1}=await sb.from("cwl_stat_wars").upsert(war,{onConflict:"clan_id,war_key"});
      if(e1)throw e1;
      const enemy=new Map((round.opponent.members||[]).map(m=>[cleanTag(m.tag),m]));
      const rows=round.clan.members.flatMap(m=>(m.attacks||[]).map((a,i)=>{
        const target=enemy.get(cleanTag(a.defenderTag));
        return {clan_id:id,war_key:key,attacker_tag:m.tag,attack_order:i+1,
          attacker_name:m.name,attacker_th:m.townHallLevel,defender_tag:a.defenderTag,
          defender_name:target?.name||"",defender_th:target?.townHallLevel||null,
          stars:a.stars,destruction:Math.round(a.destructionPercentage)};
      }));
      for(const batch of chunks(rows,80)){
        const {error}=await sb.from("cwl_stat_attacks").upsert(batch,
          {onConflict:"clan_id,war_key,attacker_tag,attack_order"});if(error)throw error;
      }
      lastCapture.add(cacheKey);
      if(scope===id){await load()}
    }
  }
  function bind(){
    const e=id=>$(id);
    // The native <details> toggle does not bubble; capture it on the stable host.
    e("statsWarHistory")?.addEventListener("toggle",event=>{
      const disclosure=event.target;
      if(disclosure?.matches?.(".war-history-item")&&disclosure.open)renderHistoryAttacks(disclosure);
    },true);
    e("statsSectionTabs")?.addEventListener("click",event=>{
      const button=event.target.closest("button[data-stats-section]");
      if(!button)return;
      setStatsSection(button.dataset.statsSection);
      render();
    });
    document.getElementById("view-stats")?.querySelector(".stats-form-window")
      ?.addEventListener("click",ev=>{
        const button=ev.target.closest("[data-form-window]");
        if(!button)return;
        formWindow=Number(button.dataset.formWindow);
        lastComparableRowsMarkup=null;
        renderComparableForm();
      });
    e("statsFormSearch")?.addEventListener("input",ev=>{
      formSearch=ev.target.value;renderComparableForm();
    });
    e("statsFormSort")?.addEventListener("change",ev=>{
      formSort=ev.target.value;renderComparableForm();
    });
    e("statsCompareType")?.addEventListener("change",ev=>{
      compareType=ev.target.value;renderMatchups();renderDuel();
    });
    e("statsCompareDays")?.addEventListener("change",ev=>{
      compareDays=ev.target.value==="all"?"all":Number(ev.target.value);
      renderMatchups();renderDuel();
    });
    e("statsTrendType")?.addEventListener("change",ev=>{
      trendType=ev.target.value;renderTimeline();renderWarHistory();
    });
    e("statsTrendDays")?.addEventListener("change",ev=>{
      trendDays=ev.target.value==="all"?"all":Number(ev.target.value);
      renderTimeline();renderWarHistory();
    });
    e("statsDuelLeft")?.addEventListener("change",ev=>{
      duelLeft=cleanTag(ev.target.value);renderDuel();
    });
    e("statsDuelRight")?.addEventListener("change",ev=>{
      duelRight=cleanTag(ev.target.value);renderDuel();
    });
    e("statsDuelSameTH")?.addEventListener("change",ev=>{
      duelSameTH=ev.target.checked;renderDuel();
    });
    e("statsTrendMetric")?.addEventListener("change",ev=>{
      trendMetric=ev.target.value==="averageStars"?"averageStars":"hitRate";
      renderTimeline();
    });
    e("statsTrendGranularity")?.addEventListener("change",ev=>{
      trendGranularity=["day","week","month"].includes(ev.target.value)?ev.target.value:"week";
      renderTimeline();
    });
    e("statsType")?.addEventListener("change",ev=>{
      type=ev.target.value;
      syncPeriodChoices();
      render();
    });
    e("statsRange")?.addEventListener("change",ev=>{
      last=ev.target.value==="all"?"all":Math.max(1,Math.min(50,Number(ev.target.value)||50));
      syncPeriodChoices();render();
    });
    e("statsCwlRange")?.addEventListener("change",ev=>{
      cwlSeasons=ev.target.value==="all"?"all":Math.max(1,Math.min(3,Number(ev.target.value)||3));
      syncPeriodChoices();render();
    });
    e("statsSameTH")?.addEventListener("change",ev=>{sameHigher=ev.target.checked;render()});
    e("statsFormer")?.addEventListener("change",ev=>{showFormer=ev.target.checked;render()});
    e("statsSearch")?.addEventListener("input",ev=>{search=ev.target.value;render()});
    e("statsSort")?.addEventListener("change",ev=>{order=ev.target.value;render()});
    e("statsRows")?.addEventListener("toggle",event=>{
      const details=event.target;
      if(!details?.matches?.(".stats-player-details"))return;
      const playerTag=cleanTag(details.dataset.playerTag);
      if(details.open)openStatsPlayers.add(playerTag);else openStatsPlayers.delete(playerTag);
    },true);
    e("statsRefresh")?.addEventListener("click",()=>load());
    e("statsImportButton")?.addEventListener("click",()=>e("statsImportFile").click());
    e("statsImportFile")?.addEventListener("change",async ev=>{
      try{await importSelectedFiles(ev.target.files)}catch(e){notice("Importfehler: "+String(e.message||e))}
      finally{ev.target.value=""}
    });
    document.querySelector('[data-view="stats"]')?.addEventListener("click",()=>load());
  }
  function syncPeriodChoices(){
    const periodLabel=$("statsPeriodLabel");
    if(periodLabel)periodLabel.textContent="Nur für Spielerstatistik";
    const cw=$("statsRange"),league=$("statsCwlRange");
    if(cw)cw.value=String(last);
    if(league)league.value=String(cwlSeasons);
    if($("statsCwField"))$("statsCwField").hidden=type==="cwl";
    if($("statsCwlField"))$("statsCwlField").hidden=type==="normal";
    const scopeInfo=describeWarSelection(wars,{type,last,cwlSeasons});
    const parts=[];
    if(type!=="cwl"){
      parts.push(last==="all"?
        (scopeInfo.allNormal===0?"Noch keine abgeschlossenen CWs":
          scopeInfo.allNormal===1?"1 abgeschlossener CW":
          "Alle "+scopeInfo.allNormal+" abgeschlossenen CWs"):
        scopeInfo.selectedNormal+" von "+scopeInfo.allNormal+" abgeschlossenen CWs (Limit "+last+")");
    }
    if(type!=="normal"){
      parts.push(cwlSeasons==="all"?
        (scopeInfo.allCwl===0?"Noch keine abgeschlossenen CWL-Durchgänge":
          scopeInfo.allCwl===1?"1 abgeschlossener CWL-Durchgang":
          "Alle "+scopeInfo.allCwl+" abgeschlossenen CWL-Durchgänge"):
        scopeInfo.selectedCwl+" von "+scopeInfo.allCwl+" abgeschlossenen CWL-Durchgängen");
    }
    if($("statsPeriodSummary"))$("statsPeriodSummary").textContent=parts.join(" + ");
  }
  syncPeriodChoices();
  bind();
  setStatsSection(section);
  return {load,reset,render,captureCwl};
}
