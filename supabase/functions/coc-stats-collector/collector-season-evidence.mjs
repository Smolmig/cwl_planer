// #227: Fail-closed proof that Supercell has announced a CWL group for a
// specific linked clan. This is NOT evidence that its final war ended and
// must never by itself reset a plan or mark a missing attack as completed.
const tag=value=>{
  const raw=String(value||"").trim().toUpperCase();
  return raw.startsWith("#")?raw:raw?"#"+raw:"";
};
const validTag=value=>/^#[0289PYLQGRJCUV]{3,15}$/.test(value);
const seasonPattern=/^(\d{4}-(?:0[1-9]|1[0-2]))(?:-(?:0[1-9]|[12]\d|3[01]))?$/;
const phases=new Set(["preparation","inWar","ended"]);

export function verifiedLeagueObservation(group,linkedTag){
  const ownTag=tag(linkedTag);
  if(!validTag(ownTag)||!group||typeof group!=="object"||
     Array.isArray(group)||!phases.has(group.state))return null;
  const match=seasonPattern.exec(String(group.season||""));
  if(!match||!Array.isArray(group.clans)||
     ![6,8].includes(group.clans.length)||!Array.isArray(group.rounds))return null;
  const tags=group.clans.map(clan=>tag(clan?.tag));
  if(tags.some(t=>!validTag(t))||new Set(tags).size!==tags.length||
     !tags.includes(ownTag))return null;
  const warCount=tags.length-1,roundCount=group.rounds.length;
  if(roundCount!==0&&roundCount!==warCount)return null;
  // Only an undrawn preparation group may have no rounds. No match is
  // deemed finished by the existence of a group or a status label.
  if(roundCount===0&&group.state!=="preparation")return null;
  const observedWarTags=new Set();
  for(const round of group.rounds){
    if(!round||!Array.isArray(round.warTags)||
       round.warTags.length>tags.length/2)return null;
    for(const raw of round.warTags){
      const warTag=tag(raw);
      if(!validTag(warTag)||observedWarTags.has(warTag))return null;
      observedWarTags.add(warTag);
    }
  }
  return {
    season:match[1],clan_tag:ownTag,group_tags:tags.sort(),
    war_count:warCount,rounds_count:roundCount,group_state:group.state
  };
}
