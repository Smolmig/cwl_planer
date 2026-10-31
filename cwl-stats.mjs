import {validateHistoryFile,computeWarStats,cleanTag} from "./cwl-stats-core.mjs?v=1.3.0";
import {sanitizeSnapshot,clashTime} from "./cwl-live-core.mjs?v=1.3.0";
const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pct=x=>x===null?"–":x+"%";
const chunks=(xs,n)=>Array.from({length:Math.ceil(xs.length/n)},(_,i)=>xs.slice(i*n,(i+1)*n));
export function createCloudStats({sb,context,notify}) {
  let scope=null,wars=[],attacks=[],loading=false,importing=false,version=0,lastCapture=new Set();
  let type="all",last=25,sameHigher=false,showFormer=true,search="",order="hitRate",ascending=false;
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
    const summary=computeWarStats(wars,attacks,{type,last,sameHigher,showFormer,memberTags:ctx.memberTags||[]});
    const label=summary.complete?String(summary.misses):"–";
    $("statsSummary").innerHTML=[
      ["Clan Hit Rate",pct(summary.hitRate)],
      ["Angriffe erfasst",String(summary.attacks)],
      ["Angriffe verpasst",label],
      ["Beste Hit Rate",summary.best?pct(summary.best.hitRate):"–"]
    ].map(([title,value])=>"<div class='stats-kpi'><span>"+esc(title)+"</span><strong>"+esc(value)+"</strong></div>").join("");
    const count=$("statsDataCount");if(count)count.textContent=summary.wars+
      " von "+summary.totalWars+" gespeicherten Kriegen · "+summary.attacks+" Angriffe";
    const leader=$("statsBestPlayer");if(leader)leader.textContent=summary.best?summary.best.name+
      " · "+summary.best.attacks+" Angriffe (mindestens 5)":"Mindestens 5 Angriffe erforderlich";
    const note=$("statsMissingNote");if(note)note.textContent=summary.complete?
      "Verpasste Angriffe aus den vollständigen Kriegsaufstellungen berechnet.":
      "Verpasste Angriffe (Missed) sind für exportierte Kriege ohne vollständige Kriegsaufstellung nicht zuverlässig bestimmbar. Deshalb zeigen wir – statt falscher Nullen.";
    const term=search.trim().toLocaleLowerCase("de");
    const visible=summary.rows.filter(p=>!term||p.name.toLocaleLowerCase("de").includes(term)||p.tag.toLowerCase().includes(term))
      .sort((a,b)=>{
        const av=a[order]??-1,bv=b[order]??-1;
        const diff=typeof av==="string"?av.localeCompare(bv,"de"):av-bv;
        return (ascending?diff:-diff)||b.attacks-a.attacks;
      });
    $("statsRows").innerHTML=visible.length?visible.map(p=>{
      const hitColor=p.hitRate===null?"":p.hitRate>=80?" great":p.hitRate<60?" low":"";
      const missedColor=p.missed>0?" warn":"";
      return "<div class='stats-player-row'>"+
        "<div class='stats-player' title='"+esc(p.tag)+"'><span class='stats-th' aria-hidden='true'>"+
          (p.th?"RH"+p.th:"RH?")+"</span><div class='stats-name'>"+
          "<b>"+esc(p.name)+"</b>"+(p.former?"<small>Ehemals</small>":"")+"</div></div>"+
        "<strong class='stats-rate"+hitColor+"'>"+pct(p.hitRate)+"</strong>"+
        "<span class='stats-number'>"+p.attacks+"</span>"+
        "<span class='stats-number"+missedColor+"'>"+(p.missed===null?"–":p.missed)+"</span></div>";
    }).join(""):"<div class='stats-empty'>Keine passenden Spieler in dieser Auswahl.</div>";
  }
  function reset(){
    scope=null;wars=[];attacks=[];version++;lastCapture.clear();loading=false;importing=false;
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
      if(epoch!==version||context().clanId!==id)return;
      scope=id;wars=ww||[];attacks=collected;
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
    const message="Importiere "+parsed.wars.length+" historische Kriege und "+
      parsed.attacks.length+" eindeutige Angriffe in den Cloud-Clan? Wiederholter Import ist möglich; der CWL-Plan wird nicht verändert.";
    if(!confirm(message))return;
    const id=ctx.clanId;importing=true;$("statsImportButton").disabled=true;
    try{
      notice("Import: Kriege speichern …");
      for(const batch of chunks(parsed.wars,80)){
        if(context().clanId!==id)throw Error("Clan wurde gewechselt; Import abgebrochen.");
        const {error}=await sb.from("cwl_stat_wars").upsert(batch.map(w=>({...w,clan_id:id})),
          {onConflict:"clan_id,war_key"});if(error)throw error;
      }
      let done=0;
      for(const batch of chunks(parsed.attacks,80)){
        if(context().clanId!==id)throw Error("Clan wurde gewechselt; Import abgebrochen.");
        const {error}=await sb.from("cwl_stat_attacks").upsert(batch.map(a=>({...a,clan_id:id})),
          {onConflict:"clan_id,war_key,attacker_tag,attack_order"});if(error)throw error;
        done+=batch.length;notice("Import: "+done+" / "+parsed.attacks.length+" Angriffe …");
      }
      await load();
      notice("✓ Historie importiert: "+parsed.wars.length+" Kriege, "+parsed.attacks.length+" eindeutige Angriffe.");
      notify("✓ Historische CW-Statistik importiert");
    }finally{importing=false;$("statsImportButton").disabled=false}
  }
  async function captureCwl(payload){
    const ctx=context();
    if(!ctx.active||!ctx.clanId||!["owner","editor"].includes(ctx.role))return;
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
    e("statsType")?.addEventListener("change",ev=>{type=ev.target.value;render()});
    e("statsRange")?.addEventListener("change",ev=>{last=Number(ev.target.value)||25;render()});
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
  bind();
  return {load,reset,render,captureCwl};
}
