// CWL #184: pure, fail-closed preview for ONE future Clash preparation day.
// The persisted profile stays untouched until an owner confirms a server RPC.
const tag =value=>{
 const v=String(value||"").trim().toUpperCase();
 return v.startsWith("#")?v:v?"#"+v:"";
};
const error=reason=>({ok:false,reason});
const sameLineup=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&
 a.length===b.length&&new Set(a).size===a.length&&
 a.every(id=>b.includes(id));
const clashDate=value=>{
 const m=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.\d+)?Z$/.exec(String(value||""));
 if(!m)return null;
 const date=Date.parse(m[1]+"-"+m[2]+"-"+m[3]+"T"+m[4]+":"+m[5]+":"+m[6]+"Z");
 return Number.isFinite(date)?date:null;
};

export function previewVerifiedCwlPause({profile,snapshot,review,targetDay,
 dayPlans=[],staleDays=[],planningFn,medalFn,now=Date.now()}={}){
 if(typeof planningFn!=="function"||typeof medalFn!=="function"||
    !Number.isFinite(now)||!profile||!snapshot||!review||
    !Number.isInteger(targetDay)||targetDay<=review.day||
    targetDay>Number(profile.config?.days)||!Array.isArray(dayPlans)||
    !/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(String(snapshot.season||""))||
    profile.cwlLive?.season!==snapshot.season||
    tag(profile.cwlLive?.clanTag)!==tag(snapshot.clanTag)||
    profile.cwlLiveIgnoredSeason===snapshot.season)
  return error("CWL, Spieler oder Plandaten nicht eindeutig.");
 if(staleDays.includes(targetDay)||staleDays.includes(review.day))
  return error("Clash-Daten nicht aktuell. Bitte zuerst aktualisieren.");
 if(!review.reviewable?.some(x=>x.day===targetDay)||
    !review.plannedDays?.includes(targetDay)||review.unknownMember)
  return error("Für diesen Tag liegt keine eindeutig geplante, änderbare Aufstellung vor.");
 const round=snapshot.rounds?.find(r=>r.day===targetDay);
 const miss=snapshot.rounds?.find(r=>r.day===review.day);
 if(!round?.available||round.state!=="preparation"||
    !miss?.available||miss.state!=="warEnded"||
    tag(miss.warTag)!==tag(review.warTag)||!tag(round.warTag)||
    clashDate(round.startTime)===null||
    clashDate(round.startTime)<=now+30*60_000)
  return error("Nur ein bestätigter Vorbereitungstag mit mindestens 30 Minuten bis Kampfbeginn ist änderbar.");
 const members=[...(profile.members||[]),...(profile.archivedMembers||[])];
 const matches=members.filter(m=>tag(m.playerTag)===tag(review.tag));
 const member=matches.length===1?matches[0]:null;
 if(!member||member.id!==review.memberId||!profile.members?.includes(member)||
    member.fixed||member.targetDays!=null||
    !member.participating||member.cocSyncState==="former"||
    member.statuses?.[targetDay-1]!=="auto")
  return error("Fixspieler, exaktes Einsatzziel, abwesende Spieler oder eigene Tagesregeln werden nicht automatisch verändert.");
 const days=Number(profile.config.days),slots=Number(profile.config.slots);
 if(!Number.isInteger(slots)||slots<1||slots>50)return error("Ungültige Kriegsgröße.");
 // Clone saved locks, then overlay Clash-confirmed started rosters as
 // read-only solver locks; they are NOT saved as played days.
 const locks=Array.from({length:days},(_,d)=>profile.locks?.[d]?
  JSON.parse(JSON.stringify(profile.locks[d])):{locked:false,lineup:[]});
 const byTag=new Map(),duplicates=new Set();
 for(const player of members){
  const t=tag(player.playerTag);
  if(!t)continue;
  if(byTag.has(t))duplicates.add(t);
  else byTag.set(t,player.id);
 }
 for(let day=1;day<=days;day++){
  const battle=snapshot.rounds?.find(r=>r.day===day);
  if(day<targetDay&&!locks[day-1]?.locked&&!battle?.available)
   return error("Ein früherer CWL-Tag ist noch nicht zuverlässig abgeglichen.");
  if(!battle?.available||!["inWar","warEnded"].includes(battle.state))continue;
  if(staleDays.includes(day))return error("Laufender oder beendeter Krieg hat veraltete Daten.");
  if(battle.teamSize!==slots||!Array.isArray(battle.clan?.members)||
     battle.clan.members.length!==slots)return error("Clash-Aufstellung unvollständig.");
  const ids=battle.clan.members.map(p=>duplicates.has(tag(p.tag))?
    null:byTag.get(tag(p.tag)));
  if(ids.some(id=>!id)||new Set(ids).size!==slots)
   return error("Clash-Spieler sind nicht eindeutig der Mitgliederliste zugeordnet.");
  if(locks[day-1]?.locked){
   if(!sameLineup(locks[day-1].lineup,ids))
    return error("Gespeicherte und tatsächliche Clash-Aufstellung widersprechen sich.");
  }else locks[day-1]={locked:true,lineup:ids,source:"coc-roster-fixed-readonly"};
 }
 if(locks[targetDay-1]?.locked)return error("Dieser Kriegstag ist bereits gesperrt.");
 const params=p=>({members:p.members,archivedMembers:p.archivedMembers,
  locks,slots,days});
 let before,after;
 try{
  before=planningFn(params(profile));
  if(!before?.ok)return error("Bestehender CWL-Plan enthält Konflikte.");
  if(dayPlans.length!==days||dayPlans.some(p=>{
   const current=before.dayPlans?.find(x=>x.day===p.day);
   return !current||!sameLineup(current.lineup,p.lineup)||!!current.locked!==!!p.locked;
  }))return error("Angezeigter Plan stimmt nicht mehr mit der Planungslogik überein.");
  if(!before.dayPlans[targetDay-1]?.lineup?.includes(member.id))
   return error("Spieler steht in dieser Aufstellung nicht mehr.");
  const draft=JSON.parse(JSON.stringify(profile));
  const target=draft.members.find(m=>m.id===member.id);
  target.statuses[targetDay-1]="out";
  after=planningFn(params(draft));
  if(!after?.ok||after.dayPlans.some(p=>p.warnings?.length))
   return error("Pausierung würde Einsatzziele, MUSS-Regeln oder Kriegsplätze verletzen.");
  const protectedRounds=Array.from({length:days},(_,d)=>d+1).filter(day=>
   !!locks[day-1]?.locked);
  for(const day of protectedRounds)
   if(!sameLineup(before.dayPlans[day-1].lineup,after.dayPlans[day-1].lineup))
    return error("Eine bereits fixierte Aufstellung würde sich ändern.");
  if(after.dayPlans[targetDay-1].lineup.includes(member.id))
   return error("Spieler wäre nach der Änderung noch eingeplant.");
  const beforeMedal=medalFn({snapshot,profile,dayPlans:before.dayPlans});
  const afterMedal=medalFn({snapshot,profile:draft,dayPlans:after.dayPlans});
  if(!beforeMedal||!afterMedal)return error("8★-Bonus kann nicht sicher geprüft werden.");
  const b=new Map(beforeMedal.rows.map(m=>[m.playerTag,m]));
  const medalIssues=[];
  for(const result of afterMedal.rows){
   const old=b.get(result.playerTag);
   if(old&&old.potentialMax>=8&&result.potentialMax<8)
    medalIssues.push(result.name+" verliert rechnerisch die Möglichkeit auf 8★.");
   if(old&&old.stars>=8&&result.stars<8)
    medalIssues.push(result.name+" würde nachgewiesene 8★ verlieren.");
  }
  if(medalIssues.length)return error("8★-Konflikt: "+medalIssues.slice(0,3).join(" "));
  // Changes to one AUTO day can redistribute OTHER future assignments.
  // Report verified solver totals and a neutral rotation spread (not a fairness score).
  const participants=profile.members.filter(m=>
   m?.id&&m.participating&&m.cocSyncState!=="former");
  const totals=participants.map(m=>({
   id:m.id,name:String(m.name||tag(m.playerTag)||m.id),
   fixed:!!m.fixed,before:before.counts?.[m.id],after:after.counts?.[m.id]
  }));
  if(totals.some(r=>!Number.isInteger(r.before)||r.before<0||
      !Number.isInteger(r.after)||r.after<0))
   return error("Einsatzverteilung ist nicht vollständig berechenbar.");
  const rotations=totals.filter(r=>!r.fixed);
  const span=key=>rotations.length>1?
   Math.max(...rotations.map(r=>r[key]))-Math.min(...rotations.map(r=>r[key])):null;
  const impact={
   countsChanged:totals.filter(r=>r.before!==r.after).map(
    ({id,name,before,after})=>({id,name,before,after})),
   rotationSpread:{before:span("before"),after:span("after")},
   rotationPlayers:rotations.length
  };
  const changed=after.dayPlans.filter(p=>{
   const a=before.dayPlans[p.day-1];
   return !sameLineup(a.lineup,p.lineup);
  }).map(p=>{
   const previous=before.dayPlans[p.day-1].lineup;
   return {day:p.day,
    out:previous.filter(id=>!p.lineup.includes(id)).map(id=>members.find(m=>m.id===id)?.name||id),
    incoming:p.lineup.filter(id=>!previous.includes(id)).map(id=>members.find(m=>m.id===id)?.name||id)
   };
  });
  if(!changed.some(x=>x.day===targetDay))return error("Keine wirksame Änderung.");
  return {ok:true,day:targetDay,memberId:member.id,tag:tag(review.tag),
   warTag:tag(review.warTag),missDay:review.day,season:snapshot.season,
   changed,impact,medalUnknown:afterMedal.rows.some(m=>m.unknown),
   note:"Änderung betrifft ausschließlich eine AUTO-Tagesregel im Plan; der Clash-Wechsel muss manuell erfolgen.",
   draft};
 }catch(e){return error("Vorschau kann nicht sicher berechnet werden: "+String(e?.message||e).slice(0,120));}
}
