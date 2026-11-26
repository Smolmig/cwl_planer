"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {JSDOM}=require("jsdom");
test("The reveal shows only the supplied stored winner and explains unbiased randomness",async()=>{
 const {renderDrawReveal}=await import("../cwl-raffle-reveal.mjs");
 const dom=new JSDOM("<main></main>"),old=global.document,oldMedia=global.matchMedia;global.document=dom.window.document;
 try{
  global.matchMedia=()=>({matches:false});let shown=0;
  const root=document.querySelector("main");
  const reveal=renderDrawReveal({winnerName:"<img src=x>",winnerTag:"#2PYL",animate:true,delay:2500,onReveal:()=>shown++});
  root.append(reveal);
  const win=reveal.querySelector("[data-raffle-winner]"),pending=reveal.querySelector("[data-raffle-animation]");
  assert.equal(win.hidden,true);assert.equal(pending.hidden,false);assert.equal(shown,0);
  assert.equal(reveal.querySelector("img"),null);
  assert.match(reveal.querySelector("details").textContent,/genau ein Los/);
  assert.equal(reveal.querySelector("details").open,false);
  pending.querySelector("button").click();
  assert.equal(win.hidden,false);assert.equal(pending.hidden,true);assert.equal(shown,1);assert.match(win.textContent,/<img src=x>/);
  const reload=renderDrawReveal({winnerName:"Winner",winnerTag:"#2PYL",weighted:true});
  assert.equal(reload.querySelector("[data-raffle-winner]").hidden,false);
  assert.match(reload.querySelector("details").textContent,/mehr Lose/);
  global.matchMedia=()=>({matches:true});
  const reduced=renderDrawReveal({winnerName:"Winner",winnerTag:"#2PYL",animate:true});
  assert.equal(reduced.querySelector("[data-raffle-animation]").hidden,true);
  assert.equal(reduced.querySelector("[data-raffle-winner]").hidden,false);
 }finally{
  if(old===undefined)delete global.document;else global.document=old;
  if(oldMedia===undefined)delete global.matchMedia;else global.matchMedia=oldMedia;
  dom.window.close();
 }
});

test("Wheel segments match tickets and target the selected ticket without bias",async()=>{
 const {raffleWheel}=await import("../cwl-raffle-reveal.mjs");
 const w=raffleWheel([{tag:"#A",name:"A",tickets:1},{tag:"#B",name:"B",tickets:3},{tag:"#C",tickets:0}],2);
 assert.equal(w.total,4);assert.deepEqual(w.segments.map(s=>[s.from,s.to]),[[0,90],[90,360]]);
 assert.equal((360-w.rotation%360)%360,225);
 assert.equal(raffleWheel([],0),null);
});
