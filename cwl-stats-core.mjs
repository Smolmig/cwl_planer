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
      source:"import",roster_tags:null,finalized:false};
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
  return {wars,attacks};
}
export function computeWarStats(wars,attacks,{type="all",last=25,sameHigher=false,showFormer=true,
  memberTags=[],minAttacks=0}={}){
  const selected=[...wars].filter(w=>type==="all"||w.war_type===type)
    .sort((a,b)=>Date.parse(b.started_at)-Date.parse(a.started_at)||String(a.war_key).localeCompare(String(b.war_key)))
    .slice(0,Math.max(1,Math.min(50,last)));
  const lookup=new Map(selected.map(w=>[w.war_key,w]));
  const filtered=attacks.filter(a=>lookup.has(a.war_key) && (
    !sameHigher || Number.isInteger(a.attacker_th)&&Number.isInteger(a.defender_th)&&a.defender_th>=a.attacker_th));
  const currentTags=new Set(memberTags.map(cleanTag).filter(Boolean));
  const totalHits=filtered.filter(a=>a.stars===3).length;
  const players=new Map();
  function player(tag,name="",th=null){
    if(!players.has(tag))players.set(tag,{tag,name,th,attacks:0,threes:0,missedKnown:0,
      missComplete:true,participated:new Set()});
    return players.get(tag);
  }
  // Preserve current/last-known player names by war chronology instead of old aliases.
  for(const w of selected){
    for(const a of filtered.filter(x=>x.war_key===w.war_key)){
      const p=player(a.attacker_tag,a.attacker_name,a.attacker_th);
      if(!p.name){p.name=a.attacker_name;p.th=a.attacker_th;}
      p.attacks++;if(a.stars===3)p.threes++;p.participated.add(w.war_key);
    }
  }
  // Reliable missed counts require the complete war roster, which the attached
  // attack-only export does NOT contain. Unknown must never display as zero.
  for(const w of selected){
    if(!w.finalized||!Array.isArray(w.roster_tags)){
      // Players who attacked in an import war have incomplete missed history.
      for(const p of players.values())if(p.participated.has(w.war_key))p.missComplete=false;
      continue;
    }
    const max=w.war_type==="cwl"?1:2;
    for(const rawTag of w.roster_tags){
      const tag=cleanTag(rawTag);if(!validTag(tag))continue;
      const p=player(tag);
      const used=attacks.filter(a=>a.war_key===w.war_key&&a.attacker_tag===tag).length;
      p.missedKnown+=Math.max(0,max-used);
    }
  }
  const rows=[...players.values()].map(p=>({
    tag:p.tag,name:p.name||p.tag,th:p.th,attacks:p.attacks,hitRate:p.attacks?Math.round(p.threes/p.attacks*100):null,
    threes:p.threes,missed:p.missComplete?p.missedKnown:null,former:currentTags.size>0&&!currentTags.has(p.tag)
  })).filter(p=>p.attacks>=minAttacks &&(showFormer||!p.former))
    .sort((a,b)=>(b.hitRate??-1)-(a.hitRate??-1)||b.attacks-a.attacks||a.name.localeCompare(b.name,"de"));
  const best=rows.find(r=>r.attacks>=5&&r.hitRate!==null)||null;
  const complete=selected.length>0&&selected.every(w=>w.finalized&&Array.isArray(w.roster_tags));
  const attackSlots=selected.reduce((sum,w)=>sum+w.team_size*(w.war_type==="cwl"?1:2),0);
  return {wars:selected.length,totalWars:wars.length,attacks:filtered.length,allAttacksUsed:attacks.filter(a=>lookup.has(a.war_key)).length,
    possibleAttacks:attackSlots,hitRate:filtered.length?Math.round(totalHits/filtered.length*100):null,
    misses:complete?attackSlots-attacks.filter(a=>lookup.has(a.war_key)).length:null,
    best,rows,complete};
}
