"use strict";
// Integration against disposable PostgreSQL 17 + actual PostgREST HTTP API.
// All users, tokens, clan tags and war results are synthetic CI-only values.
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const base=process.env.CWL_TEST_REST_URL||"http://127.0.0.1:3000";
const secret=process.env.CWL_TEST_JWT_SECRET||"synthetic-clashperk-jwt-tests-only-secret-2026";
const A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const owner="11111111-1111-4111-8111-111111111111";
const editor="22222222-2222-4222-8222-222222222222";
const otherOwner="33333333-3333-4333-8333-333333333333";
const viewer="44444444-4444-4444-8444-444444444444";
const tag="#99JP2RL2",other="#2JGC2J8VG";
const b64=thing=>Buffer.from(typeof thing==="string"?thing:JSON.stringify(thing))
 .toString("base64url");
function jwt(sub,role="authenticated"){
 const header=b64({alg:"HS256",typ:"JWT"});
 const body=b64({sub,role,aud:"authenticated",
  iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600});
 const message=header+"."+body;
 return message+"."+createHmac("sha256",secret).update(message)
  .digest("base64url");
}
function payload(id,clanTag=tag){
 const date=new Date(Date.UTC(2026,0,1+(id-500))).toISOString();
 const war="cp:"+id;
 return {clanTag,
  wars:[{war_key:war,war_type:"normal",started_at:date,team_size:2,
    opponent_tag:"#2PYL",opponent_name:"Synthetic Enemy"}],
  attacks:[1,2].map((n)=>({
   war_key:war,attacker_tag:"#8PYL",attack_order:n,
   attacker_name:"Synthetic Player",attacker_th:18,
   defender_tag:"#2QPYL",defender_name:"Synthetic Enemy",defender_th:18,
   stars:n===1?3:2,destruction:n===1?100:90
  })),
  missed:[{war_key:war,player_tag:"#QPYL",player_name:"Synthetic Missing",
    missed_count:2}]
 };
}
async function request(path,sub,method="GET",body){
 const res=await fetch(base+path,{
  method,
  headers:{
   ...(sub?{Authorization:"Bearer "+jwt(sub)}:{}),
   "Content-Type":"application/json",
   "Accept":"application/json"
  },
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const text=await res.text();
 let data;try{data=text?JSON.parse(text):null}catch{data=text}
 return {status:res.status,data,raw:text};
}
const post=(sub,id,clanId=A,data=payload(id))=>
 request("/rpc/cwl_import_clashperk_atomic",sub,"POST",{
  p_clan:clanId,p_payload:data
 });
const getWars=(sub,key)=>
 request("/cwl_stat_wars?select=war_key,clan_id,finalized,missed_log_complete"+
  "&war_key=eq."+encodeURIComponent(key),sub);
const getAttacks=(sub,key)=>
 request("/cwl_stat_attacks?select=attacker_tag,attack_order,stars"+
  "&war_key=eq."+encodeURIComponent(key),sub);
function isDenied(response,label){
 assert.ok([400,401,403,404,409].includes(response.status),
  label+": expected denial but got "+response.status+" "+JSON.stringify(response.data));
}
test("Real HTTP JWT role claims, RLS isolation and an atomic ClashPerk import",{
 timeout:120000
},async()=>{
 const response=await request("/",null);
 assert.equal(response.status,200,"PostgREST must be ready");

 // Unauthenticated and signed-in viewer accounts have NO write privileges.
 const nobody=await post(null,500);
 isDenied(nobody,"anonymous writer");
 const observed=await post(viewer,500);
 isDenied(observed,"viewer writer");

 // Editor role must work as an independently authenticated user.
 const edited=await post(editor,500);
 assert.equal(edited.status,200,"editor insert "+edited.raw);
 assert.equal(edited.data.inserted,1);
 assert.equal(edited.data.attacks,2);
 assert.equal(edited.data.missed,1);
 assert.equal(edited.data.completeWars,1);

 const full=await getWars(owner,"cp:500");
 assert.equal(full.status,200);
 assert.equal(full.data.length,1);
 assert.equal(full.data[0].finalized,true);
 assert.equal(full.data[0].missed_log_complete,true);

 // Re-upload exact same XLSX-origin payload is idempotent.
 const repeated=await post(owner,500);
 assert.equal(repeated.status,200,"repeated import "+repeated.raw);
 assert.equal(repeated.data.extended,1);
 const hits=await getAttacks(owner,"cp:500");
 assert.equal(hits.data.length,2,"no duplicate attacks on reupload");

 // A late error in the Missed portion must rollback the earlier war
 // and attack inserts within this single PostgREST RPC request.
 const faulty=payload(501);
 faulty.missed[0].missed_count=3;
 const failure=await post(owner,501,A,faulty);
 isDenied(failure,"late malformed missed evidence");
 const afterFailure=await getWars(owner,"cp:501");
 assert.equal(afterFailure.status,200);
 assert.deepEqual(afterFailure.data,[],"late failure must undo the entire upload");
 const leftover=await getAttacks(owner,"cp:501");
 assert.deepEqual(leftover.data,[],"no partial attacks survive");

 // A changed attack cannot silently override a previously saved result.
 const changed=payload(500);changed.attacks[0].stars=0;
 const conflict=await post(owner,500,A,changed);
 isDenied(conflict,"contradictory previously saved attack");
 const protectedHits=await getAttacks(owner,"cp:500");
 assert.equal(protectedHits.data.find(x=>x.attack_order===1).stars,3);

 // Editing clan A cannot grant a write to other clan B.
 const wrongTenant=await post(editor,502,B,payload(502,other));
 isDenied(wrongTenant,"editor cross-tenant write");
 const wrongTag=await post(otherOwner,502,B,payload(502,tag));
 isDenied(wrongTag,"authorized user with wrong Clan Tag");

 // The second clan owner can upload to B and its rows must not be
 // visible from A; this verifies API-level SELECT RLS too.
 const bSaved=await post(otherOwner,503,B,payload(503,other));
 assert.equal(bSaved.status,200,"second clan owner "+bSaved.raw);
 const privateB=await getWars(owner,"cp:503");
 assert.deepEqual(privateB.data,[],"first-clan owner must not see second clan");
 const seeB=await getWars(otherOwner,"cp:503");
 assert.equal(seeB.data.length,1);

 // A signed-in viewer can only read the clan they belong to.
 const viewerRead=await getWars(viewer,"cp:500");
 assert.equal(viewerRead.status,200);
 assert.equal(viewerRead.data.length,1);
 const viewerForeign=await getWars(viewer,"cp:503");
 assert.deepEqual(viewerForeign.data,[]);
});

test("Real HTTP rejects tampered JWT signatures, not merely an unauthorized database role",async()=>{
 const good=jwt(owner);
 const tampered=good.slice(0,-2)+(good.slice(-2)==="ZZ"?"YY":"ZZ");
 const response=await fetch(base+"/rpc/cwl_import_clashperk_atomic",{
  method:"POST",
  headers:{Authorization:"Bearer "+tampered,"Content-Type":"application/json"},
  body:JSON.stringify({p_clan:A,p_payload:payload(505)})
 });
 assert.equal(response.status,401);
});
