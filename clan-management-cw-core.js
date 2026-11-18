/* Read-only normal-CW missed evidence; no login/offline inference or sanctions. */
(function(root){
"use strict";
const canonical=v=>String(v||"").trim().toUpperCase();
const valid=v=>/^#[0289PYLQGRJCUV]{3,15}$/.test(canonical(v));
const rank=v=>{const x=String(v||"").toLowerCase().replace(/[\s_-]/g,"");
 return x==="admin"||x==="elder"?"elder":x==="member"?"member":"excluded"};
const actions=new Set(["acknowledged","excused","reopened"]);
function evaluate(members,payload,sourceClanTag,now=Date.now()){
 const clanTag=canonical(sourceClanTag);
 if(!Array.isArray(members)||!valid(clanTag)||!payload||
    !Array.isArray(payload.wars)||!Array.isArray(payload.missed)||
    !Array.isArray(payload.decisions))return null;
 const wars=[],byKey=new Map();
 for(const w of payload.wars){
  if(!w||w.war_type!=="normal"||w.source!=="api"||
     w.finalized!==true||canonical(w.source_clash_tag)!==clanTag||
     typeof w.war_key!=="string"||!w.war_key.startsWith("normal:")||
     !Number.isInteger(w.team_size)||w.team_size<1||w.team_size>50||
     !Array.isArray(w.roster_tags)||w.roster_tags.length!==w.team_size||
     typeof w.missed_log_complete!=="boolean")return null;
  const roster=w.roster_tags.map(canonical);
  if(roster.some(x=>!valid(x))||new Set(roster).size!==roster.length)return null;
  const started=Date.parse(w.started_at||"");
  if(!Number.isFinite(started)||started>now+86400000||byKey.has(w.war_key))return null;
  const row={...w,started,roster:new Set(roster)};
  wars.push(row);byKey.set(w.war_key,row);
 }
 wars.sort((a,b)=>a.started-b.started);
 const missed=new Map();
 for(const m of payload.missed){
  const war=byKey.get(m?.war_key),player=canonical(m?.player_tag);
  if(!war||!war.missed_log_complete||!valid(player)||
     !war.roster.has(player)||![1,2].includes(m.missed_count))return null;
  const key=m.war_key+"|"+player;
  if(missed.has(key))return null;
  missed.set(key,{war,player,missing:m.missed_count});
 }
 const decisionsByKey=new Map();
 for(const d of payload.decisions){
  const key=d?.war_key+"|"+canonical(d?.player_tag);
  if(!d||!Number.isSafeInteger(d.id)||d.id<1||
     !missed.has(key)||!actions.has(d.decision)||
     typeof d.note!=="string"||d.note.length>280||
     !Number.isFinite(Date.parse(d.created_at||"")))return null;
  if(!decisionsByKey.has(key))decisionsByKey.set(key,[]);
  decisionsByKey.get(key).push(d);
 }
 const cases=[...missed.values()].map(e=>{
  const h=(decisionsByKey.get(e.war.war_key+"|"+e.player)||[])
   .slice().sort((a,b)=>a.id-b.id);
  const last=h[h.length-1]||null;
  const state=last?.decision==="excused"?"excused":
   last?.decision==="acknowledged"?"acknowledged":"open";
  return {...e,state,latest:last,history:h};
 });
 const rows=[],seen=new Set();
 for(const p of members){
  const key=canonical(p?.tag),r=rank(p?.role);
  if(!valid(key)||seen.has(key)||typeof p.name!=="string"||!p.name.trim())return null;
  seen.add(key);
  if(r==="excluded")continue;
  const events=cases.filter(x=>x.player===key).sort((a,b)=>b.war.started-a.war.started);
  if(!events.length)continue;
  const opened=events.filter(x=>x.state==="open"),
   excused=events.filter(x=>x.state==="excused").length,
   reviewed=events.filter(x=>x.state==="acknowledged").length;
  const both=opened.some(x=>x.missing===2);
  // Adjacent DOCUMENTED wars only. Unknown documented war breaks a streak;
  // other wars not captured by the collector are never assumed absent.
  let consecutive=false;
  const openKeys=new Set(opened.map(x=>x.war.war_key));
  for(let i=1;i<wars.length;i++){
   const a=wars[i-1],b=wars[i],diff=b.started-a.started;
   if(diff>=36*3600000&&diff<=96*3600000&&
      openKeys.has(a.war_key)&&openKeys.has(b.war_key)&&
      a.roster.has(key)&&b.roster.has(key)){consecutive=true;break}
  }
  const severe=r==="elder"&&opened.length>0&&(both||consecutive);
  const status=!opened.length?"Bereits entschieden":
    severe?"Degradierung prüfen":
    r==="member"&&both?"Verwarnung prüfen":"Fehlangriff prüfen";
  const reason=!opened.length?
    reviewed+" geprüft · "+excused+" entschuldigt":
    both?"Mindestens einmal beide Angriffe (0/2) nicht genutzt":
    consecutive?"Fehlangriffe in zwei aufeinanderfolgenden dokumentierten CWs":
    opened.length===1?opened[0].missing+" von 2 Angriffen nicht genutzt":
    opened.length+" dokumentierte CWs mit offenen Fehlangriffen";
  rows.push({tag:key,name:p.name,rank:r,status,severe,
   openCount:opened.length,excusedCount:excused,reviewedCount:reviewed,
   both,consecutive,reason,lastAt:events[0].war.started,events});
 }
 return {rows:rows.sort((a,b)=>Number(b.severe)-Number(a.severe)||
      b.openCount-a.openCount||b.lastAt-a.lastAt||
      a.name.localeCompare(b.name,"de",{sensitivity:"base"})),
  verifiedWars:wars.filter(x=>x.missed_log_complete).length,
  capturedWars:wars.length,
  incompleteWars:wars.filter(x=>!x.missed_log_complete).length};
}
const api={evaluate};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(root)root.CWLClanNormalMissedReview=api;
})(typeof window!=="undefined"?window:null);
