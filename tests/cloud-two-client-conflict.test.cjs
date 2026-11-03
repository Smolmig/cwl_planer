"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"..","cloud-sync.mjs"),"utf8");
const start=source.indexOf("async function loadCloudProfile(automatic=false){");
const end=source.indexOf("async function ensureSaved(){",start);
const helpers=source.slice(start,end);
assert.ok(start>0&&end>start);
const clone=x=>JSON.parse(JSON.stringify(x));
function simulatedCloud(){
 const db={revision:4,profile:{id:"shared-clan",name:"Demo",
  members:[{id:"member1",name:"Clash Player",townHall:18,note:"Original",playerTag:"#AAA"}],
  config:{slots:15,days:7}}};
 const events=[];
 function client(role="owner"){
  let profile=clone(db.profile);
  const ctx={
   clanId:"clan-1",role,revision:4,changedSerial:null,lastSerial:JSON.stringify(profile),
   saving:false,blocked:false,hydrating:false,debounce:null,rawSavedProfile:null,
   cloud:{active:true},navigator:{onLine:true},
   planIsLocked:()=>false,renderPlanReview:()=>{},
   status:()=>{},error:e=>events.push(String(e.message)),audit:async()=>{},
   clearTimeout:()=>{},setTimeout:()=>{},
   storage:{
    getProfile:()=>profile,
    switchToCloud:p=>{profile=clone(p)},
    confirmAction:async()=>true,
    blank:()=>({members:[]})
   },
   sb:{from:name=>{
    assert.equal(name,"cwl_cloud_profiles");
    return {
     select:()=>({eq:()=>({maybeSingle:async()=>({data:{profile_json:clone(db.profile),revision:db.revision},error:null})})}),
     update:({profile_json})=>{
      let requestedRevision=null;
      const chain={
       eq:(k,v)=>{if(k==="revision")requestedRevision=v;return chain},
       select:async()=>{if(requestedRevision!==db.revision)return{data:[],error:null};
        db.profile=clone(profile_json);db.revision++;
        return{data:[{revision:db.revision}],error:null}}
      };
      return chain;
     }
    }
   }}
  };
  const functions=vm.runInNewContext(helpers+"\n({writeCloud,loadCloudProfile})",ctx);
  return {ctx,functions,get profile(){return profile},
   edit(fn){fn(profile);ctx.changedSerial=JSON.stringify(profile)},
   async publish(){await functions.writeCloud()},
   async reload(){await functions.loadCloudProfile(false)}};
 }
 return {db,client,events};
}
test("two devices: stale profile revision cannot override emergency edit or noteboard",async()=>{
 const s=simulatedCloud(),a=s.client(),b=s.client();
 a.edit(p=>{p.cocManualEmergency={pending:true,since:42};p.members[0].note="Notfall A"});
 b.edit(p=>{p.members[0].name="Späteres Gerät B"});
 await a.publish();
 assert.equal(s.db.revision,5);
 assert.equal(s.db.profile.cocManualEmergency.pending,true);
 await b.publish();
 assert.equal(b.ctx.blocked,true);
 assert.equal(s.db.revision,5);
 assert.equal(s.db.profile.members[0].name,"Clash Player");
 assert.equal(s.db.profile.members[0].note,"Notfall A");
 assert.ok(s.events.some(e=>e.includes("Konflikt")));
 await b.reload();
 assert.equal(b.ctx.blocked,false);
 assert.equal(b.ctx.revision,5);
 assert.equal(b.profile.cocManualEmergency.pending,true);
 assert.equal(b.profile.members[0].note,"Notfall A");
});
test("an observer cannot overwrite the shared Cloud profile even with local changes",async()=>{
 const s=simulatedCloud(),observer=s.client("viewer");
 observer.edit(p=>{p.members[0].townHall=20});
 await observer.publish();
 assert.equal(s.db.profile.members[0].townHall,18);
 assert.equal(s.db.revision,4);
});
test("Cloud emergency status is read from the synchronized profile, not local browser storage",async()=>{
 const s=simulatedCloud(),a=s.client(),b=s.client();
 a.edit(p=>{p.cocManualEmergency={pending:true,since:42}});
 await a.publish();await b.reload();
 const begin=source.indexOf("function manualRosterPending(){");
 const stop=source.indexOf("function refreshRosterEmergencyUI()",begin);
 assert.ok(begin>0&&stop>begin);
 const pending=vm.runInNewContext(source.slice(begin,stop)+"\nmanualRosterPending",{
  storage:{getProfile:()=>b.profile}
 });
 assert.equal(pending(),true);
 b.profile.cocManualEmergency.pending=false;
 assert.equal(pending(),false);
});
