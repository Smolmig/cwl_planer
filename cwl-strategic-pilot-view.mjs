// One entry in existing Plan. No storage, network, profile mutation or apply.
export function createStrategicPilotView({anchor,getContext,load,setMode,publish}){
 const doc=anchor.ownerDocument,el=(tag,text="")=>{const n=doc.createElement(tag);n.textContent=text;return n};
 const root=el("details");root.id="planStrategicPilot";root.hidden=true;root.className="strategic-pilot";root.style.cssText="border-block:1px solid var(--line);margin:10px 0;padding:0 4px;min-width:0;overflow-wrap:anywhere";
 const summary=el("summary","Intelligenter Planer · Beta");summary.style.cssText="min-height:44px;padding:10px 0;font-weight:750";
 const inner=el("div"),subtitle=el("p"),label=el("label","Leistungsmodus"),mode=el("select"),modeNote=el("small");modeNote.className="statusline";subtitle.className="statusline";mode.id="strategicPilotMode";label.htmlFor=mode.id;
 const autoButton=el("button");autoButton.type="button";autoButton.className="btn";autoButton.style.cssText="min-height:44px";autoButton.id="strategicAutoToggle";
 const controls=el("div");controls.style.cssText="max-width:480px;min-width:0;display:grid;gap:6px";
 const draftFields=el("div"),format=el("select"),days=el("select"),formatLabel=el("label","CWL-Format"),daysLabel=el("label","Angenommene Kriegstage");
 format.id="strategicDraftFormat";days.id="strategicDraftDays";formatLabel.htmlFor=format.id;daysLabel.htmlFor=days.id;
 for(const n of [15,30]){const o=el("option",n+" gegen "+n);o.value=String(n);format.append(o)}
 for(const n of [5,7]){const o=el("option",n+" Tage");o.value=String(n);days.append(o)}
 const participation=el("details"),ps=el("summary","Teilnahme erfassen (optional)"),counts=el("p"),search=el("input"),answersHost=el("div");
 ps.style.cssText="min-height:44px;padding:10px 0;font-weight:650";
 search.type="search";search.placeholder="Spieler suchen";search.setAttribute("aria-label","Teilnehmer suchen");search.style.cssText="appearance:none;-webkit-appearance:none;width:100%;min-height:44px;max-width:100%;color:var(--text);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px";
 counts.setAttribute("role","status");
 participation.append(ps,el("p","Übertrage bekannte Antworten aus eurer Abstimmung. Nicht beantwortete Spieler bleiben offen. Nur für diesen Entwurf."),counts,search,answersHost);
 draftFields.style.cssText="display:grid;gap:6px";draftFields.append(formatLabel,format,daysLabel,days,participation);
 for(const [v,t] of [["balanced","Ausgewogen"],["performance","Leistung"],["development","Förderung"]]){const o=el("option",t);o.value=v;mode.append(o)}
 mode.style.cssText="appearance:none;-webkit-appearance:none;display:block;min-height:44px;width:100%;color:var(--text);background-color:var(--card);background-image:linear-gradient(45deg,transparent 50%,var(--muted) 50%),linear-gradient(135deg,var(--muted) 50%,transparent 50%);background-position:calc(100% - 17px) 50%,calc(100% - 12px) 50%;background-size:5px 5px;background-repeat:no-repeat;border:1px solid var(--line);border-radius:10px;padding:8px 28px 8px 10px";
 format.style.cssText=mode.style.cssText;days.style.cssText=mode.style.cssText;
 const button=el("button","Vorschau berechnen");button.type="button";button.className="btn";button.style.cssText="min-height:44px;margin:10px 0";
 const status=el("p"),results=el("div"),details=el("details"),ds=el("summary","Spielerdetails"),rows=el("div");
 status.id="strategicPilotStatus";results.id="strategicPilotResults";details.id="strategicPilotDetails";button.id="strategicPilotCalculate";
 button.setAttribute("aria-describedby",status.id);
 status.setAttribute("role","status");status.className="statusline";ds.style.cssText="min-height:44px;padding:10px 0";
 details.append(ds,rows);controls.append(label,mode,modeNote,autoButton,draftFields,button);inner.append(subtitle,controls,status,results,details);root.append(summary,inner);anchor.insertAdjacentElement("afterend",root);
 let scope=null,token=null,sequence=0,busy=false,stored=null,expiryTimer=null,candidates=[],candidateSignature="",answers=new Map();
 function summarize(){
  let yes=0,no=0;for(const a of answers.values()){if(a==="yes")yes++;else if(a==="no")no++}
  counts.textContent=yes+" zugesagt · "+no+" abgesagt · "+(candidates.length-yes-no)+" offen";
 }
 function invalidateDraft(){
  sequence++;busy=false;clear("Entwurf geändert. Bitte neu berechnen.");sync();
 }
 function renderAnswers(){
  const q=search.value.trim().toLocaleLowerCase("de");answersHost.replaceChildren();
  for(const m of candidates.filter(m=>String(m.name).toLocaleLowerCase("de").includes(q)||String(m.tag).toLowerCase().includes(q))){
   const row=el("div");row.style.cssText="display:grid;grid-template-columns:minmax(0,1fr) minmax(100px,38%);gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)";
   const label=el("label",m.name+(m.fixed?" · Fix":"")),select=el("select");select.style.cssText=mode.style.cssText;
   select.setAttribute("aria-label","Teilnahme "+m.name+" "+m.tag);
   for(const [v,t] of [["unknown","Offen"],["yes","Zusage"],["no","Absage"]]){const o=el("option",t);o.value=v;select.append(o)}
   select.value=answers.get(m.id)||"unknown";select.disabled=busy;
   select.addEventListener("change",()=>{if(select.value==="unknown")answers.delete(m.id);else answers.set(m.id,select.value);summarize();invalidateDraft()});
   row.append(label,select);answersHost.append(row);
  }
  if(!answersHost.childElementCount)answersHost.append(el("p","Keine Spieler gefunden."));
  summarize();
 }
 function setCandidates(list){
  const next=Array.isArray(list)?list:[],sig=JSON.stringify(next);
  if(sig===candidateSignature)return;
  const previous=new Map(candidates.map(m=>[m.id,m.tag]));
  for(const id of answers.keys())if(!next.some(m=>m.id===id&&m.tag===previous.get(id)))answers.delete(id);
  candidates=next;candidateSignature=sig;renderAnswers();
 }
 search.addEventListener("input",renderAnswers);
 format.addEventListener("change",invalidateDraft);days.addEventListener("change",invalidateDraft);

 const clock=()=>Date.now();
 function clear(message=""){status.classList.remove("strategic-notice","is-warning","is-positive");if(expiryTimer!==null){clearTimeout(expiryTimer);expiryTimer=null}results.replaceChildren();rows.replaceChildren();details.hidden=true;stored=null;status.textContent=message}
 function armExpiry(){
  if(!stored)return;
  expiryTimer=setTimeout(()=>{expiryTimer=null;sync()},Math.max(0,stored.expiresAt-clock()));
 }
 function sync(){
  const c=getContext(),next=c?.key??null,nextToken=c?.token??null;
  if(next!==scope){sequence++;busy=false;scope=next;token=nextToken;root.open=false;details.open=false;mode.value="balanced";
   answers.clear();candidates=[];candidateSignature="";answersHost.replaceChildren();counts.textContent="";search.value="";participation.open=false;
   if(c){format.value=String(c.slots);days.value=String(c.days)}clear()}
  else if(nextToken!==token||!c?.ready&&(busy||stored)){sequence++;busy=false;token=nextToken;clear("Planstand geändert oder nicht verfügbar. Bitte neu berechnen.")}
  if(stored&&stored.expiresAt<=clock())clear("Die Vorschau ist nicht mehr aktuell. Bitte neu berechnen.");
  root.hidden=!c;if(!c)return;
  draftFields.hidden=c.phase!=="roster";draftFields.style.display=c.phase==="roster"?"grid":"none";setCandidates(c.phase==="roster"?c.candidates:[]);
  format.disabled=days.disabled=search.disabled=!c.ready||busy;
  for(const select of answersHost.querySelectorAll("select"))select.disabled=!c.ready||busy;
  subtitle.textContent=c.phase==="roster"?"Kaderentwurf für die nächste CWL · Anmeldung und Teilnahme nicht bestätigt.":"Aktuelle CWL · nur bestätigte Vorbereitungstage.";
  if(c.sharedMode){mode.value=c.sharedMode;modeNote.textContent=c.modeDraft?"Dein Vorschlag · noch nicht gemeinsam gespeichert.":c.canSetMode?"Gemeinsame Clan-Einstellung · gilt bis zur nächsten Änderung.":"Gemeinsamer Modus · aktuell nicht bearbeitbar."}else modeNote.textContent="";
  autoButton.hidden=!c.sharedMode;autoButton.textContent=c.automatic?"Automatische Planung deaktivieren":"Automatische Planung aktivieren";autoButton.title=c.automatic?"Aufstellung wird serverseitig berechnet. Mitgliedervorgaben bleiben erhalten.":"Nach Freigabe der Mitgliedervorgaben berechnet der Server die Aufstellung beim nächsten Abruf.";autoButton.disabled=!c.canSetMode||!c.ready||busy;
  button.disabled=!c.ready||busy;mode.disabled=!c.ready||busy||!!c.sharedMode&&!c.canSetMode;root.setAttribute("aria-busy",String(busy));
  if(!c.ready&&!status.textContent)status.textContent="Vorschau derzeit nicht verfügbar. Bitte Planstand prüfen.";
 }
 function line(parent,a,b){const div=el("div");div.style.cssText="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--line);overflow-wrap:anywhere";div.append(el("span",a),el("strong",b));parent.append(div)}
 function notice(parent,kind,title,message){
  const block=el("div");block.className="strategic-notice is-"+kind;block.setAttribute("role","status");
  const heading=el("strong"),mark=el("span",kind==="warning"?"⚠":"✓");mark.className="strategic-notice-icon";mark.setAttribute("aria-hidden","true");
  heading.append(mark,el("span",title));block.append(heading,el("p",message));parent.append(block);return block;
 }
 function renderRoster(s){
  results.replaceChildren();rows.replaceChildren();details.hidden=true;
  const formatText="Annahme: "+s.format.slots+" gegen "+s.format.slots+" · "+s.format.days+" Kriegstage. Das tatsächliche Format steht noch nicht fest.";
  if(s.issues?.length){notice(results,"warning","Entwurf noch nicht möglich","Bitte die folgenden Vorgaben prüfen.");results.append(el("p",formatText));const list=el("ul");for(const issue of s.issues)list.append(el("li",issue));results.append(list,el("p","Dein bestehender Plan bleibt unverändert."));return}
  details.hidden=false;
  const choice=el("select"),overview=el("div");choice.setAttribute("aria-label","Kaderoption");choice.style.cssText=mode.style.cssText;
  const filter=el("select");filter.setAttribute("aria-label","Spieler filtern");filter.style.cssText=mode.style.cssText;
  for(const [v,t] of [["all","Alle Spieler"],["changes","Nur Änderungen"],["review","Prüfbedarf"]]){const o=el("option",t);o.value=v;filter.append(o)}
  for(const sc of s.scenarios){const o=el("option",sc.size+" Spieler"+(sc.excluded.length?" · prüfen":" · alle"));o.value=String(sc.size);choice.append(o)}
  choice.style.maxWidth="480px";filter.style.maxWidth="480px";
  results.append(el("h3","Kadervergleich"),el("p",formatText),choice,overview);
  if(s.participation?.no)results.append(el("p",s.participation.no===1?"Eine Absage wurde nur für diesen Entwurf berücksichtigt.":s.participation.no+" Absagen wurden nur für diesen Entwurf berücksichtigt."));
  if(s.oldSeason)results.append(el("p","Der bisherige CWL-Plan bleibt unverändert. Tagesregeln und Einsatzziele der alten Saison gelten nicht für diesen Entwurf. Fix-Spieler und allgemeine Einstellungen bleiben berücksichtigt."));
  function selected(){
   const sc=s.scenarios.find(x=>String(x.size)===choice.value)||s.scenarios[0],m=sc.metrics;
   overview.replaceChildren();rows.replaceChildren();rows.append(filter);
   line(overview,"Geplante Einsätze pro Spieler",m.minAppearances+"–"+m.maxAppearances);
   line(overview,"Spieler mit 3+ Einsätzen",String(m.theoreticalMedalOpportunities));
   line(overview,"Bestätigte Ersatzspieler je Tag (mind.)",String(Math.max(0,m.minimumConfirmedReserve)));
   if(m.minimumConfirmedReserve<0)line(overview,"Noch benötigte Zusagen (am knappsten Tag)",String(-m.minimumConfirmedReserve));
   if(m.conditional)overview.append(el("p",m.conditional+" Spieler mit offener Teilnahme."));
   if(sc.excluded.length)overview.append(el("p","Einzeln prüfen: "+sc.excluded.join(", ")+". Keine automatische Ausladung."));
   const table=el("table");table.setAttribute("aria-label","Geplante Einsätze vergleichen");table.style.cssText="width:100%;table-layout:fixed;border-collapse:collapse;font-size:inherit";
   const cols=el("colgroup");for(const w of ["48%","26%","26%"]){const col=el("col");col.style.width=w;cols.append(col)}table.append(cols);
   const head=el("thead"),hr=el("tr");for(const v of ["Spieler","Standard","Vorschau"]){const th=el("th",v);th.scope="col";th.style.cssText="text-align:left;overflow-wrap:normal;hyphens:auto;padding:6px 2px;font-size:.78rem";hr.append(th)}head.append(hr);table.append(head);
   const body=el("tbody");
   const shown=sc.rows.filter(x=>filter.value==="all"||filter.value==="changes"&&x.changed||filter.value==="review"&&x.review);
   for(const x of shown){const tr=el("tr"),th=el("th",x.name);th.scope="row";th.style.cssText="text-align:left;overflow-wrap:anywhere;padding:8px 2px;font-weight:600;border-bottom:1px solid var(--line)";
    const small=el("small","RH"+x.townHall+" · "+(x.n?x.n+" passende Angriffe":"Keine passenden Angriffe")+(x.reason?" · "+x.reason:""));small.style.cssText="display:block;color:var(--muted);font-weight:400";th.append(small);tr.append(th);
    for(const n of [x.standard,x.proposed]){const td=el("td",String(n??"–"));td.style.cssText="padding:8px 2px;border-bottom:1px solid var(--line);text-align:center;font-variant-numeric:tabular-nums";tr.append(td)}body.append(tr)}
   if(!shown.length){const tr=el("tr"),td=el("td","Keine Spieler für diese Auswahl.");td.colSpan=3;tr.append(td);body.append(tr)}
   table.append(body);rows.append(table);
  }
  choice.addEventListener("change",selected);filter.addEventListener("change",()=>{selected();filter.focus({preventScroll:true})});selected();
 }
 function renderDaily(s){
  results.replaceChildren();rows.replaceChildren();details.hidden=false;const v=s.display;
  results.append(el("h3","Tagesstrategie"),el("p",v.tableStatus),el("p",v.dataStatus));
  for(const w of s.liveTargets||[]){
   const section=el("section");section.className="strategic-live-targets";
   section.append(el("h4","Tag "+w.day+" · Offene Angriffe"),el("p",w.openAttacks+" offen · "+w.untripledBases+" Basen unter 3★"));
   if(!w.openAttacks)notice(section,"positive","Alle Angriffe erfasst","Für diesen Krieg ist kein Angriff mehr offen.");
   else{
    section.append(el("p","Unverbindliche Zielvorschläge. Bitte im Spiel absprechen; Basislayout und eigene Strategie können wichtiger sein."));
    for(const a of w.suggestions)line(section,a.name+" · #"+a.attackerPosition,
     a.targetPosition===null?"Kein klares Ziel": "Ziel #"+a.targetPosition+" · RH"+a.targetTh+" · bisher "+a.currentStars+"★"+(a.evidenceN?" · "+a.evidenceN+" passende AG":" · grobe RH-Einschätzung"));
   }
   results.append(section);
  }
  if(s.groupStrength?.length){const g=el("details"),summary=el("summary","Stärkeeinschätzung der CWL-Gruppe");summary.style.cssText="min-height:44px;padding:10px 0";g.append(summary,el("p","Registrierte Kader (stärkste Rathausstufen nach Kriegsgröße) und beobachtete gleich-RH-Angriffe. Keine bestätigte Tagesaufstellung oder Siegprognose."));for(const x of s.groupStrength)line(g,(x.rank??"–")+". "+x.name+(x.own?" · Eigener Clan":""),x.meanTopRh===null?"Kader unbekannt":"Ø RH "+x.meanTopRh.toFixed(1)+" · "+x.attack.n+" AG");results.append(g)}
  if(s.rest?.ok){results.append(el("h4","Vorschlag für alle verbleibenden Tage"));if(s.rest.provisionalDays.length)results.append(el("p","Tag "+s.rest.provisionalDays.join(", ")+": Paarung noch unbekannt – vorläufig geplant."));for(const w of s.rest.warnings)notice(results,"warning","Einsatzvorgabe prüfen",w.name+" · Tag "+w.day+": "+w.alternative+" hat eine höhere vergleichbare Angriffsleistung. Fix/MUSS bleibt erhalten.");for(const d of s.rest.changes)line(results,"Tag "+d.day+" · Heraus: "+d.removed.join(", "),"Hinein: "+d.added.join(", "));if(!s.rest.changes.length)results.append(el("p","Keine Änderung gegenüber dem bisherigen Gesamtplan."));
   const c=getContext();
   if(c?.canPublish&&typeof publish==="function"){
    const apply=el("button",c.role==="vice"&&c.modeDraft?"In Entwurf übernehmen":"Aufstellung übernehmen");apply.type="button";apply.className="btn";apply.style.cssText="min-height:44px;margin:10px 0";apply.id="strategicPublish";
    apply.addEventListener("click",async()=>{if(stored!==s||busy||s.expiresAt<=clock())return;
     busy=true;apply.disabled=true;button.disabled=mode.disabled=true;
     try{if(await publish(s,c)){clear("Strategische Aufstellung übernommen. Prüfe den gemeinsamen Plan.")}}
     catch{if(getContext()?.key===c.key)clear("Aufstellung konnte nicht übernommen werden. Bitte neu berechnen und Cloud-Stand prüfen.")}
     finally{busy=false;sync();if(apply.isConnected)apply.disabled=false}
    });results.append(apply,el("p","Die Aufstellung wird in den normalen Plan übernommen. Änderungen im Spiel erfolgen weiterhin manuell."));
   }
  }
  if(v.recommendation){results.append(el("strong","Moduswechsel prüfen"),el("p",v.recommendation.reason));for(const c of v.recommendation.changes)line(results,"Tag "+c.day+" · Heraus: "+c.removed.join(", "),"Hinein: "+c.added.join(", "));results.append(el("p",v.recommendation.medals))}
  if(!s.changes.length){if(s.editableDays.length)notice(results,"positive","Keine Wechsel empfohlen","Für die geprüften Tage ist im gewählten Modus keine Änderung vorgeschlagen.");else results.append(el("p","Kein bestätigter, bearbeitbarer Vorbereitungstag."))}
  for(const c of s.changes)line(results,"Tag "+c.day+" · Heraus: "+c.removed.join(", "),"Hinein: "+c.added.join(", "));
  rows.append(el("h4","8-Sterne-Ziele"));for(const m of v.medals)line(rows,m.name+" · "+m.detail,m.stars);
  rows.append(el("h4","Angriffsziele"));for(const t of s.targets){line(rows,"Tag "+t.day,t.ok?t.swaps.length+" Zieltausch-Vorschläge":"Keine Zielvorschau");for(const sw of t.swaps)line(rows,"Angreifer "+sw.from+" → Ziel "+sw.to,sw.n+" passende Angriffe")}
 }
 async function run(){
  sync();const c=getContext();if(!c?.ready||busy||root.hidden)return;
  const ticket=++sequence,expectedMode=mode.value;busy=true;clear("Vorschau wird berechnet …");button.disabled=true;mode.disabled=true;root.setAttribute("aria-busy","true");
  try{
   const draft=c.phase==="roster"?{slots:Number(format.value),days:Number(days.value),answers:candidates.filter(m=>answers.has(m.id)).map(m=>({id:m.id,tag:m.tag,intent:answers.get(m.id)}))}:null;
   sync();
   const result=await load(expectedMode,c,draft),latest=getContext();
   if(ticket!==sequence||latest?.key!==c.key||latest?.token!==c.token||!latest.ready)return;
   if(!result||result.canApply!==false||result.mode!==expectedMode||result.kind!==c.phase||!Number.isFinite(result.expiresAt)||result.expiresAt<=clock())throw Error("invalid_result");
   stored=result;status.textContent=result.historyNote+" · Beta: Empfehlungen manuell prüfen. Dein Plan bleibt unverändert.";
   if(result.kind==="roster")renderRoster(result);else renderDaily(result);
   armExpiry();
  }catch{if(ticket===sequence)clear("Vorschau nicht verfügbar. Bitte später erneut berechnen. Dein Plan bleibt unverändert.")}
  finally{if(ticket===sequence){busy=false;sync()}}
 }
 autoButton.addEventListener("click",async()=>{const c=getContext();if(!c?.canSetMode||busy)return;try{await setMode(c.sharedMode,c,!c.automatic)}catch{clear("Einstellung konnte nicht gespeichert werden.")}sync()});
 button.addEventListener("click",run);mode.addEventListener("change",async()=>{
  const c=getContext(),value=mode.value;sequence++;busy=false;clear("Gewählten Modus neu berechnen.");
  if(!c?.sharedMode||!c.canSetMode||typeof setMode!=="function"){sync();return}
  const ticket=++sequence;busy=true;mode.disabled=button.disabled=true;status.textContent="Leistungsmodus wird geändert …";
  try{await setMode(value,c,c.automatic===true)}
  catch{if(getContext()?.key===c.key){clear("Modus konnte nicht sicher gespeichert werden. Bitte Cloud-Stand prüfen.");status.classList.add("strategic-notice","is-warning")}}
  finally{if(ticket===sequence){busy=false;sync()}}
 });sync();return {sync};
}
