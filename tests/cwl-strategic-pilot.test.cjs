"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),{JSDOM}=require("jsdom"),fs=require("node:fs"),path=require("node:path");
const mod=import("../cwl-strategic-pilot.mjs"),view=import("../cwl-strategic-pilot-view.mjs"),{planCwl}=require("../cwl-planning-core.js");
const abc="0289PYLQGRJCUV",tag=i=>"#P"+abc[Math.floor(i/13)%13]+abc[i%13],at=Date.UTC(2026,10,26);
function data(){
 const members=Array.from({length:18},(_,i)=>({id:"p"+i,name:"Spieler "+i,playerTag:tag(10+i),townHall:19,participating:true,statuses:[]}));
 const context={key:"session:clan",token:"rev1",phase:"roster",ready:true,role:"owner",clanTag:tag(0),slots:15,days:7};
 return {context,profile:{config:{slots:15,days:7},members,locks:[]},currentPlan:planCwl({members,slots:15,days:7}).dayPlans};
}
test("pilot uses actual core, unknown participation and no automatic roster choice",async()=>{
 const {preparePilotInput,buildPilotPreview}=await mod,s=data(),before=JSON.stringify(s),input=preparePilotInput(s);
 assert.ok(input.members.every(m=>m.participationIntent==="unknown"));
 const history={kind:"current_snapshot_war_start_proxy",asOf:at,facts:[],obligations:[],audit:{}};
 const x=buildPilotPreview({input,history,mode:"balanced",planStandard:planCwl,now:at});
 assert.equal(x.canApply,false);assert.equal(x.scenarios.length,1);assert.equal(x.scenarios[0].size,18);assert.equal(x.scenarios[0].metrics.conditional,18);assert.equal(JSON.stringify(s),before);
 assert.throws(()=>preparePilotInput({...s,profile:{...s.profile,locks:[{locked:true,lineup:[]}]}}),/pilot_existing_locks/);
 assert.throws(()=>buildPilotPreview({input,history,mode:"balanced",planStandard:planCwl,now:at+301000}),/pilot_history_unavailable/);
});
test("pilot view ignores old-clan responses, preserves same-context disclosure, no apply",async()=>{
 const {createStrategicPilotView}=await view,dom=new JSDOM('<main id="view-plan"><div id="anchor"></div></main>'),d=dom.window.document;
 let c={...data().context},resolve;const p=createStrategicPilotView({anchor:d.querySelector("#anchor"),getContext:()=>c,load:()=>new Promise(r=>resolve=r)});
 const root=d.querySelector("#planStrategicPilot"),button=root.querySelector("button");root.open=true;button.click();assert.match(root.textContent,/berechnet/);
 p.sync();assert.equal(root.open,true);c={...c,key:"new-clan"};p.sync();assert.equal(root.open,false);
 resolve({kind:"roster",mode:"balanced",canApply:false,historyNote:"old private name",scenarios:[]});await new Promise(r=>setImmediate(r));assert.doesNotMatch(root.textContent,/old private name/);
 c=null;p.sync();assert.equal(root.hidden,true);assert.equal(root.querySelectorAll("button").length,1);dom.window.close();
});
test("cloud pilot is default off and read only with existing membership verification",()=>{
 const s=fs.readFileSync(path.join(__dirname,"../cloud-sync.mjs"),"utf8"),begin=s.indexOf("const strategicPilotEnabled="),end=s.indexOf("const cloud={",begin),block=s.slice(begin,end);
 assert.match(block,/globalThis\.CWLStrategicStaging===true/);assert.match(block,/cwl_clan_memberships/);assert.match(block,/stats\.readStrategicHistory/);assert.match(block,/strategic:true/);
 assert.doesNotMatch(block,/\.insert\(|\.update\(|\.upsert\(|\.delete\(|flushPendingChanges|onLocalChange\(/);
});
