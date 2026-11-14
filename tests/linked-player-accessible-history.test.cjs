"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const mod=()=>import(pathToFileURL(path.resolve(__dirname,"../cwl-player-linked-history.mjs")).href);
const tag="#2PYL",clan="tenant-a",warKey="cp:291";
const source={
 clans:[{id:clan,name:"United Fighters",clash_tag:"#CLAN"}],
 attacks:[{clan_id:clan,war_key:warKey,attack_order:1,attacker_tag:tag,attacker_th:18,stars:3}],
 wars:[{clan_id:clan,war_key:warKey,war_type:"normal",started_at:"2026-11-08T00:00:00Z",source:"import",finalized:true}]
};
test("Clash player tag joins per-war facts, not names or old RH labels",async()=>{
 const {summarizeAccessiblePlayerHistory}=await mod();
 const out=summarizeAccessiblePlayerHistory(source.clans,source.attacks,source.wars);
 assert.equal(out.length,1);
 assert.equal(out[0].clanName,"United Fighters");
 assert.equal(out[0].recordedAttacks,1);
 assert.equal(out[0].rawThreeStarRate,100);
 assert.equal(out[0].latestDocumentedTh,18);
 assert.equal(out[0].possibleDuplicateSources,false);
});
test("cross-tenant same war keys stay separate and unfinished wars are hidden",async()=>{
 const {summarizeAccessiblePlayerHistory}=await mod();
 const clans=[source.clans[0],{id:"tenant-b",name:"UF 2",clash_tag:"#UF2"}];
 const attacks=[source.attacks[0],{...source.attacks[0],clan_id:"tenant-b",stars:0}];
 const wars=[source.wars[0],{...source.wars[0],clan_id:"tenant-b",finalized:false}];
 const x=summarizeAccessiblePlayerHistory(clans,attacks,wars);
 assert.deepEqual(x.map(y=>y.clanId),[clan]);
});
test("inaccessible clans cannot be fetched and there is no unrestricted player lookup",async()=>{
 const {loadAccessiblePlayerHistory}=await mod();
 let calls=[];
 const tables={cwl_clans:source.clans,cwl_stat_attacks:source.attacks,cwl_stat_wars:source.wars};
 const sb={
  auth:{async getUser(){return {data:{user:{id:"test-user"}},error:null}}},
  from(table){
   calls.push(table);
   const state={table,filtered:tables[table]||[]};
   const chain={
    select(){return chain},
    neq(key,value){state.filtered=state.filtered.filter(row=>row[key]!==value);return chain},
    eq(key,value){state.filtered=state.filtered.filter(row=>row[key]===value);return chain},
    in(key,values){state.filtered=state.filtered.filter(row=>values.includes(row[key]));return chain},
    order(){return chain},
    limit(count){return Promise.resolve({data:state.filtered.slice(0,count),error:null})},
    range(start,end){return Promise.resolve({data:state.filtered.slice(start,end+1),error:null})}
   };
   return chain;
  }
 };
 const first=await loadAccessiblePlayerHistory(sb,tag,"current-tenant");
 assert.equal(first.clans.length,1);
 assert.equal(first.clans[0].recordedAttacks,1);
 assert.deepEqual(calls,["cwl_clans","cwl_stat_attacks","cwl_stat_wars"]);
 assert.deepEqual((await loadAccessiblePlayerHistory(sb,tag,clan)).clans,[],
  "current tenant cannot be recycled as a second clan");
});
test("authentication is required and no query runs without it",async()=>{
 const {loadAccessiblePlayerHistory}=await mod();
 let queried=false;
 const sb={auth:{async getUser(){return {data:{user:null},error:null}}},
   from(){queried=true;throw Error("should never run")}};
 await assert.rejects(loadAccessiblePlayerHistory(sb,tag,"current"),/anmelden/);
 assert.equal(queried,false);
 await assert.rejects(loadAccessiblePlayerHistory(sb,"invalid","#current"),/Ungültiges Spielerprofil/);
});
