// App-wide beta with caller-scoped tenant authorization. No archive/profile write.
// The existing live-status deployment is not replaced.
import {withSupabase} from "npm:@supabase/server@1";
import {loadStatus} from "../coc-cwl-status/index.ts";
import {betaEnabled} from "./beta-config.mjs";
const CORS={"Access-Control-Allow-Origin":"https://smolmig.github.io",
 "Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type",
 "Access-Control-Allow-Methods":"POST, OPTIONS","Cache-Control":"no-store","Vary":"Origin"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TAG=/^#[0289PYLQGRJCUV]{3,15}$/;
const response=(data,status=200)=>Response.json(data,{status,headers:CORS});
const deny=()=>response({ok:false,error:"strategic_unavailable"},403);
export function createStrategicBetaHandler(enabled=()=>betaEnabled(Deno.env.get("CWL_STRATEGIC_BETA_ENABLED"))){
 const handler=withSupabase({auth:"user"},async(req,ctx)=>{
  if(req.method!=="POST")return response({ok:false,error:"method_not_allowed"},405);
  let body;try{body=await req.json()}catch{return response({ok:false,error:"invalid_body"},400)}
  const clanId=body?.clanId,actor=ctx.userClaims.id;
  if(!UUID.test(clanId||"")||!UUID.test(actor||"")||!["capability","preview"].includes(body?.action))return deny();
  if(!enabled())return deny();
  async function authorized(){
   if(!enabled())return null;
   const {data:m,error:me}=await ctx.supabase.from("cwl_clan_memberships").select("role").eq("clan_id",clanId).eq("user_id",actor).maybeSingle();
   if(me||!["owner","editor"].includes(m?.role))return null;
   const {data:c,error:ce}=await ctx.supabase.from("cwl_clans").select("clash_tag,owner_user_id").eq("id",clanId).single();
   if(ce||!TAG.test(c?.clash_tag||"")||!UUID.test(c?.owner_user_id||"")||(m.role==="owner")!==(actor===c.owner_user_id))return null;
   return {tag:c.clash_tag,owner:c.owner_user_id,role:m.role};
  }
  const binding=await authorized();if(!binding)return deny();
  const expected=binding.tag;
  if(body.action==="capability")return response({ok:true,enabled:true,clanTag:expected});
  const key=Deno.env.get("COC_API_KEY");
  if(!key)return response({ok:false,error:"strategic_unavailable"},503);
  try{
   const result=await loadStatus(expected,key,true,{clanId,records:Deno.env.get("CWL_STRATEGIC_REVIEWED_LEAGUE_RULES")});
   const current=await authorized();
   if(!current||current.tag!==binding.tag||current.owner!==binding.owner||current.role!==binding.role)return deny();
   return response(result.active&&result.strategic?result:{ok:true,active:false,clanTag:expected,strategic:null});
  }catch{return response({ok:false,error:"strategic_unavailable"},502)}
 });
 return {fetch:(req,...args)=>req.method==="OPTIONS"?new Response("ok",{headers:CORS}):handler(req,...args)};
}
export default createStrategicBetaHandler();
