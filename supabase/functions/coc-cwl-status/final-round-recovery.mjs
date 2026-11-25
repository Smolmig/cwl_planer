// Select the latest tenant-bound final-round witness; never recover a
// previous seven-round league just because the newest one has five rounds.
const valid=t=>/^#[0289PYLQGRJCUV]{3,15}$/.test(String(t||""));
const season=s=>/^20\d{2}-(0[1-9]|1[0-2])$/.test(String(s||""));
export function finalRoundRecoveryCandidate(prior,groupRecord,clanTag,now=Date.now()){
 if(!prior||!valid(clanTag)||!season(prior.season)||!valid(prior.war_tag)||
    !["inWar","warEnded"].includes(prior.state)||
    !Number.isInteger(prior.team_size)||prior.team_size<5||prior.team_size>50)return null;
 const utc=new Date(now),parts=prior.season.split("-").map(Number);
 const distance=(utc.getUTCFullYear()-parts[0])*12+utc.getUTCMonth()+1-parts[1];
 if(!Number.isFinite(distance)||distance<0||distance>1)return null;
 let count=7,group=null;
 if(groupRecord){
  const g=groupRecord.group_json;
  if(groupRecord.season!==prior.season||groupRecord.clan_tag!==clanTag||
     g?.season!==prior.season||g?.clanTag!==clanTag||
     !Array.isArray(g.clans)||!Array.isArray(g.rounds))return null;
  const tags=g.clans.map(c=>c?.tag);
  if(![6,8].includes(tags.length)||tags.some(t=>!valid(t))||
     new Set(tags).size!==tags.length||!tags.includes(clanTag))return null;
  count=tags.length-1;
  if(g.rounds.length!==count||!g.rounds.every((r,i)=>r?.day===i+1))return null;
  const matches=g.rounds[count-1].matches;
  if(!Array.isArray(matches))return null;
  const own=matches.filter(m=>m?.available&&
    [m.clan?.tag,m.opponent?.tag].includes(clanTag));
  if(own.length>1||own.some(m=>m.warTag!==prior.war_tag))return null;
  group=g;
 }
 if(prior.day!==count)return null;
 return {warTag:prior.war_tag,season:prior.season,day:count,warCount:count,teamSize:prior.team_size,group};
}
