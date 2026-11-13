"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {deflateRawSync}=require("node:zlib");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {JSDOM}=require("jsdom");
const fs=require("node:fs");
const root=path.resolve(__dirname,"..");
const xlsx=()=>import(pathToFileURL(path.join(root,"cwl-clashperk-xlsx.mjs")).href);
const db=()=>import(pathToFileURL(path.join(root,"cwl-clashperk-import-db.mjs")).href);
const tag="#99JP2RL2",other="#2JGC2J8VG";
const header=["Tag","Name","Position","Town Hall","War ID","Attack Order",
 "Attacker Tag","Defender Tag","Stars","New Stars","Destruction","Defender Tag",
 "Defender Name","Defender Position","Defender TH","Attacker Home Clan","Clan Tag",
 "Clan Name","Clan League/Level","Enemy Clan Tag","Enemy Clan Name",
 "Enemy Clan League/Level","War Start Time","Team Size","War Type"];
const missedHeader=["Name","Tag","Clan","Enemy Clan","War ID","Ended","War Type","Team Size","Missed"];
function hit(warId,order=1,home=1,type="normal",attacker="#8PYL",stars=3,league="Master I"){
 return [attacker,"Example",1,18,warId,order,attacker,"#2PYL",stars,stars,
  stars===3?100:86,"#2PYL","Enemy",1,18,home,tag,"United Fighters",league,
  "#2QPYL","Opponent",league,46000+warId,2,type];
}
const ms=(warId,player="#QPYL",count=1,type="normal")=>
 ["Missing",player,"United Fighters","Opponent",warId,46000+warId+1,
  type==="normal"?"Regular":"CWL",2,count];
const attackSheet=(rows,name="United Fighters (#99JP2RL2)")=>({name,rows:[header,...rows]});
const missedSheet=(rows)=>({name:"Missed Attacks",rows:[missedHeader,...rows]});
const dom=new JSDOM("<!doctype html><html><body></body></html>");
global.DOMParser=dom.window.DOMParser;

test("two CWs or ten CWs are mapped by War ID, not a fixed Excel size",async()=>{
 const {parseClashPerkSheets}=await xlsx();
 for(const n of [2,10,205]){
  const lines=[];
  for(let i=1;i<=n;i++)lines.push(hit(i,1,1,"normal","#8PYL"));
  const result=parseClashPerkSheets([attackSheet(lines)],tag);
  assert.equal(result.wars.length,n);
  assert.equal(result.attacks.length,n);
  assert.equal(result.missingWars,n);
  assert.equal(result.completeWars,0);
 }
});

test("our attack events are separated from enemy attacks; global order becomes per-player order",async()=>{
 const {parseClashPerkSheets}=await xlsx();
 const lines=[hit(3,4,1,"normal","#8PYL",3),
  hit(3,11,1,"normal","#8PYL",2),
  hit(3,12,0,"normal","#QPYL",3)];
 const got=parseClashPerkSheets([attackSheet(lines)],tag);
 assert.equal(got.attacks.length,2);
 assert.equal(got.enemyAttacks,1);
 assert.deepEqual(got.attacks.map(a=>a.attack_order),[1,2]);
 assert.equal(got.attacks[0].stars,3);
 assert.equal(got.attacks[1].stars,2);
});

test("ClashPerk duplicated CWL rows differing only in optional league metadata are counted once",async()=>{
 const {parseClashPerkSheets}=await xlsx();
 const lines=[hit(8,7,1,"cwl","#8PYL",3,"Master I"),
  hit(8,7,1,"cwl","#8PYL",3,null),
  hit(8,8,0,"cwl","#QPYL",2)];
 const result=parseClashPerkSheets([attackSheet(lines)],tag);
 assert.equal(result.sourceAttacks,3);
 assert.equal(result.duplicates,1);
 assert.equal(result.attacks.length,1);
 assert.equal(result.enemyAttacks,1);
 assert.equal(result.wars[0].war_type,"cwl");
});

test("missed primary sheet covers only evidenced slots, pivot sheets are ignored",async()=>{
 const {parseClashPerkSheets}=await xlsx();
 const got=parseClashPerkSheets([
  attackSheet([hit(1)]),
  missedSheet([ms(1)]),
  {name:"1 Missed Attacks",rows:[["Name","Tag","Miss #1"],["Missing","#QPYL",46002]]}
 ],tag);
 assert.equal(got.missed.length,1);
 assert.equal(got.missed[0].missed_count,1);
 assert.equal(got.wars[0].missed_log_complete,false);
 assert.equal(got.missingWars,1,"1 attack + 1 missed < 4 team slots");
 assert.equal(got.duplicates,0);
});

test("complete roster with exactly all attack or missed slots is marked complete, without inventing zeros",async()=>{
 const {parseClashPerkSheets}=await xlsx();
 const got=parseClashPerkSheets([
  attackSheet([hit(2,1,1,"normal","#8PYL",3),
               hit(2,2,1,"normal","#8PYL",2)]),
  missedSheet([ms(2,"#QPYL",2)])
 ],tag);
 assert.equal(got.completeWars,1);
 assert.equal(got.wars[0].missed_log_complete,true);
 assert.equal(got.wars[0].roster_tags.length,2);
 assert.equal(got.missed[0].missed_count,2);
});

test("missing historical Rathaus information stays unknown, not an import rejection or invented RH",async()=>{
 const {parseClashPerkSheets}=await xlsx();
 const row=hit(1);
 row[3]=undefined;row[14]=null;
 const got=parseClashPerkSheets([attackSheet([row])],tag);
 assert.equal(got.attacks.length,1);
 assert.equal(got.attacks[0].attacker_th,null);
 assert.equal(got.attacks[0].defender_th,null);
});

test("wrong-clan sheet, mixed clan rows and conflicting duplicate attack are rejected",async()=>{
 const {parseClashPerkSheets}=await xlsx();
 assert.throws(()=>parseClashPerkSheets([attackSheet([hit(1)])],other),/anderen Clan/);
 const mixed=hit(1);mixed[16]=other;
 assert.throws(()=>parseClashPerkSheets([attackSheet([mixed])],tag),/falschen Clan/);
 const changed=hit(1);changed[8]=2;
 assert.throws(()=>parseClashPerkSheets([attackSheet([hit(1),changed])],tag),/widersprüchliche doppelte/);
 assert.throws(()=>parseClashPerkSheets([{
  name:"UF 2",rows:[["Name","Tag","Wars Participated","Total Stars"]]
 }],tag),/mindestens einen/);
});

test("missed data for wars not included in this file is reported, never forged",async()=>{
 const {parseClashPerkSheets}=await xlsx();
 const got=parseClashPerkSheets([attackSheet([hit(1)]),missedSheet([ms(3)])],tag);
 assert.equal(got.unmatchedMissed,1);
 assert.equal(got.missed.length,0);
 assert.ok(got.warnings.some(x=>x.includes("ausgelassen")));
});

test("an existing API war wins against the same historical Excel war, even with a different war_key",async()=>{
 const {parseClashPerkSheets}=await xlsx();
 const {planClashPerkMerge}=await db();
 const parsed=parseClashPerkSheets([attackSheet([hit(4)])],tag);
 const w=parsed.wars[0];
 const existing=[{...w,war_key:"normal:2026...",source:"api"}];
 const plan=planClashPerkMerge(parsed,existing);
 assert.equal(plan.insert.length,0);
 assert.equal(plan.skip.length,1);
 assert.equal(plan.attacks.length,0);
 assert.equal(plan.missed.length,0);
});

test("repeated Excel imports use exactly ONE RPC with tenant/role guard, never client table writes",async()=>{
 const {parseClashPerkSheets}=await xlsx();
 const {planClashPerkMerge,commitClashPerkMerge}=await db();
 const parsed=parseClashPerkSheets([attackSheet([
  hit(2,1,1,"normal","#8PYL"),hit(2,2,1,"normal","#8PYL",2)
 ]),missedSheet([ms(2,"#QPYL",2)])],tag);
 const existing=[{...parsed.wars[0],source:"import",missed_log_complete:false}];
 const plan=planClashPerkMerge(parsed,existing);
 assert.equal(plan.insert.length,0);
 assert.equal(plan.extend.length,1);
 const calls=[];
 const sb={
  from(){throw Error("non-atomic table writes are forbidden")},
  rpc(name,args){
   calls.push({name,args});
   return Promise.resolve({data:{
    inserted:0,extended:1,skippedApi:0,attacks:2,missed:1,completeWars:1
   },error:null});
  }
 };
 const result=await commitClashPerkMerge(sb,plan,{
  clanId:"synthetic-clan-id",clanTag:tag,assertCurrent:()=>true
 });
 assert.equal(result.extended,1);
 assert.equal(calls.length,1);
 assert.equal(calls[0].name,"cwl_import_clashperk_atomic");
 assert.equal(calls[0].args.p_clan,"synthetic-clan-id");
 assert.equal(calls[0].args.p_payload.clanTag,tag);
 assert.equal(calls[0].args.p_payload.wars.length,1);
 assert.equal(calls[0].args.p_payload.attacks.length,2);
 assert.equal(calls[0].args.p_payload.missed.length,1);
 assert.ok(!JSON.stringify(calls[0]).includes("service_role"));
});

test("missing RPC refuses import; it must not fall back to partially committed browser batches",async()=>{
 const {parseClashPerkSheets}=await xlsx();
 const {planClashPerkMerge,commitClashPerkMerge}=await db();
 const parsed=parseClashPerkSheets([attackSheet([hit(1)])],tag);
 const plan=planClashPerkMerge(parsed,[]);
 let called=0;
 const sb={
  from(){throw Error("client direct writes unexpectedly called")},
  rpc(){called++;return Promise.resolve({data:null,error:{
   code:"PGRST202",message:"Missing function"
  }})}
 };
 await assert.rejects(commitClashPerkMerge(sb,plan,{
  clanId:"fake",clanTag:tag,assertCurrent:()=>true
 }),/noch nicht auf dem Server verfügbar/);
 assert.equal(called,1);
});

test("clan switching or role loss before commit aborts without an RPC",async()=>{
 const {parseClashPerkSheets}=await xlsx();
 const {planClashPerkMerge,commitClashPerkMerge}=await db();
 const plan=planClashPerkMerge(parseClashPerkSheets([attackSheet([hit(1)])],tag),[]);
 let calls=0;
 await assert.rejects(commitClashPerkMerge({
  rpc(){calls++}
 },plan,{clanId:"fake",clanTag:tag,assertCurrent:()=>false}),/Clan gewechselt/);
 assert.equal(calls,0);
});

// Construct one tiny, completely self-contained deflate-compressed XLSX
// to test the actual ZIP/XML stack without publishing real player data.
function zip(parts){
 const local=[],central=[];let offset=0;
 for(const [name,contents] of Object.entries(parts)){
  const key=Buffer.from(name),plain=Buffer.from(contents,"utf8"),packed=deflateRawSync(plain);
  const l=Buffer.alloc(30);l.writeUInt32LE(0x04034b50,0);
  l.writeUInt16LE(20,4);l.writeUInt16LE(8,8);
  l.writeUInt32LE(packed.length,18);l.writeUInt32LE(plain.length,22);
  l.writeUInt16LE(key.length,26);
  local.push(l,key,packed);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);
  c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);
  c.writeUInt32LE(packed.length,20);c.writeUInt32LE(plain.length,24);
  c.writeUInt16LE(key.length,28);c.writeUInt32LE(offset,42);
  central.push(c,key);
  offset+=30+key.length+packed.length;
 }
 const cdir=Buffer.concat(central),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(central.length/2,8);
 end.writeUInt16LE(central.length/2,10);end.writeUInt32LE(cdir.length,12);
 end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,cdir,end]);
}
const sheetXml=values=>{
 const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
 const row=(cells,i)=>'<row r="'+(i+1)+'">'+cells.map((v,j)=>{
  let n=j+1,col="";while(n){col=String.fromCharCode(65+(n-1)%26)+col;n=Math.floor((n-1)/26)}
  return Number.isFinite(v)?
   '<c r="'+col+(i+1)+'"><v>'+v+'</v></c>':
   '<c r="'+col+(i+1)+'" t="inlineStr"><is><t>'+esc(v??"")+'</t></is></c>';
 }).join("")+"</row>";
 return '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
  "<sheetData>"+values.map(row).join("")+"</sheetData></worksheet>";
};
function book(values){
 return zip({
  "xl/workbook.xml":'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="United Fighters (#99JP2RL2)" sheetId="1" r:id="rId1"/></sheets></workbook>',
  "xl/_rels/workbook.xml.rels":'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  "xl/worksheets/sheet1.xml":sheetXml(values)
 });
}
function file(buffer){
 return {name:"sample.xlsx",size:buffer.length,
  arrayBuffer:async()=>buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength)};
}
test("real XLSX binary: ZIP central directory, native deflate, workbook relationships, worksheet cell types",async t=>{
 if(typeof DecompressionStream==="undefined"){t.skip("Node runtime lacks DecompressionStream");return}
 const {readClashPerkXlsx,parseClashPerkSheets}=await xlsx();
 const sheets=await readClashPerkXlsx(file(book([header,hit(1),hit(2)])));
 assert.equal(sheets.length,1);
 assert.equal(sheets[0].rows.length,3);
 const result=parseClashPerkSheets(sheets,tag);
 assert.equal(result.wars.length,2);
 assert.equal(result.attacks.length,2);
});
test("ZIP parser rejects macro content, invalid containers and formula-bearing sheets",async()=>{
 const {readClashPerkXlsx}=await xlsx();
 await assert.rejects(readClashPerkXlsx(file(Buffer.from("not a zip".repeat(30)))),/ZIP/);
 const valid=book([header,hit(1)]);
 const malicious=zip({"xl/vbaProject.bin":"bad","xl/workbook.xml":"<workbook/>"});
 await assert.rejects(readClashPerkXlsx(file(malicious)),/externe oder aktive Inhalte/);
 assert.ok(valid.length>100);
});
test("UI accepts several .xlsx files, retains JSON fallback and previews before any write",()=>{
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 const stats=fs.readFileSync(path.join(root,"cwl-stats.mjs"),"utf8");
 assert.match(html,/id="statsImportFile"[^>]*accept="[^"]*\.xlsx[^"]*\.json[^"]*" multiple/);
 assert.match(html,/\/export attack-log/);
 assert.match(html,/\/export missed/);
 assert.match(stats,/await readClashPerkXlsx\(files\[i\]\)/);
 assert.match(stats,/const plan=planClashPerkMerge\(parsed,old\)/);
 assert.match(stats,/if\(!await confirmAction\(summary/);
 assert.match(stats,/commitClashPerkMerge\(sb,plan/);
 assert.match(stats,/return importFile\(chosen\[0\]\)/);
 assert.doesNotMatch(stats,/\.limit\(200\)/);
});


test("finished history imports even if same ClashPerk export includes a live unconfirmed war",async()=>{
 const {parseClashPerkSheets}=await xlsx();
 const recent=hit(5);
 recent[22]=Math.floor((Date.now()-3600000-Date.UTC(1899,11,30))/86400000);
 const older=parseClashPerkSheets([attackSheet([hit(1),recent])],tag);
 assert.equal(older.wars.length,1);
 assert.equal(older.wars[0].finalized,true);
 assert.equal(older.ignoredRecentWars,1);
 assert.equal(older.attacks.length,1);
 assert.ok(older.warnings.some(w=>w.includes("ausgelassen")));
 assert.throws(()=>parseClashPerkSheets([attackSheet([recent])],tag),
  /nur noch laufende oder sehr neue Kriege/);
});

test("database rejects a late failure atomically; browser sends one RPC and never finalizes partial wars",async()=>{
 const {parseClashPerkSheets}=await xlsx();
 const {planClashPerkMerge,commitClashPerkMerge}=await db();
 const plan=planClashPerkMerge(parseClashPerkSheets([
  attackSheet([hit(7,1,1,"normal","#8PYL")]),missedSheet([ms(7,"#QPYL",2)])
 ],tag),[]);
 let calls=0;
 const sb={rpc:async()=>{calls++;return {data:null,error:{
  message:"late simulated SQL exception: transaction rolled back"
 }}},from(){throw Error("no direct writes")}};
 await assert.rejects(commitClashPerkMerge(sb,plan,{
  clanId:"fake",clanTag:tag,assertCurrent:()=>true
 }),/transaction rolled back/);
 assert.equal(calls,1);
});

test("sharedStrings XLSX structure used by real ClashPerk exports parses without any CDN library",async t=>{
 if(typeof DecompressionStream==="undefined"){t.skip("Node runtime lacks DecompressionStream");return}
 const {readClashPerkXlsx,parseClashPerkSheets}=await xlsx();
 const rows=[header,hit(1)];
 const strings=[],lookup=new Map();
 const cell=(v,ref)=>{
  if(typeof v==="number"&&Number.isFinite(v))
   return '<c r="'+ref+'"><v>'+v+'</v></c>';
  const value=String(v??"");
  if(!lookup.has(value)){lookup.set(value,strings.length);strings.push(value)}
  return '<c r="'+ref+'" t="s"><v>'+lookup.get(value)+'</v></c>';
 };
 const sheetRows=rows.map((row,ri)=>{
  const cells=row.map((v,j)=>{
   let n=j+1,c="";while(n){c=String.fromCharCode(65+(n-1)%26)+c;n=Math.floor((n-1)/26)}
   return cell(v,c+(ri+1));
  });
  return '<row r="'+(ri+1)+'">'+cells.join("")+'</row>';
 });
 const sh='<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+
  sheetRows.join("")+'</sheetData></worksheet>';
 const sst='<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
  strings.map(x=>'<si><t>'+x+'</t></si>').join("")+'</sst>';
 const parts={
  "xl/workbook.xml":'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="United Fighters (#99JP2RL2)" sheetId="1" r:id="rId1"/></sheets></workbook>',
  "xl/_rels/workbook.xml.rels":'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  "xl/sharedStrings.xml":sst,"xl/worksheets/sheet1.xml":sh
 };
 const sheets=await readClashPerkXlsx(file(zip(parts)));
 assert.equal(sheets[0].rows[0][0],"Tag");
 assert.equal(sheets[0].rows[1][17],"United Fighters");
 const parsed=parseClashPerkSheets(sheets,tag);
 assert.equal(parsed.wars.length,1);
 assert.equal(parsed.attacks.length,1);
 assert.equal(parsed.wars[0].finalized,true);
});


test("formerly hosted UF2 players keep historical attacks but are no longer current roster members",()=>{
 const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
 assert.match(sync,/memberTags:storage\.getProfile\(\)\?\.members\?\.filter\(m=>[\s\S]*?m\.cocSyncState!=="former"&&m\.cocSyncState!=="kept"\)/);
 const members=[
  {playerTag:"#8PYL",cocSyncState:"active"},
  {playerTag:"#QPYL",cocSyncState:"former"},
  {playerTag:"#2PYL",cocSyncState:"kept"}
 ];
 const activeTags=members.filter(m=>m.cocSyncState!=="former"&&m.cocSyncState!=="kept")
  .map(m=>m.playerTag);
 assert.deepEqual(activeTags,["#8PYL"]);
 // The attack history itself is separate and must not be filtered away.
 const historicalAttacks=[{attacker_tag:"#8PYL"},{attacker_tag:"#QPYL"},{attacker_tag:"#2PYL"}];
 assert.equal(historicalAttacks.length,3);
});


test("one real-world style Missed export covers both normal CW and CWL, with no second war_type export",async()=>{
 const {parseClashPerkSheets}=await xlsx();
 const sheets=[
  attackSheet([
   hit(201,1,1,"normal","#8PYL",3),
   hit(201,2,1,"normal","#8PYL",2),
   hit(202,1,1,"cwl","#8PYL",3)
  ]),
  missedSheet([
   ms(201,"#QPYL",2,"normal"),
   ms(202,"#QPYL",1,"cwl")
  ])
 ];
 const result=parseClashPerkSheets(sheets,tag);
 assert.equal(result.wars.length,2);
 assert.equal(result.attacks.length,3);
 assert.equal(result.missed.length,2);
 assert.equal(result.completeWars,2);
 assert.equal(result.missingWars,0);
 assert.deepEqual(result.wars.map(w=>w.war_type),["normal","cwl"]);
 assert.ok(result.wars.every(w=>w.missed_log_complete===true));
});
