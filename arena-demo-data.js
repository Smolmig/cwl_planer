/* ARENA test-only seeded local clan + clearly marked synthetic historic stats.
 * No network calls. Never loaded by production, never inserted into cloud-sync.mjs.
 */
(()=>{
'use strict';
const SAMPLE_ID='arena_demo_united_20261102';
const MARKER='arena_demo_seed_v2';
const $=id=>document.getElementById(id);
const names=[
'Alaric','Lynx','ECTON','Vortex','Nova','Ragnar','Ghost','Kira','Frost','Kronos','Mika','Sirius','Drako','Echo','Nero',
'Aria','Sora','Falcon','Atlas','Blaze','Milo','Nyx','Raiden','Zephyr','Skye','Fenrir','Dante','Vega','Zed','Riven',
'Juno','Talon','Mira','Boreas','Orion','Lyra','Ash','Hawk','Rune','Pixel','Icarus','Rook','Kael','Elara','Volt','Umbra',
'Raze','Mako','Flint'];
const TAGS='0289PYLQGRJCUV';
const tag=i=>{let n=i+71,s='';for(let k=0;k<7;k++){s=TAGS[n%TAGS.length]+s;n=Math.floor(n/TAGS.length)+3;}return '#'+s};
function sampleMembers(){return names.map((name,i)=>{
 const p=typeof freshMember==='function'?freshMember(name):{id:'demo_'+i,name,statuses:Array(7).fill('auto')};
 p.id='arena_m'+String(i+1).padStart(2,'0');p.playerTag=tag(i);
 p.participating=i<45;p.fixed=i<8;
 p.townHall=i<3?19:i<15?18:i<31?17:i<43?16:15;
 p.priority=i<8?5:i<15?4:i<31?3:i<40?2:1;
 p.threeStar=i%9===8?'low':i<15?'high':i<34?'medium':'low';
 p.statuses=Array(7).fill('auto');
 if(i===14)p.statuses[3]='must';
 if(i===22)p.statuses[4]='out';
 if(i===26)p.statuses[5]='must';
 if(i===33)p.firstDay=3;
 if(i===36)p.outFromDay=6;
 if(i===40)p.firstDay=5;
 return p;
});}
function lineupForDay(members,day){const eligible=members.filter(m=>m.participating&&(!m.firstDay||m.firstDay<=day+1)&&(!m.outFromDay||m.outFromDay>day+1)&&m.statuses[day]!=='out');const fixed=eligible.filter(m=>m.fixed).slice(0,8);const rot=eligible.filter(m=>!m.fixed);const picks=Array.from({length:7},(_,i)=>rot[(day*7+i)%rot.length]).filter(Boolean);return [...fixed,...picks].map(m=>m.id)}
function sampleProfile(){
 const p=typeof freshProfile==='function'?freshProfile('United Fighters · DEMO'):{id:SAMPLE_ID,name:'United Fighters · DEMO',config:{slots:15,days:7},members:[],locks:[],dayGoals:[],archives:[]};
 p.id=SAMPLE_ID;p.name='United Fighters · DEMO';p.config={slots:15,days:7,memberSort:'manual'};
 p.members=sampleMembers();p.archivedMembers=[];
 p.dayGoals=Array.from({length:7},(_,i)=>({townHall:i%2===0?{'18':6,'17':5}:{'19':2,'18':5},strength:{high:5,medium:5,low:0,verylow:0}}));
 // Two played wars provide a realistic mix of fixed history and future rotation.
 p.locks=Array.from({length:7},(_,i)=>i<2?{locked:true,lineup:lineupForDay(p.members,i),snapshots:{}}:{locked:false,lineup:[],snapshots:{}});
 const archLineups=Array.from({length:7},(_,i)=>({day:i+1,lineup:lineupForDay(p.members,i),snapshots:{}}));
 p.archives=[{id:'arena_archive_oct_2026',label:'Oktober 2026 · Testarchiv',createdAt:Date.UTC(2026,9,28),slots:15,days:7,playedCount:7,complete:true,players:p.members.map(m=>({id:m.id,name:m.name,playerTag:m.playerTag,townHall:m.townHall,threeStar:m.threeStar,fixed:m.fixed})),lineups:archLineups}];
 p.updatedAt=Date.now();return p;
}
function isStaging(){return !!window.__arenaStagingConfigured;}
function isOurSample(){try{return typeof state!=='undefined'&&state.id===SAMPLE_ID}catch{return false}}
function installSample(force=false){
 if(isStaging()){notify('In der echten Staging-Cloud keine lokalen Demoprofile überschreiben.');return false}
 if(!force){try{if(localStorage.getItem(MARKER)==='ready')return false}catch{}
   if(typeof state==='undefined'||state.members.length>0||app.profiles.length!==1||state.name!=='Neuer Clan')return false;
 }
 const p=typeof normalizeProfile==='function'?normalizeProfile(sampleProfile()):sampleProfile();
 app={version:9,dataVersion:9,activeProfileId:p.id,profiles:[p],updatedAt:Date.now()};
 state=p;
 try{mobileSelectedDay=2;openRulePanels.clear();openDuplicatePanels.clear();selectionMode=false;selectedMembers.clear();openMemberDetails.clear();memberSearch='';memberFilter='all'}catch{}
 if($('memberSearch'))$('memberSearch').value='';if($('memberFilter'))$('memberFilter').value='all';
 try{uiSettings.dayViewMode='single';saveUiSettings()}catch{}
 saveApp.lastSavedJson=null;
 renderAll();
 try{localStorage.setItem(MARKER,'ready')}catch{}
 return true;
}
function notify(message){if(typeof showToast==='function')showToast(message)}
function makeHistory(){const events=[];
 for(let w=0;w<22;w++){
  const type=w<8?'CWL':'CW';const season=w<8?'Oktober 2026':w<15?'September 2026':'August 2026';
  const available=names.slice(0,45);
  const indexes=[...Array(available.length).keys()].filter(i=>i<8||((i*7+w*11)%17)<9).slice(0,type==='CWL'?15:25);
  for(const i of indexes){const roll=(i*19+w*13+i*w*3)%100;const three=roll<(i<15?69:i<29?53:34),miss=roll>92&&i>=8;
   const stars=miss?0:three?3:roll%5===0?1:2;
   events.push({id:'arena_m'+String(i+1).padStart(2,'0'),name:available[i],type,season,stars,miss,war:w});
  }
 }
 return events;
}
const history=makeHistory();
function addDemoControls(){
 const plan=$('view-plan');if(!plan||$('arena-demo-bar'))return;
 const bar=document.createElement('section');bar.id='arena-demo-bar';bar.className='arena-demo-bar';
 const copy=document.createElement('div');copy.className='arena-demo-info';copy.innerHTML='<strong>DEMO-CLAN · echte Planungsfunktionen</strong><span>49 fiktive Spieler, 2 gespielte Tage, Testarchiv und simulierte Angriffsstatistiken · nur in diesem Browser</span>';
 const reset=document.createElement('button');reset.type='button';reset.textContent='Demodaten zurücksetzen';reset.onclick=()=>{
   if(!confirm('Das aktuelle Testprofil und alle darin vorgenommenen Änderungen durch frische Demodaten ersetzen?'))return;
   if(installSample(true)){notify('Demoprofil zurückgesetzt');if(typeof window.showPlannerView==='function')window.showPlannerView('plan');}
 };
 bar.append(copy,reset);plan.prepend(bar);
 if(!isOurSample()&&!isStaging()){bar.style.borderColor='var(--line)';copy.querySelector('strong').textContent='TESTMODUS · eigenes Profil';copy.querySelector('span').textContent='Du arbeitest mit eigenen Testdaten. Lade das Demoprofil bei Bedarf neu.';reset.textContent='Demoprofil laden';}
 if(isStaging())bar.remove();
}
function statsPanel(){
 const stats=$('view-stats');if(!stats||isStaging()||$('arena-demo-history'))return;
 const panel=document.createElement('section');panel.className='arena-demo-history active';panel.id='arena-demo-history';
 const card=document.createElement('div');card.className='ar4-panel';
 card.innerHTML=`<div class="ar4-kicker">SIMULIERTE DATEN · KEINE CLOUD-SYNCHRONISIERUNG</div><h2>Historische Angriffe & Hit-Rate</h2><p class="arena-demo-notice">Fiktive Kriegsverläufe für den UI- und Filtertest. Die Einsatzanalyse unter „Analyse“ nutzt hingegen die echten Berechnungen des CWL-Planers. Diese Demo-Zahlen stammen nicht aus der Clash-API.</p><div class="arena-demo-stats-grid" id="arena-demo-stats-grid"></div><div class="arena-demo-filters"><select id="arena-demo-war-type" aria-label="Kriegstyp"><option value="all">CW + CWL</option><option value="CW">Nur CW</option><option value="CWL">Nur CWL</option></select><select id="arena-demo-sort" aria-label="Sortierung"><option value="rate">3★-Quote</option><option value="attacks">Meiste Angriffe</option><option value="missing">Vergessene Angriffe</option><option value="name">Name</option></select><input id="arena-demo-stat-search" type="search" placeholder="Spieler suchen …" aria-label="Spieler suchen"></div><div class="arena-demo-stat-row header"><span>Spieler</span><span>Angriffe</span><span>3★</span><span>Verpasst</span><span>Hit-Rate</span></div><div id="arena-demo-stat-rows"></div>`;
 panel.append(card);stats.prepend(panel);
 // Keep the native cloud statistics controls in place for staging, hide only as long as mock stats are visible.
 [...stats.querySelectorAll(':scope > .card')].forEach(x=>x.hidden=true);
 const render=()=>{
  const type=$('arena-demo-war-type').value,sort=$('arena-demo-sort').value,q=$('arena-demo-stat-search').value.toLocaleLowerCase('de');
  const records=history.filter(x=>type==='all'||x.type===type);const by={};
  for(const a of records){if(!by[a.id])by[a.id]={id:a.id,name:a.name,attacks:0,three:0,missing:0,stars:0};const p=by[a.id];p.attacks+=Number(!a.miss);p.missing+=Number(a.miss);p.three+=Number(a.stars===3);p.stars+=a.stars}
  let rows=Object.values(by).filter(x=>x.name.toLocaleLowerCase('de').includes(q));
  rows.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'de'):sort==='attacks'?b.attacks-a.attacks:sort==='missing'?b.missing-a.missing:(b.three/Math.max(1,b.attacks))-(a.three/Math.max(1,a.attacks))||b.attacks-a.attacks);
  const attacks=records.filter(x=>!x.miss).length,three=records.filter(x=>x.stars===3).length,missed=records.filter(x=>x.miss).length;
  const cards=[['Erfasste Angriffe',attacks],['3★-Hit-Rate',attacks?Math.round(100*three/attacks)+' %':'–'],['Nicht angegriffen',missed],['Spieler',Object.keys(by).length]];
  $('arena-demo-stats-grid').replaceChildren();for(const [label,value] of cards){const el=document.createElement('div');el.className='stat';const b=document.createElement('strong');b.textContent=value;const span=document.createElement('span');span.textContent=label;el.append(b,span);$('arena-demo-stats-grid').append(el)}
  $('arena-demo-stat-rows').replaceChildren();for(const p of rows){const el=document.createElement('div');el.className='arena-demo-stat-row';const name=document.createElement('span');name.className='name';name.textContent=p.name;const a=document.createElement('span');a.textContent=p.attacks;const triple=document.createElement('span');triple.textContent=p.three;const missing=document.createElement('span');missing.textContent=p.missing;missing.className='missed faint';const rate=document.createElement('span');rate.className='arena-demo-pct';rate.textContent=(100*p.three/Math.max(1,p.attacks)).toFixed(1)+' %';el.append(name,a,triple,missing,rate);$('arena-demo-stat-rows').append(el)}
 };
 for(const id of ['arena-demo-war-type','arena-demo-sort','arena-demo-stat-search'])$(id).addEventListener(id==='arena-demo-stat-search'?'input':'change',render);
 render();
}
function afterInit(){if(typeof app==='undefined'||typeof renderAll!=='function'){console.error('ARENA DEMO: core planner not loaded');return;}
 if(!isStaging())installSample(false);
 addDemoControls();statsPanel();
}
afterInit();
window.ArenaDemo={reset:()=>installSample(true),sample:sampleProfile,history:()=>history.slice(),isActive:isOurSample};
})();