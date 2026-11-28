// #44 first target suggestion prototype. Read-only, actual preparation roster,
// one primary target per attacker. No in-game actions, no automatic plan change.
const TAG=/^#[0289PYLQGRJCUV]{3,15}$/;
const tag=v=>typeof v==="string"?v.trim().toUpperCase():"";
const th=v=>Number.isInteger(v)&&v>=3&&v<=30;
const finite=v=>typeof v==="number"&&Number.isFinite(v);
function ordered(rows,n){
 if(!Array.isArray(rows)||rows.length!==n)return null;
 const tags=new Set(),positions=new Set(),out=[];
 for(const m of rows){
  const p=tag(m?.tag);
  if(!TAG.test(p)||tags.has(p)||!th(m.townHall)||!Number.isInteger(m.mapPosition)||m.mapPosition<1||m.mapPosition>n||positions.has(m.mapPosition))return null;
  tags.add(p);positions.add(m.mapPosition);out.push({tag:p,townHall:m.townHall,mapPosition:m.mapPosition});
 }
 return out.sort((a,b)=>a.mapPosition-b.mapPosition);
}
export function previewStrategicTargets({group,evidence,selectedClanTag,season,day,asOf}={}){
 const own=tag(selectedClanTag);
 if(!TAG.test(own)||!group||group.selectedClanTag!==own||group.season!==season||
  !finite(asOf)||group.asOf!==asOf||evidence?.asOf!==asOf||!Array.isArray(evidence.profiles)||
  !Array.isArray(group.upcoming)||!Array.isArray(group.profiles))throw Error("invalid_target_scope");
 const match=group.upcoming.find(r=>r.day===day&&r.status==="confirmed_preparation_roster");
 const unavailable=reason=>({ok:false,reason,mirror:[],proposal:[],changes:[],calibrated:false});
 if(!match||![15,30].includes(match.teamSize))return unavailable("no_confirmed_preparation");
 const ours=ordered(match.ownRoster,match.teamSize),theirs=ordered(match.roster,match.teamSize);
 if(!ours||!theirs||ours.some(m=>theirs.some(t=>t.tag===m.tag)))return unavailable("incomplete_positions");
 const profiles=new Map();
 for(const p of evidence.profiles){
  const t=tag(p.playerTag);
  if(profiles.has(t))throw Error("duplicate_profile");
  profiles.set(t,p);
 }
 // Direct context evidence only, not inferred from a different TH matchup.
 // Conservative constants; no probability or exact expected result.
 function cell(a,b){
  const p=profiles.get(a.tag);
  if(p?.townHall!==a.townHall||!Array.isArray(p.contexts))return null;
  const cells=p.contexts.filter(c=>c.attackerTh===a.townHall&&c.defenderTh===b.townHall&&
    ["normal","cwl"].includes(c.kind)&&Number.isInteger(c.n)&&c.n>0&&finite(c.smoothedStars)&&c.smoothedStars>=0&&c.smoothedStars<=3);
  if(new Set(cells.map(c=>c.kind)).size!==cells.length)return null;
  const n=cells.reduce((s,c)=>s+c.n,0),w=cells.reduce((s,c)=>s+c.n*(c.kind==="cwl"?2:1),0);
  if(n<4||!w)return null;
  return {n,index:cells.reduce((s,c)=>s+c.smoothedStars*c.n*(c.kind==="cwl"?2:1),0)/w};
 }
 const make=(a,b)=>{
  const e=cell(a,b),p=group.profiles.find(p=>p.clanTag===match.opponentTag&&p.playerTag===b.tag&&p.townHall===b.townHall);
  // Defense is explanatory only. No unverified layout effect in score.
  return {attackerTag:a.tag,attackerPosition:a.mapPosition,attackerTh:a.townHall,targetTag:b.tag,targetPosition:b.mapPosition,targetTh:b.townHall,
   evidenceN:e?.n??0,index:e?.index??null,defense:p?{observedWars:p.defense.observedWars,tripledWars:p.defense.tripledWars,layoutUnverified:true}:null};
 };
 const assigned=[...theirs],mirror=ours.map((a,i)=>make(a,theirs[i]));
 // Disjoint pair swaps from mirror. Each pair needs all four observed
 // contexts and clear net gain without materially worsening either attacker.
 // This intentionally does not search arbitrary long permutations.
 const options=[];
 for(let i=0;i<ours.length;i++)for(let j=i+1;j<ours.length;j++){
  const a=ours[i],b=ours[j],x=theirs[i],y=theirs[j];
  const ax=cell(a,x),by=cell(b,y),ay=cell(a,y),bx=cell(b,x);
  if(!ax||!by||!ay||!bx)continue;
  const da=ay.index-ax.index,db=bx.index-by.index,gain=da+db;
  if(gain>=.25&&da>=-.08&&db>=-.08)options.push({i,j,gain});
 }
 options.sort((a,b)=>b.gain-a.gain||a.i-b.i||a.j-b.j);
 const changed=new Set(),changes=[];
 for(const o of options){
  if(changed.has(o.i)||changed.has(o.j))continue;
  [assigned[o.i],assigned[o.j]]=[assigned[o.j],assigned[o.i]];
  changed.add(o.i);changed.add(o.j);
  changes.push({attackers:[ours[o.i].tag,ours[o.j].tag],reason:"comparable_context_advantage",requiresInGameCoordination:true});
 }
 return {ok:true,season,day,warTag:match.warTag,mirror,proposal:ours.map((a,i)=>make(a,assigned[i])),changes,
  calibrated:false,requiresConfirmation:changes.length>0,
  limitations:["mirror_default","limited_matchup_samples","no_layout_identity","no_star_prediction","no_automatic_assignment"]};
}

// Live cleanup: one optional distinct target per remaining attack. A
// deterministic weighted matching, including dummy "no suggestion" columns.
// No claim of a particular base layout or guaranteed extra stars.
function maximumAssignment(weights){
 const n=weights.length,m=weights[0]?.length||0;
 if(!n)return [];
 const u=Array(n+1).fill(0),v=Array(m+1).fill(0),p=Array(m+1).fill(0),way=Array(m+1).fill(0);
 for(let i=1;i<=n;i++){
  p[0]=i;let j0=0;const min=Array(m+1).fill(Infinity),used=Array(m+1).fill(false);
  do{
   used[j0]=true;const i0=p[j0];let delta=Infinity,j1=0;
   for(let j=1;j<=m;j++)if(!used[j]){
    const cur=-weights[i0-1][j-1]-u[i0]-v[j];
    if(cur<min[j]){min[j]=cur;way[j]=j0}
    if(min[j]<delta){delta=min[j];j1=j}
   }
   for(let j=0;j<=m;j++)if(used[j]){u[p[j]]+=delta;v[j]-=delta}else min[j]-=delta;
   j0=j1;
  }while(p[j0]!==0);
  do{const j1=way[j0];p[j0]=p[j1];j0=j1}while(j0);
 }
 const assigned=Array(n).fill(-1);for(let j=1;j<=m;j++)if(p[j])assigned[p[j]-1]=j-1;return assigned;
}
export function previewLiveStrategicTargets({group,evidence,selectedClanTag,season,asOf,now=asOf}={}){
 if(!group||group.selectedClanTag!==selectedClanTag||group.season!==season||group.asOf!==asOf||
  evidence?.asOf!==asOf||!Array.isArray(evidence.profiles)||!finite(now)||now<asOf||now-asOf>=300000)return [];
 const profiles=new Map(evidence.profiles.map(p=>[tag(p.playerTag),p]));
 if(profiles.size!==evidence.profiles.length)return [];
 const out=[];
 for(const w of group.liveTargets||[]){
  const actual=group.wars?.find(x=>x.day===w.day&&x.warTag===w.warTag&&x.state==="inWar");
  if(!actual||![15,30].includes(w.teamSize)||actual.teamSize!==w.teamSize||w.observedAt!==group.observedAt||
   !finite(w.endAt)||w.endAt<=now||!Array.isArray(w.attackers)||w.attackers.length>w.teamSize||
   !Array.isArray(w.targets)||w.targets.length!==w.teamSize||!Array.isArray(actual.ownRoster))continue;
  const validPosition=m=>th(m?.townHall)&&Number.isInteger(m.mapPosition)&&m.mapPosition>=1&&m.mapPosition<=w.teamSize;
  if(w.attackers.some(m=>!validPosition(m)||!actual.ownRoster.some(a=>a.tag===m.tag&&a.mapPosition===m.mapPosition&&a.townHall===m.townHall))||
   new Set(w.attackers.map(m=>m.tag)).size!==w.attackers.length||new Set(w.attackers.map(m=>m.mapPosition)).size!==w.attackers.length||
   w.targets.some(m=>!validPosition(m)||!Number.isInteger(m.stars)||m.stars<0||m.stars>3||!Number.isInteger(m.hits)||m.hits<0||m.hits>w.teamSize||!finite(m.destruction)||m.destruction<0||m.destruction>100||
    m.hits===0&&(m.stars!==0||m.destruction!==0)||(m.stars===3)!==(m.destruction===100))||new Set(w.targets.map(m=>m.mapPosition)).size!==w.teamSize)continue;
  const attackers=[...w.attackers].sort((a,b)=>a.mapPosition-b.mapPosition);
  const available=w.targets.filter(t=>t.stars<3).sort((a,b)=>a.mapPosition-b.mapPosition);
  function matchup(a,b){
   const p=profiles.get(a.tag),cells=(p?.contexts||[]).filter(c=>c.attackerTh===a.townHall&&c.defenderTh===b.townHall&&["normal","cwl"].includes(c.kind)&&Number.isInteger(c.n)&&c.n>0&&finite(c.smoothedStars)&&c.smoothedStars>=0&&c.smoothedStars<=3);
   const n=cells.reduce((s,c)=>s+c.n,0),total=cells.reduce((s,c)=>s+c.n*(c.kind==="cwl"?2:1),0);
   const known=p?.townHall===a.townHall&&n>=4&&total>0&&new Set(cells.map(c=>c.kind)).size===cells.length;
   const index=known?cells.reduce((s,c)=>s+c.smoothedStars*c.n*(c.kind==="cwl"?2:1),0)/total:Math.max(0,2.5-.45*Math.max(0,b.townHall-a.townHall));
   // Heuristic incremental-star index, not an expected value. Favor
   // mirror on close scores; avoid unsupported difficult cleanup.
   const gain=index-b.stars;
   const score=gain>0.08?Math.max(0,Math.round(100*gain)+(a.mapPosition===b.mapPosition?8:0)):0;
   return {score,evidenceN:known?n:0};
  }
  const cells=attackers.map(a=>available.map(b=>matchup(a,b)));
  const assigned=maximumAssignment(cells.map(row=>[...row.map(c=>c.score),...attackers.map(()=>0)]));
  const suggestions=attackers.map((a,i)=>{
   const j=assigned[i],b=available[j],c=cells[i][j];
   return {attackerTag:a.tag,attackerPosition:a.mapPosition,attackerTh:a.townHall,
    targetPosition:c?.score>0?b.mapPosition:null,targetTh:c?.score>0?b.townHall:null,
    currentStars:c?.score>0?b.stars:null,currentDestruction:c?.score>0?b.destruction:null,evidenceN:c?.score>0?c.evidenceN:0};
  });
  out.push({day:w.day,warTag:w.warTag,openAttacks:attackers.length,untripledBases:available.length,
   expiresAt:Math.min(w.endAt,asOf+300000),suggestions,calibrated:false});
 }
 return out;
}
