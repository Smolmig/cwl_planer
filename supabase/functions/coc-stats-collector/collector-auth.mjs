// Public-key verification for GitHub Actions' short-lived workload identity.
// No long-lived scheduler secret or Supabase service key is present in GitHub.
export const EXPECTED={
 issuer:"https://token.actions.githubusercontent.com",
 audience:"cwl-stats-collector:yjldnvfwposfwmzmcsow",
 repository:"Smolmig/cwl_planer",
 repositoryId:"1360107984",
 // GitHub currently provides the repository_id/owner_id-bound subject.
 // Match this *exact* signed value, never a wildcard or a prefix.
 subject:"repo:Smolmig@323628566/cwl_planer@1360107984:ref:refs/heads/main",
 ref:"refs/heads/main",
 workflowRef:"Smolmig/cwl_planer/.github/workflows/collect-war-stats.yml@refs/heads/main"
};
const JWKS="https://token.actions.githubusercontent.com/.well-known/jwks";
let cache=null,cacheUntil=0;
const bytes=part=>{
  if(!/^[a-zA-Z0-9_-]+$/.test(part)||part.length>12000)throw Error("invalid_identity");
  const raw=atob(part.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(part.length/4)*4,"="));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
};
const obj=part=>JSON.parse(new TextDecoder().decode(bytes(part)));
export async function verifyCollectorIdentity(jwt,{
  now=Date.now(),jwksLoader=null,expected=EXPECTED
}={}){
  if(typeof jwt!=="string"||jwt.length>16000||jwt.length<100)return false;
  try{
    const parts=jwt.split(".");
    if(parts.length!==3)return false;
    const [encodedHeader,encodedClaims,encodedSig]=parts;
    const header=obj(encodedHeader),claims=obj(encodedClaims);
    if(header.alg!=="RS256"||header.typ!=="JWT"||
       typeof header.kid!=="string"||!header.kid||header.kid.length>200)return false;
    const seconds=Math.floor(now/1000);
    if(claims.iss!==expected.issuer||claims.aud!==expected.audience||
       claims.repository!==expected.repository||
       String(claims.repository_id)!==expected.repositoryId||
       claims.ref!==expected.ref||claims.workflow_ref!==expected.workflowRef||
       claims.sub!==expected.subject||
       !["schedule","workflow_dispatch","push"].includes(claims.event_name)||
       !Number.isInteger(claims.exp)||claims.exp<=seconds||
       !Number.isInteger(claims.iat)||claims.iat>seconds+30||
       claims.exp-claims.iat>600||
       (claims.nbf!==undefined&&(!Number.isInteger(claims.nbf)||claims.nbf>seconds+30))
      )return false;
    let jwks;
    if(jwksLoader)jwks=await jwksLoader();
    else if(cache&&now<cacheUntil)jwks=cache;
    else{
      const response=await fetch(JWKS,{signal:AbortSignal.timeout(6500)});
      if(!response.ok)throw Error("github_jwks_unavailable");
      jwks=await response.json();
      cache=jwks;cacheUntil=now+1800000;
    }
    const key=jwks?.keys?.find(k=>k.kid===header.kid&&k.kty==="RSA"&&
      k.use==="sig"&&(!k.alg||k.alg==="RS256"));
    if(!key)return false;
    const publicKey=await crypto.subtle.importKey("jwk",key,
      {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    const data=new TextEncoder().encode(encodedHeader+"."+encodedClaims);
    const verified=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",publicKey,bytes(encodedSig),data);
    // After signature verification, log only the signed trigger type.
    // This distinguishes autonomous schedule runs from manual/push calls,
    // without exposing the JWT, identity claims, clan tags or player data.
    if(verified)console.info("collector_verified_trigger="+claims.event_name);
    return verified;
  }catch{return false}
}
