// Server-only deployment fallback. The committed configuration denies all.
// An explicit environment setting, including an empty string, overrides it.
// Never commit tenant/owner UUIDs or expose grant records to clients.
export const DEPLOYMENT_AUTO_GRANTS="";
export function autoGrantRecords(environment,fallback=DEPLOYMENT_AUTO_GRANTS){
 return typeof environment==="string"?environment:fallback;
}
