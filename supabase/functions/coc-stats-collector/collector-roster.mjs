// #183: validate a FULL, trusted Clash clan-members response before any
// membership-time observation. A partial page must never mark anyone absent.
import {tag,validTag} from "./collector-core.mjs";
export function rosterTags(raw){
 if(!raw||!Array.isArray(raw.items)||raw.items.length<1||raw.items.length>50||
    raw.paging?.cursors?.after||raw.paging?.cursors?.before)
  throw Error("roster_incomplete");
 const tags=raw.items.map(row=>{
  if(!row||typeof row!=="object"||typeof row.name!=="string"||
     !row.name.trim()||row.name.length>80)throw Error("roster_unverified");
  const clean=tag(row.tag);
  if(!validTag(clean))throw Error("roster_unverified");
  return clean;
 });
 if(new Set(tags).size!==tags.length)throw Error("roster_duplicates");
 return tags;
}

// Full roster detail, deliberately derived only after tag/name/completeness validation.
// A missing optional donation counter is UNKNOWN, not zero or a recorded donation.
export function rosterEvidence(raw){
 const tags=rosterTags(raw);
 return raw.items.map((member,i)=>({
  tag:tags[i],
  role:["member","admin","elder","coLeader","leader"].includes(member.role)?
    member.role:null,
  donations:Number.isSafeInteger(member.donations)&&
    member.donations>=0&&member.donations<=9999999?member.donations:null
 }));
}
