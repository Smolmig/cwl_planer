import {DEFAULT_RAFFLE_RULES,collectRaffleEvidence,rafflePreview} from "./cwl-goldpass-core.mjs";
const pct=new Intl.NumberFormat("de-AT",{style:"percent",maximumFractionDigits:2});
const month=new Intl.DateTimeFormat("de-AT",{month:"long",year:"numeric",timeZone:"UTC"});
const el=(tag,text="",className="")=>{const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n};
const field=(label,control)=>{const n=el("label","","goldpass-field");n.append(el("span",label),control);return n};
const option=(value,label)=>{const n=el("option",label);n.value=value;return n};
function numberInput(value,max){const n=el("input");n.type="number";n.min="0";n.max=String(max);n.step="1";n.value=String(value);return n}
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
export function createGoldpassPreview({root,getProfile,getContext}){
 let scope=null,season="",rules={...DEFAULT_RAFFLE_RULES},eligibility=Object.create(null),seasons=[];
 const allowed=()=>{const c=getContext();return c?.owner&&c?.clanId&&c?.clanTag?c:null};
 const reset=()=>{season="";rules={...DEFAULT_RAFFLE_RULES};eligibility=Object.create(null);seasons=[];root.replaceChildren()};
 function refresh(){
  const c=allowed();
  if(!c||scope!==c.clanId+"|"+c.clanTag){reset();return}
  seasons=raffleSeasons(getProfile(),c.clanTag);
  if(!seasons.some(x=>x.season===season)){season=seasons[0]?.season||"";eligibility=Object.create(null)}
  render();
 }
 function render(){
  root.replaceChildren();
  if(!seasons.length){root.append(el("p","Noch keine belegten CWL-Daten dieses Clans gespeichert.","season-empty"));return}
  const select=el("select");
  for(const s of seasons)select.append(option(s.season,month.format(new Date(s.season+"-01T00:00:00Z"))));
  select.value=season;
  select.onchange=()=>{season=select.value;rules={...DEFAULT_RAFFLE_RULES};eligibility=Object.create(null);render()};
  const e=seasons.find(s=>s.season===season);
  if(!e)return;
  const top=el("div","","goldpass-controls");top.append(field("CWL-Saison",select));
  const refreshButton=el("button","Gespeicherte Daten aktualisieren","btn small");refreshButton.type="button";refreshButton.onclick=refresh;
  top.append(refreshButton);root.append(top);
  const status=el("p","","statusline");
  status.textContent=e.ended+" / "+(e.warCount??"unbekannt")+" Runden vollständig auswertbar · "+e.players.length+" belegte Teilnehmer. "+
    (e.complete?"Gespeicherte Rundendaten strukturell vollständig.":"Vorläufig: Fehlende oder laufende Runden können die Chancen verändern.")+
    " Keine offizielle Ziehung möglich.";
  root.append(status);
  const settings=el("div","","goldpass-controls");
  const minType=el("select");
  for(const [v,label] of [["none","Keine Mindestleistung"],["triples","Dreisterneangriffe"],["stars","Gesamtsterne"],["attacks","Durchgeführte Angriffe"]])minType.append(option(v,label));
  minType.value=rules.minimumType;
  const min=numberInput(rules.minimum,rules.minimumType==="stars"?21:7);min.disabled=rules.minimumType==="none";
  settings.append(field("Mindestleistung",minType),field("Mindestanzahl",min));
  const weightInputs={};
  for(const [key,label] of [["base","Grundlose"],["one","Bonus je 1★"],["two","Bonus je 2★"],["three","Bonus je 3★"],["perStar","Bonus je Gesamtstern"]]){
   const input=numberInput(rules[key],100);weightInputs[key]=input;settings.append(field(label,input));
  }
  const discord=el("input");discord.type="checkbox";discord.checked=rules.requireDiscord;
  settings.append(field("Discord manuell bestätigen",discord));
  root.append(el("h3","Teilnahmeregeln"),settings);
  const formula=el("p","","statusline"),summary=el("p","","statusline"),rows=el("div","","goldpass-rows");
  summary.setAttribute("role","status");root.append(formula,el("h3","Teilnehmer & Gewinnchancen"),summary,rows);
  const rowNodes=new Map();
  function update(){
   let p;
   try{p=rafflePreview(e,rules,eligibility)}catch{summary.textContent="Bitte gültige ganze Zahlen eingeben.";return}
   formula.textContent="Lose = "+rules.base+" Grund + "+rules.one+" je 1★ + "+rules.two+" je 2★ + "+rules.three+" je 3★ + "+rules.perStar+" je Stern.";
   summary.textContent=p.rows.filter(r=>r.eligible).length+" zugelassen · "+p.total+" Lose insgesamt"+(p.total?"":" · Keine Gewinnchance");
   for(const r of p.rows){
    let node=rowNodes.get(r.tag);
    if(!node){
     const wrap=el("article","","goldpass-player"),head=el("div","","goldpass-player-head"),title=el("strong",r.name),chance=el("strong","","goldpass-chance"),metrics=el("p","","statusline"),reason=el("p","","statusline");
     head.append(title,chance);wrap.append(head,el("small",r.tag,"statusline"),metrics,reason);
     const options=el("div","","goldpass-options");
     const checks={};
     for(const [key,label] of [["organizer","Veranstalter"],["excluded","Ausschließen"],["discord","Discord bestätigt"],["override","Mindestleistung ausnahmsweise erfüllt"]]){
      const input=el("input");input.type="checkbox";input.checked=r.decision[key];
      input.onchange=()=>{eligibility[r.tag]={...(eligibility[r.tag]||{}),[key]:input.checked};update()};
      checks[key]=input;options.append(field(label,input));
     }
     wrap.append(options);rows.append(wrap);node={chance,metrics,reason,checks};rowNodes.set(r.tag,node);
    }
    node.chance.textContent=pct.format(r.probability);
    node.metrics.textContent=r.appearances+" Einsätze · "+r.attacks+" AG · "+r.stars+"★ · "+r.three+" Dreier · "+r.tickets+" Lose"+
      (r.unknown?" · "+r.unknown+" offen":"");
    node.reason.textContent=r.reason||"Teilnahmeberechtigt (Vorschau)";
    node.checks.discord.disabled=!rules.requireDiscord;
    node.checks.override.disabled=rules.minimumType==="none";
   }
  }
  minType.onchange=()=>{rules={...rules,minimumType:minType.value,minimum:0};render()};
  min.oninput=()=>{rules.minimum=min.value===""?NaN:Number(min.value);update()};
  for(const [key,input] of Object.entries(weightInputs))input.oninput=()=>{rules[key]=input.value===""?NaN:Number(input.value);update()};
  discord.onchange=()=>{rules.requireDiscord=discord.checked;update()};
  update();
 }
 return {open(){
  const c=allowed();if(!c){reset();scope=null;return false}
  const next=c.clanId+"|"+c.clanTag;
  if(scope!==next){reset();scope=next}
  refresh();return true;
 },accessChanged(c){if(!c||scope!==c.clanId+"|"+c.clanTag){reset();scope=null;return false}return true},refresh};
}
