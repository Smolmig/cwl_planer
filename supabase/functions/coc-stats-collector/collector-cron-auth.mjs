// Independent Supabase Cron caller. Never accepts public client API keys.
// The only privileged database RPC returns a boolean; HMAC material remains
// encrypted in Vault and is not sent to the Edge runtime.
const AT="x-cwl-collector-cron-at";
const SIG="x-cwl-collector-cron-signature";
const SIGNING_CONTEXT="cwl:collector:cron:v1"; // mirrored by SQL verifier

export const hasCronHeaders=request=>
  request.headers.has(AT)||request.headers.has(SIG);

export function validCronHeaderShape(request,{now=Date.now()}={}){
  const at=request.headers.get(AT)||"";
  const signature=request.headers.get(SIG)||"";
  if(request.headers.has("authorization")||
     !/^\d{10}$/.test(at)||!/^[a-f0-9]{64}$/.test(signature))
    return null;
  const seconds=Number(at);
  const age=Math.floor(now/1000)-seconds;
  if(!Number.isSafeInteger(seconds)||age < -15||age > 90)return null;
  return {at:seconds,signature};
}

export async function verifyIndependentCron(request,settings,{
  now=Date.now(),fetcher=fetch
}={}){
  const data=validCronHeaderShape(request,{now});
  if(!data)return false;
  try{
    const r=await fetcher(settings.url+"/rest/v1/rpc/cwl_verify_collector_cron_request",{
      method:"POST",
      headers:{
        apikey:settings.key,
        Authorization:"Bearer "+settings.key,
        "Content-Type":"application/json",
        Accept:"application/json"
      },
      body:JSON.stringify({p_timestamp:data.at,p_signature:data.signature}),
      signal:AbortSignal.timeout(4000)
    });
    if(!r.ok)return false;
    return (await r.json())===true;
  }catch{return false}
}
