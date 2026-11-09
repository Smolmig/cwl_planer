const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const load=()=>import(pathToFileURL(path.join(root,"cwl-live-core.mjs")).href);
const time=Date.parse("2026-11-05T10:00:00Z");
function snapshot() {
 const members=[
  {tag:"#2PYL",name:"Alpha",townHallLevel:19,attacks:[{attackerTag:"#2PYL",defenderTag:"#Q2V",stars:3,destructionPercentage:100}]},
  {tag:"#JRC",name:"Bravo",townHallLevel:18,attacks:[]}
 ];
 const enemy=[
  {tag:"#Q2V",name:"Gegner A",townHallLevel:20,attacks:[]},
  {tag:"#8PY",name:"Gegner B",townHallLevel:19,attacks:[]}
 ];
 return {ok:true,active:true,clanTag:"#2PQ",season:"2026-11",
  rounds:[{day:1,available:true,warTag:"#PLQ",state:"warEnded",teamSize:2,
    endTime:"20261104T020000.000Z",startTime:"20261103T020000.000Z",
    clan:{tag:"#2PQ",name:"Unsere",members},opponent:{tag:"#JQV",name:"Andere",members:enemy}},
   ...Array.from({length:6},(_,i)=>({day:i+2,available:false}))]};
}
function profile() {
 return {config:{slots:2,days:7},members:[
  {id:"member1",name:"Alpha",playerTag:"#2PYL",threeStar:"high"}],
  archivedMembers:[],locks:Array.from({length:7},()=>({locked:false,lineup:[]}))};
}
test("CWL opponent, enemy TH and attack results are retained",async()=>{
 const {sanitizeSnapshot}=await load();
 const snap=sanitizeSnapshot(snapshot());
 assert.equal(snap.rounds[0].opponent.name,"Andere");
 assert.deepEqual(snap.rounds[0].opponent.members.map(m=>m.townHallLevel),[20,19]);
 assert.equal(snap.rounds[0].clan.members[0].attacks[0].stars,3);
 assert.equal(snap.rounds[0].clan.members[0].attacks[0].destructionPercentage,100);
 assert.equal(snap.rounds[1].available,false);
});
test("Only finished wars with complete actual lineups can be auto-confirmed",async()=>{
 const {reconcileCwl}=await load();
 const p=profile();
 let uid=1;
 const apply=()=>reconcileCwl(p,snapshot(),name=>({id:"new_"+uid++,name,threeStar:"unknown"}),time);
 const first=apply();
 assert.deepEqual(first.lockedDays,[1]);
 assert.deepEqual(p.locks[0].lineup,["member1","new_1"]);
 assert.equal(p.locks[0].source,"coc-api");
 assert.equal(p.locks[0].warTag,"#PLQ");
 assert.equal(p.archivedMembers[0].name,"Bravo");
 assert.equal(p.members.length,1);
 const second=apply();
 assert.equal(second.changed,false);
 assert.deepEqual(second.lockedDays,[]);
 assert.equal(p.archivedMembers.length,1);
 assert.equal(p.locks.filter(l=>l.locked).length,1);
});
test("Unfinished wars, mismatched team sizes and placeholder wars cannot close days",async()=>{
 const {reconcileCwl}=await load();
 for(const mutate of [
  p=>p.rounds[0].state="inWar",
  p=>p.rounds[0].warTag="#0",
  p=>p.rounds[0].teamSize=15,
  p=>p.rounds[0].clan.members.pop(),
  p=>p.rounds[0].endTime="20261106T020000.000Z"
 ]) {
  const snap=snapshot();mutate(snap);
  const p=profile();
  const result=reconcileCwl(p,snap,name=>({id:name,name}),time);
  assert.deepEqual(result.lockedDays,[]);
  assert.equal(p.locks[0].locked,false);
 }
});
test("Manual played history and earlier seasons are never overwritten",async()=>{
 const {reconcileCwl}=await load();
 const p=profile();
 p.locks[0]={locked:true,lineup:["manual1","manual2"]};
 const untouched=JSON.stringify(p.locks[0]);
 const result=reconcileCwl(p,snapshot(),name=>({id:name,name}),time);
 assert.equal(result.reason,"unlinked_manual_history");
 assert.equal(JSON.stringify(p.locks[0]),untouched);
 p.cwlLive={season:"2026-10",clanTag:"#2PQ",rounds:[]};
 assert.equal(reconcileCwl(p,snapshot(),name=>({id:name,name}),time).reason,"previous_season_locked");
 assert.equal(JSON.stringify(p.locks[0]),untouched);
});
test("Intentional CWL reset ignores the previous season rather than relocking it",async()=>{
 const {reconcileCwl}=await load();
 const p=profile();p.cwlLiveIgnoredSeason="2026-11";
 assert.equal(reconcileCwl(p,snapshot(),name=>({id:name,name}),time).reason,"season_explicitly_reset");
 assert.equal(p.locks[0].locked,false);
});
test("Without a CWL the normal v9 plan stays untouched",async()=>{
 const {reconcileCwl}=await load();
 const p=profile();
 assert.equal(reconcileCwl(p,{ok:true,active:false},name=>({id:name,name}),time).changed,false);
 assert.equal(p.cwlLive,undefined);
});
test("Cloud only: server endpoint is authenticated and app retains local planner",()=>{
 const proxy=fs.readFileSync(path.join(root,"supabase/functions/coc-cwl-status/index.ts"),"utf8");
 const mod=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
 const cloud=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 const guest=fs.readFileSync(path.join(root,"index.html"),"utf8");
 assert.match(proxy,/withSupabase\(\{auth:"user"\}/);
 assert.match(proxy,/cwl_clan_memberships/);
 assert.match(proxy,/COC_API_KEY/);
 assert.match(proxy,/currentwar\/leaguegroup/);
 assert.match(proxy,/clanwarleagues\/wars/);
 assert.doesNotMatch(mod,/COC_API_KEY|Bearer .*COC_/);
 assert.match(mod,/createCwlLive/);
 assert.match(cloud,/const DATA_VERSION=9;/);
 assert.match(cloud,/const STORAGE_KEY="cwl_planer_mobile_v9";/);
 assert.match(guest,/const APP_VERSION="v1\.0\.2";/);
});

test("CWL presentation module parses and exports the live UI factory",async()=>{
 const live=await import(pathToFileURL(path.join(root,"cwl-live.mjs")).href);
 assert.equal(typeof live.createCwlLive,"function");
});


test("Official war stars are distinct from player attack totals; badges use the Clash asset host",async()=>{
 const {sanitizeSnapshot,safeBadgeUrl}=await load();
 const snap=snapshot();
 snap.rounds[0].clan.stars=35;
 snap.rounds[0].opponent.stars=27;
 snap.rounds[0].clan.destructionPercentage=91.75;
 snap.rounds[0].opponent.destructionPercentage=85.12;
 snap.rounds[0].clan.badgeUrl="https://api-assets.clashofclans.com/badges/200/clan.png";
 snap.rounds[0].opponent.badgeUrl="https://api-assets.clashofclans.com/badges/200/opponent.png";
 const round=sanitizeSnapshot(snap).rounds[0];
 assert.equal(round.clan.stars,35);
 assert.equal(round.opponent.stars,27);
 assert.equal(round.clan.members[0].attacks[0].stars,3);
 assert.equal(round.clan.destructionPercentage,91.75);
 assert.equal(round.opponent.destructionPercentage,85.12);
 assert.match(round.clan.badgeUrl,/api-assets\.clashofclans\.com\/badges/);
 assert.match(round.opponent.badgeUrl,/api-assets\.clashofclans\.com\/badges/);
 assert.equal(safeBadgeUrl("javascript:alert(1)"),null);
 assert.equal(safeBadgeUrl("https://evil.example/badges/200/x.png"),null);
 assert.equal(safeBadgeUrl("http://api-assets.clashofclans.com/badges/200/x.png"),null);
 assert.equal(safeBadgeUrl("https://api-assets.clashofclans.com.evil.example/badges/200/x.png"),null);
 assert.equal(safeBadgeUrl("https://api-assets.clashofclans.com/else/x.png"),null);
 snap.rounds[0].clan.stars=null;
 snap.rounds[0].clan.badgeUrl="https://evil.example/x.png";
 const missing=sanitizeSnapshot(snap).rounds[0].clan;
 assert.equal(missing.stars,null,"Missing score cannot become zero");
 assert.equal(missing.badgeUrl,null,"Untrusted image origins are discarded");
 snap.rounds[0].clan.stars=0;
 assert.equal(sanitizeSnapshot(snap).rounds[0].clan.stars,0,"Real zero score must remain visible");
});
test("Server-side CWL API maps official war stars, image URLs, and group fallback",()=>{
 const proxy=fs.readFileSync(path.join(root,"supabase/functions/coc-cwl-status/index.ts"),"utf8");
 assert.match(proxy,/stars:safeStars\(s\?\.stars\)/);
 assert.match(proxy,/badgeUrl:safeBadge\(s\?\.badgeUrls\)\|\|safeBadge\(fromGroup\?\.badgeUrls\)/);
 assert.match(proxy,/groupClans/);
 assert.match(proxy,/hostname==="api-assets\.clashofclans\.com"/);
});


test("Live attack rows prioritize open attacks only during battle and retain target RH",async()=>{
 const {sanitizeSnapshot,cwlAttackRows}=await load();
 const data=snapshot();
 data.rounds[0].state="inWar";
 // Alpha has one 3-star attack against a known RH20 opponent; Bravo is open.
 let round=sanitizeSnapshot(data).rounds[0];
 let rows=cwlAttackRows(round);
 assert.equal(rows.length,2);
 assert.equal(rows[0].player.name,"Bravo");
 assert.equal(rows[0].attack,null);
 assert.equal(rows[1].player.name,"Alpha");
 assert.equal(rows[1].attack.stars,3);
 assert.equal(rows[1].attack.destructionPercentage,100);
 assert.equal(rows[1].target.name,"Gegner A");
 assert.equal(rows[1].target.townHallLevel,20);
 data.rounds[0].state="warEnded";
 round=sanitizeSnapshot(data).rounds[0];
 rows=cwlAttackRows(round);
 assert.deepEqual(rows.map(x=>x.player.name),["Alpha","Bravo"]);
});
test("Unknown targets and multiple attacks are displayed separately, without guesswork",async()=>{
 const {sanitizeSnapshot,cwlAttackRows}=await load();
 const data=snapshot();
 data.rounds[0].clan.members[0].attacks.push({
   attackerTag:"#2PYL",defenderTag:"#PGV",stars:2,destructionPercentage:82
 });
 const rows=cwlAttackRows(sanitizeSnapshot(data).rounds[0]);
 assert.equal(rows.length,3);
 assert.equal(rows[0].attack.stars,3);
 assert.equal(rows[1].attack.stars,2);
 assert.equal(rows[1].target,null);
 assert.equal(rows[2].player.name,"Bravo");
});


test("CWL near-end attention is read-only; an attack five minutes before end clears the notice",async()=>{
 const {cwlAttackReminder,sanitizeSnapshot}=await load();
 const now=Date.parse("2026-11-05T10:00:00Z");
 const data=snapshot();
 const r=data.rounds[0];
 r.state="inWar";
 r.startTime="20261104T103000.000Z";
 r.endTime="20261105T103000.000Z";
 let note=cwlAttackReminder(sanitizeSnapshot(data).rounds[0],now);
 assert.deepEqual({kind:note.kind,day:note.day,minutes:note.minutesLeft,
  players:note.players.map(p=>p.name)},{kind:"open",day:1,minutes:30,players:["Bravo"]});
 // No notification hours before the end (avoids persistent alarm).
 assert.equal(cwlAttackReminder(sanitizeSnapshot(data).rounds[0],now-90*60*1000),null);
 // A player uses their last chance. They must not be penalized.
 r.clan.members[1].attacks=[{attackerTag:"#JRC",defenderTag:"#8PY",stars:2,destructionPercentage:80}];
 assert.equal(cwlAttackReminder(sanitizeSnapshot(data).rounds[0],now+25*60*1000),null);
 assert.equal(cwlAttackReminder(sanitizeSnapshot(data).rounds[0],now+31*60*1000),null);
});

test("CWL absence is confirmed only after complete finished war and never mutates player state",async()=>{
 const {cwlAttackReminder,sanitizeSnapshot}=await load();
 const now=Date.parse("2026-11-05T10:00:00Z");
 const data=snapshot(),round=data.rounds[0];
 const before=JSON.stringify(data);
 const note=cwlAttackReminder(sanitizeSnapshot(data).rounds[0],now);
 assert.deepEqual({kind:note.kind,players:note.players.map(p=>p.tag)},
  {kind:"confirmed",players:["#JRC"]});
 assert.equal(JSON.stringify(data),before,"The API observation must be read-only");
 const incomplete=snapshot();
 incomplete.rounds[0].clan.members.pop();
 assert.equal(cwlAttackReminder(sanitizeSnapshot(incomplete).rounds[0],now),null);
 const notFinished=snapshot();
 notFinished.rounds[0].endTime="20261106T020000.000Z";
 assert.equal(cwlAttackReminder(sanitizeSnapshot(notFinished).rounds[0],now),null);
 const unresolved=snapshot();
 unresolved.rounds[0].state="inWar";
 // Clash may still show an old "inWar" state after deadline. Do not assume missed.
 assert.equal(cwlAttackReminder(sanitizeSnapshot(unresolved).rounds[0],now),null);
});

test("CWL alert is advisory only and never auto-pauses, changes rules or writes a plan",()=>{
 const live=fs.readFileSync(path.join(root,"cwl-live.mjs"),"utf8");
 const helpers=fs.readFileSync(path.join(root,"cwl-live-core.mjs"),"utf8");
 assert.match(live,/cwlAttackReminder/);
 assert.match(live,/Nur Hinweis, kein automatischer Wechsel/);
 assert.match(live,/attention\.kind==="open"/);
 assert.ok(live.includes("const attention=fresh?"));
 const begin=helpers.indexOf("export function cwlAttackReminder(");
 const end=helpers.indexOf("// Read-only preview:",begin);
 assert.ok(begin>=0&&end>begin,"Only the newly added reminder must be free of profile writes");
 const reminder=helpers.slice(begin,end);
 assert.doesNotMatch(reminder,/\.participating\s*=\s*false|\.statuses\s*=|\.locks\s*=|profile\.members/);
});


test("CWL 60-minute reminder needs a real war key and verified attack-log coverage",async()=>{
 const {cwlAttackReminder,sanitizeSnapshot}=await load();
 const data=snapshot(),round=data.rounds[0];
 round.state="inWar";
 round.startTime="20261104T110000.000Z";
 round.endTime="20261105T110000.000Z";
 const end=Date.parse("2026-11-05T11:00:00Z");
 for(const [minutes,expected] of [[65,false],[60,true],[45,true],[10,true],[0,false],[-5,false]]){
  const note=cwlAttackReminder(sanitizeSnapshot(data).rounds[0],end-minutes*60000);
  assert.equal(!!note,expected,"minute "+minutes);
  if(note){assert.equal(note.warTag,round.warTag);assert.equal(note.players.length,1)}
 }
 round.warTag="#BAD";
 assert.equal(cwlAttackReminder(sanitizeSnapshot(data).rounds[0],end-45*60000),null);
 round.warTag="#2PYL";
 round.clan.members[1].attacks=undefined;
 assert.equal(cwlAttackReminder(sanitizeSnapshot(data).rounds[0],end-45*60000),null,
   "missing list is unknown, not an unspent chance");
 round.clan.members[1].attacks=[{attackerTag:"#JRC",defenderTag:"#PPQ",stars:4,destructionPercentage:80}];
 assert.equal(cwlAttackReminder(sanitizeSnapshot(data).rounds[0],end-45*60000),null,
   "invalid attack is not a fake missed attack");
 round.clan.members[1].attacks=[];
 round.clan.members.push({...round.clan.members[1]});
 assert.equal(cwlAttackReminder(sanitizeSnapshot(data).rounds[0],end-45*60000),null,
   "duplicate tag or incomplete roster blocks notification");
});

test("CWL reminder acknowledgement stays local; stale data and viewer roles are protected",()=>{
 const live=fs.readFileSync(path.join(root,"cwl-live.mjs"),"utf8");
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 assert.match(live,/cwlReminderAckKey/);
 assert.match(live,/cwl-attention-ack/);
 assert.match(live,/cwl-attention-reset/);
 assert.match(live,/writeCwlReminderAck/);
 assert.match(live,/lastSuccessfulProfile===active\.profile/);
 assert.match(live,/staleAttention/);
 assert.match(live,/Datenstand unklar/);
 assert.match(live,/active\.role!=="viewer"/);
 assert.match(html,/auf diesem Gerät/);
});

test("Running CWL attacks are documented before war end; no fake zero or missed attack",async()=>{
 const {sanitizeSnapshot,recordedCwlAttackResults}=await load();
 const data=snapshot();
 const first=data.rounds[0];
 first.state="inWar";
 first.clan.members[0].attacks[0].destructionPercentage=99.75;
 first.clan.members[1].attacks=[]; // Still has time to attack.
 const running=recordedCwlAttackResults(sanitizeSnapshot(data));
 assert.deepEqual(Object.keys(running),["1"]);
 assert.equal(running[1]["#2PYL"].stars,3);
 assert.equal(running[1]["#2PYL"].percent,99.75);
 assert.equal(running[1]["#2PYL"].state,"inWar");
 assert.equal(running[1]["#JRC"],undefined,"absence in battle is NOT a miss");
 // A real 0-star attack is nevertheless evidence, and two players must
 // never be conflated even against the same enemy base.
 first.clan.members[1].attacks=[{attackerTag:"#JRC",defenderTag:"#Q2V",
  stars:0,destructionPercentage:44.5}];
 const withZero=recordedCwlAttackResults(sanitizeSnapshot(data));
 assert.equal(withZero[1]["#JRC"].stars,0);
 assert.equal(withZero[1]["#JRC"].percent,44.5);
 assert.equal(withZero[1]["#2PYL"].stars,3);
 first.state="warEnded";
 first.clan.members[1].attacks=[];
 const ended=recordedCwlAttackResults(sanitizeSnapshot(data));
 assert.equal(ended[1]["#2PYL"].stars,3);
 assert.deepEqual({missed:ended[1]["#JRC"].missed,state:ended[1]["#JRC"].state},
  {missed:true,state:"warEnded"});
 // No double-counting on another read or after day completion.
 assert.deepEqual(recordedCwlAttackResults(sanitizeSnapshot(data)),ended);
 // Preparation, invalid roster, mismatched clan, and old/unknown seasons
 // must never manufacture executed attacks.
 const preparation=structuredClone(data);preparation.rounds[0].state="preparation";
 assert.equal(recordedCwlAttackResults(sanitizeSnapshot(preparation))[1],undefined);
 const incomplete=structuredClone(data);incomplete.rounds[0].teamSize=3;
 assert.equal(recordedCwlAttackResults(sanitizeSnapshot(incomplete))[1],undefined);
 assert.deepEqual(recordedCwlAttackResults({...sanitizeSnapshot(data),clanTag:"#9PP"}),{});
 assert.deepEqual(recordedCwlAttackResults({...sanitizeSnapshot(data),season:"bad"}),{});
});
