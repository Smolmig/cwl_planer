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
