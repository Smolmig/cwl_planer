"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const load=()=>import(pathToFileURL(path.join(root,"cwl-stats-core.mjs")).href);
const war=(key,type,date,roster=null,finalized=false)=>({
 clan_id:"demo-clan",war_key:key,war_type:type,started_at:date,
 team_size:15,opponent_name:"Example",source:roster?"api":"import",
 roster_tags:roster,finalized
});
const attack=(war_key,tag,stars,attacker_th,defender_th)=>({
 war_key,attacker_tag:tag,attacker_name:tag,attacker_th,defender_th,
 stars,destruction:stars===3?100:74,attack_order:1
});
test("Historical import accepts the current clan and rejects duplicate or foreign data",async()=>{
 const {validateHistoryFile}=await load();
 const h={kind:"cwl-stats-history",format:1,clanTag:"#99JP2RL2",
 wars:[{war_key:"cp:123",war_type:"normal",started_at:"2026-10-25T12:00:00Z",
  team_size:15,opponent_tag:"#2JGC",opponent_name:"Gegner"}],
 attacks:[{war_key:"cp:123",attacker_tag:"#2PYL",attack_order:7,
  attacker_name:"Name",attacker_th:18,defender_tag:"#8PY",defender_name:"Base",
  defender_th:18,stars:3,destruction:100}]};
 const result=validateHistoryFile(h,"#99JP2RL2");
 assert.equal(result.wars.length,1);
 assert.equal(result.attacks.length,1);
 assert.equal(result.attacks[0].stars,3);
 assert.throws(()=>validateHistoryFile(h,"#2JGC2J8VG"),/falscher Clan-Tag/);
 const dup=structuredClone(h);dup.attacks.push({...dup.attacks[0]});
 assert.throws(()=>validateHistoryFile(dup,h.clanTag),/doppelte Angriffszeile/);
});
test("Hit rate uses 3 stars/attacks and same-or-higher TH filter only counts eligible attacks",async()=>{
 const {computeWarStats}=await load();
 const w=[war("cw:1","normal","2026-10-30T00:00:00Z"),war("cwl:2","cwl","2026-10-28T00:00:00Z")];
 const a=[attack("cw:1","#2PYL",3,18,17),attack("cwl:2","#2PYL",2,18,19),
  attack("cwl:2","#8PY",3,18,18)];
 let s=computeWarStats(w,a,{type:"all",last:25});
 assert.equal(s.attacks,3);assert.equal(s.hitRate,67);
 assert.equal(s.misses,null,"Historical missed counts cannot be inferred");
 s=computeWarStats(w,a,{type:"all",last:25,sameHigher:true});
 assert.equal(s.attacks,2);assert.equal(s.hitRate,50);
 s=computeWarStats(w,a,{type:"cwl",last:25});
 assert.equal(s.wars,1);assert.equal(s.hitRate,50);
 s=computeWarStats(w,a,{type:"normal",last:25});
 assert.equal(s.wars,1);assert.equal(s.hitRate,100);
});
test("Historical missed attacks never display fake zeros and proven API lineups count misses",async()=>{
 const {computeWarStats}=await load();
 const w=[{...war("cwl:ok","cwl","2026-11-01T00:00:00Z",["#2PYL","#8PY"],true),team_size:2}];
 const a=[attack("cwl:ok","#2PYL",3,18,18)];
 const stats=computeWarStats(w,a,{});
 assert.equal(stats.misses,1); // Two roster positions, one observed attack.
 const absent=stats.rows.find(r=>r.tag==="#8PY");
 assert.equal(absent.missed,1);
 assert.equal(absent.attacks,0);
 assert.equal(stats.rows.find(r=>r.tag==="#2PYL").missed,0);
});
test("Stats UI, migration and data version are independent from the manual planner",async()=>{
 const source=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 const client=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
 const migration=fs.readFileSync(path.join(root,"supabase/migrations/20261031125500_cwl_private_attack_history_stats.sql"),"utf8");
 const stats=fs.readFileSync(path.join(root,"cwl-stats.mjs"),"utf8");
 assert.match(source,/id="view-stats"/);
 assert.match(source,/id="statsNav"/);
 assert.match(source,/id="statsSameTH"/);
 assert.match(source,/const DATA_VERSION=9/);
 assert.match(client,/createCloudStats/);
 assert.match(client,/onSnapshot:data=>stats.captureCwl/);
 assert.match(stats,/validateHistoryFile/);
 assert.match(migration,/enable row level security/);
 assert.match(migration,/private\.cwl_is_member/);
 assert.match(migration,/private\.cwl_can_edit/);
});
