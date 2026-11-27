// App-wide, with explicit per-clan opt-in and a server kill switch.
// Unknown configuration values fail closed; no private grant list.
export function automaticEnabled(value){return value===undefined||value==="true"}
