"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const base=path.join(root,"supabase/functions/coc-player-profile");
const get=()=>import(pathToFileURL(path.join(base,"profile-core.mjs")).href);
const src=()=>fs.readFileSync(path.join(base,"index.ts"),"utf8");
test("current player parser only accepts exact expected tag, official integer RH and minimal fields",async()=>{
 const {projectCurrentPlayer}=await get();
 const now="2026-11-14T12:00:00.000Z";
 const raw={tag:"#2PYL",name:"Current ⚡ Name",townHallLevel:19,
  clan:{tag:"#QPPP",name:"United Fighters",privateNotes:"secret"},
  expLevel:300,playerToken:"private"};
 assert.deepEqual(projectCurrentPlayer(raw,"#2PYL",now),{
  tag:"#2PYL",name:"Current ⚡ Name",townHallLevel:19,
  clan:{tag:"#QPPP",name:"United Fighters"},checkedAt:now
 });
 assert.equal(projectCurrentPlayer(raw,"#2PYP",now),null);
 assert.equal(projectCurrentPlayer({...raw,townHallLevel:"19"},"#2PYL",now),null);
 assert.equal(projectCurrentPlayer({...raw,townHallLevel:0},"#2PYL",now),null);
 assert.equal(projectCurrentPlayer({...raw,townHallLevel:null},"#2PYL",now),null);
 assert.equal(projectCurrentPlayer({...raw,tag:"BAD"},"#2PYL",now),null);
});
test("tags and tenant IDs are validated instead of trusting a client-supplied identity",async()=>{
 const {cleanPlayerTag,validPlayerTag,validClanId}=await get();
 assert.equal(cleanPlayerTag(" 2pyl "),"#2PYL");
 assert.equal(validPlayerTag("#2PYL"),true);
 assert.equal(validPlayerTag("#P2Y-"),false);
 assert.equal(validClanId("00000000-0000-0000-0000-000000000001"),true);
 assert.equal(validClanId("tenant-1"),false);
});
test("API endpoint verifies authenticated membership AND same-clan attack proof before API/cache",()=>{
 const s=src();
 assert.match(s,/withSupabase\(\{auth:"user"\}/);
 const a=s.indexOf('from("cwl_clan_memberships")');
 const b=s.indexOf('from("cwl_stat_attacks")');
 const c=s.indexOf("cache.get(tag)");
 const d=s.indexOf('Deno.env.get("COC_API_KEY")');
 assert.ok(a>0&&b>a&&c>b&&d>c);
 assert.match(s,/\.eq\("clan_id",clanId\)\.eq\("attacker_tag",tag\)/);
 assert.match(s,/\.eq\("user_id",ctx\.userClaims\.id\)/);
 assert.match(s,/player_not_documented/);
 assert.match(s,/reserve\(ctx.userClaims\.id,now\)/);
 assert.match(s,/encodeURIComponent\(tag\)/);
 assert.doesNotMatch(s,/service_role|serviceRole|supabaseAdmin|SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(s,/player_api_unavailable/);
});
