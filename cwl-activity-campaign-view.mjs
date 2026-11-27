import {sampleRaffle} from "./cwl-goldpass-core.mjs?v=1.37.0";
import {renderDrawReveal} from "./cwl-raffle-reveal.mjs?v=1.37.0";
import {ACTIVITY_PRESETS,activityPeriod,presetTargets,activityGoalPace,campaignPreview} from "./cwl-activity-campaign.mjs?v=1.37.0";
const metrics=[
 ["donations","Spenden",3500],["cwStars","Normale CW-Sterne",28],["cwAttacks","Normale CW-Angriffe",12],
 ["cwTriples","Normale CW-Dreier",8],["cwlStars","CWL-Sterne",15],["cwlAttacks","CWL-Angriffe",5],
 ["cwlTriples","CWL-Dreier",4],["discord","Discord vertreten",true],["voted","Abgestimmt / reagiert",true]
];
const names=Object.fromEntries(metrics.map(([key,label])=>[key,label]));
const personRule={metric:"onePerPerson",minimum:true};
const wheelRows=pool=>pool.map(p=>({...p,tickets:1}));
const n=(tag,text="",cls="")=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e};
const field=(label,input)=>{const e=n("label","","goldpass-field");e.append(n("span",label),input);return e};
const input=(type,value)=>{const e=n("input");e.type=type;if(type==="checkbox")e.checked=!!value;else e.value=String(value??"");return e};
const button=(text,action,disabled=false)=>{const e=n("button",text,"btn");e.type="button";e.disabled=disabled;e.onclick=action;return e};
const select=(options,value)=>{const e=n("select");for(const [v,t] of options){const o=n("option",t);o.value=v;e.append(o)}e.value=value;return e};
const todayVienna=()=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Vienna",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());return ["year","month","day"].map(k=>p.find(x=>x.type===k).value).join("-")};
const clone=x=>JSON.parse(JSON.stringify(x));
export function createActivityCampaignView({root,getContext,api,confirmDraw=async()=>false,today=todayVienna}){
 let scope=null,list=[],current=null,draft=null,message="",busy=false,dirty=false,serial=0,wars="",animateNextDraw=false,testMode=false;
 const context=()=>{const c=getContext();return c?.owner&&c?.clanId&&c?.clanTag?c:null};
 const key=c=>c?c.clanId+"|"+c.clanTag+"|"+String(c.session??""):null;
 const reset=()=>{testMode=false;animateNextDraw=false;serial++;list=[];current=null;draft=null;busy=false;dirty=false;message="";wars="";root.replaceChildren()};
 function adopt(result){animateNextDraw=false;current=result;draft={id:result.id,title:result.title,start:result.start,end:result.end,rules:clone(result.rules),decisions:clone(result.decisions||{})};dirty=false;wars=""}
 function fresh(sandbox=false){testMode=sandbox;const start=today();current=null;draft={id:globalThis.crypto.randomUUID(),title:"Grind-Verlosung",start,end:new Date(Date.parse(start+"T00:00:00Z")+29*86400000).toISOString().slice(0,10),rules:[],decisions:{}};dirty=true;wars="";applyPreset("active");render()}
 function applyPreset(id){
  try{
   const opts=wars===""?{}:{normalWars:Number(wars)};
   const r=presetTargets(id,draft.start,draft.end,opts);
   draft.rules=[...r.rules,...draft.rules.filter(x=>x.metric==="onePerPerson")];
   dirty=true;message="";
  }catch{message="Bitte gültigen Zeitraum und realistische CW-Anzahl wählen."}
 }
 async function request(args,apply){
  const c=context();if(!c||key(c)!==scope||busy||testMode)return;
  const token=++serial;busy=true;message="Wird geladen …";render();
  try{let r=await api({...args,context:c});if(token!==serial||key(context())!==scope)return;
   if(args.action==="discord"){r=await api({action:"read",id:args.refreshId,context:c});if(token!==serial||key(context())!==scope)return}
   apply(r);message=""}
  catch(e){if(token===serial&&key(context())===scope)message=/revision|evidence_changed/.test(String(e?.message))?"Stand verändert. Bitte neu laden.":"Aktion nicht bestätigt. Bitte Serverstand prüfen."}
  finally{if(token===serial&&key(context())===scope){busy=false;render()}}
 }
 function listLoad(){return request({action:"list"},r=>{if(!Array.isArray(r))throw Error("bad list");list=r})}
 function read(id){if(!dirty)return request({action:"read",id},adopt)}
 function save(){if(!draft||busy||testMode)return;try{activityPeriod(draft.start,draft.end);if(!draft.rules.some(r=>r.metric!=="onePerPerson")||draft.rules.some(r=>r.minimum!==true&&(!Number.isInteger(r.minimum)||r.minimum<0)))throw Error("invalid")}catch{message="Zeitraum und mindestens ein gültiges Ziel eingeben.";render();return}
  return request({action:current?"save":"create",...clone(draft),revision:current?.revision},r=>{adopt(r);list=[{id:r.id,title:r.title,start:r.start,end:r.end},...list.filter(x=>x.id!==r.id)]})
 }
 async function draw(){
  if(testMode||!current?.ready||dirty||busy||current.official)return;
  const before=serial,old=current,c=context();
  let confirmed=false;try{confirmed=await confirmDraw(old)}catch{return}
  if(!confirmed||before!==serial||current!==old||key(c)!==key(context())||dirty||busy)return;
  return request({action:"draw",id:old.id,revision:old.revision,witness:old.witness},result=>{adopt(result);animateNextDraw=!!result.official});
 }
 function decision(tag,patch){draft.decisions[tag]={...(draft.decisions[tag]||{}),...patch};for(const k of Object.keys(draft.decisions[tag]))if(draft.decisions[tag][k]===undefined)delete draft.decisions[tag][k];dirty=true;render()}
 function render(){
  root.replaceChildren();
  const toolbar=n("div","","actions");
  if(!testMode)toolbar.append(button("Neue Verlosung",()=>{if(!dirty)fresh();else{message="Bitte Entwurf zuerst speichern oder verwerfen.";render()}},busy),
   button("Testen",()=>{if(!dirty)fresh(true)},busy||dirty),
   button("Kampagnen aktualisieren",()=>{if(!dirty)listLoad()},busy||dirty));
  if(dirty)toolbar.append(button(testMode?"Test beenden":"Entwurf verwerfen",()=>{testMode=false;dirty=false;draft=null;current=null;message="";listLoad()},busy));
  root.append(toolbar);
  if(testMode)root.append(n("h3","Testmodus · nur Beispieldaten"),n("p","Zeitraum und Ziele ausprobieren. Keine Kampagne, kein Tracking und kein offizieller Gewinner werden gespeichert.","statusline"));
  if(list.length&&!testMode){
  const picker=select([["","Gespeicherte Verlosung wählen"],...list.map(x=>[x.id,x.title+" · "+x.start+" – "+x.end])],current?.id||"");
  picker.disabled=busy||dirty;picker.onchange=()=>{if(picker.value)read(picker.value)};root.append(field("Verlosung",picker));}
  if(message){const m=n("p",message,"statusline");m.setAttribute("role","status");root.append(m)}
  if(!draft){root.append(n("p",busy?"Verlosungen werden geladen …":list.length?"Wähle eine gespeicherte Verlosung oder erstelle eine neue.":"Noch keine Grind-Verlosung. Erstelle eine Verlosung oder probiere sie unverbindlich aus.","statusline"));return}
  const date=current?.today||today(),started=!!current&&date>=draft.start,locked=!!current?.official;
  if(locked){
   const o=current.official;
   const animate=animateNextDraw;animateNextDraw=false;
   const audit=n("details");
   root.append(renderDrawReveal({winnerName:o.winner.name,winnerTag:o.winner.tag,animate,weighted:false,
    rows:wheelRows(o.pool),ticket:o.ticket,subtitle:o.pool.length+" gültige Lose · einmalige Ziehung",onReveal:()=>{audit.hidden=false}}));
   audit.hidden=animate&&!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
   audit.append(n("summary","Gespeicherter Teilnehmer- und Zielstand"),
    n("p",(Number.isInteger(o.ticket)?"Losindex "+(o.ticket+1)+" von "+o.pool.length+" · ":"")+"Prüfsumme: "+o.witness,"statusline"));
   if(o.rules?.some(r=>r.metric==="onePerPerson"))audit.append(n("p","Ein Los je zugeordneter Person. Gewinn-Account: qualifizierter Hauptaccount, sonst erster qualifizierter Spielertag. Keine Zusammenrechnung von Leistungen.","statusline"));
   for(const p of o.rows)audit.append(n("p",p.name+" · "+p.status+" · "+p.checks.map(x=>names[x.metric]+": "+(x.value??x.status)).join(" / "),"statusline"));
   root.append(audit);return;
  }
  const settings=n("div","","goldpass-controls");
  const title=input("text",draft.title),start=input("date",draft.start),end=input("date",draft.end);
  title.maxLength=80;title.disabled=busy;title.onchange=()=>{draft.title=title.value;dirty=true;render()};
  for(const [key,e] of [["start",start],["end",end]]){e.disabled=busy||started;e.onchange=()=>{draft[key]=e.value;dirty=true;render()}}
  settings.append(field("Name",title),field("Start",start),field("Ende (einschließlich)",end));root.append(settings);
  try{const p=activityPeriod(draft.start,draft.end);root.append(n("p",p.days+" Kalendertage · Zeitzone Europe/Vienna","statusline"))}catch{root.append(n("p","Ungültiger Zeitraum.","statusline"))}
  if(!started){
   root.append(n("h3","Zielvorlagen"),n("p","Wähle eine Vorlage oder stelle deine Ziele selbst zusammen. Änderungen am Zeitraum übernehmen keine neuen Ziele automatisch.","statusline"));
   const assumed=input("number",wars);assumed.min="0";assumed.step="1";assumed.placeholder="Automatische Schätzung";assumed.disabled=busy;
   root.append(field("Erwartete normale CWs (optional)",assumed));
   const presets=n("div","","goldpass-controls"),estimate=n("div","","goldpass-estimate");
   estimate.setAttribute("aria-live","polite");
   const options=ACTIVITY_PRESETS.map(p=>{
    const cell=n("div"),b=button(p.name,()=>{applyPreset(p.id);render()},busy),summary=n("p","","statusline");
    b.classList.add("goldpass-preset");b.setAttribute("aria-pressed","false");
    cell.append(b,n("p",p.description,"statusline"),summary);presets.append(cell);return {p,b,summary};
   });
   const ruleKey=rules=>JSON.stringify(rules.filter(r=>r.metric!=="onePerPerson").map(r=>[r.metric,r.minimum]).sort((a,b)=>a[0].localeCompare(b[0])));
   function refreshEstimate(){
    estimate.replaceChildren();
    try{
     const opts=wars===""?{}:{normalWars:Number(wars)};
     const scenarios=options.map(({p})=>presetTargets(p.id,draft.start,draft.end,opts));
     const a=scenarios[0].assumptions;
     estimate.append(n("p",a.normalWars+" normale CWs · maximal "+a.maximumStars+" Sterne · "+a.maximumAttacks+" Angriffe je Spieler.","statusline"),
      n("p",a.estimated?"Schätzung: 2 normale CWs/Woche, Tage 1–7 je Monat ausgenommen. Tatsächlicher Spielplan kann abweichen.":"Eigene CW-Anzahl. Tatsächliche Einsätze können abweichen.","statusline"));
     for(const [i,{b,summary}] of options.entries()){
      const scenario=scenarios[i],same=ruleKey(scenario.rules)===ruleKey(draft.rules);
      b.disabled=busy;b.setAttribute("aria-pressed",String(same));
      const stars=scenario.rules.find(r=>r.metric==="cwStars")?.minimum;
      summary.textContent=scenario.rules[0].minimum.toLocaleString("de-AT")+" Spenden"+(stars===undefined?" · kein CW-Sternziel":" · "+stars+" CW-Sterne");
     }
     const caps={cwStars:a.maximumStars,cwAttacks:a.maximumAttacks,cwTriples:a.maximumAttacks};
     const warnings=draft.rules.filter(r=>Object.hasOwn(caps,r.metric)&&r.minimum>caps[r.metric]);
     if(warnings.length)estimate.append(n("p","⚠ "+warnings.map(r=>names[r.metric]+": "+r.minimum+" verlangt, maximal "+caps[r.metric]+" bei der angenommenen CW-Anzahl").join("; ")+". Prüfe die Ziele oder korrigiere die CW-Anzahl.","goldpass-estimate-warning"));
     if(!a.normalWars)estimate.append(n("p","Keine normalen CWs eingeplant. Die Vorlagen enthalten deshalb kein CW-Sternziel.","statusline"));
    }catch{
     for(const {b,summary} of options){b.disabled=true;b.setAttribute("aria-pressed","false");summary.textContent=""}
     estimate.append(n("p","Bitte gültigen Zeitraum und eine realistische ganze CW-Anzahl eingeben.","goldpass-estimate-warning"));
    }
   }
   assumed.oninput=()=>{wars=assumed.value;refreshEstimate()};
   root.append(presets,estimate);refreshEstimate();
  }else root.append(n("p","Ziele und Zeitraum sind ab Start fixiert. Teilnahmeentscheidungen bleiben bearbeitbar.","statusline"));
  root.append(n("h3","Ziele"));
  for(const [metric,label,def] of metrics){
   const rule=draft.rules.find(r=>r.metric===metric),line=n("div","","goldpass-goal");
   const enabled=input("checkbox",!!rule);enabled.disabled=busy||started;
   enabled.onchange=()=>{draft.rules=draft.rules.filter(r=>r.metric!==metric);if(enabled.checked)draft.rules.push({metric,minimum:def});dirty=true;render()};
   const toggle=n("label");toggle.append(enabled,n("span",label));line.append(toggle);
   if(rule&&def!==true){
    const val=input("number",rule.minimum);val.min="0";val.step="1";val.disabled=busy||started;
    val.onchange=()=>{rule.minimum=val.value===""?NaN:Number(val.value);dirty=true;render()};
    val.setAttribute("aria-label","Mindestziel "+label);line.append(val);
   }
   root.append(line);
  }
  const group=input("checkbox",draft.rules.some(r=>r.metric==="onePerPerson"));group.disabled=busy||started;
  group.onchange=()=>{draft.rules=draft.rules.filter(r=>r.metric!=="onePerPerson");if(group.checked)draft.rules.push(personRule);dirty=true;render()};
  const extra=n("details");extra.append(n("summary","Weitere Teilnahmeoptionen"),field("Nur ein Los pro Person",group),n("p","Verknüpfe Mehrfachaccounts unter Mehr → Clanverwaltung → Mitgliedsmerkmale. Jeder Account muss die Ziele selbst erreichen. Pro Person zählt nur ein qualifizierter Account: der Hauptaccount, falls qualifiziert, sonst der erste qualifizierte Spielertag. Veranstalter werden als Person ausgeschlossen. Nicht zugeordnete Accounts gelten als eigenständige Personen.","statusline"));root.append(extra);
  root.append(n("p","Ranked, Raid und Clanspiele folgen nach tatsächlicher API-/Tracking-Prüfung. Spenden und CW/CWL nutzen die vorhandenen Beobachtungen.","statusline"));
  if(testMode){
   const rules=draft.rules.filter(r=>r.metric!=="onePerPerson");
   const sample=[["#P02","Beispiel A",5200,42,18,10,18,7,4,true,true],["#P08","Beispiel B",4100,30,14,8,12,5,3,true,true],["#P09","Beispiel C",2500,24,12,6,9,4,2,true,false],["#P0Y","Beispiel D",800,9,5,2,6,3,1,false,true],["#P0P","Beispiel E",null,20,10,5,12,5,3,undefined,true]];
   try{
    if(!rules.length)throw Error("no_rules");
    const rows=sample.map(([tag,name,...values])=>({tag,name,evidence:Object.fromEntries(metrics.slice(0,7).flatMap(([k],i)=>values[i]===null?[]:[[k,{value:values[i],coverage:"complete"}]])),marks:{discord:values[7],voted:values[8]}}));
    const preview=campaignPreview({...draft,rules},rows,draft.end);
    root.append(n("h3","Beispiel-Fortschritt"),n("p",preview.qualified+" qualifiziert · "+preview.unknown+" offen · fiktive, feste Werte, getrennte Personen","statusline"));
    const pool=preview.rows.filter(x=>x.status==="qualified").map(x=>({tag:x.tag,name:x.name,tickets:1}));
    for(const p of preview.rows){
     const row=n("div","","goldpass-player"),head=n("div","","goldpass-player-head");
     head.append(n("strong",p.name),n("span",({qualified:"Qualifiziert",unknown:"Offen",unmet:"Nicht erfüllt",excluded:"Ausgeschlossen"})[p.status]));row.append(head);
     row.append(n("p",p.results.map(x=>names[x.metric]+": "+(x.value===null?"–":typeof x.value==="boolean"?(x.value?"Ja":"Nein"):x.value+" / "+x.minimum)).join(" · "),"statusline"));root.append(row);
    }
    const result=n("div");
    root.append(button("Testziehung starten",()=>{if(!testMode||key(context())!==scope||!pool.length)return;
     try{const pick=sampleRaffle({rows:pool,total:pool.length}),winner=pool.find(p=>p.tag===pick.winnerTag);result.replaceChildren(renderDrawReveal({winnerName:winner.name,winnerTag:winner.tag,rows:pool,ticket:pick.ticket,test:true,animate:true,subtitle:"Beispieldaten · nicht gespeichert"}))}catch{result.textContent="Testziehung nicht verfügbar."}
    },!pool.length),result);
   }catch{root.append(n("p","Bitte einen gültigen Zeitraum und mindestens ein gültiges Ziel wählen.","statusline"))}
   return;
  }
  const saveBtn=button(current?"Änderungen speichern":"Verlosung anlegen",save,busy||!dirty);root.append(saveBtn);
  if(!current)return;
  root.append(n("h3","Fortschritt"),n("p",current.qualified+(current.onePerPerson?" qualifizierte Personen":" qualifiziert")+" · "+current.unknown+" Accounts noch nicht eindeutig · "+(current.rows||[]).length+" beobachtete Teilnehmer","statusline"),
   n("p","Belegte Untergrenzen, nicht lückenlose Aktivität. CWs zählen nach gespeichertem Kriegsstart; nur abgeschlossene Kriege. Discord und Abstimmungen werden manuell gesetzt.","statusline"),
   button("Fortschritt neu laden",()=>read(current.id),busy||dirty));
  if(Array.isArray(current.pool)&&current.pool.length){
   const testResult=n("div"),test=button("Testziehung starten",()=>{
    if(dirty||busy||key(context())!==scope)return;
    try{const rows=wheelRows(current.pool),pick=sampleRaffle({rows,total:rows.length}),winner=rows.find(p=>p.tag===pick.winnerTag);
     testResult.replaceChildren(renderDrawReveal({winnerName:winner.name,winnerTag:winner.tag,rows,ticket:pick.ticket,test:true,animate:true,subtitle:"Unverbindlich · nicht gespeichert"}));
    }catch{testResult.replaceChildren(n("p","Testziehung nicht verfügbar.","statusline"))}
   },busy||dirty);
   root.append(test,n("p","Testziehung aus dem aktuellen qualifizierten Los-Pool. Kein offizieller Gewinner.","statusline"),testResult);
  }
  for(const p of current.rows||[]){
   const card=n("article","","goldpass-player"),head=n("div","","goldpass-player-head");
   head.append(n("strong",p.name),n("span",({qualified:"Qualifiziert",unknown:"Offen / nicht belegt",unmet:"Nicht erfüllt",excluded:"Ausgeschlossen"})[p.status]||p.status));
   card.append(head,n("small",p.tag,"statusline"));
   if(current.onePerPerson&&p.groupKey){
    const groupName=(current.rows||[]).find(x=>x.tag===p.groupKey)?.name||p.groupKey;
    const representative=(current.pool||[]).find(x=>x.groupKey===p.groupKey);
    const description=p.groupKey!==p.tag?"Zweitaccount von "+groupName:"Eigenständiger oder Hauptaccount";
    card.append(n("p",description+(p.status==="qualified"&&representative?(representative.tag===p.tag?" · 1 Los für diese Person":" · Los bereits über "+representative.name):""),"statusline"));
   }
   for(const check of p.checks||[]){
    const numeric=typeof check.minimum==="number";
    card.append(n("p",names[check.metric]+": "+(numeric?(check.value??"–")+" / "+check.minimum:({met:"Ja",unmet:"Nein",unknown:"Unbekannt"})[check.status])+(numeric?" · "+(check.status==="met"?"Ziel belegt":"Ziel noch nicht belegt"):""),"statusline"));
    if(numeric){const r=draft.rules.find(x=>x.metric===check.metric);if(r)try{const pace=activityGoalPace(r,draft,date);card.append(n("small","Orientierung: "+Math.round(pace.perWeek)+"/Woche · bis heute etwa "+pace.expected,"statusline"))}catch{}}
   }
   const d=draft.decisions[p.tag]||{},discord=select([["","Unbekannt"],["yes","Ja"],["no","Nein"]],p.discord===true?"yes":p.discord===false?"no":"");
   discord.disabled=busy||dirty;discord.onchange=()=>request({action:"discord",player:p.tag,discord:discord.value===""?null:discord.value==="yes",refreshId:current.id},adopt);
   const voted=select([["","Unbekannt"],["yes","Ja"],["no","Nein"]],d.voted===true?"yes":d.voted===false?"no":"");
   voted.disabled=busy;voted.onchange=()=>decision(p.tag,{voted:voted.value===""?undefined:voted.value==="yes"});
   const excluded=input("checkbox",d.excluded===true),organizer=input("checkbox",d.organizer===true);
   excluded.disabled=organizer.disabled=busy;excluded.onchange=()=>decision(p.tag,{excluded:excluded.checked});organizer.onchange=()=>decision(p.tag,{organizer:organizer.checked});
   const opts=n("div","","goldpass-options");opts.append(field("Discord (dauerhaft)",discord),field("Abgestimmt (diese Verlosung)",voted),field("Ausschließen",excluded),field("Veranstalter",organizer));const edit=n("details");edit.append(n("summary","Teilnahme bearbeiten"),opts);card.append(edit);
   if(date>draft.end&&(p.status==="unknown"||d.resolution)){
    const resolution=select([["","Noch offen"],["qualify","Nach Prüfung zulassen"],["exclude","Nach Prüfung ausschließen"]],d.resolution||"");
    const note=input("text",d.note||"");note.maxLength=240;resolution.disabled=note.disabled=busy;
    const commit=()=>decision(p.tag,{resolution:resolution.value||undefined,note:note.value||undefined});
    resolution.onchange=commit;note.onchange=commit;
    card.append(field("Manuelle Klärung bei fehlenden Daten",resolution),field("Begründung (erforderlich)",note));
   }
   root.append(card);
  }
  root.append(n("p",dirty?"Erst Teilnahmeentscheidungen speichern.":date<=draft.end?"Ziehung erst nach Ende des letzten Tages.":current.ready?"Alle offenen Fälle geklärt. Ziehung bereit.":"Offene Fälle klären; mindestens ein qualifizierter Teilnehmer erforderlich.","statusline"),
   button("Gewinner offiziell ziehen",draw,busy||dirty||!current.ready));
 }
 return {open(){const c=context();if(!c){reset();scope=null;return false}if(scope!==key(c)){reset();scope=key(c)}render();if(!dirty)listLoad();return true},
 accessChanged(c){if(key(c)!==scope){reset();scope=null;return false}return true}};
}
