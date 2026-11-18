/* Owner-only normal CW incident rendering. No rank/plan writes. */
(function(root){
"use strict";
let generation=0,current=null;
const expanded=new Set();
const get=id=>document.getElementById(id);
const element=(tag,text="",className="")=>{
 const x=document.createElement(tag);x.textContent=text;if(className)x.className=className;
 return x;
};
const date=iso=>new Date(iso).toLocaleDateString("de-AT",{
 day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"
});
function clear(){
 generation++;current=null;expanded.clear();
 const panel=get("clanManagementNormalPanel");
 if(panel)panel.open=false;
 get("clanManagementNormalList")?.replaceChildren();
}
function render(members,payload,sourceTag){
 generation++;
 current={members,payload,sourceTag};
 const list=get("clanManagementNormalList"),heading=get("clanManagementNormalHeading");
 if(!list||!heading)return;
 const result=root.CWLClanNormalMissedReview?.evaluate(members,payload,sourceTag)??null;
 list.replaceChildren();
 if(!result){
  heading.textContent="Normale CW · Nachweise nicht verfügbar";
  list.appendChild(element("p",
   "Die Kriegsnachweise oder Entscheidungen sind nicht vollständig abrufbar. Es wird kein Fehlverhalten angenommen.",
   "clan-management-empty"));
  return;
 }
 const count=result.rows.reduce((sum,p)=>sum+p.openCount,0);
 heading.textContent="Normale CW · "+count+(count===1?" offener Fall":" offene Fälle");
 if(result.incompleteWars)
  list.appendChild(element("p",result.incompleteWars+
   " dokumentierte Kriege ohne vollständige Angriffsnachweise – nicht bewertet.",
   "clan-management-empty"));
 if(!result.rows.length){
  list.appendChild(element("p",result.verifiedWars?
   "Keine offenen Fehlangriffe in vollständig erfassten CWs. Nicht erfasste Kriege bleiben unbekannt.":
   "Noch keine vollständig belegten normalen CWs erfasst. Ältere Kriege bleiben unbekannt.",
   "clan-management-empty"));
  return;
 }
 for(const person of result.rows){
  const row=element("div","","clan-management-person");
  row.setAttribute("role","listitem");row.dataset.playerTag=person.tag;
  row.append(element("strong",person.name));
  row.append(element("div",person.status,"clan-management-person-status"));
  row.append(element("small",person.reason));
  const disclosure=element("details","","clan-management-evidence");
  disclosure.open=expanded.has(person.tag);
  const summary=element("summary");
  const label=element("span",disclosure.open?"Kriege schließen":"Kriege ansehen");
  summary.append(label);disclosure.append(summary);
  const body=element("div","","clan-management-evidence-body");
  for(const incident of person.events){
   const section=element("section","","clan-management-cw-incident");
   section.append(element("strong",date(incident.war.started_at)+" · "+
    (2-incident.missing)+"/2 Angriffe genutzt"));
   section.append(element("small",incident.state==="excused"?"Entschuldigt":
    incident.state==="acknowledged"?"Als geprüft markiert":"Noch offen"));
   if(incident.history.length){
    const history=element("details","","clan-management-cw-history");
    history.append(element("summary","Entscheidungsverlauf · "+incident.history.length));
    for(const d of incident.history.slice().reverse()){
     const state=d.decision==="excused"?"Entschuldigt":
       d.decision==="acknowledged"?"Geprüft":"Wieder geöffnet";
     history.append(element("p",date(d.created_at)+" · "+state+
      (d.note?" · "+d.note:"")));
    }
    section.append(history);
   }
   const group=element("div","","clan-management-review-actions");
   group.setAttribute("role","group");
   group.setAttribute("aria-label","Prüfung für "+person.name+" am "+date(incident.war.started_at));
   const note=document.createElement("input");
   note.type="text";note.maxLength=280;note.className="clan-management-cw-note";
   note.placeholder="Notiz (optional)";
   note.setAttribute("aria-label","Notiz zu "+person.name+" am "+date(incident.war.started_at));
   group.append(note);
   const choices=incident.state==="open"?
    [["Als geprüft markieren","acknowledged"],["Entschuldigen","excused"]]:
    [["Erneut öffnen","reopened"]];
   for(const [caption,choice] of choices){
    const button=element("button",caption,"btn small");
    button.type="button";button.setAttribute("aria-label",
     person.name+" "+date(incident.war.started_at)+": "+caption);
    button.onclick=()=>save(incident.war.war_key,person.tag,choice,note.value,group);
    group.append(button);
   }
   section.append(group);body.append(section);
  }
  disclosure.append(body);
  disclosure.addEventListener("toggle",()=>{
   if(!disclosure.isConnected)return;
   if(disclosure.open)expanded.add(person.tag);
   else expanded.delete(person.tag);
   label.textContent=disclosure.open?"Kriege schließen":"Kriege ansehen";
  });
  row.append(disclosure);list.append(row);
 }
}
async function save(warKey,playerTag,choice,note,group){
 const cloud=root.CWLCloud,request=generation,clan=cloud?.getActiveClanId?.();
 if(!current||!group?.isConnected||!cloud?.active||!cloud?.isOwner?.()||!clan)return;
 const buttons=[...group.querySelectorAll("button")];
 buttons.forEach(b=>b.disabled=true);
 try{
  const stored=await cloud.saveManagementNormalCwDecision(warKey,playerTag,choice,note);
  if(request!==generation||clan!==cloud.getActiveClanId()||
     !cloud.active||!cloud.isOwner()||!group.isConnected||!current)return;
  current.payload.decisions.push(stored);
  expanded.add(playerTag);
  const {members,payload,sourceTag}=current;
  render(members,payload,sourceTag);
  const target=[...get("clanManagementNormalList").querySelectorAll(".clan-management-person")]
   .find(row=>row.dataset.playerTag===playerTag);
  target?.querySelector("details > summary")?.focus({preventScroll:true});
 }catch(err){
  if(request!==generation||!group.isConnected)return;
  buttons.forEach(b=>b.disabled=false);
  group.append(element("span",err?.message||"Entscheidung nicht gespeichert. Bitte neu laden.","review-error"));
 }
}
root.CWLNormalCwUI={render,clear};
})(typeof window!=="undefined"?window:{});
