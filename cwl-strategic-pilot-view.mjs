// One entry in existing Plan. No storage, network, profile mutation or apply.
export function createStrategicPilotView({anchor,getContext,load}){
 const doc=anchor.ownerDocument,el=(tag,text="")=>{const n=doc.createElement(tag);n.textContent=text;return n};
 const root=el("details");root.id="planStrategicPilot";root.hidden=true;root.className="strategic-pilot";root.style.cssText="border-block:1px solid var(--line);margin:10px 0;padding:0 4px;min-width:0;overflow-wrap:anywhere";
 const summary=el("summary","Intelligenter Planer · Vorschau");summary.style.cssText="min-height:44px;padding:10px 0;font-weight:750";
 const inner=el("div"),subtitle=el("p"),label=el("label","Leistungsmodus"),mode=el("select");subtitle.className="statusline";mode.id="strategicPilotMode";label.htmlFor=mode.id;
 const controls=el("div");controls.style.cssText="max-width:480px;min-width:0";
 const draftFields=el("div"),format=el("select"),days=el("select"),formatLabel=el("label","CWL-Format"),daysLabel=el("label","Angenommene Kriegstage");
 format.id="strategicDraftFormat";days.id="strategicDraftDays";formatLabel.htmlFor=format.id;daysLabel.htmlFor=days.id;
 for(const n of [15,30]){const o=el("option",n+" gegen "+n);o.value=String(n);format.append(o)}
 for(const n of [5,7]){const o=el("option",n+" Tage");o.value=String(n);days.append(o)}
 const participation=el("details"),ps=el("summary","Teilnahme erfassen (optional)"),counts=el("p"),search=el("input"),answersHost=el("div");
 ps.style.cssText="min-height:44px;padding:10px 0;font-weight:650";
 search.type="search";search.placeholder="Spieler suchen";search.setAttribute("aria-label","Teilnehmer suchen");search.style.cssText="width:100%;min-height:44px;max-width:100%";
 counts.setAttribute("role","status");
 participation.append(ps,el("p","Übertrage bekannte Antworten aus eurer Abstimmung. Nicht beantwortete Spieler bleiben offen. Nur für diesen Entwurf."),counts,search,answersHost);
 draftFields.append(formatLabel,format,daysLabel,days,participation);
 for(const [v,t] of [["balanced","Ausgewogen"],["performance","Leistung"],["development","Förderung"]]){const o=el("option",t);o.value=v;mode.append(o)}
 mode.style.cssText="display:block;min-height:44px;width:100%;color:var(--text);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px";
 format.style.cssText=mode.style.cssText;days.style.cssText=mode.style.cssText;
 const button=el("button","Vorschau berechnen");button.type="button";button.className="btn";button.style.cssText="min-height:44px;margin:10px 0";
 const status=el("p"),results=el("div"),details=el("details"),ds=el("summary","Spielerdetails"),rows=el("div");
 status.id="strategicPilotStatus";results.id="strategicPilotResults";details.id="strategicPilotDetails";button.id="strategicPilotCalculate";
 button.setAttribute("aria-describedby",status.id);
 status.setAttribute("role","status");status.className="statusline";ds.style.cssText="min-height:44px;padding:10px 0";
 details.append(ds,rows);controls.append(label,mode,draftFields,button);inner.append(subtitle,controls,status,results,details);root.append(summary,inner);anchor.insertAdjacentElement("afterend",root);
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
 function clear(message=""){if(expiryTimer!==null){clearTimeout(expiryTimer);expiryTimer=null}results.replaceChildren();rows.replaceChildren();details.hidden=true;stored=null;status.textContent=message}
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
  draftFields.hidden=c.phase!=="roster";setCandidates(c.phase==="roster"?c.candidates:[]);
  format.disabled=days.disabled=search.disabled=!c.ready||busy;
  for(const select of answersHost.querySelectorAll("select"))select.disabled=!c.ready||busy;
  subtitle.textContent=c.phase==="roster"?"Kaderentwurf für die nächste CWL · Anmeldung und Teilnahme nicht bestätigt.":"Aktuelle CWL · nur bestätigte Vorbereitungstage.";
  button.disabled=!c.ready||busy;mode.disabled=!c.ready||busy;root.setAttribute("aria-busy",String(busy));
  if(!c.ready&&!status.textContent)status.textContent="Vorschau derzeit nicht verfügbar. Bitte Planstand prüfen.";
 }
 function line(parent,a,b){const div=el("div");div.style.cssText="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--line);overflow-wrap:anywhere";div.append(el("span",a),el("strong",b));parent.append(div)}
 function renderRoster(s){
  results.replaceChildren();rows.replaceChildren();details.hidden=true;
  const formatText="Annahme: "+s.format.slots+" gegen "+s.format.slots+" · "+s.format.days+" Kriegstage. Das tatsächliche Format steht noch nicht fest.";
  if(s.issues?.length){results.append(el("h3","Entwurf noch nicht möglich"),el("p",formatText));const list=el("ul");for(const issue of s.issues)list.append(el("li",issue));results.append(list,el("p","Dein bestehender Plan bleibt unverändert."));return}
  details.hidden=false;
  const choice=el("select"),overview=el("div");choice.setAttribute("aria-label","Kaderoption");choice.style.cssText=mode.style.cssText;
  const filter=el("select");filter.setAttribute("aria-label","Spieler filtern");filter.style.cssText=mode.style.cssText;
  for(const [v,t] of [["all","Alle Spieler"],["changes","Nur Änderungen"],["review","Prüfbedarf"]]){const o=el("option",t);o.value=v;filter.append(o)}
  for(const sc of s.scenarios){const o=el("option",sc.size+" Spieler"+(sc.excluded.length?" · prüfen":" · vollständiger Kader"));o.value=String(sc.size);choice.append(o)}
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
  if(v.recommendation){results.append(el("strong","Moduswechsel prüfen"),el("p",v.recommendation.reason));for(const c of v.recommendation.changes)line(results,"Tag "+c.day+" · Heraus: "+c.removed.join(", "),"Hinein: "+c.added.join(", "));results.append(el("p",v.recommendation.medals))}
  if(!s.changes.length)results.append(el("p",s.editableDays.length?"Keine Wechsel im gewählten Modus.":"Kein bestätigter, bearbeitbarer Vorbereitungstag."));
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
   stored=result;status.textContent=result.historyNote+" · Nur Vorschau, keine Übernahme.";
   if(result.kind==="roster")renderRoster(result);else renderDaily(result);
   armExpiry();
  }catch{if(ticket===sequence)clear("Vorschau nicht verfügbar. Bitte später erneut berechnen. Dein Plan bleibt unverändert.")}
  finally{if(ticket===sequence){busy=false;sync()}}
 }
 button.addEventListener("click",run);mode.addEventListener("change",()=>{sequence++;busy=false;clear("Gewählten Modus neu berechnen.");sync()});sync();return {sync};
}
