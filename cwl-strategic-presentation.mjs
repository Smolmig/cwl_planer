// #44 German read-only presentation model shared by the isolated fixture
// and future authenticated plan integration. No DOM/network/storage/mutation.
// Inputs must already have been authorized by the host. No new access grants.
const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const tag=v=>typeof v==="string"?v.trim().toUpperCase():"";
const label=(m)=>typeof m.name==="string"&&m.name.trim()?m.name.trim():m.playerTag||"Unbekannter Spieler";
const reasons={manual_review:"Form nicht ausreichend belegt",limited_opportunity_review:"Wenige Einsätze – prüfen",capacity_or_availability_review:"Kein Einsatz – prüfen"};
function memberMap(members){
 if(!Array.isArray(members))throw Error("invalid_members");
 const map=new Map();
 for(const m of members){if(typeof m?.id!=="string"||!m.id||map.has(m.id))throw Error("invalid_member_identity");map.set(m.id,m)}
 return map;
}
export function presentRosterRows({scenario,members,filter="all"}={}){
 const map=memberMap(members),p=scenario?.plan;
 if(!p?.ok||!Array.isArray(p.rows)||!Array.isArray(p.evidence?.profiles)||!["all","changes","review"].includes(filter))throw Error("invalid_roster_preview");
 const profiles=new Map(p.evidence.profiles.map(x=>[x.id,x])),seen=new Set();
 const rows=p.rows.map(x=>{
  const m=map.get(x.id),e=profiles.get(x.id);
  if(!m||!e||seen.has(x.id)||!int(m.townHall,3,30)||!int(e.n,0,10000))throw Error("invalid_roster_row");
  seen.add(x.id);
  const standard=int(x.standardAppearances,0,7)?x.standardAppearances:null,proposed=int(x.scenarioAppearances,0,7)?x.scenarioAppearances:null;
  const changed=standard!==proposed,review=x.participation==="unknown"||Object.hasOwn(reasons,x.recommendation);
  const reason=x.participation==="unknown"?"Teilnahme offen":(Object.hasOwn(reasons,x.recommendation)?reasons[x.recommendation]:null)||(m.fixed?"Fix":changed?"Einsatzverteilung geändert":"");
  return {id:x.id,name:label(m),townHall:m.townHall,n:e.n,standard,proposed,changed,review,reason};
 }).sort((a,b)=>Number(b.review)-Number(a.review)||Number(b.changed)-Number(a.changed)||(b.proposed??-1)-(a.proposed??-1)||a.id.localeCompare(b.id));
 return {rows,shown:rows.filter(x=>filter==="all"||filter==="changes"&&x.changed||filter==="review"&&x.review)};
}
export function presentDailyStrategy({preview,standings,group,members,role,asOf,season,selectedClanTag}={}){
 const map=memberMap(members),own=tag(selectedClanTag);
 if(!preview?.ok||preview.season!==season||tag(preview.selectedClanTag)!==own||preview.asOf!==asOf||preview.observedAt!==group?.observedAt||!/^#[0289PYLQGRJCUV]{3,15}$/.test(own)||preview.role!==role||!["owner","vice","viewer"].includes(role)||preview.canApply!==false||
 !group||!standings||group.season!==season||standings.season!==season||tag(group.selectedClanTag)!==own||
 tag(standings.selectedClanTag)!==own||group.asOf!==asOf||standings.asOf!==asOf||!Number.isFinite(asOf)||
 group.observedAt!==standings.observedAt||!Number.isFinite(group.observedAt)||group.observedAt>asOf||
 !Array.isArray(preview.players)||!Array.isArray(standings.teams))throw Error("invalid_daily_presentation_scope");
 const n=standings.teams.length,completeRank=standings.quality==="schedule_known"&&standings.invalid===0&&
 int(standings.confirmedRank,1,n)&&int(standings.confirmedRankWorst,standings.confirmedRank,n)&&standings.teams.every(t=>int(t.completed,1,n-1)&&t.completed===standings.teams[0].completed);
 const b=standings.bounds,validBounds=int(b?.best,1,n)&&int(b?.worst,b.best,n);
 const demotion={impossible:"Klassenerhalt rechnerisch gesichert",not_applicable:"Keine Abstiegsplätze",guaranteed:"Abstieg rechnerisch feststehend",open:"Klassenerhalt offen",unknown_rules:"Abstiegsregeln nicht bestätigt"};
 const tableStatus=[completeRank?"Bestätigter Platz "+standings.confirmedRank+(standings.confirmedRankWorst===standings.confirmedRank?"":"–"+standings.confirmedRankWorst)+" / "+n:"Bestätigter Platz nicht verfügbar",
 validBounds?"Rechnerischer Endplatz "+b.best+(b.best===b.worst?"":"–"+b.worst):"Endplatz noch nicht eingrenzbar",
 demotion[standings.demotion]||"Abstiegsregeln nicht bestätigt"].join(" · ");
 const stamp=new Intl.DateTimeFormat("de-AT",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Vienna"}).format(new Date(group.observedAt));
 const dataStatus="Datenstand "+stamp+" · "+(standings.quality==="schedule_known"?"Paarungen bekannt":"Gruppendaten unvollständig")+
 (preview.medalCoverageComplete?"":" · Sternedaten unvollständig");
 const m=preview.modeRecommendation;
 let recommendation=null;
 if(m){
  if(!Array.isArray(preview.alternate?.changes)||m.requiresOwnerConfirmation!==true)throw Error("invalid_recommendation");
  const reason=m.reason==="observed_relegation_zone_and_better_comparable_plan"?"Der bestätigte Tabellenstand ist kritisch. Die alternative Aufstellung verbessert den vergleichbaren Leistungswert. Keine sichere Siegprognose.":m.reason==="table_goals_settled_and_rotation_opportunity"?"Die Auf- und Abstiegsziele sind rechnerisch geklärt. Die Alternative verbessert die Einsatzverteilung.":null;
  if(!reason)throw Error("unknown_recommendation");
  const names=ids=>ids.map(id=>{if(!map.has(id))throw Error("unknown_player");return label(map.get(id))});
  recommendation={reason,changes:preview.alternate.changes.map(c=>({day:c.day,removed:names(c.removed),added:names(c.added)})),
   medals:"Spieler mit rechnerischer Chance auf 8 Sterne: "+(m.medalOpportunitiesBefore??"unbekannt")+" → "+(m.medalOpportunitiesAfter??"unbekannt"),
   canDismiss:role!=="viewer"};
 }
 const medals=preview.players.map(x=>{
  const m=map.get(x.id);if(!m||!int(x.observedStarsLowerBound,0,21)||!int(x.confirmedPreparationAppearances,0,7))throw Error("invalid_medal_row");
  const lower=x.observedStarsLowerBound;
  const stars=x.medalStatus==="unknown"?(lower>0?"Mind. "+lower+" ★":"Unbekannt"):x.medalStatus==="achieved"?lower+" ★ · erreicht":lower+" / 8 ★";
  return {id:x.id,name:label(m),stars,detail:x.confirmedPreparationAppearances+" bestätigte Vorbereitungseinsätze"};
 });
 return {tableStatus,dataStatus,recommendation,medals,canApply:false};
}
