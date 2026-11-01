/* ARENA WEEKVIEW – navigation and presentation only. All original handlers remain active. */
(() => {
  'use strict';
  const icon = (name) => ({plan:'<path d="M3 7h18M7 3v4m10-4v4M5 12h4v4H5zm6 0h4v4h-4zM3 5h18v16H3z"/>',members:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2zm13-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v1"/>',summary:'<path d="M4 20V10h4v10zm6 0V4h4v16zm6 0v-7h4v7z"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'}[name] || '');
  const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const shield = svg('<path d="M12 2 20 6v6c0 5-3.2 8.3-8 10-4.8-1.7-8-5-8-10V6z"/><path d="M9 12h6m-3-3v6"/>');
  const plan = document.getElementById('view-plan');
  const summary = document.getElementById('view-summary');
  const nav = document.querySelector('.bottomnav');
  if (!plan || !summary || !nav || document.getElementById('view-more')) return;
  document.querySelector('.titleblock h1').innerHTML = `<span class="arena-shield">${shield}</span><span>CWL Planer</span>`;
  document.querySelector('.titleblock .subtitle').textContent = 'ARENA · Clankriegsliga';
  const extra = document.createElement('button');extra.className='btn small arena-theme-switch';extra.type='button';extra.id='arenaThemeToggle';extra.title='Hell- / Dunkelmodus';extra.setAttribute('aria-label','Hell- oder Dunkelmodus umschalten');document.querySelector('.top-actions').prepend(extra);
  const mark = document.createElement('span');mark.className='arena-preview-label';mark.textContent='TESTVERSION';document.querySelector('.top-actions').prepend(mark);
  const more = document.createElement('section');more.id='view-more';more.className='view';
  more.innerHTML='<div class="arena-page-head"><div><div class="arena-eyebrow">Verwaltung</div><h2>Mehr</h2><p>Clanprofile, vergangene CWLs, Einstellungen und Datensicherung.</p></div></div>';
  document.querySelector('main.content').append(more);
  [...summary.querySelectorAll(':scope > .card')].slice(1).forEach(card=>more.appendChild(card));
  const moreBtn=document.createElement('button');moreBtn.type='button';moreBtn.className='navbtn';moreBtn.dataset.view='more';moreBtn.innerHTML=svg(icon('more'))+'<span>Mehr</span>';
  nav.querySelector('.navinner').appendChild(moreBtn);
  for(const btn of nav.querySelectorAll('.navbtn')){
    const view=btn.dataset.view; const label=view==='summary'?'Analyse':view==='members'?'Mitglieder':view==='plan'?'Plan':'Mehr';
    btn.innerHTML=svg(icon(view))+'<span>'+label+'</span>';
  }
  moreBtn.onclick=()=>{
    document.querySelectorAll('.navbtn').forEach(n=>n.classList.toggle('active',n===moreBtn));
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v===more));
    window.scrollTo({top:0,behavior:'smooth'});
  };
  const intro=(target,eyebrow,title,desc)=>{
    const el=document.createElement('div');el.className='arena-page-head';el.innerHTML=`<div><div class="arena-eyebrow">${eyebrow}</div><h2>${title}</h2><p>${desc}</p></div>`;target.prepend(el);
  };
  intro(document.getElementById('view-members'),'Kader','Mitglieder','Spieler, Teilnahme, Stärken und Tagesregeln verwalten.');
  intro(summary,'Auswertung','Analyse','Einsätze und Rotation im Blick behalten.');
  const hero=document.createElement('div');hero.className='arena-hero';hero.innerHTML=`<div class="arena-hero-copy"><div class="arena-eyebrow">ARENA / CWL-PLANUNG</div><h2>Deine Kriegswoche.</h2><p id="arenaHeroStatus">Sieben Tage planen, Aufstellungen anpassen und Rotation im Blick behalten.</p></div><div class="arena-hero-art">${shield}</div>`;
  plan.insertBefore(hero,document.getElementById('planOverview'));
  const switcher=document.getElementById('mobileDaySwitcher');
  switcher.querySelector('.day-switcher-label').textContent='Die Kriegswoche';
  plan.insertBefore(switcher,document.getElementById('planOverview'));
  plan.insertBefore(document.getElementById('planOverview'),document.getElementById('planDays'));
  const themeSelect=document.getElementById('themeSelect');
  [...themeSelect.options].forEach(opt=>{if(!['dark','light'].includes(opt.value)) opt.remove()});
  if (!['dark','light'].includes(uiSettings.theme)) {uiSettings.theme=uiSettings.theme==='cyberlight'?'light':uiSettings.theme==='system'&&matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';applyTheme();saveUiSettings();}
  function updateTheme(){const dark=document.documentElement.dataset.theme!=='light';extra.textContent=dark?'☀':'☾';extra.setAttribute('aria-label',dark?'Hellmodus einschalten':'Dunkelmodus einschalten');}
  extra.addEventListener('click',()=>{themeSelect.value=document.documentElement.dataset.theme==='light'?'dark':'light';themeSelect.dispatchEvent(new Event('change',{bubbles:true}));updateTheme();});
  themeSelect.addEventListener('change',()=>requestAnimationFrame(updateTheme));updateTheme();
  function placeNav(){const parent=window.innerWidth>900?document.querySelector('.topbar'):document.body;if(nav.parentElement!==parent)parent.appendChild(nav)}
  addEventListener('resize',placeNav,{passive:true});placeNav();
  function decorateWeek(){
    const root=document.getElementById('mobileDayTabs');if(!root)return;
    [...root.querySelectorAll('.mobile-day-tab')].forEach((btn,i)=>{
      if(btn.querySelector('.arena-week-caption'))return;
      const count=lastPlan?.dayPlans?.[i]?.lineup?.length??0;
      const played=!!state.locks[i]?.locked;
      const cap=document.createElement('span');cap.className='arena-week-caption'+(played?' ok':'');cap.textContent=played?'Gespielt':`${count} / ${state.config.slots} Spieler`;
      btn.appendChild(cap);
    });
  }
  const oldMobile=renderMobileDays;
  renderMobileDays=function(){oldMobile();decorateWeek();};
  // Some file/sandbox previews block sessionStorage; do not let that break the UI.
  let firstArenaVisit = false;
  try {
    firstArenaVisit = !sessionStorage.getItem('arena_weekview_initialized');
    if(firstArenaVisit) sessionStorage.setItem('arena_weekview_initialized','1');
  } catch (_) { firstArenaVisit = true; }
  if(firstArenaVisit){uiSettings.dayViewMode='single';saveUiSettings();}
  mobileLineupsExpanded=true;
  renderPlan();
  function updateHero(){
    const status=document.getElementById('arenaHeroStatus');
    const count=state.members.filter(m=>m.participating&&m.name.trim()).length;
    const done=state.locks.slice(0,state.config.days).filter(l=>l.locked).length;
    status.textContent=`${state.config.days} Kriegstage · ${state.config.slots} Plätze pro Tag · ${count} Teilnehmer · ${done} gespielt`;
  }
  const oldAll=renderAll;
  renderAll=function(...args){const r=oldAll(...args);updateHero();return r;};
  updateHero();
  const adjust=()=>{if(window.innerWidth<700){const root=document.getElementById('mobileDayTabs');const active=root?.querySelector('.mobile-day-tab.active');if(root&&active)root.scrollLeft=active.offsetLeft-root.offsetLeft-12}};
  requestAnimationFrame(adjust);
  document.getElementById('mobileDayTabs').addEventListener('click',()=>requestAnimationFrame(adjust));
})();