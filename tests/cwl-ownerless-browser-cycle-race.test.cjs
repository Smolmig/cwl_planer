"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const read=file=>fs.readFileSync(path.resolve(__dirname,"..",file),"utf8");
const sync=read("cloud-sync.mjs");
const app=read("cloud-app.html");
const live=read("cwl-live.mjs");
const start=sync.indexOf("function flagRemoteCwlCycleChange(){");
const end=sync.indexOf("\nconst cloud={",start);
assert.ok(start>=0&&end>start,"expected production cycle verification and CAS logic");
const funcs=sync.slice(start,end)+
 ";({authorizeBrowserCwlRollover,openNewPlanCycle})";

const oldSeason="2026-11",newSeason="2026-12";
const oldCycle="11111111-1111-4111-8111-111111111111";
const newCycle="22222222-2222-4222-8222-222222222222";
const oldProfile=()=>({cwlLive:{season:oldSeason},archives:[],locks:[]});

function fixture(config={}){
 const state={
  id:"clan-one",epoch:1,
  planReview:{cycle_id:oldCycle,season:oldSeason,locked:true},
  revision:20,role:"owner",
  remoteReview:{cycle_id:oldCycle,season:oldSeason},
  remoteProfile:{revision:20,profile_json:oldProfile()},
  local:oldProfile(),dirty:null,
  saving:false,blocked:false,remotePending:false,
  rpc:[],messages:[],status:[],reads:[],
  ...config
 };
 const ctx={
  clanId:state.id,accountEpoch:state.epoch,role:state.role,
  planReview:state.planReview,revision:state.revision,
  cloud:{active:true},
  blocked:state.blocked,saving:state.saving,changedSerial:state.dirty,
  remotePending:state.remotePending,
  navigator:{onLine:true},
  storage:{getProfile:()=>state.local},
  status:(...args)=>state.status.push(args),
  showChangeToast:(...args)=>state.messages.push(args),
  planIsLocked:()=>false,
  reviewCycleToken:()=>({
   p_expected_cycle:ctx.planReview?.cycle_id??null,
   p_expected_season:ctx.planReview?.season??oldSeason
  }),
  ensureSaved:async()=>{},
  reviewRpcError:e=>e,
  loadPlanReview:async()=>{},
  sb:{
   from(name){
    return {
     select(cols){
      state.reads.push([name,cols]);
      return {
       eq(_field,_value){return {
        maybeSingle:async()=>({
         data:name==="cwl_plan_review_state"?state.remoteReview:
          name==="cwl_cloud_profiles"?state.remoteProfile:null,
         error:null
        })
       }}
      };
     }
    };
   },
   rpc:async(name,args)=>{
    state.rpc.push({name,args});return {error:null};
   }
  }
 };
 const methods=vm.runInNewContext(funcs,ctx);
 return {state,ctx,...methods};
}

test("authoritative old review+profile CAS allows one browser fallback, without writing",async()=>{
 const f=fixture();
 assert.equal(await f.authorizeBrowserCwlRollover(oldSeason,newSeason),true);
 assert.deepEqual(f.state.reads.map(x=>x[0]),
  ["cwl_plan_review_state","cwl_cloud_profiles"]);
 assert.deepEqual(f.state.rpc,[]);
 assert.equal(f.ctx.remotePending,false);
});

test("server created new cycle first: no local archive, no second cycle",async()=>{
 const f=fixture({remoteReview:{cycle_id:newCycle,season:newSeason},
  remoteProfile:{revision:21,profile_json:{cwlLiveIgnoredSeason:oldSeason}}});
 assert.equal(await f.authorizeBrowserCwlRollover(oldSeason,newSeason),false);
 assert.equal(f.ctx.remotePending,true);
 assert.equal(f.state.messages.length,1);
 assert.equal(f.state.rpc.length,0);
});

test("profile revision changed while review season is old: fail closed",async()=>{
 const f=fixture({remoteProfile:{revision:21,profile_json:oldProfile()}});
 assert.equal(await f.authorizeBrowserCwlRollover(oldSeason,newSeason),false);
 assert.equal(f.ctx.remotePending,true);
});

test("local reviewer already sees new cycle, offline or dirty: no remote reads",async()=>{
 for(const cfg of [
  {planReview:{cycle_id:newCycle,season:newSeason}},
  {dirty:'{"pending":true}'},
  {role:"viewer"},
  {revision:null}
 ]){
  const f=fixture(cfg);
  assert.equal(await f.authorizeBrowserCwlRollover(oldSeason,newSeason),false);
  assert.deepEqual(f.state.reads,[]);
 }
 const f=fixture();
 f.ctx.navigator.onLine=false;
 assert.equal(await f.authorizeBrowserCwlRollover(oldSeason,newSeason),false);
});

test("unknown/malformed seasons or stale old source in saved profile never advance",async()=>{
 const f=fixture();
 for(const target of ["2026-10","2026-11","2026-13","tomorrow"]){
  assert.equal(await f.authorizeBrowserCwlRollover(oldSeason,target),false);
 }
 assert.deepEqual(f.state.reads,[]);
 const g=fixture({remoteProfile:{revision:20,profile_json:{cwlLive:{season:"2026-10"}}}});
 assert.equal(await g.authorizeBrowserCwlRollover(oldSeason,newSeason),false);
});

test("owner browser pins old review token across ensureSaved; refreshed review cannot open another cycle",async()=>{
 const f=fixture();
 f.ctx.ensureSaved=async()=>{
  f.ctx.planReview={cycle_id:newCycle,season:newSeason};
 };
 await assert.rejects(
  f.openNewPlanCycle(oldSeason),
  /CWL-Zyklus wurde während der Planung geändert/
 );
 assert.equal(f.state.rpc.length,0);
 assert.equal(f.ctx.remotePending,true);
});

test("remote review changes after own archive saved: owner does not send new token",async()=>{
 const f=fixture({remoteReview:{cycle_id:newCycle,season:newSeason}});
 await assert.rejects(f.openNewPlanCycle(oldSeason),/im Hintergrund bereits gewechselt/);
 assert.equal(f.state.rpc.length,0);
 assert.equal(f.ctx.remotePending,true);
});

test("stable owner opens exactly one cycle using old CAS token",async()=>{
 const f=fixture();
 await f.openNewPlanCycle(oldSeason);
 assert.equal(f.state.rpc.length,1);
 assert.equal(f.state.rpc[0].name,"cwl_set_plan_lock_checked");
 assert.deepEqual({...f.state.rpc[0].args},{
  p_clan:"clan-one",p_locked:false,p_new_cycle:true,
  p_expected_cycle:oldCycle,p_expected_season:oldSeason
 });
});

test("same service check fails closed if clan switches before response",async()=>{
 const f=fixture();
 f.ctx.sb.from=()=>({
  select:()=>({eq:()=>({maybeSingle:async()=>{
   f.ctx.clanId="clan-two";
   return {data:{cycle_id:oldCycle,season:oldSeason},error:null};
  }})})
 });
 assert.equal(await f.authorizeBrowserCwlRollover(oldSeason,newSeason),false);
 assert.equal(f.state.rpc.length,0);
});

test("live API must check the old cycle BEFORE inserting any archive",async()=>{
 const a=live.indexOf("if(data.active&&previous?.season&&data.season>previous.season&&");
 const b=live.indexOf("// A temporary failure to fetch individual wars",a);
 assert.ok(a>=0&&b>a);
 const block=live.slice(a,b);
 assert.ok(block.indexOf("const mayAdvance=await storage.canAutoAdvanceCwl?.(")>=0);
 assert.ok(block.indexOf("if(mayAdvance!==true)return;")>=0);
 assert.ok(block.indexOf("if(storage.archivePriorCwlForRollover?.(")>
   block.indexOf("if(mayAdvance!==true)return;"));
 assert.match(app,/canAutoAdvanceCwl:\(oldSeason,newSeason\)=>/);
 assert.match(app,/cloud\.openNewCycle\(oldSeason\)/);
 assert.match(sync,/authorizeBrowserCwlRollover:\(oldSeason,newSeason\)=>/);

 // Run the exact source of the production refresh branch with a stale
 // server-verification response. The code may not mutate the local archive.
 const actions={preflight:0,archive:0,save:0,open:0};
 const profile={cwlLive:{season:oldSeason,clanTag:"#2PYL"}};
 const ctx={active:true,role:"owner",canApply:true,clanTag:"#2PYL"};
 const storage={
  canAutoAdvanceCwl:async()=>{
   actions.preflight++;return false;
  },
  archivePriorCwlForRollover:()=>{
   actions.archive++;return true;
  },
  autoAdvanceCwl:async()=>{
   actions.open++;return true;
  }
 };
 const data={active:true,season:newSeason};
 const evalBranch=new Function("ctx","data","storage","ensureCloudSaved","stillCurrent","notify",
  "return (async()=>{let previous=ctx.profile?.cwlLive;"+block+"return previous;})();");
 ctx.profile=profile;
 await evalBranch(ctx,data,storage,async()=>{actions.save++},()=>true,()=>{});
 assert.deepEqual(actions,{preflight:1,archive:0,save:0,open:0});
});
