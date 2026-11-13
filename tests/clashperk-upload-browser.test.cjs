"use strict";
// Real Chromium upload -> original-looking XLSX ZIP with sharedStrings.xml,
// live statistics DOM, owner confirmation, and a mocked single Supabase RPC.
// These fixtures are fully synthetic. Never commit real player exports.
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {deflateRawSync}=require("node:zlib");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const serve=()=>http.createServer((req,res)=>{
 const name=new URL(req.url||"/","http://localhost").pathname.slice(1);
 if(name==="cloud-sync.mjs"){
  res.writeHead(200,{"Content-Type":"text/javascript"});res.end("export {};");return;
 }
 if(name==="cloud-app.html"||name==="cwl-planning-core.js"||
    /^[a-z0-9-]+\.mjs$/.test(name)){
  const file=path.join(root,name);
  if(fs.existsSync(file)){
   res.writeHead(200,{"Content-Type":name.endsWith(".html")?"text/html":"text/javascript"});
   res.end(fs.readFileSync(file));return;
  }
 }
 res.writeHead(404);res.end("");
});
const esc=s=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;")
 .replaceAll(">","&gt;").replaceAll('"',"&quot;");
function zip(parts){
 let offset=0;const local=[],central=[];
 for(const [name,contents] of Object.entries(parts)){
  const key=Buffer.from(name),plain=Buffer.from(contents,"utf8");
  const compressed=deflateRawSync(plain);
  const a=Buffer.alloc(30);a.writeUInt32LE(0x04034b50,0);
  a.writeUInt16LE(20,4);a.writeUInt16LE(8,8);
  a.writeUInt32LE(compressed.length,18);a.writeUInt32LE(plain.length,22);
  a.writeUInt16LE(key.length,26);
  local.push(a,key,compressed);
  const b=Buffer.alloc(46);b.writeUInt32LE(0x02014b50,0);
  b.writeUInt16LE(20,4);b.writeUInt16LE(20,6);b.writeUInt16LE(8,10);
  b.writeUInt32LE(compressed.length,20);b.writeUInt32LE(plain.length,24);
  b.writeUInt16LE(key.length,28);b.writeUInt32LE(offset,42);
  central.push(b,key);
  offset+=a.length+key.length+compressed.length;
 }
 const cd=Buffer.concat(central),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);
 end.writeUInt16LE(central.length/2,8);end.writeUInt16LE(central.length/2,10);
 end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,cd,end]);
}
function workbook(rows,sheetName){
 const strings=[],lookup=new Map();
 const cell=(value,ref)=>{
  if(typeof value==="number"&&Number.isFinite(value))
   return '<c r="'+ref+'"><v>'+value+'</v></c>';
  const v=String(value??"");
  if(!lookup.has(v)){lookup.set(v,strings.length);strings.push(v)}
  return '<c r="'+ref+'" t="s"><v>'+lookup.get(v)+'</v></c>';
 };
 const xmlRows=rows.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((value,j)=>{
  let col="",n=j+1;
  while(n){col=String.fromCharCode(65+(n-1)%26)+col;n=Math.floor((n-1)/26)}
  return cell(value,col+(i+1));
 }).join("")+'</row>').join("");
 const parts={
  "xl/workbook.xml":'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+esc(sheetName)+'" sheetId="1" r:id="rId1"/></sheets></workbook>',
  "xl/_rels/workbook.xml.rels":'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  "xl/sharedStrings.xml":'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+strings.map(x=>'<si><t>'+esc(x)+'</t></si>').join("")+'</sst>',
  "xl/worksheets/sheet1.xml":'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+xmlRows+'</sheetData></worksheet>'
 };
 return zip(parts);
}
const head=["Tag","Name","Position","Town Hall","War ID","Attack Order",
 "Attacker Tag","Defender Tag","Stars","New Stars","Destruction","Defender Tag",
 "Defender Name","Defender Position","Defender TH","Attacker Home Clan","Clan Tag",
 "Clan Name","Clan League/Level","Enemy Clan Tag","Enemy Clan Name",
 "Enemy Clan League/Level","War Start Time","Team Size","War Type"];
const missedHead=["Name","Tag","Clan","Enemy Clan","War ID","Ended","War Type","Team Size","Missed"];
const ownTag="#99JP2RL2";
function attack(id,order=1,options={}){
 const {clan=ownTag,stars=3,player="#8PYL",type="Regular"}=options;
 return [player,"Synthetic Member",1,18,id,order,player,"#2PYL",stars,stars,
  stars===3?100:92,"#2PYL","Synthetic Enemy",1,18,1,clan,
  "United Fighters","Master I","#2QPYL","Enemy","Master I",46000+id,2,type];
}
const aFile=(rows,filename="regular.xlsx")=>({name:filename,
 mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
 buffer:workbook([head,...rows],"United Fighters (#99JP2RL2)")});
const mFile=(rows)=>({name:"missed.xlsx",
 mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
 buffer:workbook([missedHead,...rows],"Missed Attacks")});
const missed=(id,player="#QPYL",count=2)=>[
 "Synthetic Missing",player,"United Fighters","Enemy",id,46000+id+2,
 "Regular",2,count
];
async function setup(page,base,role="owner"){
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(base+"/cloud-app.html",{waitUntil:"domcontentloaded"});
 await page.evaluate(async role=>{
  document.body.classList.add("cloud-mode");
  document.querySelectorAll(".view.active").forEach(x=>x.classList.remove("active"));
  document.getElementById("view-stats").classList.add("active");
  const {createCloudStats}=await import("./cwl-stats.mjs?v=browser-xlsx-uat");
  window.testRole=role;
  window.testClan="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  window.testClash="#99JP2RL2";
  window.testAccept=true;window.testConfirmations=[];window.testCalls=[];
  window.testWars=[];window.testAttacks=[];window.testMissed=[];
  window.testNotices=[];
  const sb={
   from(name){
    const data=name==="cwl_stat_wars"?window.testWars:
      name==="cwl_stat_attacks"?window.testAttacks:
      name==="cwl_stat_missed"?window.testMissed:[];
    return {select(){return this},eq(){return this},order(){return this},
     limit(){return Promise.resolve({data,error:null})},
     range(first,last){return Promise.resolve({data:data.slice(first,last+1),error:null})}};
   },
   async rpc(name,args){
    window.testCalls.push({name,args});
    if(window.testRpcError)return {data:null,error:{
      code:"PGRST202",message:"RPC not installed"
    }};
    if(name!=="cwl_import_clashperk_atomic")throw Error("Unexpected RPC "+name);
    const p=args.p_payload;
    for(const w of p.wars)if(!window.testWars.some(x=>x.war_key===w.war_key))
      window.testWars.push({...w,source:"import",finalized:true,
       missed_log_complete:false,roster_tags:null});
    for(const a of p.attacks)if(!window.testAttacks.some(x=>x.war_key===a.war_key&&
      x.attacker_tag===a.attacker_tag&&x.attack_order===a.attack_order))
      window.testAttacks.push(a);
    for(const m of p.missed)if(!window.testMissed.some(x=>x.war_key===m.war_key&&
      x.player_tag===m.player_tag))window.testMissed.push(m);
    return {data:{inserted:p.wars.length,extended:0,attacks:p.attacks.length,
      missed:p.missed.length,completeWars:0,skippedApi:0},error:null};
   }
  };
  window.testStats=createCloudStats({
   sb,context:()=>({active:true,clanId:window.testClan,
    clanTag:window.testClash,role:window.testRole,memberTags:["#8PYL"],
    memberProfiles:[]}),
   notify:x=>window.testNotices.push(x),
   confirmAction:async(text)=>{window.testConfirmations.push(text);return window.testAccept}
  });
  await window.testStats.load();
 },role);
 return errors;
}
async function upload(page,files){
 await page.locator("#statsImportFile").setInputFiles(files);
 await page.waitForFunction(()=>!document.getElementById("statsImportButton").disabled);
 return page.evaluate(()=>({
  feedback:document.querySelector("#statsFeedback").textContent,
  confirmations:[...window.testConfirmations],
  calls:window.testCalls.length,
  wars:window.testWars.length,attacks:window.testAttacks.length,
  misses:window.testMissed.length,
  scrollWidth:document.documentElement.scrollWidth,
  viewport:innerWidth,
  importVisible:!document.getElementById("statsImportButton").hidden
 }));
}

test("Real Chromium: 2-war XLSX + Missed XLSX follows the visible owner upload, confirmation and one-RPC path",{
 timeout:120000
},async()=>{
 const server=serve();await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [390,1366]){
   const page=await browser.newPage({viewport:{width,height:820}});
   try{
    const errors=await setup(page,"http://127.0.0.1:"+server.address().port);
    assert.equal(await page.locator("#statsImportButton").isVisible(),true);
    const p=await upload(page,[
     aFile([attack(301,1),attack(301,2),attack(302,1)],"attack-log-regular.xlsx"),
     mFile([missed(301)])
    ]);
    assert.equal(p.calls,1);
    assert.equal(p.wars,2);
    assert.equal(p.attacks,3);
    assert.equal(p.misses,1);
    assert.match(p.feedback,/✓ .*2 neue Kriege.*3 eigene Angriffe/);
    assert.match(p.confirmations[0],/2 Kriege/);
    assert.match(p.confirmations[0],/1 lückenlos belegte Kriege/);
    assert.ok(p.scrollWidth<=p.viewport+2,"Upload causes horizontal overflow at "+width);
    assert.equal(errors.length,0,errors.join("\n"));
   }finally{await page.close()}
  }
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});

test("Real Chromium: cancelling preview, switching clan, viewer role and missing RPC never create an upload",{
 timeout:120000
},async()=>{
 const server=serve();await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:390,height:820}});
  try{
   const errors=await setup(page,"http://127.0.0.1:"+server.address().port);
   await page.evaluate(()=>{window.testAccept=false});
   let p=await upload(page,[aFile([attack(311)])]);
   assert.equal(p.calls,0);assert.match(p.feedback,/Import abgebrochen/);
   await page.evaluate(()=>{window.testAccept=true;window.testClash="#2JGC2J8VG"});
   p=await upload(page,[aFile([attack(311)])]);
   assert.equal(p.calls,0);assert.match(p.feedback,/Importfehler:.*anderen Clan/);
   // No user data is written if the server side RPC is not yet deployed.
   await page.evaluate(()=>{window.testClash="#99JP2RL2";window.testRpcError=true});
   p=await upload(page,[aFile([attack(311)])]);
   assert.equal(p.calls,1);assert.match(p.feedback,/noch nicht auf dem Server verfügbar/);
   await page.evaluate(()=>{window.testRole="viewer";window.testStats.render()});
   assert.equal(await page.locator("#statsImportButton").isVisible(),false);
   p=await upload(page,[aFile([attack(311)])]);
   assert.equal(p.calls,1);assert.match(p.feedback,/Nur Besitzer und Vize/);
   assert.equal(errors.length,0,errors.join("\n"));
  }finally{await page.close()}
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});
