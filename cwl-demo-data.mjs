// Deterministic, fictional CWL data. No network, API key, database or localStorage.
export const DEMO_CLAN_TAG="#2PQ";
export const DEMO_CLAN_NAME="Demo Fighters";
export const DEMO_OPPONENTS=[
  "Nachtwächter","Eislegion","Drachenhort","Royal Titans",
  "Sturmbrecher","Sternenjäger","Phönix-Garde"
];
const alphabet="0289PYLQGRJCUV";
function fakeTag(index) {
  let n=index+70,letters="";
  for(let i=0;i<6;i++){letters=alphabet[n%alphabet.length]+letters;n=Math.floor(n/alphabet.length)}
  return "#"+letters;
}
export const DEMO_MEMBERS=Array.from({length:24},(_,i)=>({
  id:"demo-player-"+String(i+1).padStart(2,"0"),
  tag:fakeTag(100+i),name:"Spieler "+String(i+1).padStart(2,"0"),
  townHallLevel:i<9?19:i<18?18:i<22?17:16
}));
export function freshDemoProfile(){
  // The two later substitution players deliberately start outside the planner roster.
  return {
    id:"demo-profile",name:DEMO_CLAN_NAME,
    config:{slots:15,days:7,memberSort:"manual"},
    members:DEMO_MEMBERS.slice(0,22).map(m=>({
      id:m.id,name:m.name,playerTag:m.tag,townHall:m.townHallLevel,
      participating:true,fixed:m.id==="demo-player-01",
      priority:0,threeStar:"unknown",statuses:Array(7).fill("auto"),
      firstDay:null,outFromDay:null
    })),
    archivedMembers:[],locks:Array.from({length:7},()=>({locked:false,lineup:[]})),
    dayGoals:Array.from({length:7},()=>({townHall:{},strength:{}})),
    archives:[]
  };
}
const dayRoster=day=>Array.from({length:15},(_,i)=>
  DEMO_MEMBERS[((day-1)*3+i)%DEMO_MEMBERS.length]);
const opponentRoster=day=>Array.from({length:15},(_,i)=>({
  tag:fakeTag(300+day*20+i),
  name:"Gegner "+String(i+1).padStart(2,"0"),
  townHallLevel:day%2===0?(i<7?19:i<12?18:17):(i<6?20:i<11?19:18)
}));
function gameTime(ms){
  const t=new Date(ms).toISOString();
  return t.replace(/[-:]/g,"").replace(".000",""); // e.g. 20261105T081500Z
}
export function demoResponse(sim,now=Date.now()){
  if(!sim.active) return {ok:true,active:false,clanTag:DEMO_CLAN_TAG,rounds:[]};
  const rounds=Array.from({length:7},(_,i)=>{
    const day=i+1;
    const state=day<sim.day?"warEnded":day===sim.day?sim.phase:
      day===sim.day+1||day===sim.day+2&&sim.phase==="warEnded"?"preparation":null;
    if(!state)return {day,available:false,warTag:"#0"};
    const ended=state==="warEnded";
    // Always within the legitimate 45-day verification horizon.
    const end=ended ? now-(sim.day-day+1)*7200000 :
      state==="inWar"?now+3600000:now+(day-sim.day+2)*86400000;
    const opponents=opponentRoster(day);
    const members=dayRoster(day).map((m,i)=>{
      const attack=ended||state==="inWar"&&i<8;
      return {
        tag:m.tag,name:m.name,townHallLevel:m.townHallLevel,
        attacks:attack && (!ended||i<14)?[{
          attackerTag:m.tag,defenderTag:opponents[i].tag,
          stars:i%5===0?1:i%3===0?2:3,
          destructionPercentage:i%5===0?56:i%3===0?82:100
        }]:[]
      };
    });
    return {
      day,available:true,warTag:fakeTag(700+day),
      state,teamSize:15,startTime:gameTime(end-86400000),endTime:gameTime(end),
      clan:{tag:DEMO_CLAN_TAG,name:DEMO_CLAN_NAME,members},
      opponent:{tag:fakeTag(600+day),name:DEMO_OPPONENTS[i],members:opponents}
    };
  });
  return {ok:true,active:true,clanTag:DEMO_CLAN_TAG,season:"2026-11",rounds};
}
export function advanceDemo(sim) {
  if(sim.phase==="preparation")sim.phase="inWar";
  else if(sim.phase==="inWar")sim.phase="warEnded";
  else if(sim.day<7){sim.day++;sim.phase="preparation"}
  return sim;
}
export function demoStageLabel(sim) {
  if(!sim.active)return "Keine aktive CWL";
  return "Tag "+sim.day+" / 7 · "+({
    preparation:"Vorbereitung",inWar:"Krieg läuft",warEnded:"Krieg beendet"
  }[sim.phase]||sim.phase);
}
