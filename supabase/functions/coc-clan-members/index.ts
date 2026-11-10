import { withSupabase } from "npm:@supabase/server@1";
const CORS = {
 "Access-Control-Allow-Origin":"https://smolmig.github.io",
 "Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type",
 "Access-Control-Allow-Methods":"POST, OPTIONS",
 "Vary":"Origin",
 "Cache-Control":"no-store"
};
const fail=(message,status)=>Response.json({ok:false,error:message},{status,headers:CORS});
const handler=withSupabase({auth:"user"},async(req,ctx)=>{
 if(req.method!=="POST")return fail("method_not_allowed",405);
 let body;
 try{body=await req.json()}catch{return fail("invalid_body",400)}
 const clanId=String(body?.clanId||"");
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(clanId))return fail("invalid_clan",400);
 const {data:membership,error:roleErr}=await ctx.supabase.from("cwl_clan_memberships")
 .select("role").eq("clan_id",clanId).eq("user_id",ctx.userClaims.id).maybeSingle();
 if(roleErr||!membership||!["owner","editor","viewer"].includes(membership.role))return fail("not_a_member",403);
 const {data:clan,error:clanErr}=await ctx.supabase.from("cwl_clans")
 .select("clash_tag").eq("id",clanId).single();
 if(clanErr||!clan?.clash_tag)return fail("missing_linked_clan_tag",400);
 const apiKey=Deno.env.get("COC_API_KEY");
 if(!apiKey)return fail("missing_server_configuration",503);
 const url="https://cocproxy.royaleapi.dev/v1/clans/"+encodeURIComponent(clan.clash_tag)+"/members";
 let lastError="upstream_unreachable";
 for(let attempt=0;attempt<2;attempt++){
  let response;
  try{
   response=await fetch(url,{
    headers:{"Authorization":"Bearer "+apiKey,"Accept":"application/json"},
    signal:AbortSignal.timeout(9000)
   });
  }catch(err){
   lastError=err?.name==="TimeoutError"?"upstream_timeout":"upstream_unreachable";
   if(attempt===0){await new Promise(resolve=>setTimeout(resolve,350));continue}
   return fail(lastError,502);
  }
  if(!response.ok){
   lastError="supercell_status_"+response.status;
   // One short retry only on transient gateway, server or rate-limit failures.
   // Do not retry permissions and never replace saved members with an empty list.
   if(attempt===0&&(response.status===429||response.status>=500)){
    await new Promise(resolve=>setTimeout(resolve,response.status===429?900:350));
    continue;
   }
   return fail(lastError,502);
  }
  let json;
  try{json=await response.json()}catch{return fail("unexpected_response",502)}
  if(!Array.isArray(json?.items))return fail("unexpected_response",502);
  return Response.json({ok:true,clanTag:clan.clash_tag,members:json.items.slice(0,50).map(m=>({
   tag:String(m.tag||"").toUpperCase(),name:String(m.name||"").slice(0,80),
   townHallLevel:Number.isInteger(m.townHallLevel)?m.townHallLevel:null,
   role:String(m.role||"member"),
   donations:Number.isSafeInteger(m.donations)&&m.donations>=0&&m.donations<=9999999?m.donations:null
  }))},{headers:CORS});
 }
 return fail(lastError,502);
});
export default {fetch:(req,...args)=>req.method==="OPTIONS"?
 new Response("ok",{headers:CORS}):handler(req,...args)};
