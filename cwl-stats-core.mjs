// Pure, testable war statistics; never alters CWL planning/profile state.
export const cleanTag=v=>{
  const s=String(v||"").trim().toUpperCase();
  return s.startsWith("#")?s:(s?"#"+s:"");
};
const validTag=t=>/^#[0289PYLQGRJCUV]{3,15}$/.test(t);
const int=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi;
export function validateHistoryFile(input,expectedTag){
  if(!input || input.kind!=="cwl-stats-history" || input.format!==1 ||
      cleanTag(input.clanTag)!==cleanTag(expectedTag) ||
      !Array.isArray(input.wars)||!Array.isArray(input.attacks) ||
      input.wars.length<1||input.wars.length>150||
      input.attacks.length>10000)throw Error("Ungültige Statistik-Datei oder falscher Clan-Tag.");
  const ids=new Set(),attackIds=new Set();
  const wars=input.wars.map(w=>{
    if(typeof w.war_key!=="string"||!/^cp:[0-9]{1,20}$/.test(w.war_key)||
       ids.has(w.war_key)||!["normal","cwl"].includes(w.war_type)||
       !Number.isFinite(Date.parse(w.started_at))||!int(w.team_size,1,50))
      throw Error("Fehlerhafte oder doppelte Kriegsdaten.");
    ids.add(w.war_key);
    return {war_key:w.war_key,war_type:w.war_type,started_at:w.started_at,
      team_size:w.team_size,opponent_tag:String(w.opponent_tag||"").slice(0,30),
      opponent_name:String(w.opponent_name||"").slice(0,80),
      source:"import",roster_tags:null,finalized:false,
      // PostgREST bulk upsert sends absent booleans as NULL. This column is
      // NOT NULL in Supabase and cannot rely on the SQL DEFAULT here.
      missed_log_complete:false};
  });
  const attacks=input.attacks.map(a=>{
    const key=[a.war_key,cleanTag(a.attacker_tag),a.attack_order].join("/");
    if(!ids.has(a.war_key)||!validTag(cleanTag(a.attacker_tag))||
       !int(a.attack_order,0,200)||attackIds.has(key)||
       !int(a.stars,0,3)||!int(a.destruction,0,100)||
       (a.attacker_th!==null&&!int(a.attacker_th,3,30))||
       (a.defender_th!==null&&!int(a.defender_th,3,30)))
       throw Error("Ungültige oder doppelte Angriffszeile.");
    attackIds.add(key);
    return {war_key:a.war_key,attacker_tag:cleanTag(a.attacker_tag),
      attack_order:a.attack_order,attacker_name:String(a.attacker_name||"").slice(0,80),
      attacker_th:a.attacker_th,defender_tag:String(a.defender_tag||"").slice(0,30),
      defender_name:String(a.defender_name||"").slice(0,80),
      defender_th:a.defender_th,stars:a.stars,destruction:a.destruction};
  });
  const missedInput=input.missed===undefined?[]:input.missed;
  if(!Array.isArray(missedInput)||missedInput.length>3000)
    throw Error("Ungültige Missed-Attacks-Liste.");
  const warByKey=new Map(wars.map(w=>[w.war_key,w]));
  const missedIds=new Set();
  const missed=missedInput.map(e=>{
    const tag=cleanTag(e.player_tag),key=e.war_key+"/"+tag;
    const war=warByKey.get(e.war_key);
    if(!war||!validTag(tag)||
       !int(e.missed_count,1,war.war_type==="cwl"?1:2)||missedIds.has(key))
      throw Error("Ungültiger oder doppelter Missed-Attacks-Eintrag.");
    missedIds.add(key);
    return {war_key:e.war_key,player_tag:tag,
      player_name:String(e.player_name||"").slice(0,80),
      missed_count:e.missed_count};
  });
  for(let i=0;i<wars.length;i++){
    const flagged=input.wars[i].missed_log_complete;
    if(flagged===undefined||flagged===false)continue;
    if(flagged!==true||wars[i].war_type!=="normal")
      throw Error("Missed-Log-Abdeckung ist nur für reguläre Kriege erlaubt.");
    wars[i].missed_log_complete=true;
  }
  for(const m of missed){
    const war=warByKey.get(m.war_key);
    // Exact individual CWL misses are valid evidence even when the export
    // does not cover all seven days or all participants.
    if(war.war_type==="normal"&&!war.missed_log_complete)
      throw Error("Missed-Eintrag ohne bestätigten Kriegszeitraum.");
  }
  return {wars,attacks,missed};
}
// Calendar month is a DISPLAY property, not the identity of a CWL run.
// June 2026 had TWO real seven-day CWLs; seasonal starts may cross month ends.
export function cwlSeasonOf(war) {
  if(war?.war_type!=="cwl")return null;
  const date=new Date(war.started_at);
  return Number.isFinite(date.getTime())?date.toISOString().slice(0,7):null;
}
const CWL_RUN_GAP_MS=4*86400000;
/**
 * Group documented CWL days into distinct runs. An explicit league-run ID,
 * if present in a future import, takes precedence. Current v9 stat wars do
 * not store one: fall back to chronological runs (up to 7 days, <=4-day
 * inter-war gaps). A gap larger than four days is intentionally treated as
 * distinct, but missing source days can still make the assignment uncertain.
 * These are presentation groups, never persistent keys or proof of 7 days.
 */
export function groupCwlRuns(wars) {
  const league=(wars||[]).filter(w=>w?.war_type==="cwl"&&
      Number.isFinite(Date.parse(w.started_at)))
    .slice().sort((a,b)=>Date.parse(a.started_at)-Date.parse(b.started_at)||
      String(a.war_key).localeCompare(String(b.war_key)));
  const asc=[];
  for(const w of league){
    const t=Date.parse(w.started_at);
    const explicit=String(w.league_run_id||w.cwl_group_id||"").trim()||null;
    const prev=asc.at(-1);
    const gap=prev?t-prev.lastMs:Infinity;
    const join=prev&&prev.warKeys.length<7&&gap>=0&&
      (explicit&&prev.explicitId===explicit ||
       !explicit&&!prev.explicitId&&gap<=CWL_RUN_GAP_MS);
    if(join){
      prev.warKeys.push(w.war_key);
      prev.lastMs=t;prev.lastAt=w.started_at;
      continue;
    }
    asc.push({
      id:explicit?"league:"+explicit:"observed:"+w.started_at.slice(0,10)+":"+String(w.war_key),
      explicitId:explicit,season:cwlSeasonOf(w),
      from:w.started_at.slice(0,10),to:w.started_at.slice(0,10),
      firstAt:w.started_at,lastAt:w.started_at,firstMs:t,lastMs:t,
      warKeys:[w.war_key]
    });
  }
  return asc.map(run=>({
    ...run,days:run.warKeys.length,to:run.lastAt.slice(0,10),
    inferred:!run.explicitId
  })).reverse();
}
// Keep statistics as rolling windows while retaining older raw records
// for safe recovery. Only finalized CW/CWL wars count as performance data.
export function selectStatWars(wars,{type="all",last=50,cwlSeasons=3}={}){
  const sorted=[...wars].filter(w=>w.source!=="api"||w.finalized===true)
    .sort((a,b)=>Date.parse(b.started_at)-Date.parse(a.started_at)||
      String(a.war_key).localeCompare(String(b.war_key)));
  const normal=sorted.filter(w=>w.war_type==="normal");
  const league=sorted.filter(w=>w.war_type==="cwl");
  const cap=Math.max(1,Math.min(50,last));
  if(type==="normal")return normal.slice(0,cap);
  const runs=groupCwlRuns(league);
  const limit=cwlSeasons==="all"?runs.length:
    Number.isInteger(cwlSeasons)&&cwlSeasons>=1?Math.min(cwlSeasons,runs.length):3;
  const included=new Set(runs.slice(0,limit).flatMap(run=>run.warKeys));
  const selectedLeague=league.filter(w=>included.has(w.war_key));
  if(type==="cwl")return selectedLeague;
  // Combined: independent normal-war and league-season limits.
  return [...normal.slice(0,cap),...selectedLeague].sort((a,b)=>
    Date.parse(b.started_at)-Date.parse(a.started_at)||
    String(a.war_key).localeCompare(String(b.war_key)));
}
// A missed log is independent of the hit-rate TH filter. Exact historical
// CWL missed entries are usable, but they do not prove complete coverage.
/**
 * Actual CW/CWL attack outcomes by opposing Town Hall level.
 * Read-only, descriptive counts; unlike the Form comparison it does not rank players.
 * Unknown THs are a separate category rather than silently removed from denominators.
 */
export function computeThMatchupComparison(wars, attacks, {type="all",last=50,cwlSeasons="all"}={}) {
  const selected = selectStatWars(wars,{type,last,cwlSeasons});
  const byWar = new Map(selected.map(w=>[w.war_key,w]));
  const groups = ["normal","cwl"].flatMap(kind=>["lower","same","higher","unknown"].map(matchup=>({
    type:kind,matchup,attacks:0,triples:0,stars:0,hitRate:null,averageStars:null
  })));
  const byGroup = new Map(groups.map(g=>[g.type+":"+g.matchup,g]));
  for(const attack of attacks||[]){
    const war=byWar.get(attack.war_key);
    if(!war||!Number.isInteger(attack.stars)||attack.stars<0||attack.stars>3)continue;
    const a=Number(attack.attacker_th),d=Number(attack.defender_th);
    const goodTH=Number.isInteger(attack.attacker_th)&&Number.isInteger(attack.defender_th)&&
      a>=3&&a<=30&&d>=3&&d<=30;
    const matchup=!goodTH?"unknown":d<a?"lower":d>a?"higher":"same";
    const group=byGroup.get(war.war_type+":"+matchup);
    if(!group)continue;
    group.attacks++;
    group.stars+=attack.stars;
    if(attack.stars===3)group.triples++;
  }
  for(const group of groups){
    group.hitRate=group.attacks?Math.round(group.triples/group.attacks*100):null;
    group.averageStars=group.attacks?Math.round(group.stars/group.attacks*100)/100:null;
  }
  return groups;
}

/**
 * One comparable date bucket per observed week or month, grouped by CW/CWL.
 * Missing periods are not zero-win periods; consumers must show n for each dot.
 */
export function computeStatsTimeline(wars,attacks,{
  type="all",last=50,cwlSeasons="all",granularity="month"
}={}){
  const selected=selectStatWars(wars,{type,last,cwlSeasons});
  const index=new Map(selected.map(w=>[w.war_key,w]));
  const buckets=new Map();
  for(const a of attacks||[]){
    const war=index.get(a.war_key);
    if(!war||!int(a.stars,0,3))continue;
    const date=new Date(war.started_at);
    if(!Number.isFinite(date.getTime()))continue;
    const year=date.getUTCFullYear(),month=date.getUTCMonth(),day=date.getUTCDate();
    const monday=new Date(Date.UTC(year,month,day));
    monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
    const period=granularity==="week"?monday:new Date(Date.UTC(year,month,1));
    const key=period.toISOString().slice(0,10);
    if(!buckets.has(key))buckets.set(key,{
      key,normal:{attacks:0,triples:0,stars:0},
      cwl:{attacks:0,triples:0,stars:0}
    });
    const g=buckets.get(key)[war.war_type];if(!g)continue;
    g.attacks++;g.stars+=a.stars;if(a.stars===3)g.triples++;
  }
  const rows=[...buckets.values()].sort((a,b)=>a.key.localeCompare(b.key))
    .map(row=>{
      const format=g=>({
        attacks:g.attacks,triples:g.triples,
        hitRate:g.attacks?Math.round(g.triples/g.attacks*100):null,
        averageStars:g.attacks?Math.round(g.stars/g.attacks*100)/100:null
      });
      return {key:row.key,normal:format(row.normal),cwl:format(row.cwl)};
    });
  return {granularity:granularity==="week"?"week":"month",selectedWars:selected.length,
    recordedAttacks:rows.reduce((n,r)=>n+r.normal.attacks+r.cwl.attacks,0),rows};
}

/**
 * Side-by-side factual player comparison with the exact same war selection.
 * "sameTH" excludes missing RH values; no weighting, skill grade or solver use.
 */
export function computePlayerDuel(wars,attacks,firstTag,secondTag,{
  type="all",last=50,cwlSeasons="all",sameTH=true
}={}){
  const chosen=selectStatWars(wars,{type,last,cwlSeasons});
  const byWar=new Map(chosen.map(w=>[w.war_key,w]));
  const tags=[cleanTag(firstTag),cleanTag(secondTag)];
  const empty=tag=>({tag,attacks:0,triples:0,hitRate:null,averageStars:null,
    stars:0,wars:0,lastWar:null,
    normal:{attacks:0,triples:0,hitRate:null},
    cwl:{attacks:0,triples:0,hitRate:null}});
  const results=tags.map(empty),visited=results.map(()=>new Set());
  const names=new Map(tags.map((tag,i)=>[tag,i]));
  for(const a of attacks||[]){
    const war=byWar.get(a.war_key),i=names.get(cleanTag(a.attacker_tag));
    if(!war||i===undefined||!int(a.stars,0,3))continue;
    if(sameTH&&(!int(a.attacker_th,3,30)||!int(a.defender_th,3,30)||
      a.attacker_th!==a.defender_th))continue;
    const p=results[i],kind=p[war.war_type];
    if(!kind)continue;
    p.attacks++;p.stars+=a.stars;
    p.triples+=(a.stars===3?1:0);
    kind.attacks++;kind.triples+=(a.stars===3?1:0);
    visited[i].add(war.war_key);
    if(!p.lastWar||Date.parse(war.started_at)>Date.parse(p.lastWar))
      p.lastWar=war.started_at;
  }
  for(let i=0;i<results.length;i++){
    const p=results[i];p.wars=visited[i].size;
    p.hitRate=p.attacks?Math.round(p.triples/p.attacks*100):null;
    p.averageStars=p.attacks?Math.round(p.stars/p.attacks*100)/100:null;
    for(const kind of [p.normal,p.cwl])
      kind.hitRate=kind.attacks?Math.round(kind.triples/kind.attacks*100):null;
  }
  return {sameTH:!!sameTH,selectedWars:chosen.length,players:results};
}

export function computeWarStats(wars,attacks,{type="all",last=50,cwlSeasons=3,sameHigher=false,showFormer=true,
  memberTags=[],minAttacks=0,missedEvents=[]}={}){
  const selected=selectStatWars(wars,{type,last,cwlSeasons});
  const lookup=new Map(selected.map(w=>[w.war_key,w]));
  const lastTenWars=selected.slice(0,10);
  const lastTenKeys=new Set(lastTenWars.map(w=>w.war_key));
  const chosen=attacks.filter(a=>lookup.has(a.war_key));
  const filtered=chosen.filter(a=>!sameHigher||
    Number.isInteger(a.attacker_th)&&Number.isInteger(a.defender_th)&&a.defender_th>=a.attacker_th);
  const knownMissed=missedEvents.filter(m=>lookup.has(m.war_key));
  const missesByWar=new Map();
  for(const m of knownMissed){
    const key=m.war_key+"/"+cleanTag(m.player_tag);
    missesByWar.set(key,(missesByWar.get(key)||0)+m.missed_count);
  }
  const currentTags=new Set(memberTags.map(cleanTag).filter(Boolean));
  const players=new Map();
  function player(tag,name="",th=null){
    const key=cleanTag(tag);
    if(!players.has(key))players.set(key,{tag:key,name,th,attacks:0,threes:0,starsTotal:0,missedKnown:0,missedKnownByType:{normal:0,cwl:0},participated:new Set(),
      lastTen:{attacks:0,threes:0,stars:0,missedKnown:0}});
    const p=players.get(key);
    if(!p.name&&name)p.name=name;
    if(p.th===null&&Number.isInteger(th))p.th=th;
    return p;
  }
  for(const w of selected)for(const a of filtered.filter(x=>x.war_key===w.war_key)){
    const p=player(a.attacker_tag,a.attacker_name,a.attacker_th);
    p.attacks++;p.starsTotal+=a.stars;if(a.stars===3)p.threes++;p.participated.add(w.war_key);
    if(lastTenKeys.has(w.war_key)){
      p.lastTen.attacks++;p.lastTen.stars+=a.stars;
      if(a.stars===3)p.lastTen.threes++;
    }
  }
  // Players who missed every attack still belong in the ranking, with no
  // fabricated hit-rate percentage.
  for(const m of knownMissed){
    const p=player(m.player_tag,m.player_name);
    p.participated.add(m.war_key);
  }
  const hasFullRoster=w=>w.finalized&&Array.isArray(w.roster_tags)&&
    w.roster_tags.length===w.team_size&&
    new Set(w.roster_tags.map(cleanTag)).size===w.team_size;
  const covered=w=>w.missed_log_complete===true||hasFullRoster(w);
  // Coverage describes the selected wars, not just players who made an
  // attack. An unlogged CWL war could contain an unseen missed attack.
  const missedCoverage={
    normal:{wars:0,coveredWars:0,missedKnown:0,complete:false},
    cwl:{wars:0,coveredWars:0,missedKnown:0,complete:false}
  };
  let totalMissedKnown=0;
  function creditMiss(w,p,count){
    if(!Number.isInteger(count)||count<=0)return;
    p.missedKnown+=count;
    p.missedKnownByType[w.war_type]+=count;
    missedCoverage[w.war_type].missedKnown+=count;
    totalMissedKnown+=count;
    if(lastTenKeys.has(w.war_key))p.lastTen.missedKnown+=count;
  }
  for(const w of selected){
    const coverage=missedCoverage[w.war_type];
    coverage.wars++;
    if(covered(w))coverage.coveredWars++;
    if(w.missed_log_complete===true){
      for(const m of knownMissed.filter(m=>m.war_key===w.war_key)){
        const p=player(m.player_tag,m.player_name);
        creditMiss(w,p,m.missed_count);
      }
    }else if(hasFullRoster(w)){
      const max=w.war_type==="cwl"?1:2;
      for(const rawTag of w.roster_tags){
        const tag=cleanTag(rawTag);if(!validTag(tag))continue;
        const p=player(tag);
        p.participated.add(w.war_key);
        const used=chosen.filter(a=>a.war_key===w.war_key&&cleanTag(a.attacker_tag)===tag).length;
        const misses=Math.max(0,max-used);
        creditMiss(w,p,misses);
      }
    }else{
      // A partially available Missed Log still proves individual missed
      // attacks. It does NOT prove there were zero other missed attacks.
      for(const m of knownMissed.filter(m=>m.war_key===w.war_key)){
        const p=player(m.player_tag,m.player_name);
        creditMiss(w,p,m.missed_count);
      }

    }
  }
  for(const category of Object.values(missedCoverage)){
    category.complete=category.wars>0&&category.coveredWars===category.wars;
  }
  const complete=selected.length>0&&selected.every(covered);
  const lastTenCoveredWars=lastTenWars.filter(covered).length;
  const lastTenComplete=lastTenWars.length>0&&lastTenCoveredWars===lastTenWars.length;
  const rows=[...players.values()].map(p=>({
    tag:p.tag,name:p.name||p.tag,th:p.th,attacks:p.attacks,
    hitRate:p.attacks?Math.round(p.threes/p.attacks*100):null,threes:p.threes,
    averageStars:p.attacks?Math.round(p.starsTotal/p.attacks*100)/100:null,
    missed:complete?p.missedKnown:null,missedKnown:p.missedKnown,
    missedKnownByType:{...p.missedKnownByType},
    missedComplete:complete,
    lastTen:{
      wars:lastTenWars.length,
      coveredWars:lastTenCoveredWars,
      recordedParticipations:[...p.participated].filter(key=>lastTenKeys.has(key)).length,
      attacks:p.lastTen.attacks,
      threes:p.lastTen.threes,
      hitRate:p.lastTen.attacks?Math.round(100*p.lastTen.threes/p.lastTen.attacks):null,
      averageStars:p.lastTen.attacks?Math.round(100*p.lastTen.stars/p.lastTen.attacks)/100:null,
      missedKnown:p.lastTen.missedKnown,
      missed:lastTenComplete?p.lastTen.missedKnown:null,
      missedComplete:lastTenComplete
    },
    former:currentTags.size>0&&!currentTags.has(p.tag)
  })).filter(p=>p.attacks>=minAttacks&&(showFormer||!p.former))
    .sort((a,b)=>(b.hitRate??-1)-(a.hitRate??-1)||b.attacks-a.attacks||
      a.name.localeCompare(b.name,"de"));
  const best=rows.find(r=>r.attacks>=5&&r.hitRate!==null)||null;
  const attackSlots=selected.reduce((sum,w)=>sum+w.team_size*(w.war_type==="cwl"?1:2),0);
  const totalHits=filtered.filter(a=>a.stars===3).length;
  const allCwl=wars.filter(w=>w.war_type==="cwl"&&(w.source!=="api"||w.finalized===true));
  const allRuns=groupCwlRuns(allCwl);
  const selectedKeys=new Set(selected.map(w=>w.war_key));
  const cwlSeasonBreakdown=allRuns.filter(run=>
    run.warKeys.some(key=>selectedKeys.has(key)))
    .map(run=>({
      season:run.season,id:run.id,from:run.from,to:run.to,
      days:run.warKeys.filter(key=>selectedKeys.has(key)).length,
      inferred:run.inferred
    })).reverse();
  return {
    wars:selected.length,totalWars:wars.length,totalCwlDays:allCwl.length,
    totalCwlSeasons:allRuns.length,cwlSeasonBreakdown,
    attacks:filtered.length,
    allAttacksUsed:chosen.length,possibleAttacks:attackSlots,
    hitRate:filtered.length?Math.round(totalHits/filtered.length*100):null,
    averageStars:filtered.length?Math.round(filtered.reduce((n,a)=>n+a.stars,0)/filtered.length*100)/100:null,
    misses:complete?totalMissedKnown:null,missesKnown:totalMissedKnown,
    missingCoverage:!complete,missedCoverage,best,rows,complete
  };
}

/**
 * Compact member cards deliberately use at most seven individual attacks
 * (normal CW and CWL together), independent of the statistics period filter.
 * History stores war start time and attack order, not individual attack times.
 */
export function computeRecentAttackStats(wars,attacks,maxAttacks=7){
 const limit=Math.min(7,Math.max(1,Math.trunc(Number(maxAttacks))||7));
 const byWar=new Map((wars||[]).filter(w=>w.source!=="api"||w.finalized===true)
   .map(w=>[w.war_key,Date.parse(w.started_at)]));
 const recent=(attacks||[]).filter(a=>byWar.has(a.war_key)&&
   Number.isInteger(a.stars)&&a.stars>=0&&a.stars<=3)
   .sort((a,b)=>(byWar.get(b.war_key)||0)-(byWar.get(a.war_key)||0)||
     b.attack_order-a.attack_order||String(a.war_key).localeCompare(String(b.war_key)));
 const groups=new Map();
 for(const a of recent){
  const tag=cleanTag(a.attacker_tag);
  if(!validTag(tag))continue;
  if(!groups.has(tag))groups.set(tag,[]);
  const group=groups.get(tag);
  if(group.length<limit)group.push(a);
 }
 const warInfo=new Map((wars||[]).map(w=>[w.war_key,w]));
 return new Map([...groups].map(([tag,items])=>{
  const triples=items.filter(a=>a.stars===3).length;
  const starsTotal=items.reduce((sum,a)=>sum+a.stars,0);
  const normal=items.filter(a=>warInfo.get(a.war_key)?.war_type==="normal").length;
  const cwl=items.filter(a=>warInfo.get(a.war_key)?.war_type==="cwl").length;
  const imported=items.filter(a=>warInfo.get(a.war_key)?.source==="import").length;
  return [tag,{
   attacks:items.length,threes:triples,starsTotal,normalAttacks:normal,cwlAttacks:cwl,
   importedAttacks:imported,apiAttacks:items.length-imported,
   newestWar:warInfo.get(items[0]?.war_key)?.started_at||null,
   oldestWar:warInfo.get(items.at(-1)?.war_key)?.started_at||null,
   averageStars:Math.round(starsTotal/items.length*100)/100,
   hitRate:Math.round(triples/items.length*100)
  }];
 }));
}
