"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
test("active clan switcher uses the existing cloud select change flow",()=>{
 assert.match(html,/id="headerClanName"[^>]*type="button"|id="headerClanName" class="header-clan-name" type="button"/);
 assert.match(html,/id="quickClanSelect"/);
 assert.match(html,/original\.dispatchEvent\(new Event\("change",\{bubbles:true\}\)\)/);
 assert.match(html,/id="quickClanManage"/);
});
test("More opens section-specific in-app screens, not scroll-to-settings",()=>{
 for(const action of ["archive","rules","appearance","profiles","backup"])
  assert.match(html,new RegExp(action+':\\["'));
 assert.match(html,/id="moreDetailBack"/);
 assert.match(html,/function closeMoreDetail\(/);
 assert.match(html,/moreOrigins\.set\(node,\{parent:node\.parentNode,next:node\.nextSibling\}\)/);
 assert.doesNotMatch(html,/archiveSection"\)\?\.scrollIntoView/);
});
test("desktop rail can collapse without modifying planner profile data",()=>{
 assert.match(html,/id="sidebarCollapse"/);
 assert.match(html,/body\.sidebar-collapsed \.bottomnav\{width:74px/);
 assert.match(html,/cwl_desktop_sidebar_collapsed/);
 assert.match(html,/setSidebarCollapsed\(!document\.body\.classList\.contains\("sidebar-collapsed"\)\)/);
});
test("Gold avoids decorative and inset effects",()=>{
 assert.match(html,/html\[data-theme="arena"\] \.plan-overview::before,/);
 assert.match(html,/html\[data-theme="arena"\] \.member-snapshot,html\[data-theme="arena"\] \.member-tools\{background:transparent!important/);
 assert.match(html,/html\[data-theme="arena"\] \.stats-th\{border:0;background:transparent/);
});
