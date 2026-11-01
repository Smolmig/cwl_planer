/* ARENA WEEKVIEW V2 / Cloud staging UI. Core planner and cloud business logic are untouched. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const svg=(path)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
 const icons={plan:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M7 14h3m-3 3h3m3-3h3"/>',members:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2zm13-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v1"/>',summary:'<path d="M4 20V10h4v10zm6 0V4h4v16zm6 0v-7h4v7z"/>',settings:'<circle cx="5" cy="12" r="1.25"/><circle cx="12" cy="12" r="1.25"/><circle cx="19" cy="12" r="1.25"/>',cloud:'<path d="M20 18a4 4 0 0 0 .2-8A6 6 0 0 0 8.5 9a4.5 4.5 0 0 0 .5 9h11z"/>',shield:'<path d="M12 2 20 6v6c0 5-3.2 8.3-8 10-4.8-1.7-8-5-8-10V6z"/><path d="M9 12h6m-3-3v6"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',palette:'<circle cx="12" cy="12" r="9"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="7" cy="15" r="1"/><path d="M15 20a3 3 0 0 1 0-6h3"/>',backup:'<path d="M4 7h16v14H4zM8 3h8v4m-4 4v7m-4-3 4 4 4-4"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>'};
 const nav=$('view-plan')&&$('view-members')&&$('view-summary')&&$('view-settings')&&document.querySelector('.bottomnav');
 if(!nav)return;
 const originalShow=typeof showPlannerView==='function'?showPlannerView:null;
 const topbar=document.querySelector('.topbar');
 const row=topbar?.querySelector('.toprow');
 const title=topbar?.querySelector('.titleblock h1');
 if(title){title.innerHTML=`<span class="arena2-mark">${svg(icons.shield)}</span><span>CWL Planer</span>`}
 const actions=topbar.querySelector('.top-actions');
 const badge=document.createElement('span');badge.className='arena2-test';badge.textContent='CLOUD · TEST';actions.prepend(badge);
 const themeBtn=document.createElement('button');themeBtn.type='button';themeBtn.className='arena2-theme';themeBtn.title='Hell / Dunkel';themeBtn.setAttribute('aria-label','Farbschema wechseln');actions.append(themeBtn);
 function fixTheme(){const light=document.documentElement.dataset.theme==='light';themeBtn.textContent=light?'☾':'☀';}
 const themeSelect=$('themeSelect');
 for(const opt of [...themeSelect.options])if(!['dark','light'].includes(opt.value)) opt.remove();
 if(!['dark','light'].includes(uiSettings.theme)){uiSettings.theme='dark';saveUiSettings();applyTheme();}
 themeBtn.onclick=()=>{themeSelect.value=document.documentElement.dataset.theme==='light'?'dark':'light';themeSelect.dispatchEvent(new Event('change',{bubbles:true}));requestAnimationFrame(fixTheme)};
 themeSelect.addEventListener('change',()=>requestAnimationFrame(fixTheme));fixTheme();
 // Preserve existing elements, handlers and IDs. Reorganize, do not replace the core app.
 const heads={members:['KADER','Mitglieder','Spieler, Teilnahme und Tagesregeln an einem Ort.'],summary:['AUSWERTUNG','Analyse','Einsatzverteilung, Rotation und aktuelle Kriege.'],stats:['CLAN-DATEN','Clan-Statistik','Ergebnisse und Angriffsstärke im Überblick.']};
 for(const [id,[tag,name,desc]] of Object.entries(heads)){
  const section=$('view-'+id);if(!section)continue;
  const h=document.createElement('div');h.className='arena2-heading';h.innerHTML=`<div><span class="arena2-eyebrow">${tag}</span><h2>${name}</h2><p>${desc}</p></div>`;section.prepend(h);
 }
 const plan=$('view-plan');
 const hero=document.createElement('div');hero.className='arena2-hero';hero.innerHTML=`<div><span class="arena2-eyebrow">ARENA / CWL-WOCHE</span><h2>Deine Kriegswoche.</h2><p id="arena2HeroMeta">Alle Kriegstage auf einen Blick. Einen Tag wählen und direkt bearbeiten.</p></div>${svg(icons.shield)}`;
 plan.insertBefore(hero,$('planOverview'));
 const week=$('mobileDaySwitcher');
 week.querySelector('.day-switcher-label').textContent='Die Kriegswoche';
 const grid=document.createElement('div');grid.className='arena2-plan-grid';
 plan.insertBefore(week,$('planOverview'));
 plan.insertBefore(grid,$('planOverview'));
 grid.append($('planDays'),$('planOverview'));
 const setCounts=()=>{
  const root=$('mobileDayTabs');if(!root||typeof state==='undefined')return;
  [...root.querySelectorAll('.mobile-day-tab')].forEach((b,i)=>{
   let n=b.querySelector('.arena2-day-count');if(!n){n=document.createElement('span');n.className='arena2-day-count';b.appendChild(n)}
   const actual=lastPlan?.dayPlans?.[i]?.lineup?.length||0;
   n.textContent=state.locks?.[i]?.locked?'Gespielt':`${actual} / ${state.config.slots} Spieler`;
  });
  const played=state.locks.filter(x=>x.locked).length;
  const mem=state.members.filter(x=>x.participating&&x.name.trim()).length;
  $('arena2HeroMeta').textContent=`${state.config.days} Kriegstage · ${state.config.slots} Plätze · ${mem} Teilnehmer · ${played} gespielt`;
 };
 // The UI's day navigation always has a visible single-day mode; user can choose all.
 if(uiSettings.dayViewMode!=='single') {uiSettings.dayViewMode='single';saveUiSettings();renderMobileDays();}
 mobileLineupsExpanded=true;renderPlan();setCounts();
 const originalRenderMobile=renderMobileDays;renderMobileDays=function(...args){const res=originalRenderMobile(...args);setCounts();return res};
 const originalRenderAll=renderAll;renderAll=function(...args){const res=originalRenderAll(...args);setCounts();return res};
 const weekScroll=()=>{const active=$('mobileDayTabs')?.querySelector('.mobile-day-tab.active');if(active&&innerWidth<=750)active.scrollIntoView({block:'nearest',inline:'nearest'})};
 $('mobileDayTabs').addEventListener('click',()=>requestAnimationFrame(weekScroll));
 // True design change: settings rendered as accessible, separate pages. The original controls remain DOM elements.
 const settings=$('view-settings');settings.removeAttribute('role');settings.removeAttribute('aria-modal');settings.removeAttribute('aria-label');
 const win=settings.querySelector('.settings-window');const originalCards=[...win.querySelectorAll(':scope > .card')];
 const layout=document.createElement('div');layout.className='arena2-settings-layout';
 const menu=document.createElement('nav');menu.className='arena2-settings-menu';menu.setAttribute('aria-label','Bereiche in Mehr');
 const panels=document.createElement('div');panels.className='arena2-settings-panels';
 layout.append(menu,panels);win.append(layout);
 const pageTitle=document.createElement('div');pageTitle.className='arena2-heading';pageTitle.innerHTML='<div><span class="arena2-eyebrow">VERWALTUNG</span><h2>Mehr</h2><p>Alles rund um euren Clan, die Planung und eure Daten – übersichtlich sortiert.</p></div>';settings.prepend(pageTitle);
 const panelDefs=[['account','Clan & Konto','Deine Clanprofile, gemeinsamer Zugriff und Berechtigungen.',icons.user],['planning','Planung','Kriegsgröße, CWL-Tage und Mitgliederabgleich.',icons.calendar],['display','Darstellung','Farbschema, Version und Neuerungen.',icons.palette],['backups','Sicherungen','Backups exportieren und wiederherstellen.',icons.backup],['extras','Weitere Optionen','Zurücksetzen, Feedback und Hilfe.',icons.info]];
 const panelMap={};
 function selectPanel(id){menu.querySelectorAll('button').forEach(b=>{const active=b.dataset.panel===id;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'true':'false')});panels.querySelectorAll('.arena2-settings-panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===id));}
 for(const [id,name,sub,ico] of panelDefs){
  const b=document.createElement('button');b.type='button';b.dataset.panel=id;b.innerHTML=svg(ico)+`<span>${name}</span>`;b.onclick=()=>selectPanel(id);menu.append(b);
  const p=document.createElement('section');p.className='arena2-settings-panel';p.dataset.panel=id;p.innerHTML=`<h3 class="arena2-panel-title">${name}</h3><p class="arena2-panel-sub">${sub}</p>`;panels.append(p);panelMap[id]=p;
 }
 if(originalCards[0])panelMap.account.append(originalCards[0]);
 if($('localProfileCard'))panelMap.account.append($('localProfileCard'));
 const oldSettings=originalCards.find(c=>c.querySelector('.settings-subcard'));
 if(oldSettings){
   [...oldSettings.querySelectorAll(':scope > .settings-subcard')].forEach(s=>{
    const h=s.querySelector('h4')?.textContent?.trim().toLowerCase()||'';
    const key=h.includes('grunddaten')||h.includes('clash-')?'planning':h.includes('darstellung')?'display':h.includes('backup')?'backups':'extras';panelMap[key].append(s);
   });
   const danger=oldSettings.querySelector('.actions');if(danger)panelMap.extras.append(danger);
   const input=oldSettings.querySelector('#membersFile');if(input)panelMap.backups.append(input);
   const foot=oldSettings.querySelector('.footer-note');if(foot)panelMap.backups.append(foot);
   oldSettings.remove();
 }
 const help=document.createElement('div');help.className='settings-subcard';help.innerHTML='<h4>Hilfe & Dokumentation</h4><p class="settings-note">Erklärungen zu Tagesregeln, Aufstellungen und Datensicherung.</p><button type="button" class="btn" id="arena2Help">Hilfe öffnen</button>';panelMap.extras.append(help);$('arena2Help').onclick=()=>$('helpBtn').click();
 const stage=document.createElement('div');stage.className='arena2-sandbox-box';stage.innerHTML='<strong>Cloud-Testumgebung</strong><p>Hier ist ausschließlich eine separate Supabase-Staging-Umgebung zulässig. Produktive Clan-Daten und die Live-Datenbank sind für diese Testoberfläche gesperrt.</p>';
 panelMap.account.prepend(stage);
 const stageForm=document.createElement('form');stageForm.className='settings-subcard arena2-config-form';stageForm.innerHTML='<h4>Staging verbinden</h4><label>Supabase-URL <input required type="url" name="url" autocomplete="off" placeholder="https://…supabase.co"></label><label>Publishable Key <input required type="text" name="key" autocomplete="off" placeholder="sb_publishable_…"></label><button class="btn primary" type="submit">Mit Test-Cloud verbinden</button><p class="settings-note">Nur die öffentliche Publishable Key verwenden, niemals einen Secret- oder Service-Role-Key. Nach dem Einrichten wird die Testseite neu geladen.</p><p class="arena2-demo-notice" id="arena2StageState" role="status"></p>';
 panelMap.account.insertBefore(stageForm,stage.nextSibling);
 function stageStatus(){const s=sessionStorage.getItem('arena_staging_auth_v1');$('arena2StageState').textContent=s?'Staging-Konfiguration für diesen Browser-Tab gesetzt.':'Noch kein isolierter Cloud-Zugang eingerichtet.';}
 try{stageStatus()}catch(e){$('arena2StageState').textContent='Staging-Zugang nicht konfiguriert.'}
 stageForm.onsubmit=e=>{
   e.preventDefault();const form=new FormData(stageForm);const url=String(form.get('url')||'').trim().replace(/\/$/,'');const key=String(form.get('key')||'').trim();
   let u;try{u=new URL(url)}catch{alert('Ungültige Supabase-URL');return}
   if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co')||u.hostname==='yjldnvfwposfwmzmcsow.supabase.co'){alert('Nur eine separate Supabase-Staging-URL ist erlaubt. Die Produktivdatenbank wird nicht verwendet.');return}
   if(!(key.startsWith('sb_publishable_')||key.startsWith('eyJ'))||key.toLowerCase().includes('service_role')||key.startsWith('sb_secret_')){alert('Bitte eine gültige öffentliche Publishable Key eingeben.');return}
   try{sessionStorage.setItem('arena_staging_auth_v1',JSON.stringify({url,key}));location.reload()}catch{alert('Browser-Speicher nicht verfügbar. Staging kann hier nicht eingerichtet werden.')}
 };
 selectPanel('account');
 // Main navigation maps to existing views, preserving cloud plugin functions.
 const navRoot=document.querySelector('.bottomnav');const navInner=navRoot.querySelector('.navinner');
 const originalStatsNav=$('statsNav');if(originalStatsNav)originalStatsNav.hidden=true;
 const more=document.createElement('button');more.type='button';more.className='navbtn';more.dataset.view='settings';navInner.append(more);
 for(const b of [...navInner.querySelectorAll('.navbtn')]){
   const id=b.dataset.view, labels={plan:'Plan',members:'Mitglieder',summary:'Analyse',settings:'Mehr',stats:'Statistik'};
   b.innerHTML=svg(icons[id]||icons.summary)+`<span>${labels[id]||'Mehr'}</span>`;
 }
 const secondary=document.createElement('div');secondary.className='arena2-stats-link';secondary.innerHTML='<div><strong>Clan-Statistik</strong><p>Angriffe, Hit-Rate und vergangene Kriege auswerten.</p></div><button class="btn small" id="arena2OpenStats" type="button">Ansehen</button>';
 $('view-summary').append(secondary);$('arena2OpenStats').onclick=()=>route('stats');
 const back=document.createElement('button');back.className='btn small';back.type='button';back.textContent='Zur Analyse';$('view-stats').querySelector('.arena2-heading')?.append(back);back.onclick=()=>route('summary');
 let current='plan';
 function route(view){
  if(!['plan','members','summary','settings','stats'].includes(view))view='plan';current=view;
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+view));
  navInner.querySelectorAll('.navbtn').forEach(b=>{b.classList.toggle('active',b.dataset.view===view||(view==='stats'&&b.dataset.view==='summary'));b.setAttribute('aria-current',b.classList.contains('active')?'page':'false')});
  window.scrollTo({top:0,behavior:'instant'});
 }
 window.showPlannerView=route;
 navInner.querySelectorAll('.navbtn').forEach(b=>b.onclick=()=>route(b.dataset.view));
 $('settingsOpen').onclick=()=>route('settings');$('settingsClose').onclick=()=>route('plan');
 // Cloud settings button must remain wired to its original cloud overlay after staging module loads.
 const stageNotice=()=>{route('settings');selectPanel('account');stage.scrollIntoView({block:'nearest',behavior:'smooth'});};
 if(!window.__arenaStagingConfigured){$('cloudOpen').onclick=stageNotice;$('settingsCloudManage').onclick=stageNotice;}
 // Responsive desktop header navigation, without duplicate nav controls.
 function placeNav(){if(innerWidth>=1000){const group=topbar.querySelector('.arena2-header-group')||(()=>{const h=document.createElement('div');h.className='arena2-header-group';row.prepend(h);h.append(row.querySelector('.titleblock'));return h})();row.insertBefore(navRoot,actions)}else{document.body.append(navRoot)}}
 placeNav();addEventListener('resize',placeNav,{passive:true});
 route('plan');
})();