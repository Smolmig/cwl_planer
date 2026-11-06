import {validateHistoryFile,computeWarStats,selectStatWars,computeRecentAttackStats,computeThMatchupComparison,groupCwlRuns,computeStatsTimeline,computePlayerDuel,cleanTag} from "./cwl-stats-core.mjs?v=1.15.8";
import {sanitizeSnapshot,clashTime} from "./cwl-live-core.mjs?v=1.3.6";
import {computeComparableForm} from "./cwl-comparable-form.mjs?v=1.15.8";
const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pct=x=>x===null?"–":x+"%";
const chunks=(xs,n)=>Array.from({length:Math.ceil(xs.length/n)},(_,i)=>xs.slice(i*n,(i+1)*n));
export function createCloudStats({sb,context,notify,confirmAction}) {
  let scope=null,wars=[],attacks=[],missedEvents=[],loading=false,importing=false,version=0,lastCapture=new Set();
  let type="all",last=50,cwlSeasons="all",sameHigher=false,showFormer=true,search="",order="performance",ascending=false,section="overview";
  let duelLeft="",duelRight="",duelSameTH=true,trendMetric="hitRate",trendGranularity="month";
  const notice=message=>{const e=$("statsFeedback");if(e)e.textContent=message||""};
  let cachedPlayerStats=new Map(),cachedRecentStats=new Map(),lastMetricSignature="";
  let comparableProfiles=new Map(),comparableSummary=null,lastComparableRowsMarkup=null;
  let viewComparableProfiles=new Map(),viewComparableSummary=null;
  const openStatsPlayers=new Set();
  let cachedSummary=null,lastRowsMarkup=null,lastRowsHost=null,lastMembersNotifiedVersion=-1;
  let historyAttacksByWar=new Map();
  function getPlayerStats(tag){return scope===context().clanId?cachedPlayerStats.get(cleanTag(tag))||null:null}
  function getRecentPlayerStats(tag){return scope===context().clanId?cachedRecentStats.get(cleanTag(tag))||null:null}
  function getComparablePlayerStats(tag){return scope===context().clanId?comparableProfiles.get(cleanTag(tag))||null:null}
  window.CWLCloudStats={getPlayerStats,getRecentPlayerStats,getComparablePlayerStats,onUpdate:()=>window.CWLRefreshMembers?.()};
  const formPct=rate=>rate===null||!Number.isFinite(rate)?"–":rate+" %";
  const formStar=number=>number===null||!Number.isFinite(number)?"–":
    number.toLocaleString("de-AT",{minimumFractionDigits:2,maximumFractionDigits:2})+" ★";
  function renderComparableForm(){
    const panel=$("statsFormDetails"),host=$("statsFormRows"),desc=$("statsFormIntro");
    if(!panel?.open||!host)return;
    const ctx=context();
    if(!ctx.active||scope!==ctx.clanId){
      if(lastComparableRowsMarkup!==null){host.replaceChildren();lastComparableRowsMarkup=null}
      if(desc)desc.textContent="Keine gespeicherte Cloud-Statistik verfügbar.";
      return;
    }
    const current=new Set((ctx.memberTags||[]).map(cleanTag));
    const term=search.trim().toLocaleLowerCase("de");
    const rows=[...viewComparableProfiles.values()]
      .filter(p=>(showFormer||!current.size||current.has(p.tag))&&
        (!term||p.name.toLocaleLowerCase("de").includes(term)||p.tag.toLowerCase().includes(term)))
      .sort((a,b)=>Number(current.has(b.tag))-Number(current.has(a.tag))||
        a.name.localeCompare(b.name,"de"));
    if(desc&&viewComparableSummary){
      const m=viewComparableSummary;
      const excluded=m.lowerThExcluded+m.higherThExcluded+m.unknownThExcluded;
      desc.textContent=m.comparableAttacks+" Angriffe gegen dieselbe Rathausstufe aus den letzten 90 Tagen sind vergleichbar. "+
        (excluded?excluded+" weitere Angriffe mit anderem oder unbekanntem RH zählen hier nicht. ":"")+
        "Die Auswahl aus CW und CWL entspricht deinen Filtern oben. Für die 90-Tage-Tendenz zählen neuere Angriffe stärker; bei wenig Daten bleibt sie unsicher. "+
        "Mirror-Position und Erstangriff sind historisch nicht durchgehend belegt.";
    }
    const qualityLabel={none:"Keine Vergleichsdaten",stale:"Nur ältere Angriffe",
      limited:"Wenig Daten",trend:"Erste Tendenz",solid:"Mehr Vergleichsdaten"};
    const textFor=p=>{
      const n30=p.last30.attacks,n90=p.last90.attacks;
      const quality=qualityLabel[p.quality]||"Wenig Daten";
      const excluded=p.excluded.lower+p.excluded.higher+p.excluded.unknown;
      const n30Label=n30?p.last30.triples+" von "+n30+" Angriffen mit 3★":"Keine aktuellen Angriffe";
      const n90Label=n90?n90+" gleich-RH-Angriffe · neuere zählen stärker":"Keine Angriffe in 90 Tagen";
      const source="CWL: "+p.cwl90.attacks+" Angriffe · normaler CW: "+p.normal90.attacks+" Angriffe";
      const excludedText=excluded?" · "+excluded+" andere / unbekannte RH-Ziele nicht gewertet":"";
      return "<div class='stats-form-row'>"+
        "<div class='stats-form-person'><b>"+esc(p.name)+"</b>"+
        "<span class='stats-form-quality'>"+esc(quality)+"</span>"+
        "<small>"+(p.performanceRankable?"Ausreichend für einen vorsichtigen Vergleich":
         "Keine belastbare Rang-Einordnung")+"</small></div>"+
        "<div class='stats-form-results'>"+
          "<div class='stats-form-cell'><span>Letzte 30 Tage</span><strong>"+
            esc(n30?formPct(p.last30.hitRate):"–")+
          "</strong><small>"+esc(n30Label)+"</small></div>"+
          "<div class='stats-form-cell'><span>90-Tage-Trend</span><strong>"+
            esc(n90?formPct(p.weighted90.hitRate):"–")+
          "</strong><small>"+esc(n90Label)+"</small></div>"+
          "<small class='stats-form-breakdown'>"+esc(source+excludedText)+"</small>"+
        "</div></div>";
    };
    const markup=rows.length?rows.map(textFor).join(""):
      "<p class='stats-note'>Keine Angriffe gegen die gleiche Rathausstufe in dieser Auswahl. Die vollständigen Rohdaten bleiben erhalten.</p>";
    if(markup!==lastComparableRowsMarkup){host.innerHTML=markup;lastComparableRowsMarkup=markup}
  }
  function setStatsSection(next){
    if(!["overview","players","compare","history"].includes(next))return;
    section=next;
    for(const button of document.querySelectorAll("#statsSectionTabs [data-stats-section]")){
      const active=button.dataset.statsSection===section;
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",String(active));
    }
    for(const panel of document.querySelectorAll("#view-stats [data-stats-panel]"))
      panel.hidden=panel.dataset.statsPanel!==section;
  }
  function renderMatchups(){
    const host=$("statsMatchupComparison");
    if(!host)return;
    const data=computeThMatchupComparison(wars,attacks,{type,last,cwlSeasons});
    const labels={lower:"Gegner-RH niedriger",same:"Gleiches Rathaus",higher:"Gegner-RH höher",unknown:"RH unbekannt"};
    const kinds=[["normal","Normale Clankriege"],["cwl","CWL"]];
    host.innerHTML="<div class='stats-matchup-grid'>"+kinds.map(([kind,title])=>{
      const rows=data.filter(row=>row.type===kind);
      const n=rows.reduce((sum,row)=>sum+row.attacks,0);
      return "<div class='stats-matchup-group'><h4>"+title+" · "+n+" Angriffe</h4>"+
        rows.map(row=>"<div class='stats-matchup-row'><span>"+labels[row.matchup]+"</span>"+
          "<strong>"+(row.attacks?(row.hitRate+" % 3★"):"–")+"</strong>"+
          "<small>"+(row.attacks?(row.triples+" von "+row.attacks+" Dreier · Ø "+row.averageStars.toLocaleString("de-AT",{minimumFractionDigits:2,maximumFractionDigits:2})+" ★"):"Keine Angriffe dokumentiert")+"</small></div>").join("")+
        "</div>";
    }).join("")+"</div>";
  }
  function renderDuel(){
    const host=$("statsDuelResults"),first=$("statsDuelLeft"),second=$("statsDuelRight");
    if(!host||!first||!second||!cachedSummary)return;
    const available=cachedSummary.rows.slice()
      .filter(p=>p.tag&&p.attacks>0).sort((a,b)=>a.name.localeCompare(b.name,"de"));
    const keyed=new Map(available.map(p=>[cleanTag(p.tag),p]));
    if(!keyed.has(duelLeft))duelLeft=available[0]?.tag||"";
    if(!keyed.has(duelRight)||duelRight===duelLeft)
      duelRight=available.find(p=>p.tag!==duelLeft)?.tag||"";
    const optionMarkup="<option value=''>Spieler wählen</option>"+available
      .map(p=>"<option value='"+esc(p.tag)+"'>"+esc(p.name)+"</option>").join("");
    const signature=available.map(p=>p.tag+":"+p.name).join("|");
    for(const select of [first,second]){
      if(select.dataset.optionSignature!==signature){
        select.innerHTML=optionMarkup;
        select.dataset.optionSignature=signature;
      }
    }
    first.value=duelLeft;second.value=duelRight;
    if($("statsDuelSameTH"))$("statsDuelSameTH").checked=duelSameTH;
    if(!duelLeft||!duelRight){
      host.innerHTML="<p class='stats-note'>Für einen direkten Vergleich brauchen wir mindestens zwei Spieler mit dokumentierten Angriffen im gewählten Zeitraum.</p>";
      return;
    }
    const results=computePlayerDuel(wars,attacks,duelLeft,duelRight,
      {type,last,cwlSeasons,sameTH:duelSameTH});
    const human=(n)=>n===null?"–":String(n)+" %";
    const fmtAvg=n=>n===null?"–":n.toLocaleString("de-AT",
      {minimumFractionDigits:2,maximumFractionDigits:2})+" ★";
    const markup=results.players.map(p=>{
      const name=keyed.get(cleanTag(p.tag))?.name||p.tag;
      const mini=(g,label)=>label+": "+(g.attacks?
        (human(g.hitRate)+" aus "+g.attacks+" Angriffen"):"keine passenden Angriffe");
      return "<div class='stats-duel-person'><h4>"+esc(name)+"</h4>"+
        "<strong>"+human(p.hitRate)+" 3★</strong><p>"+p.triples+" von "+p.attacks+
        " Angriffen · "+p.wars+" Kriege</p>"+
        "<p>Ø Sterne: "+fmtAvg(p.averageStars)+"</p>"+
        "<p>"+mini(p.normal,"CW")+"<br>"+mini(p.cwl,"CWL")+"</p>"+
        (p.attacks>0&&p.attacks<5?
          "<small>Wenig Vergleichsdaten – nicht als klare Stärkeaussage verwenden.</small>":"")+
        (p.lastWar?"<small>Letzter berücksichtigter Krieg: "+
          esc(new Date(p.lastWar).toLocaleDateString("de-AT"))+"</small>":"")+
        "</div>";
    }).join("");
    host.innerHTML="<div class='stats-duel-grid'>"+markup+"</div>"+
      "<p class='stats-note'>"+(duelSameTH?
        "Nur Angriffe auf dieselbe Rathausstufe,":"Alle belegten Angriffe unabhängig vom Rathaus,")+
      " jeweils aus denselben "+results.selectedWars+" ausgewählten Kriegen/CWL-Tagen. "+
      "Unterschiedliche Gegnerbasen, Angriffsrollen und Stichprobengrößen können den Vergleich verzerren.</p>";
  }
  function renderTimeline(){
    const chart=$("statsTrendChart"),detail=$("statsTrendTable");
    if(!chart||!detail)return;
    const trend=computeStatsTimeline(wars,attacks,{type,last,cwlSeasons,granularity:trendGranularity});
    const signature=[version,type,last,cwlSeasons,trendMetric,trendGranularity].join("|");
    if(chart.dataset.signature===signature)return;
    chart.dataset.signature=signature;
    const all=trend.rows,rows=all.slice(-12);
    const label=trendMetric==="hitRate"?"3★-Quote":"Ø Sterne";
    const colors={normal:"series-cw",cwl:"series-cwl"};
    if(!rows.length){
      chart.innerHTML="<p class='stats-note'>Noch keine Angriffe für einen Verlauf in dieser Auswahl.</p>";
      detail.replaceChildren();return;
    }
    const W=760,H=252,L=48,R=18,T=20,B=43;
    const plotW=W-L-R,plotH=H-T-B,maximum=trendMetric==="hitRate"?100:3;
    const x=i=>L+(rows.length===1?plotW/2:i*plotW/(rows.length-1));
    const y=value=>T+(maximum-value)/maximum*plotH;
    const point=(kind,i,row)=>{
      const v=row[kind][trendMetric],n=row[kind].attacks;
      if(v===null)return null;
      return {x:x(i),y:y(v),value:v,n,key:row.key,
        title:(kind==="cwl"?"CWL":"Normaler CW")+" · "+row.key+
          " · "+v+(trendMetric==="hitRate"?" %":" ★")+
          " · "+n+" Angriffe"};
    };
    const grid=[0,.25,.5,.75,1].map(part=>{
      const yy=y(part*maximum),v=part*maximum;
      return "<line class='gridline' x1='"+L+"' x2='"+(W-R)+"' y1='"+yy+"' y2='"+yy+"'/>"+
        "<text class='axislabel' text-anchor='end' x='"+(L-8)+"' y='"+(yy+4)+"'>"+
        (trendMetric==="hitRate"?Math.round(v)+"%":v.toFixed(2).replace(".",","))+"</text>";
    }).join("");
    const axisStep=Math.max(1,Math.ceil(rows.length/6));
    const axis=rows.map((row,i)=>i%axisStep===0||i===rows.length-1?
      "<text class='axislabel' text-anchor='middle' x='"+x(i)+"' y='"+(H-18)+"'>"+
      esc(trendGranularity==="week"?row.key.slice(5):row.key.slice(0,7))+"</text>":"").join("");
    const series=["normal","cwl"].map(kind=>{
      const pts=rows.map((row,i)=>point(kind,i,row)).filter(Boolean);
      if(!pts.length)return "";
      const runs=[];let current=[];
      for(let i=0;i<rows.length;i++){
        const p=point(kind,i,rows[i]);
        if(!p){if(current.length>1)runs.push(current);current=[];}
        else current.push(p);
      }
      if(current.length>1)runs.push(current);
      const lines=runs.map(segment=>"<polyline class='statline "+colors[kind]+
        "' points='"+segment.map(p=>p.x.toFixed(1)+","+p.y.toFixed(1)).join(" ")+"'/>").join("");
      const dots=pts.map(p=>"<circle class='statpoint "+colors[kind]+"' cx='"+
        p.x.toFixed(1)+"' cy='"+p.y.toFixed(1)+"' r='5'><title>"+
        esc(p.title)+"</title></circle>").join("");
      return lines+dots;
    }).join("");
    chart.innerHTML="<svg role='img' aria-label='"+esc(label+
      " nach "+(trendGranularity==="week"?"Wochen":"Monaten")+
      "; grün normaler CW, gold CWL; einzelne Fallzahlen in der Tabelle")+
      "' viewBox='0 0 "+W+" "+H+"' preserveAspectRatio='xMidYMid meet'>"+
      grid+axis+series+"</svg>";
    const wasOpen=detail.querySelector("details")?.open===true;
    const fmt=(data)=>{
      const val=data[trendMetric];
      return data.attacks?(val+(trendMetric==="hitRate"?" %":" ★")+
        " (n="+data.attacks+")"):"–";
    };
    const table=all.slice().reverse().map(row=>"<tr><td>"+esc(row.key)+
      "</td><td>"+fmt(row.normal)+"</td><td>"+fmt(row.cwl)+"</td></tr>").join("");
    detail.innerHTML="<details"+(wasOpen?" open":"")+"><summary>Alle "+all.length+
      " erfassten Zeiträume mit Angriffsanzahl anzeigen</summary><div class='stats-war-history-scroll'>"+
      "<table><thead><tr><th>Zeitraum</th><th>CW</th><th>CWL</th></tr></thead><tbody>"+
      table+"</tbody></table></div></details>"+
      (all.length>12?"<p class='stats-note'>Im Diagramm die letzten 12 Zeitpunkte; Tabelle enthält alle.</p>":"");
  }
  function render(){
    setStatsSection(section);
    const ctx=context(),view=$("view-stats");
    if(!view)return;
    const enabled=!!ctx.active&&!!ctx.clanId;
    const ctl=$("statsImportButton");if(ctl)ctl.hidden=!enabled||ctx.role==="viewer";
    const copy=$("statsNoCloud");if(copy)copy.hidden=enabled;
    if(!enabled){
      $("statsSummary").innerHTML="";
      if($("statsMissedCoverage"))$("statsMissedCoverage").textContent="";
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
      return;
    }
    const metricSignature=[ctx.clanId,version,type,last,cwlSeasons,sameHigher,showFormer,(ctx.memberTags||[]).join(",")].join("|");
    const metricsChanged=metricSignature!==lastMetricSignature||!cachedSummary;
    if(metricsChanged){
      cachedSummary=computeWarStats(wars,attacks,{type,last,cwlSeasons,sameHigher,showFormer,memberTags:ctx.memberTags||[],missedEvents});
      const selection=selectStatWars(wars,{type,last,cwlSeasons});
      const comparison=computeComparableForm(selection,attacks);
      viewComparableProfiles=comparison.profiles;viewComparableSummary=comparison.summary;
      lastMetricSignature=metricSignature;
      cachedPlayerStats=new Map(cachedSummary.rows.map(p=>[cleanTag(p.tag),p]));
    }
    const summary=cachedSummary;
    syncPeriodChoices();
    const selected=selectStatWars(wars,{type,last,cwlSeasons});
    if($("statsPlayerScope")){
      const oldest=selected.length?new Date(Math.min(...selected.map(w=>Date.parse(w.started_at)))):null;
      const newest=selected.length?new Date(Math.max(...selected.map(w=>Date.parse(w.started_at)))):null;
      const from=oldest&&!Number.isNaN(oldest.getTime())?oldest.toLocaleDateString("de-AT"):"–";
      const until=newest&&!Number.isNaN(newest.getTime())?newest.toLocaleDateString("de-AT"):"–";
      $("statsPlayerScope").textContent="Spielerwerte aus "+selected.length+" ausgewählten Kriegen / CWL-Tagen ("+from+" bis "+until+"). "
        +"Form = nur gleiches RH und die letzten 90 Tage innerhalb dieser Auswahl. "
        +"Letzte 10 Kriege = zehn jüngste ausgewählte Kriege, auch CWL-Kriegstage.";
    }
    renderMatchups();
    renderDuel();
    renderTimeline();
    const displayMissed=(known,complete)=>complete?String(known):(known>0?"mind. "+known:"k. A.");
    const label=displayMissed(summary.missesKnown,summary.complete);
    // Give each war type its own denominator: 30/30 CWs can be exact even
    // when only 1/22 CWL days has a fully evidenced roster.
    const coverageDescriptions=[["normal","CW"],["cwl","CWL"]]
      .filter(([type])=>summary.missedCoverage[type].wars>0)
      .map(([type,name])=>{
        const c=summary.missedCoverage[type];
        return name+": "+displayMissed(c.missedKnown,c.complete)+
          " verpasst · "+c.coveredWars+"/"+c.wars+" Kriege vollständig erfasst";
      });
    const missedCoverageHost=$("statsMissedCoverage");
    if(missedCoverageHost)missedCoverageHost.textContent=
      "Nachgewiesene Ausfälle im gewählten Zeitraum: "+coverageDescriptions.join(" · ");
    $("statsSummary").innerHTML=[
      ["3★-Hit-Rate",pct(summary.hitRate)],
      ["Ø Sterne / Angriff",summary.averageStars===null?"–":summary.averageStars.toLocaleString("de-AT",{minimumFractionDigits:2,maximumFractionDigits:2})+" ★"],
      ["Angriffe",String(summary.attacks)],
      ["Verpasste Angriffe",label]
    ].map(([title,value])=>"<div class='stats-kpi'><span>"+esc(title)+"</span><strong>"+esc(value)+"</strong></div>").join("");
    const count=$("statsDataCount");
    const seasonDetails=$("statsSeasonDetails");
    if(type==="cwl"){
      if(count)count.textContent=summary.wars+" von "+summary.totalCwlDays+
        " gespeicherten CWL-Kriegstagen · "+summary.cwlSeasonBreakdown.length+
        " von "+summary.totalCwlSeasons+" CWL-Durchgängen · "+summary.attacks+" Angriffe";
      if(seasonDetails)seasonDetails.textContent=summary.cwlSeasonBreakdown.map(({from,to,days,inferred})=>{
        const fmt=value=>new Date(value+"T12:00:00Z").toLocaleDateString("de-AT",
          {day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"});
        return fmt(from)+(from!==to?" – "+fmt(to):"")+
          ": "+days+" erfasste Kriegstage"+(inferred?" (zeitlich zugeordnet)":"");
      }).join(" · ");
    }else{
      const leagueDays=summary.cwlSeasonBreakdown.reduce((n,s)=>n+s.days,0);
      const normalDays=summary.wars-leagueDays;
      if(type==="all"){
        if(count)count.textContent=normalDays+" normale CWs + "+leagueDays+
          " CWL-Kriegstage aus "+summary.cwlSeasonBreakdown.length+
          " Durchgängen · "+summary.attacks+" Angriffe";
        if(seasonDetails)seasonDetails.textContent="Ausgewertet werden "+normalDays+
          " normale CWs und "+summary.cwlSeasonBreakdown.length+
          " der "+summary.totalCwlSeasons+" erfassten CWL-Durchgänge. "+
          "Historische CWL-Durchgänge ohne Gruppenkennung werden nach Datumsabstand getrennt, bei Lücken nur vorläufig.";
      }else{
        if(count)count.textContent=summary.wars+" von "+
          wars.filter(w=>w.war_type==="normal").length+
          " gespeicherten normalen CWs · "+summary.attacks+" Angriffe";
        if(seasonDetails)seasonDetails.textContent="Bis zu "+last+" zuletzt gespielte normale Clankriege werden ausgewertet.";
      }
    }
    const note=$("statsMissingNote");
    if(note){
      note.textContent=summary.complete?"":(
        "„mind.“ bedeutet: so viele vergessene Angriffe sind sicher bekannt. "+
        "„k. A.“ bedeutet: 0 ist nicht bewiesen. Bei manchen älteren CWL-Kriegen "+
        "fehlen vollständige Aufstellungen oder ein lückenloser Missed-Log; "+
        "die normalen CWs können dennoch vollständig ausgewertet sein. "+
        "Sortierung nach „Verpasst“ verwendet die nachgewiesene Anzahl."
      );
      note.hidden=summary.complete;
    }
    const guide=$("statsCoverageGuide");
    if(guide){
      const cwl=summary.missedCoverage.cwl;
      guide.hidden=!(cwl.wars>0&&!cwl.complete);
      if(guide.hidden)guide.open=false;
    }
    renderWarHistory();
    // Membership performance badges depend on loaded attack data, not search/sort/filter state.
    if(scope===ctx.clanId&&lastMembersNotifiedVersion!==version){
      lastMembersNotifiedVersion=version;
      window.CWLCloudStats?.onUpdate?.();
    }
    const term=search.trim().toLocaleLowerCase("de");
    const visible=summary.rows.filter(p=>!term||p.name.toLocaleLowerCase("de").includes(term)||p.tag.toLowerCase().includes(term))
      .sort((a,b)=>{
        const metric=p=>order==="performance"?viewComparableProfiles.get(cleanTag(p.tag))?.performanceIndex:
          order==="missed"?p.missedKnown:order==="lastTen"?p.lastTen.averageStars:p[order];
        const rawA=metric(a),rawB=metric(b);
        const av=rawA??-1,bv=rawB??-1;
        const diff=typeof av==="string"?av.localeCompare(bv,"de"):av-bv;
        const tie=order==="performance"?
          (viewComparableProfiles.get(cleanTag(b.tag))?.weighted90.effectiveAttacks??0)-
          (viewComparableProfiles.get(cleanTag(a.tag))?.weighted90.effectiveAttacks??0):0;
        return (ascending?diff:-diff)||tie||b.attacks-a.attacks||a.name.localeCompare(b.name,"de");
      });
    const nextRowsMarkup=visible.length?visible.map((p,index)=>{
      // Raw hit rates are evidence, not green/red player grades.
      const missedColor=p.missedKnown>0?" warn":"";
      const form=viewComparableProfiles.get(cleanTag(p.tag));
      const qualityLabels={none:"Keine Vergleichsdaten",stale:"Nur ältere Angriffe",
        limited:"Wenig Daten",trend:"Erste Tendenz",solid:"Mehr Vergleichsdaten"};
      const matched=form?.last90?.attacks??0;
      const quality=qualityLabels[form?.quality]||"Keine Vergleichsdaten";
      const formText=matched?
        (form.performanceRankable?
          "90-Tage-Trend "+formPct(form.weighted90.hitRate)+" · "+matched+" gleich-RH-Angriffe":
          "Vergleich: "+quality+" · "+matched+" gleich-RH-Angriffe"):
        "Vergleich: keine gleich-RH-Angriffe (90 Tage)";
      const lastTen=p.lastTen;
      const lastTenMissed=lastTen.recordedParticipations===0?"– (keine Teilnahme dokumentiert)":lastTen.missed===null?
        (lastTen.missedKnown>0?"mind. "+lastTen.missedKnown:"k. A."):
        String(lastTen.missed);
      const lastTenLabel=lastTen.attacks?
        lastTen.attacks+" Angriffe · "+lastTen.hitRate+" % 3★ · Ø "+
        lastTen.averageStars.toLocaleString("de-AT",{minimumFractionDigits:2,maximumFractionDigits:2})+" ★":
        "Keine Angriffe in diesem Kriegsfenster belegt";
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
        "<small class='stats-form-score' title='Vorläufige Form aus gleich-RH-Angriffen der letzten 90 Tage'>"+esc(formText)+"</small>"+
        "<details class='stats-player-details' data-player-tag='"+esc(p.tag)+"'"+detailsOpen+">"+
        "<summary>Letzte "+lastTen.wars+" ausgewählte Kriege · Details</summary>"+
        "<div>"+esc(lastTenLabel)+" · verpasst: "+esc(lastTenMissed)+
        "</div><small>Betrachtet werden die "+lastTen.wars+" zuletzt ausgewählten Kriege · "+lastTen.coveredWars+"/"+lastTen.wars+" vollständig erfasst. "+
        "Ohne vollständige CWL-Tagesdaten können weitere Fehlangriffe unbekannt sein. "+
        "Ein nicht eingeplanter Spieler hat keinen verpassten Angriff.</small></details></div>";
    }).join(""):"<div class='stats-empty'>Keine passenden Spieler in dieser Auswahl.</div>";
    renderComparableForm();
    // Avoid destroying player rows (and their decoded RH images) for identical results.
    const rowsHost=$("statsRows");
    if(lastRowsHost!==rowsHost||lastRowsMarkup!==nextRowsMarkup){
      rowsHost.innerHTML=nextRowsMarkup;
      lastRowsHost=rowsHost;
      lastRowsMarkup=nextRowsMarkup;
    }
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
      "<p class='stats-note'>Keine Einzelangriffe hinterlegt.</p>";
    target.dataset.rendered="1";
  }
  function renderWarHistory(){
    const host=$("statsWarHistory");if(!host)return;
    const ctx=context();
    const historySignature=[ctx.clanId,version,type,last,cwlSeasons].join("|");
    if(host.dataset.historySignature===historySignature)return;
    const sameClan=host.dataset.historyClan===String(ctx.clanId||"");
    const openWars=new Set(sameClan?[...host.querySelectorAll(".war-history-item[open]")].map(el=>el.dataset.warKey):[]);
    const focusedWar=sameClan&&host.contains(document.activeElement)&&
      document.activeElement?.matches?.(".war-history-item>summary")?
      document.activeElement.parentElement.dataset.warKey:null;
    const chosen=selectStatWars(wars,{type,last,cwlSeasons});
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
    if(!relevant.length){host.innerHTML="<p class='stats-note'>Noch keine abgeschlossenen Kriege gespeichert.</p>";return;}
    host.innerHTML=relevant.map(w=>{
      const entries=index.get(w.war_key)||[];
      const when=new Date(w.started_at).toLocaleDateString("de-AT",{day:"2-digit",month:"2-digit",year:"numeric"});
      const stars=entries.reduce((n,a)=>n+(Number(a.stars)||0),0);
      const kind=w.war_type==="cwl"?"CWL":"CW";
      return "<details class='war-history-item' data-war-key='"+esc(w.war_key)+"'"+
        (openWars.has(w.war_key)?" open":"")+"><summary><span><strong>"+esc(kind+" · "+when)+"</strong><small>gegen "+
        esc(w.opponent_name||"unbekannt")+"</small></span><span>"+entries.length+" Angriffe · "+stars+
        " ★</span></summary><div class='war-history-detail'></div></details>";
    }).join("");
    for(const disclosure of host.querySelectorAll(".war-history-item[open]"))renderHistoryAttacks(disclosure);
    if(focusedWar){
      const restored=[...host.querySelectorAll(".war-history-item")].find(el=>el.dataset.warKey===focusedWar);
      restored?.querySelector("summary")?.focus({preventScroll:true});
    }
  }
  function reset(){
    scope=null;wars=[];attacks=[];missedEvents=[];cachedPlayerStats.clear();cachedRecentStats.clear();
    comparableProfiles.clear();comparableSummary=null;lastComparableRowsMarkup=null;
    viewComparableProfiles.clear();viewComparableSummary=null;openStatsPlayers.clear();
    duelLeft="";duelRight="";duelSameTH=true;trendMetric="hitRate";trendGranularity="month";
    cachedSummary=null;lastMetricSignature="";lastRowsMarkup=null;lastRowsHost=null;historyAttacksByWar.clear();lastMembersNotifiedVersion=-1;
    version++;lastCapture.clear();loading=false;importing=false;
    notice("");render();
  }
  async function load(){
    const ctx=context();if(!ctx.active||!ctx.clanId||loading)return;
    const epoch=++version,id=ctx.clanId;loading=true;notice("Statistik wird geladen …");
    try{
      const {data:ww,error:e1}=await sb.from("cwl_stat_wars").select("*")
        .eq("clan_id",id).order("started_at",{ascending:false}).limit(200);
      if(e1)throw e1;
      const collected=[];
      for(let offset=0;offset<10000;offset+=800){
        const {data:aa,error:e2}=await sb.from("cwl_stat_attacks").select("*")
          .eq("clan_id",id).order("war_key").order("attacker_tag").order("attack_order")
          .range(offset,offset+799);
        if(e2)throw e2;
        collected.push(...(aa||[]));
        if(!aa||aa.length<800)break;
      }
      const missedRows=[];
      for(let offset=0;offset<5000;offset+=800){
        const {data:mm,error:e3}=await sb.from("cwl_stat_missed").select("*")
          .eq("clan_id",id).order("war_key").order("player_tag").range(offset,offset+799);
        if(e3)throw e3;
        missedRows.push(...(mm||[]));
        if(!mm||mm.length<800)break;
      }
      if(epoch!==version||context().clanId!==id)return;
      scope=id;wars=ww||[];attacks=collected;missedEvents=missedRows;
      cachedRecentStats=computeRecentAttackStats(wars,attacks,7);
      const comparable=computeComparableForm(wars,attacks);
      comparableProfiles=comparable.profiles;comparableSummary=comparable.summary;
      notice(wars.length?"Statistik aktuell · "+wars.length+" Kriege gespeichert":
        "Noch keine Angriffsdaten. Importiere die vorbereitete Historie.");
    }catch(e){
      if(epoch===version)notice("Fehler beim Laden der Statistik: "+String(e.message||e));
    }finally{if(epoch===version){loading=false;render()}}
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
      notify("✓ Historische CW-Statistik importiert");
    }finally{importing=false;$("statsImportButton").disabled=false}
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
      trendGranularity=ev.target.value==="week"?"week":"month";
      renderTimeline();
    });
    e("statsType")?.addEventListener("change",ev=>{
      type=ev.target.value;
      syncPeriodChoices();
      render();
    });
    e("statsRange")?.addEventListener("change",ev=>{
      last=Math.max(1,Math.min(50,Number(ev.target.value)||50));
      syncPeriodChoices();render();
    });
    e("statsCwlRange")?.addEventListener("change",ev=>{
      cwlSeasons=ev.target.value==="all"?"all":Math.max(1,Math.min(3,Number(ev.target.value)||3));
      syncPeriodChoices();render();
    });
    e("statsSameTH")?.addEventListener("change",ev=>{sameHigher=ev.target.checked;render()});
    e("statsFormDetails")?.addEventListener("toggle",()=>renderComparableForm());
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
      try{await importFile(ev.target.files?.[0])}catch(e){notice("Importfehler: "+String(e.message||e))}
      finally{ev.target.value=""}
    });
    document.querySelector('[data-view="stats"]')?.addEventListener("click",()=>load());
  }
  function syncPeriodChoices(){
    const periodLabel=$("statsPeriodLabel");
    if(periodLabel)periodLabel.textContent="Kriege für Auswertung";
    const cw=$("statsRange"),league=$("statsCwlRange");
    if(cw)cw.value=String(last);
    if(league)league.value=String(cwlSeasons);
    const cwField=$("statsCwField"),leagueField=$("statsCwlField");
    if(cwField)cwField.hidden=type==="cwl";
    if(leagueField)leagueField.hidden=type==="normal";
    const parts=[];
    const normalCount=wars.filter(w=>w.war_type==="normal").length;
    const cwlCount=groupCwlRuns(wars.filter(w=>
      w.war_type==="cwl"&&(w.source!=="api"||w.finalized===true))).length;
    if(type!=="cwl")parts.push(normalCount?
      Math.min(last,normalCount)+"/"+normalCount+" CWs":"bis zu "+last+" CWs");
    if(type!=="normal")parts.push(cwlCount?
      (cwlSeasons==="all"?cwlCount:Math.min(Number(cwlSeasons),cwlCount))+"/"+cwlCount+" CWL-Durchgänge":
      "alle gespeicherten CWL-Durchgänge");
    const summary=$("statsPeriodSummary");
    if(summary)summary.textContent=parts.join(" + ");
  }
  syncPeriodChoices();
  bind();
  setStatsSection(section);
  return {load,reset,render,captureCwl};
}
