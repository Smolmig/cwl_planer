// Clan-private member metadata, independent of campaigns and planner profiles.
const el=(tag,text="",cls="")=>{const x=document.createElement(tag);x.textContent=text;if(cls)x.className=cls;return x};
const select=(items,value)=>{const x=el("select");for(const [v,t] of items){const o=el("option",t);o.value=v;x.append(o)}x.value=value;return x};
const label=(text,control)=>{const x=el("label","","goldpass-field");x.append(el("span",text),control);return x};
const button=(text,fn,disabled=false)=>{const x=el("button",text,"btn small");x.type="button";x.disabled=disabled;x.onclick=fn;return x};
const tagPattern=/^#[0289PYLQGRJCUV]{3,15}$/;
export function createActivityMemberView({root,getContext,api}){
 let scope=null,rows=[],loaded=false,busy=false,serial=0,message="",query="",filter="current";
 const expanded=new Set();
 const allowed=()=>{const c=getContext();return c?.owner&&c?.clanId&&c?.clanTag?c:null};
 const key=c=>c?c.clanId+"|"+c.clanTag+"|"+String(c.session??""):null;
 const reset=()=>{serial++;rows=[];loaded=false;busy=false;message="";query="";filter="current";expanded.clear();root.replaceChildren()};
 async function run(args){
  const c=allowed();if(!c||key(c)!==scope||busy)return;
  const token=++serial;busy=true;message="Wird geladen …";render();
  try{
   const r=await api({...args,context:c});
   if(token!==serial||key(allowed())!==scope)return;
   if(!Array.isArray(r)||new Set(r.map(x=>x.tag)).size!==r.length||r.some(x=>!tagPattern.test(x.tag)||typeof x.present!=="boolean"||
      ![null,true,false].includes(x.discord)||x.primaryTag!==null&&!tagPattern.test(x.primaryTag)))throw Error("invalid_members");
   rows=r;loaded=true;message=args.action==="list"?"":"Gespeichert.";
  }catch(e){if(token===serial&&key(allowed())===scope)message=/revision/.test(String(e?.message))?"Zuordnung wurde geändert. Bitte neu laden.":"Nicht bestätigt. Bitte neu laden und erneut prüfen."}
  finally{if(token===serial&&key(allowed())===scope){busy=false;render()}}
 }
 function render(){
  root.replaceChildren();
  if(!scope||key(allowed())!==scope)return;
  const status=el("p",message||(!loaded?"Mitgliedsmerkmale laden.":""),"statusline");status.setAttribute("role","status");
  root.append(el("p","Discord gilt pro Clash-Account. Mehrfachaccounts kannst du einem Hauptaccount zuordnen. Diese Angaben helfen bei künftigen Grind-Verlosungen; bestehende Ziehungen bleiben unverändert.","statusline"),button("Mitgliedsmerkmale neu laden",()=>run({action:"list"}),busy),status);
  if(!loaded)return;
  const counts=rows.filter(r=>r.present),search=el("input");search.type="search";search.placeholder="Name oder Spielertag";search.value=query;search.setAttribute("aria-label","Mitglied suchen");
  const mode=select([["current","Aktuelle Mitglieder"],["unknown","Discord unbekannt"],["yes","Discord: Ja"],["no","Discord: Nein"],["linked","Mehrfachaccounts"],["all","Alle gespeicherten"]],filter);
  const toolbar=el("div","","activity-member-toolbar");
  toolbar.append(label("Suchen",search),label("Anzeigen",mode));
  root.append(el("p",counts.length+" beobachtete Mitglieder · "+counts.filter(r=>r.discord===true).length+" Discord bestätigt · "+counts.filter(r=>r.discord===null).length+" unbekannt","statusline"),toolbar);
  const matches=el("p","","statusline activity-member-matches");matches.setAttribute("role","status");
  const list=el("div");root.append(matches,list);
  const drawRows=()=>{
   list.replaceChildren();const q=query.trim().toLocaleLowerCase("de-AT");
   const byTag=new Map(rows.map(r=>[r.tag,r]));
   const primaryTags=new Set(rows.filter(r=>r.primaryTag).map(r=>r.primaryTag));
   const visible=rows.filter(r=>(filter==="all"||filter==="linked"&&(r.primaryTag||primaryTags.has(r.tag))||r.present&&
    (filter==="current"||filter==="unknown"&&r.discord===null||filter==="yes"&&r.discord===true||filter==="no"&&r.discord===false))&&
    (!q||String(r.name||r.tag).toLocaleLowerCase("de-AT").includes(q)||r.tag.toLowerCase().includes(q)));
   matches.textContent=visible.length+" "+(visible.length===1?"Account angezeigt":"Accounts angezeigt");
   if(!visible.length){list.append(el("p","Keine passenden Mitglieder.","statusline"));return}
   for(const r of visible){
    const row=el("article","","activity-member-row"),head=el("div","","activity-member-head");row.dataset.playerTag=r.tag;
    const identity=el("div");identity.append(el("strong",String(r.name||r.tag)),el("small",r.tag+(r.present?"":" · zuletzt nicht im Clan"),"statusline"));head.append(identity);
    const discord=select([["","Unbekannt"],["yes","Ja"],["no","Nein"]],r.discord===true?"yes":r.discord===false?"no":"");
    discord.dataset.discord=r.discord===true?"confirmed":r.discord===false?"no":"unknown";
    discord.disabled=busy;discord.onchange=()=>run({action:"discord",player:r.tag,discord:discord.value===""?null:discord.value==="yes"});
    head.append(label("Discord",discord));row.append(head);
    if(r.primaryTag)row.append(el("p","Zweitaccount von "+String(byTag.get(r.primaryTag)?.name||r.primaryTag)+" ("+r.primaryTag+")","statusline"));
    else if(primaryTags.has(r.tag))row.append(el("p","Hauptaccount · "+rows.filter(x=>x.primaryTag===r.tag).length+" zugeordnete Accounts","statusline"));
    const edit=el("details"),choices=[["","Eigenständiger Account"],...rows.filter(x=>x.present&&x.tag!==r.tag&&!x.primaryTag).map(x=>[x.tag,String(x.name||x.tag)+" · "+x.tag])];
    if(r.primaryTag&&!choices.some(([v])=>v===r.primaryTag))choices.push([r.primaryTag,String(byTag.get(r.primaryTag)?.name||r.primaryTag)+" · nicht aktuell"]);
    const main=select(choices,r.primaryTag||"");main.disabled=busy||primaryTags.has(r.tag);
    const save=button("Zuordnung speichern",()=>run({action:"link",player:r.tag,primary:main.value||null,expectedPrimary:r.primaryTag}),true);
    main.onchange=()=>{save.disabled=busy||main.value===(r.primaryTag||"")};
    const summary=el("summary",expanded.has(r.tag)?"Zuordnung schließen":"Account-Zuordnung ändern");
    edit.open=expanded.has(r.tag);
    edit.addEventListener("toggle",()=>{if(!edit.isConnected)return;if(edit.open)expanded.add(r.tag);else expanded.delete(r.tag);summary.textContent=edit.open?"Zuordnung schließen":"Account-Zuordnung ändern"});
    edit.append(summary,label("Hauptaccount",main),save);
    if(primaryTags.has(r.tag))edit.append(el("p","Zuerst die zugeordneten Zweitaccounts lösen, bevor dieser Account neu zugeordnet wird.","statusline"));
    row.append(edit);list.append(row);
   }
  };
  search.oninput=()=>{query=search.value;drawRows()};mode.onchange=()=>{filter=mode.value;drawRows()};drawRows();
 }
 return {open(){const c=allowed();if(!c){reset();scope=null;return false}if(key(c)!==scope){reset();scope=key(c)}render();if(!busy)run({action:"list"});return true},
 accessChanged(c){if(key(c)!==scope){reset();scope=null;return false}return true}};
}
