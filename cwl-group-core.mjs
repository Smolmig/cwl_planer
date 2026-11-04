// Deterministic, read-only CWL group scoreboard from seven API rounds.
// Never invent missing wars. A +10 win bonus is applied only after warEnded.
// The view is provisional unless every valid group war has ended.
const normalizedTag=value=>String(value||"").trim().toUpperCase().replace(/\s/g,"");
const validTag=t=>/^#[0289PYLQGRJCUV]{3,15}$/.test(t);
const safeNum=(v,max=1e6)=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=max?v:null;
export function summarizeCwlGroup(group){
 if(!group||!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(group.season||""))||
    !Array.isArray(group.clans)||!Array.isArray(group.rounds))return null;
 const clans=new Map();
 for(const c of group.clans.slice(0,8)){
   const tag=normalizedTag(c?.tag);if(!validTag(tag)||clans.has(tag))continue;
   clans.set(tag,{tag,name:String(c.name||"Unbekannt"),badgeUrl:c.badgeUrl||null,
     stars:0,warStars:0,bonusStars:0,totalDestruction:0,wins:0,
     completed:0,playing:0,known:0,unknownScores:0});
 }
 if(clans.size<2)return null;
 let expected=0,known=0,ended=0,missing=0;
 const rounds=Array.from({length:7},(_,index)=>{
   const source=group.rounds.find(r=>Number(r?.day)===index+1);
   const matches=(Array.isArray(source?.matches)?source.matches:[]).slice(0,4).map(match=>{
     expected++;
     if(!match?.available||!["preparation","inWar","warEnded"].includes(match.state)||
       !clans.has(normalizedTag(match.clan?.tag))||
       !clans.has(normalizedTag(match.opponent?.tag))||
       normalizedTag(match.clan.tag)===normalizedTag(match.opponent.tag)){
       missing++;
       return {available:false};
     }
     known++;
     const a=clans.get(normalizedTag(match.clan.tag)),
           b=clans.get(normalizedTag(match.opponent.tag));
     const state=match.state,finished=state==="warEnded",started=finished||state==="inWar";
     if(finished)ended++;
     const slots=Number.isInteger(match.teamSize)&&match.teamSize>=1&&match.teamSize<=50?match.teamSize:null;
     const record=(team,side)=>{
       team.known++;
       if(finished)team.completed++;
       else if(state==="inWar")team.playing++;
       if(started){
         const v=safeNum(side.stars,150);
         if(v!==null){team.stars+=v;team.warStars+=v}
         else team.unknownScores++;
         const destruction=safeNum(side.destructionPercentage,100);
         if(slots!==null&&destruction!==null)
           team.totalDestruction+=Math.round(destruction*slots*100)/100;
       }
     };
     record(a,match.clan);record(b,match.opponent);
     if(finished){
       const aStars=safeNum(match.clan.stars,150),bStars=safeNum(match.opponent.stars,150);
       const ad=safeNum(match.clan.destructionPercentage,100),
             bd=safeNum(match.opponent.destructionPercentage,100);
       if(aStars!==null&&bStars!==null){
         const aWin=aStars>bStars||(aStars===bStars&&ad!==null&&bd!==null&&ad>bd);
         const bWin=bStars>aStars||(aStars===bStars&&ad!==null&&bd!==null&&bd>ad);
         if(aWin){a.wins++;a.stars+=10;a.bonusStars+=10}
         if(bWin){b.wins++;b.stars+=10;b.bonusStars+=10}
       }
     }
     return {available:true,warTag:String(match.warTag||""),state,teamSize:slots,
       clan:{tag:a.tag,name:a.name,badgeUrl:a.badgeUrl,stars:started?safeNum(match.clan.stars,150):null,
         destructionPercentage:started?safeNum(match.clan.destructionPercentage,100):null,
         attacks:started?safeNum(match.clan.attacks,50):null},
       opponent:{tag:b.tag,name:b.name,badgeUrl:b.badgeUrl,stars:started?safeNum(match.opponent.stars,150):null,
         destructionPercentage:started?safeNum(match.opponent.destructionPercentage,100):null,
         attacks:started?safeNum(match.opponent.attacks,50):null}};
   });
   return {day:index+1,matches};
 });
 // Always sort by known scores and destruction, but distinguish this from
 // an official finished ranking when rounds or scores are missing.
 const table=[...clans.values()].sort((a,b)=>
   b.stars-a.stars||b.totalDestruction-a.totalDestruction||a.name.localeCompare(b.name,"de"));
 const complete=expected>0&&expected===known&&known===ended&&
   table.every(t=>t.completed>=clans.size-1&&t.unknownScores===0);
 let last=null,position=0;
 for(let i=0;i<table.length;i++){
   const row=table[i],key=row.stars+"|"+row.totalDestruction;
   if(key!==last)position=i+1;
   row.position=position;
   row.totalDestruction=Math.round(row.totalDestruction*100)/100;
   last=key;
 }
 return {season:group.season,clanTag:normalizedTag(group.clanTag),clans:table,
   rounds,complete,expected,known,ended,missing,
   partial:missing>0||table.some(t=>t.unknownScores>0)};
}
