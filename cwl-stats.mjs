import {validateHistoryFile,computeWarStats,cleanTag} from "./cwl-stats-core.mjs?v=1.3.9";
import {sanitizeSnapshot,clashTime} from "./cwl-live-core.mjs?v=1.3.6";
const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pct=x=>x===null?"–":x+"%";
const chunks=(xs,n)=>Array.from({length:Math.ceil(xs.length/n)},(_,i)=>xs.slice(i*n,(i+1)*n));
export function createCloudStats({sb,context,notify,confirmAction}) {
  let scope=null,wars=[],attacks=[],missedEvents=[],loading=false,importing=false,version=0,lastCapture=new Set();
  let type="all",last=50,cwlSeasons=3,sameHigher=false,showFormer=true,search="",order="hitRate",ascending=false;
  const notice=message=>{const e=$("statsFeedback");if(e)e.textContent=message||""};
  function render(){
    const ctx=context(),view=$("view-stats");
    if(!view)return;
    const enabled=!!ctx.active&&!!ctx.clanId;
    const ctl=$("statsImportButton");if(ctl)ctl.hidden=!enabled||ctx.role==="viewer";
    const copy=$("statsNoCloud");if(copy)copy.hidden=enabled;
    if(!enabled){
      $("statsSummary").innerHTML="";
      $("statsRows").innerHTML="";
      return;
    }
    const summary=computeWarStats(wars,attacks,{type,last,cwlSeasons,sameHigher,showFormer,memberTags:ctx.memberTags||[],missedEvents});
    const label=summary.complete?String(summary.misses):
      (summary.missesKnown>0?"≥"+summary.missesKnown:"–");
    $("statsSummary").innerHTML=[
      ["3★-Hit-Rate",pct(summary.hitRate)],
      ["Angriffe",String(summary.attacks)],
      ["Verpasste Angriffe",label],
      ["Beste 3★-Hit-Rate",summary.best?pct(summary.best.hitRate):"–"]
    ].map(([title,value])=>"<div class='stats-kpi'><span>"+esc(title)+"</span><strong>"+esc(value)+"</strong></div>").join("");
    const count=$("statsDataCount");
    const seasonDetails=$("statsSeasonDetails");
    if(type==="cwl"){
      if(count)count.textContent=summary.wars+" von "+summary.totalCwlDays+
        " gespeicherten CWL-Kriegstagen · "+summary.cwlSeasonBreakdown.length+
        " von "+summary.totalCwlSeasons+" Saisons · "+summary.attacks+" Angriffe";
      if(seasonDetails)seasonDetails.textContent=summary.cwlSeasonBreakdown.map(({season,days})=>{
        const date=new Date(season+"-01T12:00:00Z");
        return date.toLocaleDateString("de-AT",{month:"long",year:"numeric",timeZone:"UTC"})+
          ": "+days+" von 7 Kriegstagen gespeichert";
      }).join(" · ");
    }else{
      const leagueDays=summary.cwlSeasonBreakdown.reduce((n,s)=>n+s.days,0);
      const normalDays=summary.wars-leagueDays;
      if(type==="all"){
        if(count)count.textContent=normalDays+" normale CWs + "+leagueDays+
          " CWL-Kriegstage · "+summary.attacks+" Angriffe";
        if(seasonDetails)seasonDetails.textContent="Ausgewertet werden die letzten "+last+
          " normalen Clankriege und "+(cwlSeasons==="all"?"alle verfügbaren CWL-Saisons":
          "bis zu "+cwlSeasons+" CWL-Saison"+(cwlSeasons===1?"":"s"))+
          ". Ältere Daten bleiben erhalten.";
      }else{
        if(count)count.textContent=summary.wars+" von "+
          wars.filter(w=>w.war_type==="normal").length+
          " gespeicherten normalen CWs · "+summary.attacks+" Angriffe";
        if(seasonDetails)seasonDetails.textContent="Bis zu "+last+" zuletzt gespielte normale Clankriege werden ausgewertet.";
      }
    }
    const leader=$("statsBestPlayer");if(leader)leader.textContent=summary.best?
      summary.best.name+" · "+summary.best.attacks+" Angriffe":
      "Noch kein Spieler mit mindestens 5 Angriffen";
    const note=$("statsMissingNote");if(note)note.textContent=summary.complete?
      "Verpasst bedeutet: Ein möglicher Kriegsangriff wurde nicht ausgeführt. Ob er vergessen oder bewusst ausgelassen wurde, ist nicht erkennbar. Die 3★-Hit-Rate zählt nur ausgeführte Angriffe.":
      "Verpasst bedeutet: Ein möglicher Kriegsangriff wurde nicht ausgeführt – der Grund ist unbekannt. Bei älteren Kriegen fehlen teils Daten: ≥ ist die nachgewiesene Mindestzahl, – bedeutet unbekannt. Die 3★-Hit-Rate zählt nur ausgeführte Angriffe.";
    const term=search.trim().toLocaleLowerCase("de");
    const visible=summary.rows.filter(p=>!term||p.name.toLocaleLowerCase("de").includes(term)||p.tag.toLowerCase().includes(term))
      .sort((a,b)=>{
        const av=a[order]??-1,bv=b[order]??-1;
        const diff=typeof av==="string"?av.localeCompare(bv,"de"):av-bv;
        return (ascending?diff:-diff)||b.attacks-a.attacks;
      });
    $("statsRows").innerHTML=visible.length?visible.map(p=>{
      const hitColor=p.hitRate===null?"":p.hitRate>=80?" great":p.hitRate<60?" low":"";
      const missedColor=p.missedKnown>0?" warn":"";
      return "<div class='stats-player-row'>"+
        "<div class='stats-player' title='"+esc(p.tag)+"'><span class='stats-th' aria-hidden='true'>"+
          (p.th&&Number.isInteger(p.th)&&p.th>=1&&p.th<=18?
           "<img src='https://raw.githubusercontent.com/ClashKingInc/ClashKingAssets/main/assets/buildings/home-village/town_hall/level_"+p.th+".webp' width='29' height='26' loading='lazy' decoding='async' alt='' onerror='this.remove()'>":"")+
          "<small>"+(p.th?"RH"+p.th:"RH?")+"</small></span><div class='stats-name'>"+
          "<b>"+esc(p.name)+"</b>"+(p.former?"<small>Ehemals</small>":"")+"</div></div>"+
        "<strong class='stats-rate"+hitColor+"'>"+pct(p.hitRate)+"</strong>"+
        "<span class='stats-number'>"+p.attacks+"</span>"+
        "<span class='stats-number"+missedColor+"'>"+(p.missed===null?(p.missedKnown>0?"≥"+p.missedKnown:"–"):p.missed)+"</span></div>";
    }).join(""):"<div class='stats-empty'>Keine passenden Spieler in dieser Auswahl.</div>";
  }
  function reset(){
    scope=null;wars=[];attacks=[];missedEvents=[];version++;lastCapture.clear();loading=false;importing=false;
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
    const message=parsed.wars.length+" Kriege, "+parsed.attacks.length+" Angriffe und "+
      parsed.missed.length+" nicht genutzte Angriffe übernehmen? Bereits vorhandene Einträge werden aktualisiert statt doppelt angelegt. Der CWL-Plan bleibt unverändert.";
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
        " Angriffe, "+parsed.missed.length+" Missed-Einträge.");
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
    e("statsFormer")?.addEventListener("change",ev=>{showFormer=ev.target.checked;render()});
    e("statsSearch")?.addEventListener("input",ev=>{search=ev.target.value;render()});
    e("statsSort")?.addEventListener("change",ev=>{order=ev.target.value;render()});
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
    if(periodLabel)periodLabel.textContent="Zeitraum";
    const cw=$("statsRange"),league=$("statsCwlRange");
    if(cw)cw.value=String(last);
    if(league)league.value=String(cwlSeasons);
    const cwField=$("statsCwField"),leagueField=$("statsCwlField");
    if(cwField)cwField.hidden=type==="cwl";
    if(leagueField)leagueField.hidden=type==="normal";
    const parts=[];
    if(type!=="cwl")parts.push(last+" CW"+(last===1?"":"s"));
    if(type!=="normal")parts.push(cwlSeasons==="all"?"alle CWLs":cwlSeasons+" CWL"+(cwlSeasons===1?"":"s"));
    const summary=$("statsPeriodSummary");
    if(summary)summary.textContent=parts.join(" + ");
  }
  syncPeriodChoices();
  bind();
  return {load,reset,render,captureCwl};
}
