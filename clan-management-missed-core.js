/* Read-only confirmed missed-CWL review for the clan owner.
   No sanction, offline inference, tenant sharing or profile/plan mutations. */
(function(root){
 "use strict";
 const validTag=v=>/^#[0289PYLQGRJCUV]{3,15}$/.test(String(v||"").toUpperCase());
 const tag=v=>String(v||"").trim().toUpperCase();
 const normalizeRank=v=>String(v||"").toLowerCase().replace(/[\s_-]/g,"");
 function evaluate(members,payload,now=Date.now()){
  if(payload===null)return null;
  if(!Array.isArray(members)||!payload||!Array.isArray(payload.wars)||
     !Array.isArray(payload.missed)||!Array.isArray(payload.decisions))return null;
  const wars=[];
  for(const w of payload.wars){
   if(!w||w.source!=="api"||w.war_type!=="cwl"||
      w.finalized!==true||w.missed_log_complete!==true||
      typeof w.war_key!=="string"||!/^cwl:#[0289PYLQGRJCUV]{3,15}$/.test(w.war_key)||
      !Array.isArray(w.roster_tags)||!Number.isInteger(w.team_size)||
      w.roster_tags.length!==w.team_size)return null;
   const roster=w.roster_tags.map(tag);
   if(roster.some(x=>!validTag(x))||new Set(roster).size!==roster.length)return null;
   const started=Date.parse(w.started_at||"");
   if(!Number.isFinite(started)||started>now+86400000)return null;
   wars.push({...w,started,roster:new Set(roster)});
  }
  const byKey=new Map(wars.map(w=>[w.war_key,w]));
  if(byKey.size!==wars.length)return null;
  wars.sort((a,b)=>a.started-b.started);
  const decisions=new Map();
  for(const d of payload.decisions){
   if(!d||!Number.isSafeInteger(d.id)||d.id<1||!validTag(tag(d.player_tag))||
      !byKey.has(d.war_key)||!["excused","later","review_pause"].includes(d.decision))
    return null;
   const key=d.war_key+"|"+tag(d.player_tag);
   if(!decisions.has(key)||decisions.get(key).id<d.id)decisions.set(key,d);
  }
  const misses=new Map();
  for(const m of payload.missed){
   const w=byKey.get(m?.war_key),playerTag=tag(m?.player_tag);
   if(!w||!validTag(playerTag)||m.missed_count!==1||!w.roster.has(playerTag))
    return null;
   const key=w.war_key+"|"+playerTag;
   if(misses.has(key))return null;
   misses.set(key,{war:w,playerTag,excused:decisions.get(key)?.decision==="excused"});
  }
  const formatDate=value=>new Date(value).toLocaleDateString("de-AT",{
   timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric"
  });
  const result=[];
  for(const p of members){
   const rank=normalizeRank(p?.role);
   if(!validTag(tag(p?.tag))||!["member","elder","admin"].includes(rank))continue;
   const playerTag=tag(p.tag),records=[...misses.values()]
    .filter(x=>x.playerTag===playerTag),open=records.filter(x=>!x.excused)
    .sort((a,b)=>a.war.started-b.war.started);
   if(!open.length)continue;
   let consecutive=false;
   for(let i=1;i<open.length;i++){
    const first=open[i-1].war,second=open[i].war;
    const gap=second.started-first.started;
    if(gap>=18*3600000&&gap<=36*3600000&&
       wars.indexOf(second)===wars.indexOf(first)+1){
     consecutive=true;break;
    }
   }
   const severe=consecutive&&(rank==="elder"||rank==="admin");
   const recent=open.slice(-2).map(x=>formatDate(x.war.started)).join(" und ");
   result.push({tag:playerTag,name:String(p.name||playerTag),
    rank:rank==="admin"?"elder":rank,missedCount:open.length,
    excusedCount:records.length-open.length,consecutive,severe,
    lastAt:open[open.length-1].war.started,
    status:severe?"Degradierung prüfen":"Fehlangriff prüfen",
    note:(consecutive?"Zwei aufeinanderfolgende, vollständig erfasste CWL-Kriege mit je einem belegten Fehlangriff":
       open.length===1?"Ein belegter Fehlangriff im abgeschlossenen CWL-Krieg":
       open.length+" belegte Fehlangriffe in abgeschlossenen CWL-Kriegen")+
     " · zuletzt "+recent+
     (records.length>open.length?" · "+(records.length-open.length)+" als entschuldigt dokumentiert":"")+
     " · Grund des Fehlens unbekannt; Entscheidung nur manuell."});
  }
  return result.sort((a,b)=>Number(b.severe)-Number(a.severe)||
   b.lastAt-a.lastAt||a.name.localeCompare(b.name,"de",{sensitivity:"base"}));
 }
 const api={evaluate};
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.CWLClanMissedReview=api;
})(typeof window!=="undefined"?window:null);
