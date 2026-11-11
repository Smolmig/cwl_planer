"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const read=pathName=>fs.readFileSync(path.join(root,pathName),"utf8");

function parts(version){
 const match=/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
 assert.ok(match,"stable SemVer required: "+version);
 return match.slice(1).map(Number);
}
function actualType(current,previous){
 const [ma,mi,pa]=parts(current),[oldMa,oldMi,oldPa]=parts(previous);
 if(ma===oldMa+1&&mi===0&&pa===0)return "major";
 if(ma===oldMa&&mi===oldMi+1&&pa===0)return "minor";
 if(ma===oldMa&&mi===oldMi&&pa===oldPa+1)return "patch";
 return null;
}
test("newest Cloud release records a matching SemVer bump type",async()=>{
 const manifest=JSON.parse(read("cloud-version.json"));
 const {releaseHistory}=await import(pathToFileURL(path.join(root,"cloud-release-history.mjs")).href);
 assert.equal(releaseHistory[0].version,manifest.version);
 assert.ok(releaseHistory.length>1,"requires prior release for comparison");
 assert.ok(["patch","minor","major"].includes(releaseHistory[0].releaseType),
  "the newest release must declare its change type");
 const expected=actualType(releaseHistory[0].version,releaseHistory[1].version);
 assert.equal(releaseHistory[0].releaseType,expected,
  "releaseType must match numeric bump; feature-vs-fix semantics still require PR review");
});
test("release process requires a human-reviewed classification and avoids history rewrites",()=>{
 const policy=read("VERSIONING.md");
 const template=read(".github/PULL_REQUEST_TEMPLATE.md");
 assert.match(policy,/Der Inhalt eines Releases bestimmt den Versionssprung/);
 assert.match(policy,/Neue Funktionen nicht als PATCH|neue eigenständige, rückwärtskompatible App-Funktion/i);
 assert.match(template,/Versionsentscheidung für die Cloud-App/);
 assert.match(template,/MINOR/);
 assert.match(template,/Hilfe-Seite/);
});
