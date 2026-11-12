// Original ClashPerk XLSX -> verified, tenant-scoped CW/CWL statistics.
// No remote spreadsheet libraries, external downloads, eval, macros or formula execution.
// Chromium/Firefox/Safari 16.4+: native DecompressionStream("deflate-raw").
const validTag=value=>/^#[0289PYLQGRJCUV]{3,15}$/.test(String(value||"").trim().toUpperCase());
const tag=value=>String(value||"").trim().toUpperCase();
const ownWarType=value=>{
 const x=String(value||"").trim().toLowerCase();
 return x==="cwl"?"cwl":x==="regular"||x==="normal"?"normal":null;
};
const integer=(value,min,max)=>Number.isInteger(Number(value))&&Number(value)>=min&&Number(value)<=max;
const dateFromSerial=value=>{
 const n=Number(value);
 if(!Number.isFinite(n)||n<35000||n>100000)throw Error("Ungültiges ClashPerk-Kriegsdatum.");
 return new Date(Date.UTC(1899,11,30)+Math.round(n*86400000)).toISOString();
};
const localElements=(element,name)=>Array.from(element.getElementsByTagNameNS("*",name));
const single=(element,name)=>localElements(element,name)[0]||null;
const xmlDoc=raw=>{
 const doc=new DOMParser().parseFromString(raw,"application/xml");
 if(localElements(doc,"parsererror").length||doc.documentElement.localName==="parsererror")
  throw Error("Fehlerhafte Excel-XML-Struktur.");
 return doc;
};
const read16=(dv,i)=>dv.getUint16(i,true),read32=(dv,i)=>dv.getUint32(i,true);

export async function readClashPerkXlsx(file){
 if(!file||!(/\.xlsx$/i).test(file.name||"")||file.size>7500000||file.size<100)
  throw Error("Bitte eine originale ClashPerk-XLSX-Datei (maximal 7,5 MB) auswählen.");
 if(typeof DecompressionStream==="undefined")
  throw Error("Der Browser unterstützt Excel-Entpacken nicht. Bitte aktualisieren.");
 const bytes=new Uint8Array(await file.arrayBuffer());
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let eocd=-1;
 for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--){
  if(read32(dv,p)===0x06054b50){eocd=p;break}
 }
 if(eocd<0)throw Error("Excel-ZIP-Struktur nicht lesbar.");
 const count=read16(dv,eocd+10),cdSize=read32(dv,eocd+12),cdOffset=read32(dv,eocd+16);
 if(!count||count>120||count===65535||cdOffset+cdSize>bytes.length)
  throw Error("Excel-Datei ist zu groß oder beschädigt.");
 const decoder=new TextDecoder("utf-8",{fatal:true});
 const entries=new Map();let cursor=cdOffset,totalInflated=0;
 for(let i=0;i<count;i++){
  if(cursor+46>bytes.length||read32(dv,cursor)!==0x02014b50)
   throw Error("Beschädigtes Excel-Dateiverzeichnis.");
  const flags=read16(dv,cursor+8),method=read16(dv,cursor+10);
  const compressed=read32(dv,cursor+20),expanded=read32(dv,cursor+24);
  const nameLength=read16(dv,cursor+28),extra=read16(dv,cursor+30),comment=read16(dv,cursor+32);
  const offset=read32(dv,cursor+42);
  if(!nameLength||cursor+46+nameLength+extra+comment>bytes.length||
     flags&1||![0,8].includes(method)||expanded>18000000||compressed>7500000)
    throw Error("Excel-Datei enthält nicht unterstützte ZIP-Daten.");
  const name=decoder.decode(bytes.subarray(cursor+46,cursor+46+nameLength));
  if(name.includes("..")||name.startsWith("/")||name.includes("\\")||entries.has(name))
    throw Error("Unsichere Excel-Dateistruktur.");
  totalInflated+=expanded;
  if(totalInflated>58000000)throw Error("Excel-Datei ist entpackt zu groß.");
  if(/(?:^|\/)(?:vbaProject\.bin|externalLinks|connections\.xml|embeddings)(?:\/|$)/i.test(name))
    throw Error("Excel-Datei enthält externe oder aktive Inhalte.");
  entries.set(name,{compressed,expanded,offset,method});
  cursor+=46+nameLength+extra+comment;
 }
 const get=async(name,required=true)=>{
  const ent=entries.get(name);
  if(!ent){if(required)throw Error("Fehlender Excel-Bestandteil: "+name);return null}
  const p=ent.offset;
  if(p+30>bytes.length||read32(dv,p)!==0x04034b50)
   throw Error("Excel-Datei enthält einen beschädigten ZIP-Eintrag.");
  const start=p+30+read16(dv,p+26)+read16(dv,p+28);
  if(start+ent.compressed>bytes.length)throw Error("ZIP-Eintrag abgeschnitten.");
  const payload=bytes.subarray(start,start+ent.compressed);
  let result;
  if(ent.method===0)result=payload;
  else{
   const stream=new Blob([payload]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
   const reader=stream.getReader(),pieces=[];let total=0;
   try{
    while(true){
     const {done,value}=await reader.read();
     if(done)break;
     total+=value.length;
     if(total>18000000||total>ent.expanded){await reader.cancel();throw Error("Excel-ZIP-Limit überschritten.")}
     pieces.push(value);
    }
   }finally{reader.releaseLock()}
   result=new Uint8Array(total);let i=0;
   for(const piece of pieces){result.set(piece,i);i+=piece.length}
  }
  if(result.length!==ent.expanded)throw Error("Excel-ZIP-Eintrag hat eine ungültige Größe.");
  return decoder.decode(result);
 };
 const workbook=xmlDoc(await get("xl/workbook.xml"));
 if(localElements(workbook,"workbookPr").some(e=>e.getAttribute("date1904")==="1"))
  throw Error("Excel-Datei verwendet ein nicht unterstütztes Datumsformat.");
 const relationships=xmlDoc(await get("xl/_rels/workbook.xml.rels"));
 const rels=new Map(localElements(relationships,"Relationship").map(e=>[
  e.getAttribute("Id"),{target:e.getAttribute("Target"),external:e.getAttribute("TargetMode")==="External"}
 ]));
 const sharedRaw=await get("xl/sharedStrings.xml",false);
 const strings=sharedRaw?localElements(xmlDoc(sharedRaw),"si").map(si=>
  localElements(si,"t").map(t=>t.textContent||"").join("")):[];
 if(strings.length>150000)throw Error("Excel enthält zu viele Textwerte.");
 const sheets=[];
 for(const e of localElements(workbook,"sheet")){
  const name=e.getAttribute("name")||"";
  const ref=Array.from(e.attributes).find(a=>a.localName==="id")?.value;
  const relation=rels.get(ref);
  if(!relation||relation.external||!relation.target)
   throw Error("Ungültiger Excel-Tabellenverweis.");
  const dest=relation.target.startsWith("/")?
    relation.target.slice(1):"xl/"+relation.target.replace(/^\.\//,"");
  if(!/^xl\/worksheets\/sheet\d+\.xml$/.test(dest))
   throw Error("Unsicherer Excel-Tabellenpfad.");
  const doc=xmlDoc(await get(dest));
  const rows=[];
  for(const row of localElements(doc,"row")){
   if(rows.length>16000)throw Error("Zu viele Excel-Zeilen.");
   const data=[];
   for(const c of localElements(row,"c")){
    if(single(c,"f"))throw Error("Excel-Formeln in den Exportdaten werden nicht akzeptiert.");
    const ref=c.getAttribute("r")||"";
    const letters=/^([A-Z]{1,2})\d+$/.exec(ref);
    if(!letters)throw Error("Fehlerhafte Excel-Zellenadresse.");
    let col=0;for(const char of letters[1])col=col*26+char.charCodeAt(0)-64;
    if(col>60)throw Error("Zu viele Excel-Spalten.");
    const kind=c.getAttribute("t"),v=single(c,"v");
    let value=null;
    if(kind==="inlineStr")value=localElements(c,"t").map(n=>n.textContent||"").join("");
    else if(kind==="s"){
     const idx=Number(v?.textContent);
     if(!Number.isInteger(idx)||idx<0||idx>=strings.length)throw Error("Excel-Textindex ungültig.");
     value=strings[idx];
    }else if(kind==="str")value=v?.textContent??null;
    else if(kind==="e")throw Error("Excel-Zelle enthält einen Fehler.");
    else if(v?.textContent!==null&&v?.textContent!==undefined&&v.textContent!==""){
     const n=Number(v.textContent);
     if(!Number.isFinite(n))throw Error("Excel-Zahlenformat ungültig.");
     value=n;
    }
    if(typeof value==="string"&&value.length>500)throw Error("Excel-Text ist zu lang.");
    data[col-1]=value;
   }
   if(data.some(v=>v!==null&&v!==undefined&&v!==""))rows.push(data);
  }
  if(rows.length)sheets.push({name,rows});
 }
 if(!sheets.length)throw Error("Excel-Datei enthält keine Exporttabellen.");
 return sheets;
}

const ATTACK_HEADERS=["Tag","Name","Position","Town Hall","War ID","Attack Order",
 "Attacker Tag","Defender Tag","Stars","New Stars","Destruction","Defender Tag",
 "Defender Name","Defender Position","Defender TH","Attacker Home Clan","Clan Tag",
 "Clan Name","Clan League/Level","Enemy Clan Tag","Enemy Clan Name",
 "Enemy Clan League/Level","War Start Time","Team Size","War Type"];
const MISSED_HEADERS=["Name","Tag","Clan","Enemy Clan","War ID","Ended","War Type","Team Size","Missed"];
const sameHeaders=(raw,expected)=>expected.every((n,i)=>raw[i]===n);
const keyFor=id=>"cp:"+id;
const string=value=>String(value||"").trim().slice(0,80);

export function parseClashPerkSheets(sheets,expectedClanTag){
 if(!validTag(tag(expectedClanTag)))throw Error("Kein gültiger Clash-Clan ausgewählt.");
 const wars=new Map(),events=new Map(),missedInput=[],clanNames=new Set(),warnings=[];
 let rawEvents=0,aggregateSheets=0;
 for(const sheet of sheets){
  const rows=sheet?.rows||[],head=rows[0]||[];
  if(sameHeaders(head,ATTACK_HEADERS)){
   const sheetTag=/#([0289PYLQGRJCUV]{3,15})\)/.exec(sheet.name||"")?.[0]||null;
   if(sheetTag&&tag(sheetTag.slice(0,-1))!==tag(expectedClanTag))
    throw Error("Der Excel-Export gehört zu einem anderen Clan.");
   for(const r of rows.slice(1)){
    if(!r.length)continue;
    const clanTag=tag(r[16]),opponentTag=tag(r[19]);
    const type=ownWarType(r[24]),warId=Number(r[4]),globalOrder=Number(r[5]);
    const attacker=tag(r[6]),defender=tag(r[7]);
    const team=Number(r[23]),home=Number(r[15]),stars=Number(r[8]),dest=Number(r[10]);
    if(clanTag!==tag(expectedClanTag)||!validTag(opponentTag)||!validTag(attacker)||
       !validTag(defender)||!type||!integer(warId,1,999999999999999)||
       !integer(globalOrder,1,200)||!integer(team,1,50)||
       !integer(home,0,1)||!integer(stars,0,3)||
       !Number.isFinite(dest)||dest<0||dest>100||
       (r[3]!==null&&!integer(r[3],3,30))||
       (r[14]!==null&&!integer(r[14],3,30)))
      throw Error("ClashPerk-Angriffszeile ist beschädigt oder gehört zum falschen Clan.");
    const date=dateFromSerial(r[22]),id=keyFor(warId);
    const known=wars.get(id);
    const war={war_key:id,war_type:type,started_at:date,team_size:team,
      opponent_tag:opponentTag,opponent_name:string(r[20]),
      source:"import",roster_tags:null,finalized:false,missed_log_complete:false};
    if(known){
     if(known.war_type!==type||known.started_at!==date||known.team_size!==team||
        known.opponent_tag!==opponentTag)
      throw Error("Widersprüchliche ClashPerk-Kriegs-ID.");
    }else wars.set(id,war);
    clanNames.add(string(r[17]).toLowerCase());
    const eventKey=id+"/"+attacker+"/"+globalOrder;
    const event={war_key:id,attacker_tag:attacker,attacker_name:string(r[1]),
      attacker_th:r[3]??null,defender_tag:defender,defender_name:string(r[12]),
      defender_th:r[14]??null,stars,destruction:Math.round(dest),
      home:home===1,globalOrder};
    const old=events.get(eventKey);
    if(old){
     if(old.stars!==event.stars||old.destruction!==event.destruction||
        old.defender_tag!==event.defender_tag||old.home!==event.home)
      throw Error("ClashPerk enthält widersprüchliche doppelte Angriffe.");
    }else events.set(eventKey,event);
    rawEvents++;
   }
  }else if(sameHeaders(head,MISSED_HEADERS)&&sheet.name==="Missed Attacks"){
   for(const r of rows.slice(1)){
    const id=Number(r[4]),type=ownWarType(r[6]),playerTag=tag(r[1]);
    const count=Number(r[8]),size=Number(r[7]);
    if(!integer(id,1,999999999999999)||!type||!validTag(playerTag)||
       !integer(count,1,type==="cwl"?1:2)||!integer(size,1,50))
      throw Error("Ungültiger ClashPerk-Missed-Eintrag.");
    missedInput.push({war_key:keyFor(id),war_type:type,team_size:size,
      player_tag:playerTag,player_name:string(r[0]),missed_count:count,
      clan_name:string(r[2]).toLowerCase()});
   }
  }else if(head.includes("Wars Participated")&&head.includes("Total Stars")){
   aggregateSheets++;
  }else if(/^\d Missed Attacks$/.test(sheet.name||"")){
   // ClashPerk pivot summaries of the primary Missed Attacks sheet.
  }else{
   throw Error("Unbekanntes ClashPerk-Tabellenformat: "+String(sheet.name).slice(0,70));
  }
 }
 if(!wars.size){
  throw Error("Bitte mindestens einen /export attack-log (Regular oder CWL) hochladen. War Stats allein reichen nicht.");
 }
 if(wars.size>4000||events.size>140000||missedInput.length>20000)
  throw Error("Zu viele Kriegsdaten in einem Import.");
 const own=new Map(),attacks=[];
 for(const e of events.values()){
  if(!e.home)continue; // Enemy attacks are not own clan player performances!
  const key=e.war_key+"/"+e.attacker_tag;
  if(!own.has(key))own.set(key,[]);
  own.get(key).push(e);
 }
 for(const items of own.values()){
  items.sort((a,b)=>a.globalOrder-b.globalOrder);
  const war=wars.get(items[0].war_key),limit=war.war_type==="cwl"?1:2;
  if(items.length>limit)throw Error("Mehr Angriffe als für einen Spieler im Krieg erlaubt.");
  items.forEach((e,i)=>attacks.push({
   war_key:e.war_key,attacker_tag:e.attacker_tag,attack_order:i+1,
   attacker_name:e.attacker_name,attacker_th:e.attacker_th,
   defender_tag:e.defender_tag,defender_name:e.defender_name,
   defender_th:e.defender_th,stars:e.stars,destruction:e.destruction
  }));
 }
 const missedMap=new Map();let unmatchedMissed=0;
 for(const m of missedInput){
  const war=wars.get(m.war_key);
  if(!war){unmatchedMissed++;continue}
  if(war.war_type!==m.war_type||war.team_size!==m.team_size||
     (clanNames.size&&m.clan_name&&!clanNames.has(m.clan_name)))
   throw Error("Missed-Export gehört zu einem anderen Clan oder Krieg.");
  const key=m.war_key+"/"+m.player_tag;
  const prior=missedMap.get(key);
  if(prior&&prior.missed_count!==m.missed_count)
   throw Error("Widersprüchliche Missed-Einträge.");
  if(!prior)missedMap.set(key,m);
 }
 const byWar=new Map();
 for(const w of wars.values())byWar.set(w.war_key,new Map());
 for(const a of attacks){
  const slots=byWar.get(a.war_key);
  slots.set(a.attacker_tag,(slots.get(a.attacker_tag)||0)+1);
 }
 for(const m of missedMap.values()){
  const slots=byWar.get(m.war_key);
  slots.set(m.player_tag,(slots.get(m.player_tag)||0)+m.missed_count);
 }
 let completeWars=0,missingWars=0;
 for(const w of wars.values()){
  const slots=byWar.get(w.war_key),capacity=w.war_type==="cwl"?1:2;
  for(const count of slots.values())if(count>capacity)
   throw Error("Angriffe und Missed-Einträge widersprechen sich.");
  const complete=slots.size===w.team_size&&
   [...slots.values()].every(count=>count===capacity);
  if(complete){
   w.missed_log_complete=true;
   w.roster_tags=[...slots.keys()];
   completeWars++;
  }else missingWars++;
 }
 if(aggregateSheets)warnings.push(aggregateSheets+" zusammengefasste War-Stats-Tabellen wurden nicht doppelt gezählt.");
 if(unmatchedMissed)warnings.push(unmatchedMissed+" Missed-Einträge ohne zugehörigen Attack-Log-Krieg wurden ausgelassen.");
 if(missingWars)warnings.push(missingWars+" Kriege ohne vollständigen Angriffsnachweis: fehlende Angriffe bleiben unbekannt.");
 const missed=[...missedMap.values()].map(({war_key,player_tag,player_name,missed_count})=>({
  war_key,player_tag,player_name,missed_count
 }));
 const arr=[...wars.values()].sort((a,b)=>a.started_at.localeCompare(b.started_at));
 return {wars:arr,attacks,missed,sourceAttacks:rawEvents,duplicates:rawEvents-events.size,
  enemyAttacks:[...events.values()].filter(e=>!e.home).length,
  completeWars,missingWars,unmatchedMissed,warnings};
}
