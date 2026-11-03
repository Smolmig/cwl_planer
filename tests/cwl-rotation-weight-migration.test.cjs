"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const {planCwl}=require(path.join(root,"cwl-planning-core.js"));
const source=html.slice(html.indexOf("function normalizeMember("),html.indexOf("function normalizeArchive("));
assert.ok(source.startsWith("function normalizeMember(")&&source.endsWith("\n"));
const normalize=vm.runInNewContext(source+"\nnormalizeMember",{
  uid:()=> "new-id",
  freshMember:()=>({}),
  normalizePlayerTag:v=>String(v||"").trim().toUpperCase(),
  STRENGTH_LABELS:{unknown:"unknown",high:"high"}
});
const player=(id,extra={})=>({id,name:id,participating:true,fixed:false,
  statuses:Array(7).fill("auto"),priority:0,rotationWeight:"balanced",targetDays:null,...extra});
const round=(a={},b={})=>({days:7,slots:15,members:[
  ...Array.from({length:14},(_,i)=>player("fix"+i,{fixed:true})),
  player("A",a),player("B",b)]});
test("legacy priority is preserved without silently mapping its meaning",()=>{
 for(let p=0;p<=5;p++){
  const m=normalize({id:"a",name:"Alt",participating:true,priority:p,
    statuses:Array(7).fill("auto"),threeStar:"unknown"});
  assert.equal(m.priority,p);
  assert.equal(m.rotationWeight,null);
 }
 assert.equal(normalize({id:"a",name:"neu",participating:true,rotationWeight:"unexpected",priority:3,threeStar:"unknown"}).rotationWeight,null);
 assert.equal(normalize({id:"a",name:"neu",participating:true,rotationWeight:"less",priority:5,threeStar:"unknown"}).rotationWeight,"less");
 assert.match(html,/rotationWeight:"balanced"/,"new members get a balanced default");
});
test("new UI offers exactly three weight choices and a conditional legacy state",()=>{
 for(const label of ["Bevorzugt berücksichtigen","Ausgewogen","Seltener berücksichtigen"])
  assert.match(html,new RegExp(label));
 assert.match(html,/legacyWeight=m\.rotationWeight==null&&m\.priority>0/);
 assert.match(html,/Alte Prio \$\{m\.priority\} \(beibehalten\)/);
 assert.match(html,/class="name-input member-rotation-weight"/);
 assert.match(html,/m\.rotationWeight=e\.target\.value/);
 assert.doesNotMatch(html,/class="name-input priority member-priority"/);
 assert.doesNotMatch(html,/member-prio-picker"/);
 assert.match(html,/\$\{m\.fixed\?\x60<span class="member-fixed-target"/);
 assert.match(html,/Rotation: bevorzugt zuerst/);
});
test("legacy priority 0 is neutral; nonzero still favors an extra slot",()=>{
 const neutral=round({priority:0,rotationWeight:null},{priority:0,rotationWeight:null});
 const old=round({priority:5,rotationWeight:null},{priority:0,rotationWeight:null});
 const p=planCwl(neutral),q=planCwl(old);
 assert.equal(p.ok,true);
 assert.deepEqual([p.counts.A,p.counts.B].sort(),[3,4]);
 assert.equal(q.ok,true);
 assert.equal(q.counts.A,4);
 assert.equal(q.counts.B,3);
});
test("explicit rotation preference supersedes old priority and never an exact target",()=>{
 const a=round({priority:5,rotationWeight:"less"},{priority:0,rotationWeight:"preferred"});
 const p=planCwl(a);
 assert.equal(p.ok,true);
 assert.equal(p.counts.A,3);
 assert.equal(p.counts.B,4);
 a.members.find(x=>x.id==="A").targetDays=5;
 const forced=planCwl(a);
 assert.equal(forced.ok,true);
 assert.equal(forced.counts.A,5);
 assert.equal(forced.counts.B,2);
});
test("fixed players receive all available days independently of rotation weight",()=>{
 const x=round();
 x.members[0].rotationWeight="less";
 const p=planCwl(x);
 assert.equal(p.ok,true);
 assert.equal(p.counts.fix0,7);
});

test("bulk rotation offers only three options and never assigns a preference to fixed players",()=>{
 assert.match(html,/id="bulkRotationSelect"/);
 assert.match(html,/applyBulkValue\("rotationWeight",e\.target\.value\)/);
 assert.doesNotMatch(html,/id="bulkPrioritySelect"/);
 assert.match(html,/field==="rotationWeight"&&m\.fixed/);
});
