"use strict";
// #269: Real local Supabase Auth sign-in -> GoTrue-issued JWT -> PostgREST
// -> invoker RPC -> live RLS. Completely synthetic and CI-only.
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {spawnSync}=require("node:child_process");
const api=process.env.API_URL;
const anon=process.env.ANON_KEY;
const admin=process.env.SERVICE_ROLE_KEY;
const database=process.env.DB_URL;
const clanA="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const clanB="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const tagA="#99JP2RL2",tagB="#2JGC2J8VG";
const users=[
  ["owner","owner@synth-clashperk.invalid","owner"],
  ["editor","editor@synth-clashperk.invalid","editor"],
  ["viewer","viewer@synth-clashperk.invalid","viewer"],
  ["outsider","outsider@synth-clashperk.invalid","viewer"]
];
const password="synthetic-only-not-a-user-password-2026";

function assertTestConfig(){
 if(!api||!anon||!admin||!database||
    !/^https?:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(api)){
  throw Error("This UAT MUST run only against an explicitly configured local Supabase project.");
 }
 if(!/^postgres(?:ql)?:\/\/[^@]+@(?:127\.0\.0\.1|localhost):\d+\//.test(database)){
  throw Error("Refusing to write test memberships to any non-local database.");
 }
}
async function call(path,method,body,bearer,apikey=anon){
 const response=await fetch(api+path,{
  method,
  headers:{"Content-Type":"application/json",apikey,
    ...(bearer?{Authorization:"Bearer "+bearer}:{})},
  ...(body===undefined?{}:{body:JSON.stringify(body)})
 });
 const text=await response.text();
 let data;try{data=text?JSON.parse(text):null}catch{data=text}
 return {status:response.status,data,text};
}
function sql(statement){
 // All IDs are validated UUIDs returned from the LOCAL Auth server; no
 // production connection strings are permitted by assertTestConfig().
 const done=spawnSync("psql",[database,"-X","-v","ON_ERROR_STOP=1",
   "-qAt","-c",statement],{encoding:"utf8",timeout:15000});
 if(done.status!==0)throw Error("Failed to seed locally authenticated test memberships.");
}
function makePayload(id,clanTag=tagA){
 const warKey="cp:"+id;
 return {
  clanTag,
  wars:[{
   war_key:warKey,war_type:"normal",
   started_at:new Date(Date.UTC(2026,1,1+(id-720))).toISOString(),
   team_size:2,opponent_tag:"#2PYL",opponent_name:"Synthetic Enemy"
  }],
  attacks:[1,2].map((n)=>({
   war_key:warKey,attacker_tag:"#8PYL",attack_order:n,
   attacker_name:"Synthetic Attacker",attacker_th:18,
   defender_tag:"#2QPYL",defender_name:"Synthetic Defender",
   defender_th:18,stars:n===1?3:2,destruction:n===1?100:85
  })),
  missed:[{
   war_key:warKey,player_tag:"#QPYL",
   player_name:"Synthetic Missing",missed_count:2
  }]
 };
}
function denied(result){
 assert.ok([400,401,403,404,409].includes(result.status),
  "Expected access denial, got "+result.status+" ("+
  JSON.stringify(result.data).slice(0,200)+")");
}

if(process.env.CWL_LOCAL_SUPABASE_UAT==="1"){
test("Actual GoTrue email/password sessions enforce importer RLS and full rollback",{
 timeout:120000
},async()=>{
 assertTestConfig();
 const identities={};
 for(const [name,email,role] of users){
  const created=await call("/auth/v1/admin/users","POST",{
    email,password,email_confirm:true,
    app_metadata:{test_clan_role:role}
  },admin,admin);
  assert.ok([200,201].includes(created.status),
    name+": failed to create synthetic test user: "+created.status+" "+created.text.slice(0,150));
  const userId=created.data?.id;
  assert.match(userId,/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i);
  const login=await call("/auth/v1/token?grant_type=password","POST",{
    email,password
  },anon,anon);
  assert.equal(login.status,200,name+": password login failed: "+login.status+" "+login.text.slice(0,160));
  assert.ok(login.data?.access_token);
  assert.equal(login.data.user.id,userId);
  identities[name]={id:userId,access:login.data.access_token};
 }
 // User-supplied app_metadata is NOT trusted for authorization: the DB's
 // per-clan membership is the only authority. Neither an OAuth profile name
 // nor a token "role" claim grants write access.
 const safeUuid=id=>{
  assert.match(id,/^[a-f\d-]{36}$/i);return id;
 };
 sql("INSERT INTO public.cwl_clan_memberships (clan_id,user_id,role) VALUES "+
  "('"+clanA+"','"+safeUuid(identities.owner.id)+"','owner'),"+
  "('"+clanA+"','"+safeUuid(identities.editor.id)+"','editor'),"+
  "('"+clanA+"','"+safeUuid(identities.viewer.id)+"','viewer'),"+
  "('"+clanB+"','"+safeUuid(identities.outsider.id)+"','owner')");
 const rpc=(name,id,clan=clanA,clanTag=tagA,payload=makePayload(id,clanTag))=>
  call("/rest/v1/rpc/cwl_import_clashperk_canonical_atomic","POST",{
    p_clan:clan,p_payload:payload
  },identities[name].access);
 const get=(name,id)=>{
  const key=encodeURIComponent("cp:"+id);
  return call("/rest/v1/cwl_stat_wars?select=war_key,clan_id,finalized,missed_log_complete"+
    "&war_key=eq."+key,"GET",undefined,identities[name].access);
 };
 const viewerAttempt=await rpc("viewer",720);
 denied(viewerAttempt);
 const otherClanAttempt=await rpc("outsider",721,clanA,tagA);
 denied(otherClanAttempt);
 const imported=await rpc("editor",720);
 assert.equal(imported.status,200,"editor RPC failed: "+imported.status+" "+imported.text.slice(0,300));
 assert.equal(imported.data.inserted,1);
 assert.equal(imported.data.attacks,2);
 assert.equal(imported.data.missed,1);
 assert.equal(imported.data.completeWars,1);
 const ownerRead=await get("owner",720);
 assert.equal(ownerRead.status,200);
 assert.equal(ownerRead.data.length,1);
 assert.equal(ownerRead.data[0].missed_log_complete,true);
 assert.equal(ownerRead.data[0].finalized,true);
 const viewed=await get("viewer",720);
 assert.equal(viewed.data.length,1,"same-clan viewer may read the history");
 const external=await get("outsider",720);
 assert.deepEqual(external.data,[],"second-clan user cannot read first-clan history");
 const again=await rpc("owner",720);
 assert.equal(again.status,200);
 assert.equal(again.data.extended,1,"repeated upload must be idempotent");
 const bad=makePayload(722);
 bad.missed[0].missed_count=3;
 denied(await rpc("owner",722,clanA,tagA,bad));
 assert.deepEqual((await get("owner",722)).data,[],
  "late invalid missed evidence must rollback entire upload");
 const secondClan=await rpc("outsider",723,clanB,tagB);
 assert.equal(secondClan.status,200);
 assert.equal(secondClan.data.inserted,1);
 assert.deepEqual((await get("viewer",723)).data,[]);
 const bView=await get("outsider",723);
 assert.equal(bView.data.length,1);
 const wrongTag=await rpc("outsider",724,clanB,tagA);
 denied(wrongTag);
 const wrongPassword=await call("/auth/v1/token?grant_type=password","POST",{
   email:"viewer@synth-clashperk.invalid",password:"wrong-password"
 },anon,anon);
 denied(wrongPassword);
});
}
