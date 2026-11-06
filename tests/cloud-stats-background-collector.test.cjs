"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {webcrypto}=require("node:crypto");
const root=path.resolve(__dirname,".."),fn="supabase/functions/coc-stats-collector";
const importCore=()=>import("file://"+path.join(root,fn,"collector-core.mjs"));
const importAuth=()=>import("file://"+path.join(root,fn,"collector-auth.mjs"));
const own="#PYL",other="#2PYL";
const sample=(state="warEnded")=>({
 state,teamSize:1,startTime:"20261101T190000.000Z",endTime:"20261102T190000.000Z",
 clan:{tag:own,name:"Our clan",members:[{
   tag:"#8PYL",name:"Attack One",townhallLevel:18,
   attacks:[{attackerTag:"#8PYL",defenderTag:"#QPYL",order:17,
     stars:3,destructionPercentage:100}]
 }]},
 opponent:{tag:other,name:"Enemy",members:[{
   tag:"#QPYL",name:"Base One",townhallLevel:17
 }]}
});
const now=Date.parse("2026-11-06T08:00:00Z");

test("normal CW archived only with real complete rosters, no fabricated misses",async()=>{
 const {buildWarSnapshot,clashDate}=await importCore();
 assert.equal(clashDate("20261101T190000.000Z"),"2026-11-01T19:00:00.000Z");
 const result=buildWarSnapshot(sample(),own,{now});
 assert.equal(result.war.war_key,"normal:20261101T190000.000Z:"+other);
 assert.equal(result.war.source,"api");
 assert.equal(result.war.finalized,true);
 assert.equal(result.war.missed_log_complete,false);
 assert.deepEqual(result.war.roster_tags,["#8PYL"]);
 assert.equal(result.attacks.length,1);
 assert.equal(result.attacks[0].attack_order,1,
   "Must match browser, not global Clash attack order 17");
 assert.equal(result.attacks[0].defender_th,17);
 assert.equal(result.attacks[0].stars,3);
 assert.equal(buildWarSnapshot({...sample(),state:"preparation"},own,{now}),null);
 assert.throws(()=>buildWarSnapshot(sample(),"#9PYL",{now}),/incomplete_war_identity/);
});

test("ongoing war is staged but cannot contaminate finalized CW/CWL statistics",async()=>{
 const {buildWarSnapshot}=await importCore();
 const raw=sample("inWar");
 const partial=buildWarSnapshot(raw,own,{now});
 assert.equal(partial.war.finalized,false);
 assert.equal(partial.attacks.length,1);
 const recent=buildWarSnapshot(sample(),own,{now:Date.parse("2026-11-02T19:00:30Z")});
 assert.equal(recent,null,"Do not finalize before result settles");
 const league=buildWarSnapshot(sample(),own,{warType:"cwl",warTag:"#Q2PYL",now});
 assert.equal(league.war.war_key,"cwl:#Q2PYL");
 assert.equal(league.war.war_type,"cwl");
});

test("incomplete/malformed official snapshots are rejected without creating fake attacks",async()=>{
 const {buildWarSnapshot}=await importCore();
 const corrupt=sample();corrupt.clan.members=[];
 assert.throws(()=>buildWarSnapshot(corrupt,own,{now}),/incomplete_war_roster/);
 const invalid=sample();invalid.clan.members[0].attacks[0].stars=9;
 assert.throws(()=>buildWarSnapshot(invalid,own,{now}),/incomplete_attack_evidence/);
 const absent=sample();absent.opponent.members[0].townhallLevel=99;
 assert.throws(()=>buildWarSnapshot(absent,own,{now}),/invalid_defender_townhall/);
});

test("captured league round is identified by war tag, not calendar month",async()=>{
 const {hasCapturedCwlRound}=await importCore();
 const known=new Set(["cwl:#8PYL"]);
 assert.equal(hasCapturedCwlRound(["#QPYL","#8PYL","#2PYL"],known),true);
 assert.equal(hasCapturedCwlRound(["#QPYL","#2PYL"],known),false);
 assert.equal(hasCapturedCwlRound([],known),false);
});

test("GitHub OIDC verification requires signed exact workload identity",async()=>{
 const {verifyCollectorIdentity,EXPECTED}=await importAuth();
 const pair=await webcrypto.subtle.generateKey({
   name:"RSASSA-PKCS1-v1_5",modulusLength:2048,
   publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"
 },true,["sign","verify"]);
 const jwk=await webcrypto.subtle.exportKey("jwk",pair.publicKey);
 const jwksLoader=async()=>({keys:[{...jwk,kid:"testing-kid",alg:"RS256",use:"sig"}]});
 const timestamp=Math.floor(Date.now()/1000);
 const base={
   iss:EXPECTED.issuer,aud:EXPECTED.audience,repository:EXPECTED.repository,
   repository_id:EXPECTED.repositoryId,ref:EXPECTED.ref,workflow_ref:EXPECTED.workflowRef,
   sub:EXPECTED.subject,
   event_name:"schedule",iat:timestamp,nbf:timestamp-1,exp:timestamp+300
 };
 const encode=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
 const sign=async(payload,header={alg:"RS256",typ:"JWT",kid:"testing-kid"})=>{
   const data=encode(header)+"."+encode(payload);
   const signed=await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",
     pair.privateKey,new TextEncoder().encode(data));
   return data+"."+Buffer.from(signed).toString("base64url");
 };
 const valid=await sign(base);
 assert.equal(await verifyCollectorIdentity(valid,{jwksLoader}),true);
 assert.equal(await verifyCollectorIdentity(valid+"altered",{jwksLoader}),false);
 for(const changes of [
   {aud:"other-project"},{repository:"SomeoneElse/cwl_planer"},
   {repository_id:"12345"},{sub:"repo:Smolmig/cwl_planer:ref:refs/heads/main"},{ref:"refs/heads/feature"},
   {workflow_ref:"Smolmig/cwl_planer/.github/workflows/evil.yml@refs/heads/main"},
   {event_name:"pull_request"},{exp:timestamp-1},
   {iat:timestamp-700,exp:timestamp+300}
 ]){
   assert.equal(await verifyCollectorIdentity(await sign({...base,...changes}),{jwksLoader}),false,
     JSON.stringify(changes));
 }
 assert.equal(await verifyCollectorIdentity(await sign(base,{alg:"none",typ:"JWT",kid:"testing-kid"}),{jwksLoader}),false);
});

test("collector is scheduled and protected; authenticated browser can only read own status",()=>{
 const yaml=fs.readFileSync(path.join(root,".github/workflows/collect-war-stats.yml"),"utf8");
 const edge=fs.readFileSync(path.join(root,fn,"index.ts"),"utf8");
 const config=fs.readFileSync(path.join(root,"supabase/config.toml"),"utf8");
 const migration=fs.readFileSync(path.join(root,
   "supabase/migrations/20261106075500_cwl_stats_background_collector_status.sql"),"utf8");
 assert.match(yaml,/cron: '27 \* \* \* \*'/);
 assert.match(yaml,/id-token: write/);
 assert.match(yaml,/COLLECT_AUDIENCE: cwl-stats-collector:/);
 assert.doesNotMatch(yaml,/SUPABASE_SERVICE_ROLE_KEY|COC_API_KEY/);
 assert.match(edge,/verifyCollectorIdentity/);
 assert.match(edge,/rest\(settings,"cwl_stat_wars/);
 assert.match(edge,/MAX_CLANS_PER_RUN=5/);
 assert.match(config,/\[functions.coc-stats-collector\][\s\S]*?verify_jwt = false/);
 assert.match(migration,/enable row level security/);
 assert.match(migration,/grant select on public.cwl_stat_collector_status to authenticated/);
 assert.doesNotMatch(migration,/grant (insert|update|delete).*authenticated/i);
});
