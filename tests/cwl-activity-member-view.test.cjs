"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {JSDOM}=require("jsdom");
const tick=()=>new Promise(r=>setImmediate(r));
test("Central membership: tri-state Discord, filters, explicit account links and scope reset",async()=>{
 const {createActivityMemberView}=await import("../cwl-activity-member-view.mjs");
 const dom=new JSDOM("<main></main>"),old=global.document;global.document=dom.window.document;
 try{
  const root=document.querySelector("main");let c={owner:true,clanId:"A",clanTag:"#2PYL",session:1};
  const data=[{tag:"#8PYL",name:"<img src=x>",present:true,discord:null,primaryTag:null},
   {tag:"#Q9QL",name:"Main",present:true,discord:false,primaryTag:null}];
  const calls=[];
  const v=createActivityMemberView({root,getContext:()=>c,api:async req=>{
   calls.push(req);
   if(req.action==="discord")data.find(x=>x.tag===req.player).discord=req.discord;
   if(req.action==="link")data.find(x=>x.tag===req.player).primaryTag=req.primary;
   return JSON.parse(JSON.stringify(data));
  }});
  assert.equal(v.open(),true);await tick();assert.equal(root.querySelector("img"),null);
  const control=(row,label)=>[...row.querySelectorAll("label")].find(x=>x.querySelector("span")?.textContent===label).querySelector("select");
  let row=root.querySelector(".activity-member-row");
  const discord=control(row,"Discord");assert.equal(discord.value,"");discord.value="yes";discord.dispatchEvent(new dom.window.Event("change"));await tick();
  assert.equal(calls.at(-1).discord,true);
  row=root.querySelector(".activity-member-row");
  const main=control(row,"Hauptaccount");main.value="#Q9QL";main.dispatchEvent(new dom.window.Event("change"));
  row.querySelector("button").click();await tick();
  assert.equal(calls.at(-1).action,"link");assert.equal(calls.at(-1).expectedPrimary,null);assert.match(root.textContent,/Zweitaccount von Main/);
  const filter=control(root,"Anzeigen");filter.value="unknown";filter.dispatchEvent(new dom.window.Event("change"));
  assert.match(root.textContent,/Keine passenden Mitglieder/);
  c={...c,session:2};assert.equal(v.accessChanged(c),false);assert.equal(root.textContent,"");
 }finally{if(old===undefined)delete global.document;else global.document=old;dom.window.close()}
});
test("A pending roster cannot leak into a changed account",async()=>{
 const {createActivityMemberView}=await import("../cwl-activity-member-view.mjs");
 const dom=new JSDOM("<main></main>"),old=global.document;global.document=dom.window.document;
 try{
  const root=document.querySelector("main");let c={owner:true,clanId:"A",clanTag:"#2PYL",session:1},resolve;
  const v=createActivityMemberView({root,getContext:()=>c,api:()=>new Promise(r=>{resolve=r})});
  v.open();c={...c,clanId:"B"};v.accessChanged(c);
  resolve([{tag:"#8PYL",name:"Private",present:true,discord:true,primaryTag:null}]);await tick();
  assert.equal(root.textContent,"");
 }finally{if(old===undefined)delete global.document;else global.document=old;dom.window.close()}
});
