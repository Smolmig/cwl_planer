"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");

test("ordinary and actual Clash player cards share identical performance markup",()=>{
 const html=read("cloud-app.html"),live=read("cwl-live.mjs");
 assert.match(html,/function planLineupPlayerChip\(m\)/);
 assert.match(html,/names\.map\(planLineupPlayerChip\)\.join\(""\)/);
 assert.match(html,/createPlanPlayerChip:member=>/);
 assert.match(html,/memberCompactPerformance\(m\)/);
 assert.match(live,/storage\.createPlanPlayerChip\?\.\(knownMember\)/);
 assert.match(live,/storage\.createPlanPlayerChip\?\.\(member\)/);
 assert.match(live,/cwl-plan-actual-exit/);
 assert.match(live,/cwl-plan-incoming/);
});

test("the candidate view is a non-displacing accessible overlay, not inline disclosure",()=>{
 const html=read("cloud-app.html"),live=read("cwl-live.mjs");
 assert.match(html,/\.cwl-swap-popover\{[\s\S]*?position:fixed;z-index:/);
 assert.match(live,/doc\.body\.append\(popup\)/);
 assert.match(live,/aria-expanded/);
 assert.match(live,/aria-controls/);
 assert.match(live,/pointerdown/);
 assert.match(live,/Escape/);
 assert.match(live,/closeSwapPopover\(\{preserve:true\}\)/);
 assert.doesNotMatch(live,/details\.className="cwl-plan-swap"/);
 assert.match(html,/prefers-reduced-motion:reduce/);
});

test("Einsätze shows actual CWL results and medal progress without duplicate not-yet-finalized form",()=>{
 const html=read("cloud-app.html");
 assert.doesNotMatch(html,/const cwlHitRate=currentCwlTripleRate/);
 assert.match(html,/CWL: \$\{goal\.unknown/);
 assert.doesNotMatch(html,/Form: keine erfassten Angriffe/);
 assert.doesNotMatch(html,/\$\{esc\(recentText\)\}/);
 assert.match(html,/window\.CWLRefreshMembers=\(\)=>\{[\s\S]*?renderSummary\(\)\}/);
});
