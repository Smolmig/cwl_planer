#!/usr/bin/env node
"use strict";
// Standalone, synthetic-only HTML from the existing tested fixture. No
// Cloud client, credentials, network, local storage, or production publish.
const fs=require("node:fs"),path=require("node:path"),{buildSync}=require("esbuild");
const root=path.resolve(__dirname,".."),out=process.argv[2];
if(!out||!path.isAbsolute(out)||path.extname(out)!==".html"||fs.existsSync(out))
 throw Error("Specify a new absolute HTML filename outside the repository");
const rel=path.relative(root,path.resolve(out));
if(!rel.startsWith(".."+path.sep))throw Error("Output must be outside repository");
const source=fs.readFileSync(path.join(root,"tests/fixtures/strategic-preview.html"),"utf8");
const core=fs.readFileSync(path.join(root,"cwl-planning-core.js"),"utf8");
const bundle=buildSync({entryPoints:[path.join(root,"tests/fixtures/strategic-preview.mjs")],bundle:true,platform:"browser",format:"iife",write:false,metafile:true,absWorkingDir:root});
const allow=new Set(["tests/fixtures/strategic-preview.mjs","cwl-strategic-experiment.mjs","cwl-strategic-daily.mjs","cwl-strategic-targets.mjs","cwl-strategic-presentation.mjs"]);
if(Object.keys(bundle.metafile.inputs).some(f=>!allow.has(f)))throw Error("Unexpected demo dependency");
const escapeScript=s=>s.replace(/<\/script/gi,"<\\/script");
const marker='<script src="../../cwl-planning-core.js"></script><script type="module" src="./strategic-preview.mjs"></script>';
if(source.split(marker).length!==2||!source.includes("TESTVORSCHAU · FIKTIVE DATEN"))throw Error("Fixture changed");
const csp='<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; connect-src \'none\'; base-uri \'none\'; form-action \'none\'">';
const html=source.replace("<head>","<head>"+csp).replace(marker,"<script>"+escapeScript(core)+"</script><script>"+escapeScript(bundle.outputFiles[0].text)+"</script>");
if(/supabase\.co|sb_publishable_|sb_secret_|<script[^>]+src=/i.test(html))throw Error("Unexpected external binding in demonstration");
fs.writeFileSync(out,html,{flag:"wx",mode:0o600});
console.log("Synthetic single-file demo written; no network or credentials.");
