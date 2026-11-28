// Bounded, read-only operator diagnostic. No raw provider data or identifiers
// may leave this module's report. No database writes; no tracking inference.
const validTag=x=>typeof x==="string"&&/^#[0289PYLQGRJCUV]{3,15}$/.test(x);
const object=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const nonnegative=x=>Number.isSafeInteger(x)&&x>=0;
const items=x=>Array.isArray(x)?x:Array.isArray(x?.items)?x.items:null;
const sample=(rows,predicate)=>Array.isArray(rows)&&rows.some(predicate);
const listShape=x=>Array.isArray(x)?"array":Array.isArray(x?.items)?"items":"unknown";
const seasonId=x=>typeof x==="string"&&/^[0-9]{1,20}(?:-[0-9]{2}-[0-9]{2})?$/.test(x)?x:
 nonnegative(x)?String(x):null;
export async function probeActivityApi(clanTag,read){
 if(!validTag(clanTag)||typeof read!=="function")throw Error("invalid_probe_context");
 const report={mode:"activity-probe",requests:0,endpoints:{}};
 async function get(name,path){
  report.requests++;
  let r;try{r=await read(path)}catch{r={status:"network_error"}}
  const status=Number.isInteger(r?.status)&&r.status>=100&&r.status<=599?r.status:
    r?.status==="invalid_json"?"invalid_json":"network_error";
  report.endpoints[name]={status};
  return status===200?r.body:null;
 }
 const mark=(name,fields)=>Object.assign(report.endpoints[name],fields);
 const clan="/clans/"+encodeURIComponent(clanTag);
 const roster=await get("roster",clan+"/members?limit=50");
 const player=items(roster)?.find(p=>validTag(p?.tag))?.tag;
 mark("roster",{shape:listShape(roster),hasPlayer:!!player});
 const raids=await get("raid",clan+"/capitalraidseasons?limit=2"),raidList=items(raids);
 const raidMembers=(raidList||[]).flatMap(x=>Array.isArray(x?.members)?x.members:[]);
 mark("raid",{shape:listShape(raids),hasSeason:sample(raidList,object),
   hasEndedSeason:sample(raidList,x=>x?.state==="ended"),
   hasStartEnd:sample(raidList,x=>typeof x?.startTime==="string"&&typeof x?.endTime==="string"),
   hasMemberLimits:sample(raidMembers,x=>validTag(x?.tag)&&nonnegative(x.attacks)&&nonnegative(x.attackLimit)&&nonnegative(x.bonusAttackLimit)),
   hasCapitalGold:sample(raidMembers,x=>nonnegative(x?.capitalResourcesLooted))});
 if(!player){report.playerProbe="no_observed_player";return report}
 const path="/players/"+encodeURIComponent(player);
 const profile=await get("profile",path);
 const verified=object(profile)&&profile.tag===player;
 const group=verified&&validTag(profile.currentLeagueGroupTag)?profile.currentLeagueGroupTag:null;
 const season=verified?seasonId(profile.currentLeagueSeasonId):null;
 mark("profile",{identityMatched:verified,hasCurrentGroup:!!group,hasCurrentSeason:!!season,
  hasGamesChampion:verified&&sample(profile.achievements,x=>x?.name==="Games Champion"&&nonnegative(x.value)),
  hasAttackWins:verified&&nonnegative(profile.attackWins)});
 if(!verified){report.playerProbe="profile_not_verified";return report}
 const battles=await get("battlelog",path+"/battlelog"),battleList=items(battles);
 mark("battlelog",{shape:listShape(battles),hasEntries:sample(battleList,object),
  hasRankedAttack:sample(battleList,x=>x?.battleType==="RANKED"&&x.attack===true),
  hasAttackFields:sample(battleList,x=>x?.attack===true&&typeof x.battleTimestamp==="string"&&
   ["HOME_VILLAGE","RANKED","LEGEND"].includes(x.battleType)&&nonnegative(x.stars)&&x.stars<=3&&
   typeof x.destructionPercentage==="number"&&x.destructionPercentage>=0&&x.destructionPercentage<=100)});
 const history=await get("leaguehistory",path+"/leaguehistory"),historyList=items(history);
 mark("leaguehistory",{shape:listShape(history),hasEntries:sample(historyList,object)});
 if(group&&season){
  const ranked=await get("leaguegroup","/leaguegroup/"+encodeURIComponent(group)+"/"+encodeURIComponent(season)+"?playerTag="+encodeURIComponent(player));
  mark("leaguegroup",{shape:object(ranked)?"object":"unknown",hasMembers:Array.isArray(ranked?.members),
   hasAttackLogs:Array.isArray(ranked?.attackLogs),hasDefenseLogs:Array.isArray(ranked?.defenseLogs),
   hasPlayer:sample(ranked?.members,x=>x?.tag===player||x?.playerTag===player)});
 }else report.endpoints.leaguegroup={status:"no_current_group_or_season"};
 report.playerProbe="sampled";
 return report;
}
