// Pure Clash war -> private cwl_stat_* rows. Does not touch planner state.
// A live war is staged with finalized=false; only ended wars can enter stats.
export const tag=value=>{
  const clean=String(value||"").trim().toUpperCase();
  return clean.startsWith("#")?clean:clean?"#"+clean:"";
};
export const validTag=value=>/^#[0289PYLQGRJCUV]{3,15}$/.test(tag(value));
export function clashDate(value){
  const match=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.\d+)?Z$/.exec(String(value||""));
  if(!match)return null;
  const iso=match[1]+"-"+match[2]+"-"+match[3]+"T"+match[4]+":"+match[5]+":"+match[6]+"Z";
  const date=new Date(iso);
  return Number.isFinite(date.getTime())&&date.toISOString()===iso.replace("Z",".000Z")?
    date.toISOString():null;
}
const validStars=value=>Number.isInteger(value)&&value>=0&&value<=3;
const validPercentage=value=>typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=100;
const string=(value,limit)=>String(value||"").slice(0,limit);

/**
 * Returns null for not-started/inaccessible wars; throws for inconsistent
 * snapshots, which may be retried later. No partial data are persisted.
 */
export function buildWarSnapshot(raw,clanTag,{warType="normal",warTag="",now=Date.now()}={}){
  if(!raw||!["normal","cwl"].includes(warType))return null;
  if(!["inWar","warEnded"].includes(raw.state))return null;
  const ownTag=tag(clanTag);
  if(!validTag(ownTag))throw Error("invalid_linked_clan_tag");
  const clan=tag(raw.clan?.tag)===ownTag?raw.clan:
    tag(raw.opponent?.tag)===ownTag?raw.opponent:null;
  const opponent=clan===raw.clan?raw.opponent:raw.clan;
  const size=raw.teamSize;
  const started=clashDate(raw.startTime),ended=clashDate(raw.endTime);
  if(!clan||!opponent||!validTag(opponent.tag)||
     !Number.isInteger(size)||size<1||size>50||
     !started||!ended||Date.parse(started)>=Date.parse(ended))
    throw Error("incomplete_war_identity");
  const final=raw.state==="warEnded";
  // Avoid finalizing while the API still settles the last result.
  if(final&&Date.parse(ended)>now-60000)return null;
  const roster=clan.members,enemies=opponent.members;
  if(!Array.isArray(roster)||roster.length!==size||
     !Array.isArray(enemies)||enemies.length!==size)
    throw Error("incomplete_war_roster");
  const ownTags=roster.map(m=>tag(m?.tag)),enemyTags=enemies.map(m=>tag(m?.tag));
  if(ownTags.some(t=>!validTag(t))||new Set(ownTags).size!==size||
     enemyTags.some(t=>!validTag(t))||new Set(enemyTags).size!==size)
    throw Error("invalid_war_roster");
  const leagueTag=tag(warTag);
  if(warType==="cwl"&&!validTag(leagueTag))throw Error("invalid_league_war_tag");
  const key=warType==="cwl"?"cwl:"+leagueTag:
    "normal:"+String(raw.startTime)+":"+tag(opponent.tag);
  if(key.length>100)throw Error("war_key_too_long");
  const opponentLookup=new Map(enemies.map(m=>[tag(m.tag),m]));
  const rows=[];
  for(let i=0;i<roster.length;i++){
    const member=roster[i],memberTag=ownTags[i];
    if(member.townhallLevel!==undefined&&member.townhallLevel!==null&&
       (!Number.isInteger(member.townhallLevel)||member.townhallLevel<3||member.townhallLevel>30))
      throw Error("invalid_attacker_townhall");
    const rawAttacks=member.attacks||[];
    if(!Array.isArray(rawAttacks)||rawAttacks.length>(warType==="cwl"?1:4))
      throw Error("invalid_attacks_count");
    for(let j=0;j<rawAttacks.length;j++){
      const attack=rawAttacks[j],enemyTag=tag(attack.defenderTag);
      const target=opponentLookup.get(enemyTag);
      if(!target||!validStars(attack.stars)||!validPercentage(attack.destructionPercentage)||
         (attack.attackerTag&&tag(attack.attackerTag)!==memberTag))
        throw Error("incomplete_attack_evidence");
      // Match the browser's existing (member, 1-based attack index) key.
      // Clash's global battle "order" is not the same identity.
      const order=j+1;
      const defenderTH=target.townhallLevel??null;
      if(defenderTH!==null&&(!Number.isInteger(defenderTH)||defenderTH<3||defenderTH>30))
        throw Error("invalid_defender_townhall");
      rows.push({
        war_key:key,attacker_tag:memberTag,attack_order:order,
        attacker_name:string(member.name,80),attacker_th:member.townhallLevel??null,
        defender_tag:enemyTag,defender_name:string(target.name,80),defender_th:defenderTH,
        stars:attack.stars,destruction:Math.round(attack.destructionPercentage)
      });
    }
  }
  return {war:{
      war_key:key,war_type:warType,started_at:started,
      team_size:size,opponent_tag:tag(opponent.tag),opponent_name:string(opponent.name,80),
      source:"api",roster_tags:ownTags,finalized:final,missed_log_complete:false
    },attacks:rows,state:raw.state};
}
