/* ARENA WEEKVIEW / V3. Presentation and navigation only: reuse the original
   planner's elements and handlers. No database writes or cloud keys here. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const el = (tag, cls, html) => { const n=document.createElement(tag); if(cls)n.className=cls; if(html!==undefined)n.innerHTML=html;return n;};
  const icons = {
    shield:'<path d="M12 2 20 6v6c0 5-3.2 8.3-8 10-4.8-1.7-8-5-8-10V6z"/><path d="M9 12h6m-3-3v6"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    moon:'<path d="M20 15.2A8.3 8.3 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2z"/>',
    plan:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M7 14h3m-3 3h3m3-3h3"/>',
    members:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2zm13-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v1"/>',
    chart:'<path d="M4 20V10h4v10zm6 0V4h4v16zm6 0v-7h4v7z"/>',
    more:'<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    chevron:'<path d="m9 18 6-6-6-6"/>',
    left:'<path d="m15 18-6-6 6-6"/>',
    copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    pencil:'<path d="m15 5 4 4M3 21l4.5-1 12-12a2.83 2.83 0 0 0-4-4l-12 12L3 21z"/>',
    cloud:'<path d="M20 18a4 4 0 0 0 0-8A6.5 6.5 0 0 0 8 9a4.5 4.5 0 0 0 1 9z"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.5 13a8 8 0 0 0 0-2l2-1.5-2-3.5L17 7a8 8 0 0 0-2-1l-.4-3h-4l-.4 3a8 8 0 0 0-2 1l-2.5-1-2 3.5 2 1.5a8 8 0 0 0 0 2l-2 1.5 2 3.5 2.5-1a8 8 0 0 0 2 1l.4 3h4l.4-3a8 8 0 0 0 2-1l2.5 1 2-3.5z"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    check:'<path d="m5 12 4 4 10-10"/>',
    arrow:'<path d="M4 12h16m-7-7 7 7-7 7"/>'
  };
  const svg = name => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.more}</svg>`;
  if (!$('view-plan') || !$('view-settings') || !$('cloudOpen')) return;
  document.documentElement.classList.add('arena-v3');document.body.classList.add('arena-v3');
  const stageReady=!!window.__arenaStagingConfigured;
  const topbar=document.querySelector('.topbar'),topRow=topbar.querySelector('.toprow'),title=topbar.querySelector('.titleblock');
  const actions=topbar.querySelector('.top-actions');
  const profileBar=topbar.querySelector('.profilebar');
  const nav=document.querySelector('.bottomnav'),navInner=nav.querySelector('.navinner');
  const themeSelect=$('themeSelect');
  // Keep old settings handlers/inputs; expose only the two agreed themes in V3.
  if(themeSelect){[...themeSelect.options].filter(o=>!['dark','light'].includes(o.value)).forEach(o=>o.remove());
    if(typeof uiSettings!=='undefined'&&!['dark','light'].includes(uiSettings.theme)){uiSettings.theme='dark';saveUiSettings();applyTheme();}
  }
  // Reference-style narrow topbar, leaving account controls intact.
  const mark=el('div','arena3-brand',`<span class="arena3-brand-mark">${svg('shield')}</span><div><h1>CWL <span>/ Planer</span></h1><small>ARENA · WEEKVIEW</small></div>`);
  title.replaceChildren(mark);title.appendChild(profileBar);
  const theme=el('button','arena3-theme',svg('sun'));theme.type='button';theme.title='Hell-/Dunkelmodus';theme.setAttribute('aria-label','Hell-/Dunkelmodus wechseln');
  const stageBadge=el('span','arena3-stage-badge',stageReady?'CLOUD · STAGING':'VORSCHAU');stageBadge.title='Separate ARENA-Testoberfläche, nicht die Live-App';
  actions.prepend(stageBadge);actions.append(theme);
  function drawTheme(){theme.innerHTML=svg(document.documentElement.dataset.theme==='light'?'moon':'sun')}
  theme.onclick=()=>{if(!themeSelect)return;themeSelect.value=document.documentElement.dataset.theme==='light'?'dark':'light';themeSelect.dispatchEvent(new Event('change',{bubbles:true}));requestAnimationFrame(drawTheme)};
  themeSelect?.addEventListener('change',()=>requestAnimationFrame(drawTheme));drawTheme();
  // Shared heading style and view layout, without replacing content handlers.
  function heading(root,kicker,label,desc,action){const node=el('header','arena3-pagehead',`<div><span class="arena3-kicker">${kicker}</span><h2>${label}</h2><p>${desc}</p></div>`);if(action)node.append(action);root.prepend(node);return node;}
  const plan=$('view-plan'),members=$('view-members'),summary=$('view-summary'),stats=$('view-stats'),settings=$('view-settings');
  const planOverview=$('planOverview'),week=$('mobileDaySwitcher'),planDays=$('planDays');
  const hero=el('section','arena3-hero',`<div class="arena3-hero-content"><span class="arena3-kicker" id="arena3Season">CWL · SAISON</span><h2>Sieben Tage.<br>Ein starkes Team.</h2><p>Deine ganze CWL im Überblick. Wechsle zwischen Kriegstagen und behalte die Aufstellung im Blick.</p><div class="arena3-hero-actions"><button type="button" class="btn primary" id="arena3Edit">${svg('pencil')} Aufstellung bearbeiten</button><button type="button" class="btn" id="arena3Copy">${svg('copy')} Plan kopieren</button></div></div><div class="arena3-hero-art" aria-hidden="true"><svg viewBox="0 0 280 265" fill="none"><circle cx="154" cy="135" r="121" stroke="currentColor" stroke-width="1.5" opacity=".3"/><circle cx="154" cy="135" r="93" stroke="currentColor" stroke-width="1" stroke-dasharray="8 9" opacity=".34"/><path d="M46 216h214M67 202v-76h24v-24h30V69h35v33h32V74h37v53h24v75M97 202v-48h127v48M129 202v-27h66v27M110 118h18m30 0h20m27 0h20" stroke="currentColor" stroke-width="4" stroke-linejoin="round" opacity=".55"/><path d="M150 120v26m-13-13h26" stroke="currentColor" stroke-width="5" opacity=".5"/><path d="m26 136 12-22 12 22-12 22z" stroke="currentColor" stroke-width="3" opacity=".5"/></svg></div>`);
  plan.insertBefore(hero,plan.firstChild);
  $('arena3Copy').onclick=()=>$('copyFullPlanBtn')?.click();
  $('arena3Edit').onclick=()=>{const day=typeof mobileSelectedDay==='number'?mobileSelectedDay:0;if(typeof openLineupModal==='function')openLineupModal(day);};
  const originalOverviewKpis=planOverview.querySelector('.kpis');
  const metrics=el('div','arena3-metrics');if(originalOverviewKpis)metrics.append(originalOverviewKpis);
  plan.insertBefore(metrics,planOverview);
  const weekHead=el('div','arena3-weekhead','<div><h2>Die Kriegswoche</h2><p>Wähle einen Kriegstag für die Details.</p></div>');
  week.parentNode.insertBefore(weekHead,week);
  const details=el('details','arena3-extra-actions');details.innerHTML='<summary>Planungsstatus & weitere Aktionen</summary>';
  planOverview.parentNode.insertBefore(details,planOverview);details.append(planOverview);
  // Move actions behind an explicit disclosure; no original button or handler lost.
  const extraTop=planOverview.querySelector('.section-title');if(extraTop)extraTop.querySelector('h3')?.replaceChildren(document.createTextNode('Planungsstatus'));
  const applyWeek=()=>{
    const tabs=$('mobileDayTabs');if(!tabs||typeof state==='undefined'||!state.config)return;
    let season='CWL';try{season=(typeof state.name==='string'&&state.name)||'CWL';}catch{}
    const month=new Intl.DateTimeFormat('de-AT',{month:'long',year:'numeric'}).format(new Date());
    $('arena3Season').textContent=(season+' / '+month).toLocaleUpperCase('de-AT');
    const days=state.config.days||7;
    const todayCount=typeof playedPrefixLength==='function'?playedPrefixLength():0;
    [...tabs.querySelectorAll('.mobile-day-tab')].forEach((btn,i)=>{
      let kicker=btn.querySelector('.arena3-day-kicker');if(!kicker){kicker=el('span','arena3-day-kicker','KRIEGSTAG');btn.prepend(kicker)}
      const no=btn.querySelector('.day-no');if(no)no.textContent=String(i+1).padStart(2,'0');
      let status=btn.querySelector('.arena3-day-status');if(!status){status=el('span','arena3-day-status');btn.append(status)}
      const played=!!state.locks?.[i]?.locked;status.textContent=played?'Gespielt':i===todayCount?'Nächster Krieg':'Geplant';
      let foot=btn.querySelector('.arena3-day-foot');if(!foot){foot=el('span','arena3-day-foot');btn.append(foot)}
      const count=typeof lastPlan!=='undefined'&&lastPlan?.dayPlans?.[i]?.lineup?.length||0;
      foot.textContent=`${count} / ${state.config.slots} Spieler`;
      if(!btn.querySelector('.arena3-day-arrow'))btn.append(el('span','arena3-day-arrow',svg('arrow')));
      btn.classList.toggle('arena3-next',i===todayCount&&!played);
    });
    const active=tabs.querySelector('.mobile-day-tab.active');if(active){tabs.scrollTo({left:active.offsetLeft-tabs.offsetLeft-10,behavior:'instant'});}
    const m=$('kpiParticipants');if(m) m.closest('.kpi')?.classList.add('arena3-metric');
  };
  // Original handlers must be allowed to render, then enhance only their DOM output.
  const origMobile=typeof renderMobileDays==='function'?renderMobileDays:null;
  if(origMobile)renderMobileDays=function(...args){const out=origMobile(...args);applyWeek();return out};
  const origMembers=typeof renderMembers==='function'?renderMembers:null;
  const decorateMembers=()=>{
    const root=$('memberList');if(!root)return;
    root.querySelectorAll('.member').forEach((card,i)=>{
      const wrap=card.querySelector('.name-wrap');if(!wrap)return;
      const name=card.querySelector('.member-name')?.value||'?';
      if(!wrap.querySelector('.arena3-avatar'))wrap.prepend(el('span','arena3-avatar',name.trim().charAt(0).toUpperCase()||'?'));
      const tools=card.querySelector('.member-details');
      ['.member-part','.member-fixed'].forEach(sel=>{const ctrl=card.querySelector('.member-top '+sel);if(ctrl&&tools)tools.prepend(ctrl)});
      card.style.setProperty('--member-index',`"${String(i+1).padStart(2,'0')}"`);
    });
  };
  if(origMembers)renderMembers=function(...args){const out=origMembers(...args);decorateMembers();refreshLabels();return out};
  if (typeof uiSettings!=='undefined' && uiSettings.dayViewMode!=='single'){uiSettings.dayViewMode='single';saveUiSettings();}
  if(typeof mobileLineupsExpanded!=='undefined')mobileLineupsExpanded=true;
  // Existing initial render has already run, re-render to get the new day controls.
  if(typeof renderPlan==='function')renderPlan();decorateMembers();applyWeek();
  const add=el('button','btn primary arena3-add',`${svg('plus')} Spieler hinzufügen`);add.type='button';add.onclick=()=>$('addMemberBtn')?.click();
  heading(members,'KADER VERWALTEN','Mitglieder','Teilnahme, Fixstatus und Spielerstärke zentral pflegen.',add);
  const roster=$('memberList');const outer=roster?.closest('.card');if(outer)outer.classList.add('arena3-roster');
  // All existing advanced roster tools are retained but live in a disclosure.
  const rosterAdvanced=el('details','arena3-roster-advanced','<summary>Weitere Kaderaktionen · Sortieren, Import und Mehrfachbearbeitung</summary>');
  const rosterBar=outer?.querySelector('.member-actionbar'),sort=outer?.querySelector('.list-management');
  if(rosterBar){rosterBar.parentNode.insertBefore(rosterAdvanced,rosterBar);rosterAdvanced.append(rosterBar)}
  if(sort)rosterAdvanced.append(sort);
  // The visible name/title and filters sit near each other like the original concept.
  const rosterTop=el('div','arena3-roster-top',`<h3>Clan-Kader <span id="arena3MemberCount"></span></h3><p>Suche einen Spieler oder öffne die erweiterten Optionen.</p>`);
  if(outer)outer.prepend(rosterTop);
  const advancedTools=outer?.querySelector('.member-help-details');if(advancedTools)rosterAdvanced.append(advancedTools);
  const moreTools=outer?.querySelector('#guestMembersTools');if(moreTools)rosterAdvanced.append(moreTools);
  const cloudTools=outer?.querySelector('#cloudMembersTools');if(cloudTools)rosterAdvanced.append(cloudTools);
  const addBottom=outer?.querySelector('.add-member-bottom');if(addBottom)addBottom.classList.add('arena3-secondary-add');
  // Live data visualizations computed from the current planner state (never hardcoded).
  heading(summary,'AUSWERTUNG','Einsatzanalyse','Spielerverteilung und Rotation nachvollziehen.');
  const distribution=el('div','card arena3-distribution',`<div class="arena3-card-head"><h3>Einsätze im Überblick</h3><p>Geplante und bereits gespielte Kriegstage</p></div><div id="arena3Bars"></div>`);
  const balance=el('div','card arena3-balance','<h3>Rotation und Fairness</h3><strong id="arena3Rotation">–</strong><p>Einsätze je Rotationsspieler, ohne Fixspieler.</p><span class="arena3-neutral">Die Werte stammen aus der aktuellen Planung.</span>');
  const summaryCard=$('summaryList')?.closest('.card');if(summaryCard){summaryCard.parentNode.insertBefore(distribution,summaryCard);summaryCard.parentNode.insertBefore(balance,summaryCard)}
  const chart=()=>{
    const root=$('arena3Bars');if(!root||typeof state==='undefined'||typeof lastPlan==='undefined')return;
    const participants=state.members.filter(m=>m.participating&&m.name.trim());
    const n=state.config.days||7;const played=state.locks||[];
    const data=participants.map(m=>({name:m.name,id:m.id,count:(lastPlan?.dayPlans||[]).filter(dp=>dp.lineup?.includes(m.id)).length})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'de')).slice(0,10);
    if(!data.length){root.innerHTML='<div class="arena3-empty">Noch keine Teilnehmer. Füge zuerst Spieler hinzu, um die Einsatzverteilung zu sehen.</div>';} else {
      root.replaceChildren();const max=Math.max(n,1);
      for(const x of data){const row=el('div','arena3-bar-row');const lab=el('span','arena3-bar-name');lab.textContent=x.name;lab.title=x.name;const track=el('div','arena3-bar-track');const fill=el('span','arena3-bar-fill');fill.style.width=(100*x.count/max)+'%';track.append(fill);const count=el('strong','arena3-bar-num');count.textContent=x.count;row.append(lab,track,count);root.append(row)}
    }
    const nonFixed=participants.filter(m=>!m.fixed);
    const counts=nonFixed.map(m=>(lastPlan?.dayPlans||[]).filter(dp=>dp.lineup?.includes(m.id)).length);
    $('arena3Rotation').textContent=counts.length?`${Math.min(...counts)}–${Math.max(...counts)}`:'–';
  };
  heading(stats,'CLAN-DATEN','Clan-Statistik','Angriffe, Hit-Rate und vergangene Kriege analysieren.');
  const statsLink=el('button','btn arena3-stats-link',`Clan-Statistik öffnen ${svg('chevron')}`);statsLink.type='button';summary.querySelector('.arena3-pagehead')?.append(statsLink);
  // Settings design follows the original approved reference, not a settings tab sheet.
  settings.removeAttribute('role');settings.removeAttribute('aria-modal');settings.removeAttribute('aria-label');
  const win=settings.querySelector('.settings-window');const originalTitle=win.querySelector('.settings-dialog-head');originalTitle?.classList.add('arena3-old-settings-head');
  const settingsHead=heading(settings,'VERWALTUNG','Clan & Einstellungen','Alles, was du seltener brauchst – an einem verlässlichen Ort.');
  const settingsHome=el('div','arena3-settings-home');win.prepend(settingsHome);
  const pages=el('div','arena3-settings-pages');win.append(pages);
  const sections={};
  const subDefs=[['profiles','Clanprofile','Clan wechseln, Profile pflegen und Zugriffe verwalten.'],['archive','CWL-Archiv','Vergangene Ligen und gespeicherte Line-ups ansehen.'],['planning','CWL-Grunddaten','Kriegsgröße, Kriegstage und Clanabgleich.'],['backup','Backup & Wiederherstellung','Daten exportieren, sichern und wiederherstellen.'],['display','Darstellung & Hilfe','Farbschema, App-Version und Hilfethemen.'],['advanced','Weitere Optionen','Problem melden und Profil verwalten.']];
  for(const [id,name,desc] of subDefs){const p=el('section','arena3-settings-page');p.dataset.page=id;const back=el('button','arena3-back',`${svg('left')} Clan & Einstellungen`);back.type='button';back.onclick=()=>selectPage(null);p.append(back);p.append(el('h3','arena3-subtitle',name));p.append(el('p','arena3-subdesc',desc));pages.append(p);sections[id]=p;}
  const makeGroup=(name,desc,items)=>{
    const group=el('section','arena3-menu-group');group.append(el('h3','',name));group.append(el('p','arena3-group-desc',desc));
    for(const [label,sub,id,fn] of items){const b=el('button','arena3-menu-row');b.type='button';b.innerHTML=`<span><strong>${label}</strong><small>${sub}</small></span><span class="arena3-menu-arrow">${svg('chevron')}</span>`;b.onclick=fn||(()=>selectPage(id));group.append(b)}return group;
  };
  settingsHome.append(makeGroup('Clanprofile',`${stageReady?'Cloud-Testmodus':'Lokale Vorschau'} · aktives Profil: <span id="arena3ActiveProfile">–</span>`,[
    ['Profile wechseln','Verschiedene Clans getrennt verwalten','profiles'],
    ['Profil anlegen oder duplizieren','Eigene Mitglieder und Regeln','profiles'],
    ['CWL-Archiv','Vergangene Ligen einsehen','archive']
  ]));
  settingsHome.append(makeGroup('Planung & Daten','Deine Einstellungen und Sicherungen',[
    ['CWL-Grunddaten','15 / 30 Spieler, individuell, Kriegstage','planning'],
    ['Backup & Wiederherstellung','JSON exportieren und importieren','backup'],
    ['Darstellung & Hilfe','Hell / Dunkel, App-Version und Hilfe','display']
  ]));
  const utilities=el('div','arena3-settings-utilities');
  const accountLink=el('button','arena3-utility-link',`${svg('cloud')} Clan & Konto ${svg('chevron')}`);accountLink.type='button';accountLink.onclick=()=>selectPage('profiles');
  const advancedLink=el('button','arena3-utility-link',`${svg('settings')} Weitere Optionen ${svg('chevron')}`);advancedLink.type='button';advancedLink.onclick=()=>selectPage('advanced');
  utilities.append(accountLink,advancedLink);settingsHome.append(utilities);
  // Move original elements rather than duplicating or replacing them.
  const local=$('localProfileCard');if(local)sections.profiles.append(local);
  const acc=$('settingsCloudAccount')?.closest('.card');if(acc)sections.profiles.prepend(acc);
  if(profileBar){const box=el('div','card arena3-profile-switch');box.append(el('h4','','Aktives Profil'));box.append(profileBar);sections.profiles.prepend(box)}
  const archives=$('archiveList')?.closest('.card');if(archives)sections.archive.append(archives);
  const sourceCard=[...win.querySelectorAll(':scope > .card')].find(c=>c.querySelector('.settings-subcard'));
  if(sourceCard){
    [...sourceCard.querySelectorAll(':scope > .settings-subcard')].forEach(block=>{
      const label=block.querySelector('h4')?.textContent?.toLowerCase()||'';
      if(label.includes('grunddaten')||label.includes('clash'))sections.planning.append(block);
      else if(label.includes('backup'))sections.backup.append(block);
      else if(label.includes('darstellung'))sections.display.append(block);
      else sections.advanced.append(block);
    });
    const danger=sourceCard.querySelector(':scope > .actions');if(danger)sections.advanced.append(danger);
    const file=sourceCard.querySelector('#membersFile');if(file)sections.backup.append(file);
    const note=sourceCard.querySelector('.footer-note');if(note)sections.backup.append(note);
    sourceCard.remove();
  }
  const help=el('div','card arena3-help','<h3>Hilfe & Anleitungen</h3><p>Erklärungen zu Aufstellungen, Regeln und Datenverwaltung.</p><button type="button" class="btn" id="arena3Help">Hilfe öffnen</button>');sections.display.append(help);$('arena3Help').onclick=()=>$('helpBtn')?.click();
  const sandbox=el('div','card arena3-staging',`<h3>Cloud-Testumgebung</h3><p id="arena3StageStatus">${stageReady?'Isolierte Staging-Verbindung aktiviert.':'Noch keine Cloud-Testdatenbank verbunden. Die Vorschau verwendet derzeit ausschließlich lokale Browserdaten.'}</p><details><summary>Separate Testdatenbank verbinden</summary><form id="arena3StageForm"><label>Supabase Staging-URL <input name="url" type="url" required placeholder="https://staging.supabase.co"></label><label>Öffentlicher Publishable Key <input name="key" type="text" required placeholder="sb_publishable_…"></label><button class="btn primary" type="submit">Staging verbinden</button><small>Keine produktiven URLs und niemals einen Secret-/Service-Role-Key verwenden.</small></form></details>`);
  sections.profiles.prepend(sandbox);
  $('arena3StageForm').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.currentTarget),url=String(fd.get('url')||'').trim().replace(/\/$/,''),key=String(fd.get('key')||'').trim();
    let parsed;try{parsed=new URL(url)}catch{alert('Ungültige URL');return}
    if(parsed.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.co$/i.test(parsed.hostname)||parsed.hostname==='yjldnvfwposfwmzmcsow.supabase.co'||!/^(sb_publishable_|eyJ)/.test(key)||key.startsWith('sb_secret_')||key.includes('service_role')){alert('Nur eine separate Supabase-Staging-Umgebung mit öffentlichem Publishable Key ist zulässig.');return}
    try{sessionStorage.setItem('arena_staging_auth_v1',JSON.stringify({url,key}));location.reload()}catch{alert('Sitzungsspeicher nicht verfügbar')}
  };
  function selectPage(id){settingsHome.hidden=!!id;settingsHead.hidden=!!id;for(const [key,node]of Object.entries(sections))node.classList.toggle('active',key===id);settings.scrollIntoView({block:'start',behavior:'instant'});}
  const refreshLabels=()=>{const name=typeof state!=='undefined'?state?.name:'–';$('arena3ActiveProfile')&&( $('arena3ActiveProfile').textContent=name||'Neuer Clan');$('arena3MemberCount')&&($('arena3MemberCount').textContent=`· ${state?.members?.length||0} Mitglieder`)};
  const origRenderAll=typeof renderAll==='function'?renderAll:null;
  if(origRenderAll)renderAll=function(...args){const out=origRenderAll(...args);applyWeek();chart();decorateMembers();refreshLabels();return out};
  selectPage(null);chart();refreshLabels();
  // One consistent navigation, while retaining native cloud statistics actions.
  const statsNav=$('statsNav');if(statsNav)statsNav.hidden=true;
  const extra=el('button','navbtn arena3-more');extra.dataset.view='settings';navInner.append(extra);
  for(const b of [...navInner.querySelectorAll('.navbtn')]){if(b.id==='statsNav')continue;const name=b.dataset.view||'';const map={plan:['plan','Plan'],members:['members','Mitglieder'],summary:['chart','Analyse'],settings:['more','Mehr']};const spec=map[name];if(spec)b.innerHTML=svg(spec[0])+`<span>${spec[1]}</span>`}
  function route(which){if(!['plan','members','summary','settings','stats'].includes(which))which='plan';document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+which));
    navInner.querySelectorAll('.navbtn:not([hidden])').forEach(b=>{const active=b.dataset.view===which||(which==='stats'&&b.dataset.view==='summary');b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false')});
    if(which==='settings')selectPage(null);window.scrollTo({top:0,behavior:'instant'});}
  window.showPlannerView=route;
  navInner.querySelectorAll('.navbtn').forEach(b=>{if(!b.hidden)b.onclick=()=>route(b.dataset.view)});
  $('settingsOpen').onclick=()=>route('settings');$('settingsClose').onclick=()=>route('plan');
  statsLink.onclick=()=>route('stats');
  const statsBack=el('button','arena3-back',`${svg('left')} Zur Einsatzanalyse`);statsBack.type='button';statsBack.onclick=()=>route('summary');stats.insertBefore(statsBack,stats.querySelector('.arena3-pagehead'));
  if(!stageReady){const openAccount=()=>{route('settings');selectPage('profiles')};$('cloudOpen').onclick=openAccount;$('settingsCloudManage').onclick=openAccount;}
  // Desktop sidebar: same controls and route handlers, no duplicated navigation.
  const adjustDesktop=()=>{if(window.innerWidth>=1000){if(nav.parentNode!==document.body)document.body.append(nav);} else if(nav.parentNode!==document.body){document.body.append(nav)}};
  adjustDesktop();window.addEventListener('resize',adjustDesktop,{passive:true});
  // All extra presentation reacts to later cloud data refreshes as well.
  const mutationRoot=$('mobileDayTabs');mutationRoot?.addEventListener('click',()=>requestAnimationFrame(applyWeek));
  route('plan');
})();