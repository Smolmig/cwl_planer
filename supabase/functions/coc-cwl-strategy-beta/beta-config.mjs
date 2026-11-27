// App-wide for linked, authorized cloud clans. Explicit server kill switch.
// Unknown values fail closed. No private tenant list.
export function betaEnabled(value){return value===undefined||value==="true"}
