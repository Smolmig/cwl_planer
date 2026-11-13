#!/usr/bin/env node
"use strict";
// Build a STATIC staging-only preview of the Cloud app. No network or DB access.
// Mandatory: separate Supabase hosted project, synthetic accounts/data only.
// Never point this preview at the production Supabase URL or publishable key.
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const outArg=process.argv[2];
const stagingUrl=process.env.CWL_STAGING_SUPABASE_URL||"";
const stagingKey=process.env.CWL_STAGING_PUBLISHABLE_KEY||"";
function refuse(message){throw Error("Staging-Preview abgebrochen: "+message)}

if(!outArg||!path.isAbsolute(outArg))refuse("Absoluten Zielordner als Argument angeben.");
const output=path.resolve(outArg);
const relative=path.relative(root,output);
if(!relative.startsWith(".."+path.sep)&&relative!=="..")
 refuse("Der Zielordner muss außerhalb des Git-Repositories liegen.");
if(fs.existsSync(output))refuse("Zielordner existiert bereits; nichts überschreiben.");
const liveSync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const prodUrl=/const SUPABASE_URL="(https:\/\/[a-z0-9]+\.supabase\.co)";/.exec(liveSync)?.[1];
const prodKey=/const SUPABASE_PUBLISHABLE_KEY="(sb_publishable_[A-Za-z0-9_-]+)";/.exec(liveSync)?.[1];
if(!prodUrl||!prodKey)refuse("Produktive Projektkennung im Originalmodul nicht eindeutig erkennbar.");
const productionRef=new URL(prodUrl).hostname.split(".")[0];

let target;
try{target=new URL(stagingUrl)}catch{refuse("Ungültige Staging-URL.");}
const ref=/^([a-z0-9]{16,32})\.supabase\.co$/.exec(target.hostname)?.[1];
if(!ref||target.protocol!=="https:"||target.port||target.username||target.password||
 target.pathname!=="/"||target.search||target.hash||
 stagingUrl!==target.origin)
 refuse("Nur die exakte HTTPS-URL eines separaten gehosteten Supabase-Projekts zulässig.");
if(ref===productionRef||stagingUrl===prodUrl)
 refuse("Produktives Supabase-Projekt darf niemals als Staging verwendet werden.");
if(!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(stagingKey)||stagingKey===prodKey)
 refuse("Eigenen öffentlichen Staging-Publishable-Key angeben; keine Secret-/Live-Keys.");
const textExtensions=new Set([".mjs",".js",".svg",".webmanifest"]);
const staticExtensions=new Set([".png"]);
const copyNames=fs.readdirSync(root,{withFileTypes:true})
 .filter(entry=>entry.isFile()&&(
   textExtensions.has(path.extname(entry.name))||
   staticExtensions.has(path.extname(entry.name))||
   entry.name==="cloud-version.json"
 )).map(entry=>entry.name);
copyNames.push("cloud-app.html");
const staged=new Map();
for(const name of copyNames){
 const raw=fs.readFileSync(path.join(root,name));
 if(staticExtensions.has(path.extname(name))){
  staged.set(name,raw);continue;
 }
 let src=raw.toString("utf8");
 // Replace the public URL/key and auth-storage project ref, including the
 // returning-user splash check in cloud-app.html.
 src=src.replaceAll(prodUrl,stagingUrl).replaceAll(prodKey,stagingKey)
        .replaceAll(productionRef,ref);
 if(name==="cloud-app.html"){
  const watermark='<style id="cwl-staging-style">#cwl-staging-watermark{position:fixed;z-index:2147483647;top:calc(4px + env(safe-area-inset-top));right:calc(4px + env(safe-area-inset-right));background:#7f1d1d;color:#fff;border:2px solid #fff;border-radius:7px;font:700 11px system-ui;padding:5px 7px;pointer-events:none;box-shadow:0 2px 8px #0007}</style>';
  if(!src.includes("</head>")||!src.includes("<body>"))
   refuse("Cloud HTML unerwartet; Testkennzeichnung kann nicht sicher eingefügt werden.");
  src=src.replace("</head>",watermark+"</head>")
   .replace("<body>",'<body><div id="cwl-staging-watermark" role="status">TESTUMGEBUNG · Keine Echtdaten</div>')
   .replace("<title>CWL Planer</title>","<title>CWL Planer · TEST</title>");
  // Production Cloud intentionally skips SW registration on cloud-app.html.
  // The isolated test PWA must register its OWN network-only worker so the
  // installation/scope can be verified in a real browser without stale caches.
  const skipCloudWorker='if(location.pathname.endsWith("/cloud-app.html"))return;';
  if(!src.includes(skipCloudWorker))refuse("Cloud Service-Worker-Startpunkt nicht gefunden.");
  src=src.replace(skipCloudWorker,
   'if(location.pathname.endsWith("/cloud-app.html")){ '+
   'swRegistration=await navigator.serviceWorker.register("./service-worker.js"); return; }');
 }
 if(name==="cloud-manifest.webmanifest"){
  const manifest=JSON.parse(src);
  manifest.name="CWL Planer – TESTUMGEBUNG";
  manifest.short_name="CWL TEST";
  manifest.description="Isolierter ClashPerk-Test. Keine Echtdaten.";
  src=JSON.stringify(manifest,null,2)+"\n";
 }
 if(name==="service-worker.js"){
  // The regular SW belongs to the independent offline planner: it precaches
  // index.html and otherwise can make a staging install fail or appear stale.
  // Staging Cloud remains intentionally online-only, without cached writes.
  src='// Staging-only, online-only service worker. No planner cache.\\n'+
      'self.addEventListener("install",()=>self.skipWaiting());\\n'+
      'self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));\\n'+
      'self.addEventListener("fetch",e=>{\\n'+
      ' if(e.request.method!=="GET")return;\\n'+
      ' if(new URL(e.request.url).origin!==self.location.origin)return;\\n'+
      ' e.respondWith(fetch(e.request,{cache:"no-store"}));\\n'+
      '});\\n';
  src=src.replaceAll("\\n","\n");
 }
 if(src.includes(prodUrl)||src.includes(prodKey)||src.includes(productionRef))
  refuse("Produktive Supabase-Kennung in "+name+" verblieben.");
 staged.set(name,Buffer.from(src,"utf8"));
}
const sync=staged.get("cloud-sync.mjs").toString("utf8");
if(!sync.includes('const SUPABASE_URL="'+stagingUrl+'";')||
 !sync.includes('const SUPABASE_PUBLISHABLE_KEY="'+stagingKey+'";'))
 refuse("Staging-Projektkonfiguration nicht durchgängig ersetzt.");
fs.mkdirSync(output,{recursive:true,mode:0o700});
try{
 for(const [name,contents] of staged)
  fs.writeFileSync(path.join(output,name),contents,{mode:0o600});
}catch(error){
 fs.rmSync(output,{recursive:true,force:true});
 throw error;
}
// Never print publishable/secret values, real player data or private exports.
console.log("Staging-Preview erzeugt: "+staged.size+" statische Dateien; Ziel: "+output);
console.log("Nur synthetische Testkonten; per HTTPS auf einer getrennten Test-Origin hosten.");
