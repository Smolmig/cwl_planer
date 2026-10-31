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
// A missed log is independent of the hit-rate TH filter. The historical log
// covers regular CWs only; CWL misses stay unknown without a full API roster.
export function computeWarStats(wars,attacks,{type="all",last=25,sameHigher=false,showFormer=true,
  memberTags=[],minAttacks=0,missedEvents=[]}={}){
  const selected=[...wars].filter(w=>type==="all"||w.war_type===type)
    .sort((a,b)=>Date.parse(b.started_at)-Date.parse(a.started_at)||
      String(a.war_key).localeCompare(String(b.war_key)))
    .slice(0,Math.max(1,Math.min(50,last)));
  const lookup=new Map(selected.map(w=>[w.war_key,w]));
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
    if(!players.has(key))players.set(key,{tag:key,name,th,attacks:0,threes:0,missedKnown:0,
      missComplete:true,participated:new Set()});
    const p=players.get(key);
    if(!p.name&&name)p.name=name;
    if(p.th===null&&Number.isInteger(th))p.th=th;
    return p;
  }
  for(const w of selected)for(const a of filtered.filter(x=>x.war_key===w.war_key)){
    const p=player(a.attacker_tag,a.attacker_name,a.attacker_th);
    p.attacks++;if(a.stars===3)p.threes++;p.participated.add(w.war_key);
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
  let totalMissedKnown=0;
  for(const w of selected){
    if(w.missed_log_complete===true){
      for(const m of knownMissed.filter(m=>m.war_key===w.war_key)){
        const p=player(m.player_tag,m.player_name);
        p.missedKnown+=m.missed_count;
        totalMissedKnown+=m.missed_count;
      }
    }else if(hasFullRoster(w)){
      const max=w.war_type==="cwl"?1:2;
      for(const rawTag of w.roster_tags){
        const tag=cleanTag(rawTag);if(!validTag(tag))continue;
        const p=player(tag);
        p.participated.add(w.war_key);
        const used=chosen.filter(a=>a.war_key===w.war_key&&cleanTag(a.attacker_tag)===tag).length;
        const misses=Math.max(0,max-used);
        p.missedKnown+=misses;totalMissedKnown+=misses;
      }
    }else{
      // A partially available Missed Log still proves individual missed
      // attacks. It does NOT prove there were zero other missed attacks.
      for(const m of knownMissed.filter(m=>m.war_key===w.war_key)){
        const p=player(m.player_tag,m.player_name);
        p.missedKnown+=m.missed_count;totalMissedKnown+=m.missed_count;
      }
      for(const p of players.values()){
        if(p.participated.has(w.war_key))p.missComplete=false;
      }
    }
  }
  const rows=[...players.values()].map(p=>({
    tag:p.tag,name:p.name||p.tag,th:p.th,attacks:p.attacks,
    hitRate:p.attacks?Math.round(p.threes/p.attacks*100):null,threes:p.threes,
    missed:p.missComplete?p.missedKnown:null,missedKnown:p.missedKnown,
    missedComplete:p.missComplete,
    former:currentTags.size>0&&!currentTags.has(p.tag)
  })).filter(p=>p.attacks>=minAttacks&&(showFormer||!p.former))
    .sort((a,b)=>(b.hitRate??-1)-(a.hitRate??-1)||b.attacks-a.attacks||
      a.name.localeCompare(b.name,"de"));
  const best=rows.find(r=>r.attacks>=5&&r.hitRate!==null)||null;
  const complete=selected.length>0&&selected.every(covered);
  const attackSlots=selected.reduce((sum,w)=>sum+w.team_size*(w.war_type==="cwl"?1:2),0);
  const totalHits=filtered.filter(a=>a.stars===3).length;
  return {
    wars:selected.length,totalWars:wars.length,attacks:filtered.length,
    allAttacksUsed:chosen.length,possibleAttacks:attackSlots,
    hitRate:filtered.length?Math.round(totalHits/filtered.length*100):null,
    misses:complete?totalMissedKnown:null,missesKnown:totalMissedKnown,
    missingCoverage:!complete,best,rows,complete
  };
}
