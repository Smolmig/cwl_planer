// On-demand official player facts. No guessing current RH from old attacks.
// Read permitted only for a player with documented attacks in the caller's
// existing authenticated App-Clan. No cross-tenant administrative reads.
import {withSupabase} from "npm:@supabase/server@1";
import {cleanPlayerTag,validPlayerTag,validClanId,projectCurrentPlayer}
  from "./profile-core.mjs";
const CORS={
 "Access-Control-Allow-Origin":"https://smolmig.github.io",
 "Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type",
 "Access-Control-Allow-Methods":"POST, OPTIONS",
 "Vary":"Origin",
 "Cache-Control":"no-store"
};
const fail=(error,status)=>Response.json({ok:false,error},{status,headers:CORS});
const cache=new Map(),quotas=new Map();
const WINDOW=10*60*1000,MAX_PER_WINDOW=12,CACHE_MS=5*60*1000;
const reserve=(userId,now)=>{
 const previous=(quotas.get(userId)||[]).filter(t=>now-t<WINDOW);
 if(previous.length>=MAX_PER_WINDOW)return false;
 previous.push(now);quotas.set(userId,previous);
 // Very small bounded best-effort per-isolate throttle, NOT a global limit.
 if(quotas.size>500){const oldest=quotas.keys().next().value;quotas.delete(oldest)}
 return true;
};
const handler=withSupabase({auth:"user"},async(req,ctx)=>{
 if(req.method!=="POST")return fail("method_not_allowed",405);
 let body;
 try{body=await req.json()}catch{return fail("invalid_body",400)}
 const clanId=String(body?.clanId||""),tag=cleanPlayerTag(body?.playerTag);
 if(!validClanId(clanId)||!validPlayerTag(tag))
   return fail("invalid_player_or_clan",400);
 // Membership and documented player evidence are checked BEFORE cache lookup.
 // ctx.supabase is user-scoped and additionally constrained by Supabase RLS.
 const {data:membership,error:memberError}=await ctx.supabase
   .from("cwl_clan_memberships").select("role")
   .eq("clan_id",clanId).eq("user_id",ctx.userClaims.id).maybeSingle();
 if(memberError||!membership||
   !["owner","editor","viewer"].includes(membership.role))
   return fail("not_a_member",403);
 const {data:proof,error:proofError}=await ctx.supabase
   .from("cwl_stat_attacks").select("war_key")
   .eq("clan_id",clanId).eq("attacker_tag",tag).limit(1);
 if(proofError)return fail("evidence_unavailable",503);
 if(!proof?.length)return fail("player_not_documented",403);
 const now=Date.now();
 if(!reserve(ctx.userClaims.id,now))return fail("too_many_requests",429);
 const cached=cache.get(tag);
 if(cached&&now-cached.checkedMs<CACHE_MS)
   return Response.json({ok:true,profile:cached.profile,cache:"recent"},{headers:CORS});
 const key=Deno.env.get("COC_API_KEY");
 if(!key)return fail("missing_server_configuration",503);
 let resp;
 try{
   resp=await fetch(
     "https://cocproxy.royaleapi.dev/v1/players/"+encodeURIComponent(tag),
     {headers:{Authorization:"Bearer "+key,Accept:"application/json"},
      signal:AbortSignal.timeout(10000)}
   );
 }catch{return fail("player_api_unreachable",502)}
 if(resp.status===404)return fail("player_not_found",404);
 if(!resp.ok)return fail("player_api_unavailable",502);
 let json;
 try{json=await resp.json()}catch{return fail("unexpected_response",502)}
 const profile=projectCurrentPlayer(json,tag,new Date().toISOString());
 if(!profile)return fail("invalid_player_response",502);
 cache.set(tag,{profile,checkedMs:now});
 if(cache.size>250){const oldest=cache.keys().next().value;cache.delete(oldest)}
 return Response.json({ok:true,profile,cache:"fresh"},{headers:CORS});
});
export default {fetch:(req,...args)=>req.method==="OPTIONS"?
 new Response("ok",{headers:CORS}):handler(req,...args)};
