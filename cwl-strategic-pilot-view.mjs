// One entry in existing Plan. No storage, network, profile mutation or apply.
export function createStrategicPilotView({anchor,getContext,load}){
 const doc=anchor.ownerDocument,el=(tag,text="")=>{const n=doc.createElement(tag);n.textContent=text;return n};
 const root=el("details");root.id="planStrategicPilot";root.hidden=true;root.style.cssText="border-block:1px solid var(--line);margin:10px 0;padding:0 4px";
 const summary=el("summary","Intelligenter Planer · Vorschau");summary.style.cssText="min-height:44px;padding:10px 0;font-weight:750";
 const inner=el("div"),subtitle=el("p"),label=el("label","Leistungsmodus"),mode=el("select");subtitle.className="statusline";mode.id="strategicPilotMode";label.htmlFor=mode.id;
 for(const [v,t] of [["balanced","Ausgewogen"],["performance","Leistung"],["development","Förderung"]]){const o=el("option",t);o.value=v;mode.append(o)}
 mode.style.cssText="display:block;min-height:44px;width:100%;color:var(--text);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px";
 const button=el("button","Vorschau berechnen");button.type="button";button.className="btn";button.style.cssText="min-height:44px;margin:10px 0";
 const status=el("p"),results=el("div"),details=el("details"),ds=el("summary","Spielerdetails"),rows=el("div");
 status.setAttribute("role","status");status.className="statusline";ds.style.cssText="min-height:44px;padding:10px 0";
 details.append(ds,rows);inner.append(subtitle,label,mode,button,status,results,details);root.append(summary,inner);anchor.insertAdjacentElement("afterend",root);
 let scope=null,token=null,sequence=0,busy=false,stored=null;
 function clear(message=""){results.replaceChildren();rows.replaceChildren();details.hidden=true;stored=null;status.textContent=message}
 function sync(){
  const c=getContext(),next=c?.key??null,nextToken=c?.token??null;
  if(next!==scope){sequence++;busy=false;scope=next;token=nextToken;root.open=false;details.open=false;mode.value="balanced";clear()}
  else if(nextToken!==token||!c?.ready&&(busy||stored)){sequence++;busy=false;token=nextToken;clear("Planstand geändert oder nicht verfügbar. Bitte neu berechnen.")}
  root.hidden=!c;if(!c)return;
  subtitle.textContent=c.phase==="roster"?"Kaderentwurf für die nächste CWL · Teilnahme nicht bestätigt.":"Aktuelle CWL · nur bestätigte Vorbereitungstage.";
  button.disabled=!c.ready||busy;mode.disabled=!c.ready||busy;
  if(!c.ready&&!status.textContent)status.textContent="Vorschau derzeit nicht verfügbar. Bitte Planstand prüfen.";
 }
 function line(parent,a,b){const div=el("div");div.style.cssText="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--line);overflow-wrap:anywhere";div.append(el("span",a),el("strong",b));parent.append(div)}
 function renderRoster(s){
  results.replaceChildren();rows.replaceChildren();details.hidden=false;
  const choice=el("select"),overview=el("div");choice.setAttribute("aria-label","Kaderoption");choice.style.cssText=mode.style.cssText;
  for(const sc of s.scenarios){const o=el("option",sc.size+" Spieler"+(sc.excluded.length?" · prüfen":" · vollständiger Kader"));o.value=String(sc.size);choice.append(o)}
  results.append(el("h3","Kadervergleich"),choice,overview);
  function selected(){
   const sc=s.scenarios.find(x=>String(x.size)===choice.value)||s.scenarios[0],m=sc.metrics;
   overview.replaceChildren();rows.replaceChildren();
   line(overview,"Geplante Einsätze pro Spieler",m.minAppearances+"–"+m.maxAppearances);
   line(overview,"Spieler mit 3+ Einsätzen",String(m.theoreticalMedalOpportunities));
   line(overview,"Bestätigte Reserve je Tag (mind.)",String(m.minimumConfirmedReserve));
   if(m.conditional)overview.append(el("p",m.conditional+" Spieler mit offener Teilnahme."));
   if(sc.excluded.length)overview.append(el("p","Einzeln prüfen: "+sc.excluded.join(", ")+". Keine automatische Ausladung."));
   const table=el("table");table.setAttribute("aria-label","Geplante Einsätze vergleichen");table.style.cssText="width:100%;table-layout:fixed;border-collapse:collapse;font-size:14px";
   const head=el("thead"),hr=el("tr");for(const v of ["Spieler","Standard","Vorschau"]){const th=el("th",v);th.scope="col";th.style.cssText="text-align:left;overflow-wrap:anywhere;padding:6px 2px";hr.append(th)}head.append(hr);table.append(head);
   const body=el("tbody");
   for(const x of sc.rows){const tr=el("tr"),th=el("th",x.name);th.scope="row";th.style.cssText="text-align:left;overflow-wrap:anywhere;padding:8px 2px;font-weight:600";
    const small=el("small","RH"+x.townHall+" · "+x.n+" passende Angriffe"+(x.reason?" · "+x.reason:""));small.style.display="block";th.append(small);tr.append(th);
    for(const n of [x.standard,x.proposed]){const td=el("td",String(n??"–"));td.style.cssText="padding:8px 2px;border-bottom:1px solid var(--line)";tr.append(td)}body.append(tr)}
   table.append(body);rows.append(table);
  }
  choice.addEventListener("change",selected);selected();
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
  const ticket=++sequence,expectedMode=mode.value;busy=true;clear("Vorschau wird berechnet …");button.disabled=true;mode.disabled=true;
  try{
   const result=await load(expectedMode,c),latest=getContext();
   if(ticket!==sequence||latest?.key!==c.key||latest?.token!==c.token||!latest.ready)return;
   if(!result||result.canApply!==false||result.mode!==expectedMode||result.kind!==c.phase)throw Error("invalid_result");
   stored=result;status.textContent=result.historyNote+" · Nur Vorschau, keine Übernahme.";
   if(result.kind==="roster")renderRoster(result);else renderDaily(result);
  }catch{if(ticket===sequence)clear("Vorschau nicht verfügbar. Bitte später erneut berechnen. Dein Plan bleibt unverändert.")}
  finally{if(ticket===sequence){busy=false;sync()}}
 }
 button.addEventListener("click",run);mode.addEventListener("change",()=>{sequence++;busy=false;clear("Gewählten Modus neu berechnen.");sync()});sync();return {sync};
}
