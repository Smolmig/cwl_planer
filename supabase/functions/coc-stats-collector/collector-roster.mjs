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
