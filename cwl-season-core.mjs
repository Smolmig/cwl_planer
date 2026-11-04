// Read-only facts for a CWL season. The cloud profile contains only our
// own seven wars, not every pairing in the eight-clan league group.
// Never manufacture standings, bonus stars or unknown attack results.
export const cleanTag=value=>String(value||"").toUpperCase().trim().replace(/\s+/g,"");
export function summarizeCwlSeason(profile){
  const live=profile?.cwlLive;
  if(!live||!/^\d{4}-\d{2}$/.test(String(live.season||""))||!Array.isArray(live.rounds))return null;
  const stateLabels={preparation:"Vorbereitung",inWar:"Krieg läuft",warEnded:"Beendet"};
  const safeScore=value=>Number.isInteger(value)&&value>=0?value:null;
  const players=new Map(),opponents=new Map();
  const rounds=Array.from({length:7},(_,index)=>{
    const day=index+1,r=live.rounds.find(x=>Number(x?.day)===day);
    if(!r?.available||!stateLabels[r.state]||!r.clan||!r.opponent)
      return {day,available:false,state:"unknown",label:"Noch nicht verfügbar"};
    const own=r.clan,enemy=r.opponent;
    const ownMembers=Array.isArray(own.members)?own.members:[],opponentMembers=Array.isArray(enemy.members)?enemy.members:[];
    const count=list=>list.reduce((sum,p)=>sum+(Array.isArray(p?.attacks)?p.attacks.length:0),0);
    const ownAttacks=count(ownMembers),enemyAttacks=count(opponentMembers);
    const ended=r.state==="warEnded",started=ended||r.state==="inWar";
    if(started)for(const p of ownMembers){
      const tag=cleanTag(p.tag);if(!tag)continue;
      let entry=players.get(tag);
      if(!entry){entry={tag,name:String(p.name||tag),townHallLevel:p.townHallLevel??null,
        days:0,attacks:0,stars:0,completedDays:0};players.set(tag,entry)}
      entry.name=String(p.name||entry.name);
      entry.townHallLevel=p.townHallLevel??entry.townHallLevel;
      entry.days++;
      if(ended)entry.completedDays++;
      for(const attack of (Array.isArray(p.attacks)?p.attacks:[])){
        if(!Number.isInteger(attack?.stars)||attack.stars<0||attack.stars>3)continue;
        entry.attacks++;
        entry.stars+=attack.stars;
      }
    }
    const tag=cleanTag(enemy.tag);
    if(tag&&!opponents.has(tag))opponents.set(tag,{tag,name:String(enemy.name||"Unbekannt"),badgeUrl:enemy.badgeUrl||null,day});
    return {day,available:true,state:r.state,label:stateLabels[r.state],
      warTag:r.warTag||null,teamSize:r.teamSize||null,
      own:{name:String(own.name||profile.name||"Unser Clan"),badgeUrl:own.badgeUrl||null,
        stars:r.state==="preparation"?null:safeScore(own.stars),attacks:started?ownAttacks:null},
      opponent:{name:String(enemy.name||"Gegner"),badgeUrl:enemy.badgeUrl||null,
        stars:r.state==="preparation"?null:safeScore(enemy.stars),attacks:started?enemyAttacks:null}};
  });
  return {season:live.season,clanTag:cleanTag(live.clanTag),
    available:rounds.filter(r=>r.available).length,
    ended:rounds.filter(r=>r.state==="warEnded").length,
    started:rounds.filter(r=>r.state==="inWar").length,
    rounds,opponents:[...opponents.values()],
    players:[...players.values()].map(p=>({...p,averageStars:p.attacks?p.stars/p.attacks:null}))
      .sort((a,b)=>b.stars-a.stars||b.attacks-a.attacks||a.name.localeCompare(b.name,"de"))};
}
