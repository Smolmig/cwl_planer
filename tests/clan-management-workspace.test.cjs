"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{JSDOM}=require("jsdom");
const html=fs.readFileSync(path.join(__dirname,"../cloud-app.html"),"utf8");
test("Clan management has three distinct workspaces and non-duplicated review navigation",()=>{
 const dom=new JSDOM(html,{runScripts:"outside-only"}),d=dom.window.document;
 try{
  const root=d.getElementById("view-clan-management");
  const start=html.indexOf("const managementSections="),end=html.indexOf("function clearClanManagement(){",start);
  assert.ok(start>0&&end>start);
  dom.window.eval(html.slice(start,end));
  const section=key=>root.querySelector('[data-management-section="'+key+'"]');
  const source=key=>root.querySelector('[data-management-source="'+key+'"]');
  const visible=id=>{let node=d.getElementById(id);return !node.closest("[hidden]")};
  assert.equal(section("actions").getAttribute("aria-pressed"),"true");
  assert.equal(visible("managementOverview"),true);
  assert.equal(visible("managementRank"),false);
  assert.equal(visible("managementNormal"),false);
  source("rank").click();assert.equal(visible("managementOverview"),false);assert.equal(visible("managementRank"),true);
  section("rules").click();assert.equal(visible("managementRank"),false);assert.equal(visible("clanManagementRulesForm"),true);
  assert.equal(d.getElementById("clanManagementCriteria").open,true);
  d.getElementById("clanRuleDays").value="27";
  section("members").click();assert.equal(visible("clanActivityMembersContent"),true);assert.equal(d.getElementById("clanActivityMembers").open,true);
  assert.equal(visible("clanManagementRulesForm"),false);
  section("rules").click();assert.equal(d.getElementById("clanRuleDays").value,"27");
  section("actions").click();assert.equal(visible("managementRank"),true);
  source("cw").click();assert.equal(visible("clanManagementNormalList"),true);assert.equal(d.getElementById("clanManagementNormalPanel").open,true);
  source("cwl").click();assert.equal(visible("clanManagementNormalList"),false);assert.equal(visible("clanManagementMissedList"),true);
  source("overview").click();assert.equal(visible("managementOverview"),true);assert.equal(visible("clanManagementMissedList"),false);
  for(const id of ["clanManagementList","clanManagementRulesForm","clanActivityMembersContent","clanManagementActionList","clanManagementNormalList","clanManagementMissedList"])assert.equal(root.querySelectorAll("#"+id).length,1);
  assert.match(html,/function clearClanManagement\(\)\{\s*clanManagementRequest\+\+;\s*selectManagementSection\("actions"\);selectManagementSource\("overview"\)/);
  assert.match(html,/selectManagementSection\("actions"\);selectManagementSource\(source\)/);
  assert.match(html,/if\(!cloud\?\.active\|\|!cloud\?\.isOwner\?\.\(\)\|\|!cloud\?\.hasApiClan\?\.\(\)\)return/);
 }finally{dom.window.close()}
});
