"use strict";
// #269: genuine browser -> GoTrue password sign-in -> real PostgREST ->
// authorized atomic ClashPerk RPC -> visible statistics. No mocked database.
//
// Runs ONLY with explicit local Supabase flags. Test users / data are synthetic.
// Service role key never enters the browser. Real user data is never uploaded.
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {spawnSync}=require("node:child_process");
const {deflateRawSync}=require("node:zlib");
const {createServer}=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {chromium,webkit}=require("playwright");

const api=process.env.API_URL,anon=process.env.ANON_KEY,
 service=process.env.SERVICE_ROLE_KEY,db=process.env.DB_URL;
const CLAN="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TAG="#99JP2RL2";
const PASS="synthetic-browser-gotrue-only-2026";
const root=path.join(__dirname,"..");
const HEAD=["Tag","Name","Position","Town Hall","War ID","Attack Order",
 "Attacker Tag","Defender Tag","Stars","New Stars","Destruction","Defender Tag",
 "Defender Name","Defender Position","Defender TH","Attacker Home Clan","Clan Tag",
 "Clan Name","Clan League/Level","Enemy Clan Tag","Enemy Clan Name",
 "Enemy Clan League/Level","War Start Time","Team Size","War Type"];
const MISSED_HEAD=["Name","Tag","Clan","Enemy Clan","War ID","Ended",
 "War Type","Team Size","Missed"];

function assertLocal(){
 const allowedHost=/^https?:\/\/(?:localhost|127\.0\.0\.1):\d+$/;
 if(!allowedHost.test(api||"")||
    !/^postgres(?:ql)?:\/\/[^@]+@(?:127\.0\.0\.1|localhost):\d+\//.test(db||"")||
    !anon||!service)throw Error("Refusing remote/production credentials in browser UAT");
}
async function adminCreate(email){
 const res=await fetch(api+"/auth/v1/admin/users",{
  method:"POST",
  headers:{apikey:service,Authorization:"Bearer "+service,
   "Content-Type":"application/json"},
  body:JSON.stringify({email,password:PASS,email_confirm:true})
 });
 const json=await res.json();
 if(!res.ok||!json.id)throw Error("Unable to create local synthetic user "+res.status);
 assert.match(json.id,/^[a-f0-9-]{36}$/i);
 return json.id;
}
function setMembership(ownerId,viewerId){
 const id=x=>{assert.match(x,/^[a-f0-9-]{36}$/i);return x};
 const statement="INSERT INTO public.cwl_clan_memberships (clan_id,user_id,role) VALUES "+
   "('"+CLAN+"','"+id(ownerId)+"','owner'),"+
   "('"+CLAN+"','"+id(viewerId)+"','viewer')";
 const result=spawnSync("psql",[db,"-X","-v","ON_ERROR_STOP=1","-qAt",
  "-c",statement],{encoding:"utf8",timeout:15000});
 if(result.status!==0)throw Error("Local membership seeding failed");
}
const xml=s=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;")
 .replaceAll(">","&gt;").replaceAll('"',"&quot;");
function zip(parts){
 const local=[],central=[];let offset=0;
 for(const [filename,text] of Object.entries(parts)){
  const name=Buffer.from(filename),payload=Buffer.from(text,"utf8");
  const deflated=deflateRawSync(payload);
  const a=Buffer.alloc(30);a.writeUInt32LE(0x04034b50,0);
  a.writeUInt16LE(20,4);a.writeUInt16LE(8,8);
  a.writeUInt32LE(deflated.length,18);a.writeUInt32LE(payload.length,22);
  a.writeUInt16LE(name.length,26);
  const b=Buffer.alloc(46);b.writeUInt32LE(0x02014b50,0);
  b.writeUInt16LE(20,4);b.writeUInt16LE(20,6);b.writeUInt16LE(8,10);
  b.writeUInt32LE(deflated.length,20);b.writeUInt32LE(payload.length,24);
  b.writeUInt16LE(name.length,28);b.writeUInt32LE(offset,42);
  local.push(a,name,deflated);central.push(b,name);
  offset+=a.length+name.length+deflated.length;
 }
 const cd=Buffer.concat(central),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);
 end.writeUInt16LE(central.length/2,8);end.writeUInt16LE(central.length/2,10);
 end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,cd,end]);
}
function xlsx(rows,sheetName){
 const values=[],map=new Map();
 const cell=(v,ref)=>{
  if(typeof v==="number")return '<c r="'+ref+'"><v>'+v+'</v></c>';
  v=String(v??"");if(!map.has(v)){map.set(v,values.length);values.push(v)}
  return '<c r="'+ref+'" t="s"><v>'+map.get(v)+'</v></c>';
 };
 const sheetRows=rows.map((row,i)=>'<row r="'+(i+1)+'">'+
  row.map((v,j)=>{
   let column="",n=j+1;
   while(n){column=String.fromCharCode(65+(n-1)%26)+column;n=Math.floor((n-1)/26)}
   return cell(v,column+(i+1));
  }).join("")+'</row>').join("");
 return zip({
  "xl/workbook.xml":'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+xml(sheetName)+'" sheetId="1" r:id="rId1"/></sheets></workbook>',
  "xl/_rels/workbook.xml.rels":'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  "xl/sharedStrings.xml":'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+values.map(t=>'<si><t>'+xml(t)+'</t></si>').join("")+'</sst>',
  "xl/worksheets/sheet1.xml":'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+sheetRows+'</sheetData></worksheet>'
 });
}
function attack(id,order){
 return ["#8PYL","Synthetic Attacker",1,18,id,order,"#8PYL","#2PYL",
  order===1?3:2,order===1?3:2,order===1?100:86,
  "#2PYL","Synthetic Defender",1,18,1,TAG,"United Fighters",
  "Master I","#2QPYL","Synthetic Enemy","Master I",46000+id,2,"Regular"];
}
const missed=id=>["Synthetic Missing","#QPYL","United Fighters",
 "Synthetic Enemy",id,46000+id+2,"Regular",2,2];
const files=()=>[
 {name:"attack-log-Regular.xlsx",
  mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  buffer:xlsx([HEAD,attack(321,1),attack(321,2),attack(322,1)],
   "United Fighters (#99JP2RL2)")},
 {name:"missed-Regular.xlsx",
  mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  buffer:xlsx([MISSED_HEAD,missed(321)],"Missed Attacks")}
];
const server=()=>createServer((req,res)=>{
 const pathName=new URL(req.url||"/","http://localhost").pathname.slice(1);
 if(pathName==="cloud-sync.mjs"){
  res.writeHead(200,{"Content-Type":"text/javascript"});res.end("export {};");return;
 }
 if(pathName==="cloud-app.html"||/^[a-z0-9-]+\.mjs$/.test(pathName)){
  const file=path.join(root,pathName);
  if(fs.existsSync(file)){
   res.writeHead(200,{"Content-Type":pathName.endsWith(".html")?"text/html":"text/javascript"});
   res.end(fs.readFileSync(file));return;
  }
 }
 res.writeHead(404);res.end();
});

async function preparePage(page,email,role,base){
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(base+"/cloud-app.html",{waitUntil:"domcontentloaded"});
 // All token generation/signing happens on the actual local GoTrue server,
 // in the same browser session as the subsequent original-looking XLSX upload.
 const initial=await page.evaluate(async({api,anon,email,password,role,clan,tag})=>{
  const response=await fetch(api+"/auth/v1/token?grant_type=password",{
   method:"POST",headers:{"Content-Type":"application/json",apikey:anon},
   body:JSON.stringify({email,password})
  });
  if(!response.ok)throw Error("Browser GoTrue login failed: "+response.status);
  const session=await response.json();
  if(!session?.access_token||!session.user?.id)
   throw Error("No GoTrue session returned");
  window.testRpcCalls=0;
  window.testConfirmations=[];
  window.testApproves=true;
  window.testRole=role;window.testClashTag=tag;window.testClanId=clan;
  const token=session.access_token;

  // This adapter uses ACTUAL HTTP PostgREST; none of the statistics or RPC
  // calls are mocked. It implements just the query-builder methods consumed
  // by cwl-stats.mjs so the real module and native upload UI can run.
  function headers(){return {
   Authorization:"Bearer "+token,apikey:anon,
   "Content-Type":"application/json"
  }}
  async function query(table,q){
   const result=await fetch(api+"/rest/v1/"+table+"?"+q.toString(),{headers:headers()});
   const value=await result.json();
   return result.ok?{data:value,error:null}:
    {data:null,error:{code:value.code,message:value.message}};
  }
  const sb={
   from(table){
    const q=new URLSearchParams(),sort=[];
    return {
     select(fields){q.set("select",fields);return this},
     eq(key,value){q.append(key,"eq."+value);return this},
     order(column,{ascending=true}={}){sort.push(column+(ascending?".asc":".desc"));return this},
     range(start,end){
      if(sort.length)q.set("order",sort.join(","));
      q.set("limit",String(end-start+1));q.set("offset",String(start));
      return query(table,q)
     },
     limit(n){
      if(sort.length)q.set("order",sort.join(","));
      q.set("limit",String(n));return query(table,q)
     }
    };
   },
   async rpc(name,args){
    window.testRpcCalls++;
    const response=await fetch(api+"/rest/v1/rpc/"+name,{
     method:"POST",headers:headers(),body:JSON.stringify(args)
    });
    const value=await response.json();
    return response.ok?{data:value,error:null}:
     {data:null,error:{code:value.code,message:value.message}};
   }
  };
  window.testSb=sb;
  document.body.classList.add("cloud-mode");
  document.querySelectorAll(".view.active").forEach(e=>e.classList.remove("active"));
  document.getElementById("view-stats").classList.add("active");
  const {createCloudStats}=await import("./cwl-stats.mjs?v=browser-gotrue-uat");
  window.testStats=createCloudStats({
   sb,
   context:()=>({
    active:true,clanId:window.testClanId,clanTag:window.testClashTag,
    role:window.testRole,memberTags:["#8PYL"],memberProfiles:[]
   }),
   notify:()=>{},
   confirmAction:async message=>{
    window.testConfirmations.push(message);return window.testApproves
   }
  });
  await window.testStats.load();
  return {loggedIn:session.user.id,role};
 },{api,anon,email,password:PASS,role,clan:CLAN,tag:TAG});
 assert.match(initial.loggedIn,/^[a-f0-9-]{36}$/i);
 return errors;
}

async function upload(page,items,expected){
 await page.locator("#statsImportFile").setInputFiles(items);
 await page.waitForFunction(expected,null,{timeout:45000});
 await page.waitForFunction(()=>!document.getElementById("statsImportButton").disabled);
 return page.evaluate(()=>({
  feedback:document.getElementById("statsFeedback").textContent,
  calls:window.testRpcCalls,confirmations:[...window.testConfirmations],
  width:document.documentElement.scrollWidth,viewport:innerWidth
 }));
}

async function currentRows(page,table){
 return page.evaluate(async table=>{
  const q=await window.testSb.from(table).select("*")
   .eq("clan_id",window.testClanId).range(0,100);
  if(q.error)throw Error(q.error.message);
  // The preceding GoTrue HTTP UAT shares this isolated database and has
  // already inserted its own synthetic cp:720 war. Check ONLY the two wars
  // uploaded by this browser, never assume the local DB starts empty.
  return q.data.filter(row=>["cp:321","cp:322"].includes(row.war_key));
 },table);
}

if(process.env.CWL_LOCAL_BROWSER_AUTH_UAT==="1"){
test("Chromium/WebKit actual GoTrue login -> native Excel -> confirmed atomic PostgREST -> rendered stats",{
 timeout:180000
},async()=>{
 assertLocal();
 const engine=process.env.CWL_TEST_BROWSER==="webkit"?webkit:chromium;
 const ownEmail="browser-owner-"+(process.env.CWL_TEST_BROWSER||"chromium")+"@synth-clashperk.invalid";
 const viewEmail="browser-viewer-"+(process.env.CWL_TEST_BROWSER||"chromium")+"@synth-clashperk.invalid";
 const [ownerId,viewerId]=await Promise.all([
  adminCreate(ownEmail),adminCreate(viewEmail)
 ]);
 setMembership(ownerId,viewerId);
 const staticApp=server();await new Promise(ok=>staticApp.listen(0,"127.0.0.1",ok));
 const browser=await engine.launch({
  headless:true,
  ...(engine===chromium?{args:["--no-sandbox"]}:{})
 });
 try{
  const url="http://127.0.0.1:"+staticApp.address().port;
  for(const width of [390,1366]){
   const page=await browser.newPage({viewport:{width,height:820}});
   try{
    const errors=await preparePage(page,ownEmail,"owner",url);
    assert.equal(await page.locator("#statsImportButton").isVisible(),true);
    const result=await upload(page,files(),
     "()=>/✓.*(?:neue Kriege|eigene Angriffe)/.test(document.getElementById('statsFeedback').textContent)");
    assert.equal(result.calls,1,"Exactly one real PostgREST RPC");
    assert.match(result.confirmations[0],/2 normale CWs/);
    assert.match(result.confirmations[0],/Vollständig belegte Kriege: 1/);
    assert.equal(result.width<=result.viewport+2,true,"No horizontal overflow");
    assert.equal((await currentRows(page,"cwl_stat_wars")).length,2);
    const hits=await currentRows(page,"cwl_stat_attacks");
    assert.equal(hits.length,3,"Player attack events are persisted");
    const missed=await currentRows(page,"cwl_stat_missed");
    assert.equal(missed.length,1,"Missed evidence remains visible and separate");
    assert.equal((await currentRows(page,"cwl_stat_wars"))
     .find(w=>w.war_key==="cp:321").missed_log_complete,true);
    assert.equal((await currentRows(page,"cwl_stat_wars"))
     .find(w=>w.war_key==="cp:322").missed_log_complete,false);
    assert.deepEqual(errors,[],"Browser javascript errors");
   }finally{await page.close()}
  }
  // Separate browser session, valid GoTrue token, but viewer cannot import.
  const viewer=await browser.newPage({viewport:{width:390,height:820}});
  try{
   const errors=await preparePage(viewer,viewEmail,"viewer",url);
   assert.equal(await viewer.locator("#statsImportButton").isVisible(),false);
   const result=await upload(viewer,files(),
     "()=>/Nur Besitzer und Vize/.test(document.getElementById('statsFeedback').textContent)");
   assert.equal(result.calls,0,"Viewer client does not attempt import RPC");
   assert.equal((await currentRows(viewer,"cwl_stat_wars")).length,2,
    "Viewer may read own clan's history");
   assert.deepEqual(errors,[]);
  }finally{await viewer.close()}
 }finally{
  await browser.close();
  await new Promise(ok=>staticApp.close(ok));
 }
});
}
