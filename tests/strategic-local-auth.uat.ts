// Standalone Deno UAT: actual Edge handler and @supabase/server wrapper,
// real local GoTrue-issued JWTs + PostgREST + base app RLS. Only Clash is mocked.
// No deployed edge gateway, production credentials, or hosted project access.
import assert from "node:assert/strict";
const api=Deno.env.get("API_URL")||"",db=Deno.env.get("DB_URL")||"";
const anon=Deno.env.get("ANON_KEY")||"",admin=Deno.env.get("SERVICE_ROLE_KEY")||"";
assert.match(api,/^http:\/\/(127\.0\.0\.1|localhost):54321$/);
assert.match(db,/^postgres(?:ql)?:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\//);
assert.ok(anon&&admin);
Deno.env.set("SUPABASE_URL",api);
Deno.env.set("SUPABASE_ANON_KEY",anon);
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY",admin);
Deno.env.set("SUPABASE_PUBLISHABLE_KEY",Deno.env.get("PUBLISHABLE_KEY")||anon);
Deno.env.set("SUPABASE_SECRET_KEY",Deno.env.get("SECRET_KEY")||admin);
Deno.env.set("COC_API_KEY","synthetic-only");
const a="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",b="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const own="#P02",other="#P08",warTag="#PQQ",abc="0289PYLQGRJCUV";
const tag=(i:number)=>"#Q"+abc[Math.floor(i/13)%13]+abc[i%13];
const groupTags=[own,other,"#P09","#P0Y","#P0P","#P0L"];
const roster=(i:number)=>Array.from({length:15},(_,j)=>({tag:tag(i*15+j),townhallLevel:19,mapPosition:j+1,name:"synthetic player private label"}));
const season=new Date().toISOString().slice(0,7);
const startTime=new Date(Date.now()+3600000).toISOString().replace(/[-:]/g,"");
const group={state:"preparation",season,clans:groupTags.map((tag,i)=>({tag,members:roster(i)})),rounds:[{warTags:[warTag]}]};
const war={state:"preparation",teamSize:15,attacksPerMember:1,startTime,
 clan:{tag:own,members:roster(0)},opponent:{tag:other,members:roster(1)}};
const originalFetch=globalThis.fetch.bind(globalThis);
let gameCalls=0,warCalls=0,afterGame:(()=>void)|null=null;
globalThis.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
 const url=new URL(input instanceof Request?input.url:String(input));
 if(url.origin!== "https://cocproxy.royaleapi.dev"){
  assert.equal(url.origin,api,"non-local request forbidden");
  return originalFetch(input,init);
 }
 assert.equal(new Headers(init?.headers).get("authorization"),"Bearer synthetic-only");
 gameCalls++;
 if(url.pathname==="/v1/clans/"+encodeURIComponent(own)+"/currentwar/leaguegroup"){
  if(afterGame){const fn=afterGame;afterGame=null;fn()}
  return Response.json(group);
 }
 if(url.pathname==="/v1/clanwarleagues/wars/"+encodeURIComponent(warTag)){warCalls++;return Response.json(war)}
 throw Error("unexpected synthetic Clash request");
};
const sql=(statement:string)=>{
 const done=new Deno.Command("psql",{args:[db,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],stdout:"piped",stderr:"piped"}).outputSync();
 assert.equal(done.code,0,"local SQL failed");
 return new TextDecoder().decode(done.stdout).trim();
};
const uuid=(v:string)=>{assert.match(v,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);return v};
const ids:Record<string,{id:string,access:string}>={};
for(const name of ["owner","editor","viewer","outsider"]){
 const email=name+"@strategic-ci.invalid",password="synthetic-test-password-only-2026";
 const create=await originalFetch(api+"/auth/v1/admin/users",{method:"POST",headers:{apikey:admin,Authorization:"Bearer "+admin,"Content-Type":"application/json"},body:JSON.stringify({email,password,email_confirm:true,user_metadata:{role:"owner"}})});
 assert.ok([200,201].includes(create.status),"create "+name+": "+create.status);
 const user=await create.json();
 const login=await originalFetch(api+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:anon,"Content-Type":"application/json"},body:JSON.stringify({email,password})});
 assert.equal(login.status,200,"login "+name);
 const data=await login.json();
 assert.equal(data.user.id,user.id);assert.ok(data.access_token);
 ids[name]={id:uuid(user.id),access:data.access_token};
}
sql("insert into public.cwl_clans(id,name,clash_tag,owner_user_id) values ('"+a+"','Synthetic A','"+own+"','"+ids.owner.id+"'),('"+b+"','Synthetic B','"+other+"','"+ids.outsider.id+"')");
sql("insert into public.cwl_clan_memberships(clan_id,user_id,role) values ('"+a+"','"+ids.editor.id+"','editor'),('"+a+"','"+ids.viewer.id+"','viewer')");
for(const [id,name] of [[a,"owner"],[b,"outsider"]]){
 const actor=ids[name].id;
 sql("select set_config('request.jwt.claim.sub','"+actor+"',true); insert into public.cwl_cloud_profiles(clan_id,profile_json,updated_by) values ('"+id+"',"+literal({marker:"private "+name})+"::jsonb,'"+actor+"')");
}
function literal(v:unknown){return "'"+JSON.stringify(v).replaceAll("'","''")+"'";}
const snapshot=()=>sql("select md5(coalesce(jsonb_agg(to_jsonb(p) order by clan_id)::text,'')) from public.cwl_cloud_profiles p");
const before=snapshot();
Deno.env.delete("CWL_STRATEGIC_SHADOW_ENABLED");
Deno.env.delete("CWL_STRATEGIC_REVIEWED_LEAGUE_RULES");
Deno.env.set("CWL_STRATEGIC_SHADOW_CLANS",a);
const {default:handler}=await import("../supabase/functions/coc-cwl-status/index.ts");
async function invoke(name:string|null,clan=a,token?:string,extra:Record<string,unknown>={}){
 const bearer=token??(name?ids[name].access:null);
 return handler.fetch(new Request(api+"/functions/v1/coc-cwl-status",{method:"POST",
 headers:{apikey:anon,"Content-Type":"application/json",...(bearer?{Authorization:"Bearer "+bearer}:{})},
 body:JSON.stringify({clanId:clan,strategic:true,...extra})}));
}
async function denied(name:string|null,clan=a,token?:string){
 const calls=gameCalls,response=await invoke(name,clan,token);
 assert.ok([401,403].includes(response.status),"expected authorization denial for "+name+", got "+response.status);
 assert.equal(gameCalls,calls,"denied call reached Clash");
 assert.ok(!(await response.text()).includes("preview_data"));
}
await denied("owner"); // feature off
Deno.env.set("CWL_STRATEGIC_SHADOW_ENABLED","true");
await denied(null);await denied(null,a,"not-a-valid-jwt");
await denied("viewer");await denied("outsider");await denied("owner",b);
Deno.env.set("CWL_STRATEGIC_SHADOW_CLANS","*");await denied("owner");
Deno.env.set("CWL_STRATEGIC_SHADOW_CLANS",a);
for(const name of ["owner","editor"]){
 const response=await invoke(name,a,undefined,{role:"viewer",clanTag:other});
 assert.equal(response.status,200,name+" preview");
 const body=await response.json();
 assert.equal(body.clanTag,own);assert.equal(body.strategic.status,"preview_data");
 assert.equal(body.strategic.group.upcoming.length,1);
 assert.equal(body.strategic.standings.demotion,"unknown_rules");
 assert.ok(!JSON.stringify(body).includes("synthetic player private label"));
 assert.ok(!JSON.stringify(body).includes("private A"));
}
assert.equal(warCalls,2,"mutable war must be read twice, no stale preparation cache");
const {createStrategicBetaHandler,default:disabledBeta}=await import("../supabase/functions/coc-cwl-strategy-beta/index.ts");
const beta=createStrategicBetaHandler([{clanId:a,clanTag:own,userId:ids.owner.id}]);
async function invokeBeta(name,clan=a,action="capability",h=beta,extra={}){
 const bearer=name?ids[name].access:null;
 return h.fetch(new Request(api+"/functions/v1/coc-cwl-strategy-beta",{method:"POST",
 headers:{apikey:anon,"Content-Type":"application/json",...(bearer?{Authorization:"Bearer "+bearer}:{})},
 body:JSON.stringify({clanId:clan,action,...extra})}));
}
const betaCalls=gameCalls;
assert.equal((await invokeBeta("owner",a,"capability",disabledBeta)).status,403);
for(const name of ["viewer","outsider",null])assert.ok([401,403].includes((await invokeBeta(name)).status));
assert.equal((await invokeBeta("owner",b)).status,403);
assert.equal((await invokeBeta("owner",a,"save")).status,403);
assert.deepEqual(await (await invokeBeta("owner",a,"capability")).json(),{ok:true,enabled:true,clanTag:own});
assert.deepEqual(await (await invokeBeta("editor",a,"capability")).json(),{ok:true,enabled:true,clanTag:own});
assert.equal(gameCalls,betaCalls,"capability must never fetch game");
const actual=await invokeBeta("owner",a,"preview",beta,{clanTag:other,userId:ids.outsider.id});
assert.equal(actual.status,200);const bodyBeta=await actual.json();
assert.equal(bodyBeta.clanTag,own);assert.equal(bodyBeta.strategic.status,"preview_data");
assert.equal(snapshot(),before);

const record={clanId:a,clanTag:own,season,teamSize:15,anchorWarTag:warTag,league:"Master II",fullGroupSize:8,promotionPlaces:2,demotionPlaces:2,source:"in_game_current_group",verifiedAt:new Date().toISOString()};
let review=await invoke("owner",a,undefined,{rules:record,ruleContext:{clanId:a,records:JSON.stringify([record])}});
assert.equal(review.status,200);assert.equal((await review.json()).strategic.standings.demotion,"unknown_rules","client cannot inject rules");
Deno.env.set("CWL_STRATEGIC_REVIEWED_LEAGUE_RULES",JSON.stringify([record]));
review=await invoke("owner");assert.equal(review.status,200);
assert.equal((await review.json()).strategic.standings.demotion,"not_applicable");
Deno.env.delete("CWL_STRATEGIC_REVIEWED_LEAGUE_RULES");
// Revoke the editor after first membership check, while Clash response is
// being assembled. Same still-valid JWT may no longer access that clan.
afterGame=()=>sql("delete from public.cwl_clan_memberships where clan_id='"+a+"' and user_id='"+ids.editor.id+"'");
let response=await invoke("editor");
assert.equal(response.status,403,"revocation during fetch");
assert.ok(!(await response.text()).includes("preview_data"));
await denied("editor");
assert.equal((await invokeBeta("editor")).status,403,"revoked beta editor");
afterGame=()=>sql("update public.cwl_clans set clash_tag='#P0G' where id='"+a+"'");
response=await invoke("owner");
assert.equal(response.status,403,"link changed during fetch");
assert.ok(!(await response.text()).includes("preview_data"));
assert.equal((await invokeBeta("owner")).status,403,"beta link changed");
assert.equal(snapshot(),before,"profile JSON/revision must stay untouched");
console.log("PASS: real local JWT + caller RLS + owner/editor/viewer/outsider/default-off/allowlist/revocation/relink; synthetic Clash only; profile unchanged");

// End-to-end publication through the actual candidate and collector
// publisher, real service-role RPC and caller JWTs in PostgREST. No
// network other than this isolated local project and synthetic Clash.
sql("update public.cwl_clans set clash_tag='"+own+"' where id='"+a+"'; insert into public.cwl_clan_memberships(clan_id,user_id,role) values ('"+a+"','"+ids.editor.id+"','editor')");
const coreImport=await import("../cwl-planning-core.js");
const core=globalThis.CWLPlanningCore;
assert.ok(core?.planCwl);
const {buildAutomaticStrategicCandidate}=await import("../supabase/functions/coc-stats-collector/collector-strategic-cycle.mjs");
const {loadAutomaticContext,publishAutomatic,claimPendingStrategic}=await import("../supabase/functions/coc-stats-collector/collector-strategic-runner.mjs");
const {projectStrategicGroup}=await import("../supabase/functions/coc-cwl-status/strategic-projection.mjs");
const members=roster(0).map((m,i)=>({id:"p"+i,name:"Test "+i,playerTag:m.tag,townHall:19,participating:true,fixed:i===0,statuses:Array(5).fill("auto")}));
const profile={id:"synthetic-profile",members,archivedMembers:[],archives:[],locks:Array.from({length:5},()=>({locked:false,lineup:[]})),config:{slots:15,days:5,strategicMode:"balanced",strategicAuto:true},cwlLive:{season,clanTag:own,rounds:[]}};
sql("select set_config('request.jwt.claim.sub','"+ids.owner.id+"',true); update public.cwl_cloud_profiles set profile_json="+literal(profile)+"::jsonb where clan_id='"+a+"'");
async function requestRest(path:string,name:string,method="GET",rows?:unknown){
 const key=name==="service"?admin:anon,token=name==="service"?admin:ids[name].access;
 const r=await originalFetch(api+"/rest/v1/"+path,{method,headers:{apikey:key,Authorization:"Bearer "+token,Accept:"application/json","Content-Type":"application/json",Prefer:"return=representation"},...(rows===undefined?{}:{body:JSON.stringify(rows)})});
 return r;
}
async function rpc(name:string,method:string,rows:unknown){const r=await requestRest("rpc/"+method,name,"POST",rows);assert.ok(r.ok,method+" "+r.status+" "+await r.clone().text());return r.json()}
const reviewState=await rpc("owner","cwl_set_plan_lock",{p_clan:a,p_locked:true});
const approvedRev=Number(sql("select revision from public.cwl_cloud_profiles where clan_id='"+a+"'"));
const draft=structuredClone(profile);draft.config.strategicMode="performance";
const suggestion=await rpc("editor","cwl_submit_plan_suggestion",{p_clan:a,p_base_revision:approvedRev,p_profile:draft});
const approvedHash=snapshot();
const settings={};
const rest=async(_settings,path,{method="GET",rows=null}={})=>{
 const r=await requestRest(path,"service",method,rows??undefined);assert.ok(r.ok,path.split("?")[0]+" "+r.status+" "+await r.clone().text());return r.json();
};
const records=JSON.stringify([{clanId:a,clanTag:own,ownerId:ids.owner.id}]);
assert.equal(await claimPendingStrategic({rest,settings,records:"[]"}),null);
const claimed=await claimPendingStrategic({rest,settings,records});assert.equal(claimed.revision,approvedRev);
assert.equal(await claimPendingStrategic({rest,settings,records}),null);
const ctx=await loadAutomaticContext({rest,settings,clanId:a,clanTag:own,records});assert.equal(ctx.review.locked,true);
const currentWar={...war};delete currentWar.attacksPerMember;
const now=Date.now(),projection=projectStrategicGroup({group,results:new Map([[warTag,currentWar]]),clanTag:own,season,observedAt:now});
const build=ctx=>buildAutomaticStrategicCandidate({...ctx,projection,historyRows:{wars:[],attacks:[],missedEvents:[]},core,now});
const candidate=build(ctx);assert.ok(candidate.ok,candidate.reason);assert.equal(candidate.changed,true);
const deadline=Date.now()+90000;
assert.equal(await publishAutomatic({rest,settings,context:ctx,result:candidate,deadline}),true);
assert.equal(snapshot(),approvedHash,"collector may not edit approved profile");
assert.equal(sql("select status from public.cwl_plan_suggestions where id='"+uuid(suggestion)+"'"),"pending");
const path="cwl_strategic_assignments?clan_id=eq."+a+"&select=snapshot,base_revision,cycle_id";
for(const name of ["owner","editor","viewer"]){
 const r=await requestRest(path,name);assert.equal(r.status,200);const rows=await r.json();assert.equal(rows.length,1);
 assert.equal(rows[0].base_revision,approvedRev);assert.equal(rows[0].cycle_id,reviewState.cycle_id);
 const p={...profile,strategicPlan:rows[0].snapshot};
 const observed=core.strategicObservedContext({profile:p,clanId:a,locks:profile.locks});
 const standard=core.planCwl({members,locks:observed.locks,slots:15,days:5});
 const resolved=core.resolvePublishedStrategicPlan({profile:p,clanId:a,locks:observed.locks,standard,live:observed.live});
 assert.equal(resolved.status,"published");assert.deepEqual(resolved.plan.dayPlans.map(d=>d.lineup),candidate.next.plan.map(d=>d.lineup));
}
assert.deepEqual(await (await requestRest(path,"outsider")).json(),[]);
for(const name of ["viewer","editor","owner","outsider"]){
 const r=await requestRest("rpc/cwl_claim_strategic_recompute",name,"POST",{p_grants:JSON.parse(records)});assert.ok([401,403,404].includes(r.status));
 const denied=await requestRest("cwl_strategic_assignments?clan_id=eq."+a,name,"PATCH",{snapshot:{forged:true}});assert.ok([401,403].includes(denied.status));
}
const storedContext=await loadAutomaticContext({rest,settings,clanId:a,clanTag:own,records});
 assert.ok(storedContext.saved.automatic_snapshot,"persisted baseline must be loaded");
 const again=build(storedContext);assert.ok(again.ok,again.reason);
 assert.equal(again.changed,false,"same semantic snapshot after JSONB round trip must not republish");
await rpc("owner","cwl_resolve_plan_suggestion",{p_suggestion:suggestion,p_accept:true});
assert.deepEqual(await (await requestRest(path,"viewer")).json(),[],"old derived plan hidden after accepted revision");
assert.equal(await publishAutomatic({rest,settings,context:ctx,result:candidate,deadline}),false,"stale CAS");
const updated=await loadAutomaticContext({rest,settings,clanId:a,clanTag:own,records});
assert.equal(updated.saved.profile_json.config.strategicMode,"performance");
const next=build(updated);assert.ok(next.ok,next.reason);assert.equal(await publishAutomatic({rest,settings,context:updated,result:next,deadline}),true);
assert.equal((await (await requestRest(path,"viewer")).json())[0].base_revision,approvedRev+1);
sql("delete from public.cwl_clan_memberships where clan_id='"+a+"' and user_id='"+ids.viewer.id+"'");
assert.deepEqual(await (await requestRest(path,"viewer")).json(),[]);
console.log("PASS: real derived assignment RPC + JWT read across roles, locked input, pending proposal, acceptance/CAS/reload/revocation; synthetic Clash");
