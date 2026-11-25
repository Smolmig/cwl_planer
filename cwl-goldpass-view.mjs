import {DEFAULT_RAFFLE_RULES,collectRaffleEvidence,rafflePreview} from "./cwl-goldpass-core.mjs?v=1.32.0";
const pct=new Intl.NumberFormat("de-AT",{style:"percent",maximumFractionDigits:2});
const month=new Intl.DateTimeFormat("de-AT",{month:"long",year:"numeric",timeZone:"UTC"});
const el=(tag,text="",className="")=>{const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n};
const field=(label,control)=>{const n=el("label","","goldpass-field");n.append(el("span",label),control);return n};
const option=(value,label)=>{const n=el("option",label);n.value=value;return n};
function numberInput(value,max){const n=el("input");n.type="number";n.min="0";n.max=String(max);n.step="1";n.value=String(value);return n}
const validSeason=s=>/^20\d{2}-(0[1-9]|1[0-2])$/.test(String(s||""));
const reasons={organizer:"Veranstalter ausgeschlossen",manual_exclusion:"Manuell ausgeschlossen",discord_unconfirmed:"Discord nicht bestätigt",minimum_not_met:"Mindestleistung nicht erreicht",no_tickets:"Keine Lose nach aktueller Regel"};
const formulaText=r=>"Lose = "+r.base+" Grund + "+r.one+" je 1★ + "+r.two+" je 2★ + "+r.three+" je 3★ + "+r.perStar+" je Stern.";
const metricsText=r=>r.appearances+" Einsätze · "+r.attacks+" AG · "+r.stars+"★ · "+r.three+" Dreier · "+r.tickets+" Lose"+(r.unknown?" · "+r.unknown+" offen":"");
export function raffleSeasons(profile,tag){
 const map=new Map();
 for(const a of [...(profile?.archives||[])].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))){
  const s=a?.cwlLive;
  if(!s||a.sourceSeason!==s.season||map.has(s.season))continue;
  const e=collectRaffleEvidence({...s,warCount:s.warCount??([5,7].includes(a.days)?a.days:null)},tag);
  if(e)map.set(e.season,e);
 }
 const current=collectRaffleEvidence(profile?.cwlLive,tag);
 if(current){
  const prior=map.get(current.season);
  if(!prior||current.ended>=prior.ended)map.set(current.season,current);
 }
 return [...map.values()].sort((a,b)=>b.season.localeCompare(a.season));
}
export function createGoldpassPreview({root,getProfile,getContext,api=null,listSeasons=null,confirmDraw=async()=>false}){
 let scope=null,season="",rules={...DEFAULT_RAFFLE_RULES},eligibility=Object.create(null),seasons=[];
 let server=null,serverSeasons=[],organizerConfirmed=false,dirty=false,busy=false,serial=0,message="";
 const allowed=()=>{const c=getContext();return c?.owner&&c?.clanId&&c?.clanTag?c:null};
 const scopeOf=c=>c?c.clanId+"|"+c.clanTag:null;
 const matches=(token,target,context)=>token===serial&&season===target&&scope===scopeOf(context)&&scope===scopeOf(allowed());
 const resetDraft=()=>{rules={...DEFAULT_RAFFLE_RULES};eligibility=Object.create(null);server=null;organizerConfirmed=false;dirty=false;message=""};
 const reset=()=>{serial++;busy=false;season="";serverSeasons=[];seasons=[];resetDraft();root.replaceChildren()};
 function rebuildSeasons(){
  const c=allowed();if(!c)return;
  const map=new Map(raffleSeasons(getProfile(),c.clanTag).map(e=>[e.season,e]));
  for(const s of serverSeasons)if(validSeason(s)&&!map.has(s))map.set(s,{season:s,warCount:null,ended:0,players:[],complete:false});
  seasons=[...map.values()].sort((a,b)=>b.season.localeCompare(a.season));
  if(!seasons.some(x=>x.season===season)){season=seasons[0]?.season||"";resetDraft()}
 }
 function adopt(result){
  if(!result||!Number.isSafeInteger(result.revision)||result.revision<0||!result.rules||!result.eligibility||
     (!result.official&&(!result.evidence||!result.preview||typeof result.witness!=="string")))throw Error("invalid_server_response");
  server=result;rules={...result.rules};eligibility=Object.assign(Object.create(null),result.eligibility);
  organizerConfirmed=result.organizerConfirmed===true;dirty=false;
 }
 function failure(error){
  const s=String(error?.message||"");
  if(/revision|evidence_changed|40001/i.test(s))return "Der gespeicherte Stand hat sich geändert. Bitte neu laden und die Regeln erneut prüfen.";
  if(/incomplete/i.test(s))return "Die CWL-Ergebnisse sind serverseitig noch nicht vollständig bestätigt.";
  if(/no_tickets/i.test(s))return "Keine gültigen Lose vorhanden.";
  if(/organizer/i.test(s))return "Bitte den Veranstalter prüfen und die Bestätigung speichern.";
  if(/already_drawn/i.test(s))return "Für diese Saison existiert bereits eine Ziehung. Bitte neu laden.";
  return "Serverstand konnte nicht geladen oder gespeichert werden. Es wurde keine neue Ziehung bestätigt. Bitte neu laden.";
 }
 async function loadServer({includeList=false}={}){
  const c=allowed();if(!api||!c||scope!==scopeOf(c)||busy)return;
  const token=++serial;busy=true;message="Serverstand wird geladen …";render();
  try{
   if(includeList&&listSeasons){
    const incoming=await listSeasons(c);
    if(token!==serial||scope!==scopeOf(allowed()))return;
    if(Array.isArray(incoming))serverSeasons=incoming.filter(validSeason);
    rebuildSeasons();
   }
   const target=season;
   if(!target){message="Noch keine CWL-Saison vorhanden.";return}
   const result=await api({context:c,season:target,action:"read"});
   if(!matches(token,target,c))return;
   adopt(result);message="";
  }catch(error){if(token===serial&&scope===scopeOf(allowed())){server=null;message=failure(error)}}
  finally{if(token===serial&&scope===scopeOf(allowed())){busy=false;render()}}
 }
 async function run(action){
  const c=allowed(),target=season;
  if(!api||!c||!server||busy||scope!==scopeOf(c)||server.official)return;
  if(action==="draw"){
   if(dirty||server.revision<1||!organizerConfirmed||server.evidence?.complete!==true||
      !server.preview?.total||!server.witness)return;
   const before=serial,revision=server.revision,witness=server.witness;
   const ok=await confirmDraw({season:target,total:server.preview.total,participants:server.preview.rows.filter(r=>r.tickets>0).length});
   if(!ok||!matches(before,target,c)||dirty||busy||server?.revision!==revision||server?.witness!==witness)return;
  }
  const token=++serial;busy=true;message=action==="draw"?"Offizielle Ziehung läuft …":"Regeln werden gespeichert …";render();
  try{
   const request={context:c,season:target,action,expectedRevision:server.revision};
   if(action==="save")Object.assign(request,{rules:{...rules},eligibility:{...eligibility},organizerConfirmed});
   else request.expectedWitness=server.witness;
   const result=await api(request);
   if(!matches(token,target,c))return;
   adopt(result);message=action==="draw"?"Offizielles Ergebnis gespeichert.":"Regeln gespeichert.";
  }catch(error){if(matches(token,target,c)){message=failure(error);server=null}}
  finally{if(matches(token,target,c)){busy=false;render()}}
 }
 function refresh(){const c=allowed();if(!c||scope!==scopeOf(c)){reset();return}rebuildSeasons();render()}
 function renderOfficial(result){
  const o=result.official,header=el("div","","goldpass-result");
  header.append(el("p","OFFIZIELLES ERGEBNIS","more-eyebrow"),el("h3",o.winnerName||o.winnerTag),
   el("p",o.winnerTag+" · "+new Date(o.drawnAt).toLocaleString("de-AT"),"statusline"),
   el("p","Die Ziehung ist gespeichert. Regeln und Teilnehmerstand bleiben unverändert.","statusline"));
  root.append(header,el("h3","Angewandte Regeln"),el("p",formulaText(o.rules),"statusline"),
    el("p","Mindestleistung: "+({none:"keine",triples:"Dreier",stars:"Gesamtsterne",attacks:"Angriffe"}[o.rules.minimumType])+
    (o.rules.minimumType==="none"?"":" · "+o.rules.minimum)+(o.rules.requireDiscord?" · Discord bestätigt erforderlich":""),"statusline"),
    el("h3","Teilnehmer zum Ziehungszeitpunkt"),el("p",o.preview.total+" Lose · "+o.preview.rows.filter(r=>r.tickets>0).length+" zugelassen","statusline"));
  for(const r of o.preview.rows){
   const wrap=el("article","","goldpass-player"),head=el("div","","goldpass-player-head");
   head.append(el("strong",r.name+(r.tag===o.winnerTag?" · Gewinner": "")),el("strong",pct.format(Number(r.probability)),"goldpass-chance"));
   wrap.append(head,el("small",r.tag,"statusline"),el("p",metricsText(r),"statusline"),el("p",reasons[r.reason]||"Teilnahmeberechtigt","statusline"));root.append(wrap);
  }
  const audit=el("details"),summary=el("summary","Ziehungsnachweis");
  audit.append(summary,el("p","Regelversion "+o.version+" · Losindex "+(Number(o.ticket)+1)+" von "+o.preview.total+" · "+o.evidence.ended+" bestätigte Runden","statusline"),
   el("p","Prüfsumme: "+o.witness,"goldpass-witness statusline"));root.append(audit);
 }
 function render(){
  root.replaceChildren();
  if(!seasons.length){
   root.append(el("p",busy?"Serverstand wird geladen …":message||"Noch keine belegten CWL-Daten dieses Clans gespeichert.","season-empty"));
   if(api&&!busy){const retry=el("button","Serverstand laden","btn small");retry.type="button";retry.onclick=()=>loadServer({includeList:true});root.append(retry)}
   return;
  }
  const select=el("select");
  for(const s of seasons)select.append(option(s.season,month.format(new Date(s.season+"-01T00:00:00Z"))));
  select.value=season;select.disabled=busy;
  select.onchange=()=>{
   if(busy)return;
   if(dirty){select.value=season;message="Bitte zuerst speichern oder den ungespeicherten Entwurf über Neu laden verwerfen.";render();return}
   season=select.value;resetDraft();render();if(api)loadServer();
  };
  const local=seasons.find(s=>s.season===season);
  if(!local)return;
  const top=el("div","","goldpass-controls");top.append(field("CWL-Saison",select));
  const refreshButton=el("button",dirty?"Neu laden (Entwurf verwerfen)":"Gespeicherte Daten aktualisieren","btn small");
  refreshButton.type="button";refreshButton.disabled=busy;
  refreshButton.onclick=()=>{if(api){resetDraft();refresh();loadServer({includeList:true})}else refresh()};
  top.append(refreshButton);root.append(top);
  if(message){const msg=el("p",message,"statusline");msg.setAttribute("role","status");root.append(msg)}
  if(server?.official){renderOfficial(server);return}
  // Final server data is authoritative; partial local live evidence is just a
  // provisional preview and never enables a draw.
  const verified=server?.evidence;
  const e=verified?.complete===true||verified&&verified.ended>=local.ended&&local.players.every(p=>!p.unknown)?verified:local;
  const status=el("p","","statusline");
  status.textContent=e.ended+" / "+(e.warCount??"unbekannt")+" Runden vollständig auswertbar · "+e.players.length+" belegte Teilnehmer. "+
    (verified?.complete?"Serverseitig vollständig bestätigt.":e.complete?"Gespeicherte Rundendaten strukturell vollständig, Serverbestätigung noch offen.":"Vorläufig: Fehlende oder laufende Runden können die Chancen verändern.")+
    (api?(verified?.complete?"":" Keine offizielle Ziehung möglich."):" Keine offizielle Ziehung möglich.");
  root.append(status);
  const settings=el("div","","goldpass-controls");
  const minType=el("select");
  for(const [v,label] of [["none","Keine Mindestleistung"],["triples","Dreisterneangriffe"],["stars","Gesamtsterne"],["attacks","Durchgeführte Angriffe"]])minType.append(option(v,label));
  minType.value=rules.minimumType;minType.disabled=busy;
  const min=numberInput(rules.minimum,rules.minimumType==="stars"?21:7);min.disabled=busy||rules.minimumType==="none";
  settings.append(field("Mindestleistung",minType),field("Mindestanzahl",min));
  const weightInputs={};
  for(const [key,label] of [["base","Grundlose"],["one","Bonus je 1★"],["two","Bonus je 2★"],["three","Bonus je 3★"],["perStar","Bonus je Gesamtstern"]]){
   const input=numberInput(rules[key],100);input.disabled=busy;weightInputs[key]=input;settings.append(field(label,input));
  }
  const discord=el("input");discord.type="checkbox";discord.checked=rules.requireDiscord;discord.disabled=busy;
  settings.append(field("Discord manuell bestätigen",discord));
  root.append(el("h3","Teilnahmeregeln"),settings);
  const formula=el("p","","statusline"),summary=el("p","","statusline"),rows=el("div","","goldpass-rows");
  summary.setAttribute("role","status");root.append(formula,el("h3","Teilnehmer & Gewinnchancen"),summary,rows);
  const rowNodes=new Map();
  let saveButton,drawButton,organizer,saveStatus;
  if(api){
   const controls=el("div","","goldpass-actions");
   organizer=el("input");organizer.type="checkbox";organizer.checked=organizerConfirmed;organizer.disabled=busy;
   organizer.onchange=()=>{organizerConfirmed=organizer.checked;dirty=true;update()};
   controls.append(field("Veranstalter geprüft und gegebenenfalls ausgeschlossen",organizer));
   saveStatus=el("p","","statusline");controls.append(saveStatus);
   const actions=el("div","","actions");saveButton=el("button","Regeln speichern","btn");drawButton=el("button","Offiziell ziehen","btn primary");
   for(const b of [saveButton,drawButton])b.type="button";
   saveButton.onclick=()=>run("save");drawButton.onclick=()=>run("draw");
   actions.append(saveButton,drawButton);controls.append(actions);root.append(controls);
  }
  function updateButtons(p){
   if(!api)return;
   saveButton.disabled=busy||!server||!p||(!dirty&&server.revision!==0);
   drawButton.disabled=busy||!server||!p||dirty||server.revision<1||!organizerConfirmed||
    server.evidence?.complete!==true||!server.preview?.total||!server.witness;
   saveStatus.textContent=busy?"Bitte warten …":!server?"Nur lokale Vorschau · Serverstand zuerst laden.":
    dirty?"Ungespeicherte Änderungen":server.revision===0?"Noch keine Regeln gespeichert.":
    !organizerConfirmed?"Veranstalter prüfen und Bestätigung speichern.":!server.evidence.complete?"Regeln gespeichert · vollständige CWL-Ergebnisse ausstehend.":
    !server.preview.total?"Regeln gespeichert · keine gültigen Lose.":"Regeln gespeichert · offizielle Ziehung kann bewusst gestartet werden.";
  }
  function update(){
   let p;
   try{p=rafflePreview(e,rules,eligibility)}catch{summary.textContent="Bitte gültige ganze Zahlen eingeben.";rows.hidden=true;updateButtons(null);return}
   if(server?.evidence?.complete&&!dirty)p=server.preview;
   rows.hidden=false;formula.textContent=formulaText(rules);
   summary.textContent=p.rows.filter(r=>r.eligible).length+" zugelassen · "+p.total+" Lose insgesamt"+(p.total?"":" · Keine Gewinnchance");
   for(const r of p.rows){
    let node=rowNodes.get(r.tag);
    if(!node){
     const wrap=el("article","","goldpass-player"),head=el("div","","goldpass-player-head"),title=el("strong",r.name),chance=el("strong","","goldpass-chance"),metrics=el("p","","statusline"),reason=el("p","","statusline");
     head.append(title,chance);wrap.append(head,el("small",r.tag,"statusline"),metrics,reason);
     const options=el("div","","goldpass-options"),checks={};
     for(const [key,label] of [["organizer","Veranstalter"],["excluded","Ausschließen"],["discord","Discord bestätigt"],["override","Mindestleistung ausnahmsweise erfüllt"]]){
      const input=el("input");input.type="checkbox";input.checked=r.decision?.[key]===true;
      input.onchange=()=>{eligibility[r.tag]={...(eligibility[r.tag]||{}),[key]:input.checked};dirty=true;if(key==="organizer"){organizerConfirmed=false;if(organizer)organizer.checked=false}update()};
      checks[key]=input;options.append(field(label,input));
     }
     wrap.append(options);rows.append(wrap);node={chance,metrics,reason,checks};rowNodes.set(r.tag,node);
    }
    node.chance.textContent=pct.format(Number(r.probability));node.metrics.textContent=metricsText(r);
    node.reason.textContent=reasons[r.reason]||r.reason||"Teilnahmeberechtigt (Vorschau)";
    for(const input of Object.values(node.checks))input.disabled=busy;
    node.checks.discord.disabled=busy||!rules.requireDiscord;
    node.checks.override.disabled=busy||rules.minimumType==="none";
   }
   updateButtons(p);
  }
  minType.onchange=()=>{rules={...rules,minimumType:minType.value,minimum:0};dirty=true;render()};
  min.oninput=()=>{rules.minimum=min.value===""?NaN:Number(min.value);dirty=true;update()};
  for(const [key,input] of Object.entries(weightInputs))input.oninput=()=>{rules[key]=input.value===""?NaN:Number(input.value);dirty=true;update()};
  discord.onchange=()=>{rules.requireDiscord=discord.checked;dirty=true;update()};
  update();
 }
 return {open(){
  const c=allowed();if(!c){reset();scope=null;return false}
  const next=scopeOf(c);if(scope!==next){reset();scope=next}
  refresh();if(api&&!dirty&&!busy)loadServer({includeList:true});return true;
 },accessChanged(c){if(!c||scope!==scopeOf(c)){reset();scope=null;return false}return true},refresh};
}
