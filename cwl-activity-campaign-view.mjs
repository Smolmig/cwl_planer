import {renderDrawReveal} from "./cwl-raffle-reveal.mjs?v=1.35.0";
import {ACTIVITY_PRESETS,activityPeriod,presetTargets,activityGoalPace} from "./cwl-activity-campaign.mjs?v=1.35.0";
const metrics=[
 ["donations","Spenden",3500],["cwStars","Normale CW-Sterne",28],["cwAttacks","Normale CW-Angriffe",12],
 ["cwTriples","Normale CW-Dreier",8],["cwlStars","CWL-Sterne",15],["cwlAttacks","CWL-Angriffe",5],
 ["cwlTriples","CWL-Dreier",4],["discord","Discord vertreten",true],["voted","Abgestimmt / reagiert",true]
];
const names=Object.fromEntries(metrics.map(([key,label])=>[key,label]));
const n=(tag,text="",cls="")=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e};
const field=(label,input)=>{const e=n("label","","goldpass-field");e.append(n("span",label),input);return e};
const input=(type,value)=>{const e=n("input");e.type=type;if(type==="checkbox")e.checked=!!value;else e.value=String(value??"");return e};
const button=(text,action,disabled=false)=>{const e=n("button",text,"btn");e.type="button";e.disabled=disabled;e.onclick=action;return e};
const select=(options,value)=>{const e=n("select");for(const [v,t] of options){const o=n("option",t);o.value=v;e.append(o)}e.value=value;return e};
const todayVienna=()=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Vienna",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());return ["year","month","day"].map(k=>p.find(x=>x.type===k).value).join("-")};
const clone=x=>JSON.parse(JSON.stringify(x));
export function createActivityCampaignView({root,getContext,api,confirmDraw=async()=>false,today=todayVienna}){
 let scope=null,list=[],current=null,draft=null,message="",busy=false,dirty=false,serial=0,wars="",presetInfo="",animateNextDraw=false;
 const context=()=>{const c=getContext();return c?.owner&&c?.clanId&&c?.clanTag?c:null};
 const key=c=>c?c.clanId+"|"+c.clanTag+"|"+String(c.session??""):null;
 const reset=()=>{animateNextDraw=false;serial++;list=[];current=null;draft=null;busy=false;dirty=false;message="";wars="";presetInfo="";root.replaceChildren()};
 function adopt(result){animateNextDraw=false;current=result;draft={id:result.id,title:result.title,start:result.start,end:result.end,rules:clone(result.rules),decisions:clone(result.decisions||{})};dirty=false;presetInfo="";wars=""}
 function fresh(){const start=today();current=null;draft={id:globalThis.crypto.randomUUID(),title:"Grind-Verlosung",start,end:new Date(Date.parse(start+"T00:00:00Z")+29*86400000).toISOString().slice(0,10),rules:[],decisions:{}};dirty=true;wars="";presetInfo="";applyPreset("active");render()}
 function applyPreset(id){
  try{
   const opts=wars===""?{}:{normalWars:Number(wars)};
   const r=presetTargets(id,draft.start,draft.end,opts);
   draft.rules=r.rules;
   presetInfo=r.assumptions.normalWars+" normale CWs · maximal "+r.assumptions.maximumStars+" Sterne · "+r.assumptions.plannedAttacks+" erwartete Angriffe à "+r.assumptions.starsPerAttack+" Sterne · "+r.assumptions.donationsPerWeek+" Spenden/Woche. "+(r.assumptions.estimated?"Schätzung: 2 CWs/Woche, Tage 1–7 je Monat ausgenommen.":"Eigene CW-Anzahl.");
   dirty=true;message="";
  }catch{message="Bitte gültigen Zeitraum und realistische CW-Anzahl wählen."}
 }
 async function request(args,apply){
  const c=context();if(!c||key(c)!==scope||busy)return;
  const token=++serial;busy=true;message="Wird geladen …";render();
  try{let r=await api({...args,context:c});if(token!==serial||key(context())!==scope)return;
   if(args.action==="discord"){r=await api({action:"read",id:args.refreshId,context:c});if(token!==serial||key(context())!==scope)return}
   apply(r);message=""}
  catch(e){if(token===serial&&key(context())===scope)message=/revision|evidence_changed/.test(String(e?.message))?"Stand verändert. Bitte neu laden.":"Aktion nicht bestätigt. Bitte Serverstand prüfen."}
  finally{if(token===serial&&key(context())===scope){busy=false;render()}}
 }
 function listLoad(){return request({action:"list"},r=>{if(!Array.isArray(r))throw Error("bad list");list=r})}
 function read(id){if(!dirty)return request({action:"read",id},adopt)}
 function save(){if(!draft||busy)return;try{activityPeriod(draft.start,draft.end);if(!draft.rules.length||draft.rules.some(r=>r.minimum!==true&&(!Number.isInteger(r.minimum)||r.minimum<0)))throw Error("invalid")}catch{message="Zeitraum und mindestens ein gültiges Ziel eingeben.";render();return}
  return request({action:current?"save":"create",...clone(draft),revision:current?.revision},r=>{adopt(r);list=[{id:r.id,title:r.title,start:r.start,end:r.end},...list.filter(x=>x.id!==r.id)]})
 }
 async function draw(){
  if(!current?.ready||dirty||busy||current.official)return;
  const before=serial,old=current,c=context();
  let confirmed=false;try{confirmed=await confirmDraw(old)}catch{return}
  if(!confirmed||before!==serial||current!==old||key(c)!==key(context())||dirty||busy)return;
  return request({action:"draw",id:old.id,revision:old.revision,witness:old.witness},result=>{adopt(result);animateNextDraw=!!result.official});
 }
 function decision(tag,patch){draft.decisions[tag]={...(draft.decisions[tag]||{}),...patch};for(const k of Object.keys(draft.decisions[tag]))if(draft.decisions[tag][k]===undefined)delete draft.decisions[tag][k];dirty=true;render()}
 function render(){
  root.replaceChildren();
  const toolbar=n("div","","actions");
  toolbar.append(button("Neue Verlosung",()=>{if(!dirty)fresh();else{message="Bitte Entwurf zuerst speichern oder verwerfen.";render()}},busy),
   button("Kampagnen aktualisieren",()=>{if(!dirty)listLoad()},busy||dirty));
  if(dirty)toolbar.append(button("Entwurf verwerfen",()=>{dirty=false;draft=null;current=null;message="";listLoad()},busy));
  root.append(toolbar);
  const picker=select([["","Gespeicherte Verlosung wählen"],...list.map(x=>[x.id,x.title+" · "+x.start+" – "+x.end])],current?.id||"");
  picker.disabled=busy||dirty;picker.onchange=()=>{if(picker.value)read(picker.value)};root.append(field("Verlosung",picker));
  if(message){const m=n("p",message,"statusline");m.setAttribute("role","status");root.append(m)}
  if(!draft){root.append(n("p","Zeitraum festlegen, Vorlage wählen oder eigene Ziele hinzufügen.","statusline"));return}
  const date=current?.today||today(),started=!!current&&date>=draft.start,locked=!!current?.official;
  if(locked){
   const o=current.official;
   const animate=animateNextDraw;animateNextDraw=false;
   const audit=n("details");
   root.append(renderDrawReveal({winnerName:o.winner.name,winnerTag:o.winner.tag,animate,weighted:false,
    subtitle:o.pool.length+" qualifizierte Teilnehmer · einmalige Ziehung",onReveal:()=>{audit.hidden=false}}));
   audit.hidden=animate&&!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
   audit.append(n("summary","Gespeicherter Teilnehmer- und Zielstand"),
    n("p",(Number.isInteger(o.ticket)?"Losindex "+(o.ticket+1)+" von "+o.pool.length+" · ":"")+"Prüfsumme: "+o.witness,"statusline"));
   for(const p of o.rows)audit.append(n("p",p.name+" · "+p.status+" · "+p.checks.map(x=>names[x.metric]+": "+(x.value??x.status)).join(" / "),"statusline"));
   root.append(audit);return;
  }
  const settings=n("div","","goldpass-controls");
  const title=input("text",draft.title),start=input("date",draft.start),end=input("date",draft.end);
  title.maxLength=80;title.disabled=busy;title.onchange=()=>{draft.title=title.value;dirty=true;render()};
  for(const [key,e] of [["start",start],["end",end]]){e.disabled=busy||started;e.onchange=()=>{draft[key]=e.value;dirty=true;presetInfo="";render()}}
  settings.append(field("Name",title),field("Start",start),field("Ende (einschließlich)",end));root.append(settings);
  try{const p=activityPeriod(draft.start,draft.end);root.append(n("p",p.days+" Kalendertage · Zeitzone Europe/Vienna","statusline"))}catch{root.append(n("p","Ungültiger Zeitraum.","statusline"))}
  if(!started){
   const assumed=input("number",wars);assumed.min="0";assumed.placeholder="Automatische Schätzung";assumed.disabled=busy;
   assumed.oninput=()=>{wars=assumed.value};
   root.append(field("Erwartete normale CWs (optional)",assumed));
   const presets=n("div","","actions");
   for(const p of ACTIVITY_PRESETS)presets.append(button(p.name,()=>{applyPreset(p.id);render()},busy));
   root.append(presets);
   if(presetInfo)root.append(n("p",presetInfo,"statusline"));
  }else root.append(n("p","Ziele und Zeitraum sind ab Start fixiert. Teilnahmeentscheidungen bleiben bearbeitbar.","statusline"));
  root.append(n("h3","Ziele"));
  for(const [metric,label,def] of metrics){
   const rule=draft.rules.find(r=>r.metric===metric),line=n("div","","goldpass-player-head");
   const enabled=input("checkbox",!!rule);enabled.disabled=busy||started;
   enabled.onchange=()=>{draft.rules=draft.rules.filter(r=>r.metric!==metric);if(enabled.checked)draft.rules.push({metric,minimum:def});dirty=true;render()};
   line.append(field(label,enabled));
   if(rule&&def!==true){
    const val=input("number",rule.minimum);val.min="0";val.step="1";val.disabled=busy||started;
    val.onchange=()=>{rule.minimum=val.value===""?NaN:Number(val.value);dirty=true;render()};
    line.append(field("Mindestziel",val));
   }
   root.append(line);
  }
  root.append(n("p","Ranked, Raid und Clanspiele folgen nach tatsächlicher API-/Tracking-Prüfung. Spenden und CW/CWL nutzen die vorhandenen Beobachtungen.","statusline"));
  const saveBtn=button(current?"Änderungen speichern":"Verlosung anlegen",save,busy||!dirty);root.append(saveBtn);
  if(!current)return;
  root.append(n("h3","Fortschritt"),n("p",current.qualified+" qualifiziert · "+current.unknown+" noch nicht eindeutig · "+(current.rows||[]).length+" beobachtete Teilnehmer","statusline"),
   n("p","Belegte Untergrenzen, nicht lückenlose Aktivität. CWs zählen nach gespeichertem Kriegsstart; nur abgeschlossene Kriege. Discord und Abstimmungen werden manuell gesetzt.","statusline"),
   button("Fortschritt neu laden",()=>read(current.id),busy||dirty));
  for(const p of current.rows||[]){
   const card=n("article","","goldpass-player"),head=n("div","","goldpass-player-head");
   head.append(n("strong",p.name),n("span",({qualified:"Qualifiziert",unknown:"Offen / nicht belegt",unmet:"Nicht erfüllt",excluded:"Ausgeschlossen"})[p.status]||p.status));
   card.append(head,n("small",p.tag,"statusline"));
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
   const opts=n("div","","goldpass-options");opts.append(field("Discord (dauerhaft)",discord),field("Abgestimmt (diese Verlosung)",voted),field("Ausschließen",excluded),field("Veranstalter",organizer));card.append(opts);
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
