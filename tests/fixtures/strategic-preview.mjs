import {compareSeasonRosterSizes} from "../../cwl-strategic-experiment.mjs";
import {previewDailyStrategy} from "../../cwl-strategic-daily.mjs";
const $=id=>document.getElementById(id);
const abc="0289PYLQGRJCUV",tag=i=>"#P"+abc[Math.floor(i/13)%13]+abc[i%13],now=Date.UTC(2026,10,26),season="2026-11",own=tag(0),opponent=tag(1);
const member=(i,extra={})=>({id:"p"+i,name:"Spieler "+String(i+1).padStart(2,"0"),playerTag:tag(10+i),townHall:19,participating:true,participationIntent:"yes",statuses:[],...extra});
const members=Array.from({length:22},(_,i)=>member(i,i===0?{fixed:true}:i===21?{participationIntent:"unknown"}:{}));
const facts=members.slice(0,21).flatMap((m,i)=>Array.from({length:22},(_,j)=>({playerTag:m.playerTag,warKey:"w"+j,attackOrder:1,kind:"normal",attackerTh:19,defenderTh:19,stars:i<15?3:0,destruction:i<15?100:10,eventAt:now-86400000,observedAt:now-86400000})));
const names=new Map(members.map(m=>[m.id,m.name]));
const modeNames={performance:"Leistung",balanced:"Ausgewogen",development:"Förderung"};
const help={performance:"Wettbewerbsfähigkeit priorisieren, ohne feste Vorgaben zu verletzen.",balanced:"Leistung und faire Einsatzchancen verbinden.",development:"Mehr Chancen für schwächere Spieler ermöglichen."};
let size=null,last=null,declined=[];
const el=(type,text,cls)=>{const n=document.createElement(type);n.textContent=text;if(cls)n.className=cls;return n};
function row(parent,title,sub,value){const li=el("li",""),left=el("span",title),right=el("span",value);if(sub)left.append(el("small",sub));li.append(left,right);parent.append(li)}
function metric(parent,label,value){const d=el("div","","metric");d.append(el("strong",String(value)),el("span",label));parent.append(d)}
function showRoster(mode){
 const r=compareSeasonRosterSizes({members,facts,asOf:now,mode,slots:15,days:7,planStandard:window.CWLPlanningCore.planCwl});
 if(!r.ok)throw Error("roster_conflict");
 $("size").replaceChildren(...r.scenarios.map(s=>{const o=el("option",s.size+" Spieler"+(s.excluded.length?" · Alternative":" · vollständiger Kader"));o.value=String(s.size);return o}));
 const selected=r.scenarios.find(s=>s.size===size)||r.scenarios[0];size=selected.size;$("size").value=String(size);
 const m=selected.metrics;$("rosterMetrics").replaceChildren();metric($("rosterMetrics"),"Einsätze pro Spieler",m.minAppearances+"–"+m.maxAppearances);metric($("rosterMetrics"),"Bestätigte Reserve je Tag, mindestens",m.minimumConfirmedReserve);metric($("rosterMetrics"),"Spieler mit mind. 3 Einsätzen",m.theoreticalMedalOpportunities);
 $("rosterWarning").textContent=selected.excluded.length?"Nur nach Einzelprüfung nicht mitnehmen: "+selected.excluded.map(id=>names.get(id)).join(", ")+".":m.conditional+" Spieler mit unbekannter Teilnahme – bedingte Vorschau.";
 $("rosterRows").replaceChildren();const p=selected.plan;
 const profiles=new Map(p.evidence.profiles.map(x=>[x.id,x]));
 for(const x of [...p.rows].sort((a,b)=>(b.scenarioAppearances??-1)-(a.scenarioAppearances??-1)||a.id.localeCompare(b.id))){
 const profile=profiles.get(x.id),desc=(profile.n?profile.n+" vergleichbare Angriffe":"Keine vergleichbaren Angriffe")+(x.participation==="unknown"?" · Teilnahme offen":"");
 row($("rosterRows"),names.get(x.id),desc,(x.standardAppearances??"–")+" → "+(x.scenarioAppearances??"–"));
 }
 $("status").textContent="Standardplan → "+modeNames[mode]+". "+(selected.excluded.length?"Kleinere Kaderoption zur Einzelprüfung.":"Vollständiger Kader, keine automatische Auswahl.");
}
function dailyData(mode,role){
 const ms=Array.from({length:18},(_,i)=>member(i)),lineup=Array.from({length:15},(_,i)=>"p"+i),last=[...lineup.slice(0,12),"p15","p16","p17"];
 const currentPlan=Array.from({length:5},(_,i)=>({day:i+1,lineup:[...(i<2?lineup:last)]}));
 currentPlan[3].lineup[currentPlan[3].lineup.indexOf("p16")]="p12";
 currentPlan[4].lineup[currentPlan[4].lineup.indexOf("p17")]="p12";
 const roster=ids=>ids.map((id,i)=>({tag:ms.find(m=>m.id===id).playerTag,townHall:19,mapPosition:i+1}));
 const upcoming=[3,4,5].map(d=>({day:d,warTag:tag(100+d),opponentTag:opponent,teamSize:15,status:"confirmed_preparation_roster",ownRoster:roster(currentPlan[d-1].lineup),roster:Array.from({length:15},(_,i)=>({tag:tag(70+i),townHall:19,mapPosition:i+1}))}));
 const wars=[1,2].map(day=>({day,warTag:tag(100+day),state:"warEnded",teamSize:15,ownRoster:roster(lineup),completeAttackLists:true}));
 const profiles=ms.map((m,i)=>{const score=i<13?2.9:i===17?2.3:1.4;return {playerTag:m.playerTag,townHall:19,n:12,score,contexts:[{kind:"normal",attackerTh:19,defenderTh:19,n:12,smoothedStars:score}]}});
 ms[15].statuses[2]="must";ms[16].statuses[2]="must";
 return {group:{season,selectedClanTag:own,asOf:now,observedAt:now,upcoming,wars,profiles:[],ownMedals:{complete:true,stars:ms.slice(0,15).map(m=>({playerTag:m.playerTag,stars:6}))}},
 standings:{season,selectedClanTag:own,asOf:now,observedAt:now,teamSize:15,quality:"schedule_known",invalid:0,liveMatches:2,demotion:"open",promotion:"open",demotionFirst:5,currentLowerBoundRank:2,confirmedRank:5,teams:Array.from({length:6},()=>({completed:2})),bounds:{best:2,worst:6}},
 evidence:{asOf:now,profiles},members:ms,registered:{verified:true,season,clanTag:own,observedAt:now,tags:ms.map(m=>m.playerTag)},currentPlan,manualLocks:[currentPlan[3],currentPlan[4]],mode,role,asOf:now,season,selectedClanTag:own,slots:15,days:5,declined};
}
function showDaily(mode,role){
 const p=previewDailyStrategy(dailyData(mode,role));last=p;
 if(!p.ok)throw Error("daily_conflict");
 $("status").textContent=role==="viewer"?"Lesemodus · keine Änderungen möglich.":role==="vice"?"Vorschau für Vize · Entscheidung beim Clanführer.":"Vorschau für Clanführer · keine Übernahme möglich.";
 $("tableStatus").textContent="Bestätigter Platz 5 · rechnerischer Endplatz 2–6 · Klassenerhalt offen (fiktive Ligaregeln)";
 $("days").replaceChildren(...Array.from({length:5},(_,i)=>el("span","Tag "+(i+1)+(p.editableDays.includes(i+1)?" · Vorbereitung":" · geschützt"))));
 const m=p.modeRecommendation;
 $("recommendation").hidden=!m;$("dismiss").hidden=!m||role==="viewer";
 if(m){$("recommendation").replaceChildren(el("strong","Moduswechsel prüfen: "+modeNames[m.to]),el("p","Der bestätigte Tabellenstand ist kritisch. Der alternative Plan verbessert den vergleichbaren Leistungswert. Keine sichere Siegprognose."));for(const c of p.alternate.changes)$("recommendation").append(el("p","Tag "+c.day+": "+c.removed.map(id=>names.get(id)).join(", ")+" → "+c.added.map(id=>names.get(id)).join(", ")));$("recommendation").append(el("small","8-Sterne-Gelegenheiten: "+(m.medalOpportunitiesBefore??"unbekannt")+" → "+(m.medalOpportunitiesAfter??"unbekannt")))}
 $("changes").replaceChildren();
 if(!p.current.changes.length)row($("changes"),"Keine Wechsel im gewählten Modus","Bestehender Plan bleibt erhalten.","");
 for(const c of p.current.changes)row($("changes"),"Tag "+c.day,c.removed.map(id=>names.get(id)).join(", ")+" → "+c.added.map(id=>names.get(id)).join(", "),"Vorschlag");
 $("medalRows").replaceChildren();
 for(const x of p.players)row($("medalRows"),names.get(x.id),x.confirmedPreparationAppearances+" bestätigte Vorbereitungseinsätze",x.medalStatus==="unknown"?"Unbekannt":x.observedStarsLowerBound+" / 8 ★");
 $("targetRows").replaceChildren();
 for(const t of p.targetPreviews){
 if(!t.ok)row($("targetRows"),"Tag "+t.day,"Tatsächlichen Kader nach Änderung erneut prüfen.","Kein Vorschlag");
 else row($("targetRows"),"Tag "+t.day,"Mirror bleibt, wenn kein belegter Vorteil vorliegt.",t.changes.length+" Tauschpaare");
 }
}
function render(){
 const mode=document.querySelector("input[name=mode]:checked").value,phase=$("phase").value,role=$("role").value;
 $("modeHelp").textContent=help[mode];$("rosterSection").hidden=phase!=="roster";$("dailySection").hidden=phase!=="daily";
 try{phase==="roster"?showRoster(mode):showDaily(mode,role)}
 catch{$("status").textContent="Die Vorschau kann nicht berechnet werden. Es wurden keine Änderungen vorgenommen.";$("rosterSection").hidden=true;$("dailySection").hidden=true;}
}
$("phase").addEventListener("change",render);$("role").addEventListener("change",render);
document.querySelectorAll("input[name=mode]").forEach(n=>n.addEventListener("change",render));
$("size").addEventListener("change",()=>{size=Number($("size").value);render()});
$("theme").addEventListener("change",()=>{document.documentElement.dataset.theme=$("theme").value});
$("dismiss").addEventListener("click",()=>{if(last?.modeRecommendation){declined.push(last.modeRecommendation.key);render();$("phase").focus()}});
render();
