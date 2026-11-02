/* ARENA WEEKVIEW reference integration, design source: user-supplied overview(1).html.
 * Only presentation/navigation. Existing cloud and CWL business handlers retained.
 * New filename is intentional: old CDN previews may cache prior versions.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const e=(tag,cls,html)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(html!==undefined)n.innerHTML=html;return n};
const paths={shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M19.07 4.93l-1.42 1.42M6.35 17.65l-1.42 1.42"/>',moon:'<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/>',plan:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',chart:'<path d="M3 3v18h18M7 16v-4M12 16V8M17 16v-9"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',chevron:'<path d="m9 18 6-6-6-6"/>',back:'<path d="m15 18-6-6 6-6"/>',copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z"/>',plus:'<path d="M12 5v14M5 12h14"/>',cloud:'<path d="M20 18a4 4 0 0 0 .2-8A6 6 0 0 0 8.5 9a4.5 4.5 0 0 0 .5 9h11z"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3"/>'};
const ic=(name)=>`<svg class="ar4-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.info}</svg>`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if(!$('view-plan')||!$('view-members')||!$('view-settings')||!$('planDays')||!$('cloudOpen'))return;
document.documentElement.classList.add('arena-reference');document.body.classList.add('arena-reference');
const main=$('view-plan'),members=$('view-members'),summary=$('view-summary'),settings=$('view-settings'),stats=$('view-stats');
const originalWeek=$('mobileDaySwitcher'),originalPlan=$('planDays'),overview=$('planOverview');
const originalKpis=overview?.querySelector('.kpis');
let selectedDay=Math.min(typeof playedPrefixLength==='function'?playedPrefixLength():0,Math.max(0,(typeof state!=='undefined'?state.config.days:7)-1)),currentView='plan',activeSubpage=null,weekMode='single';
const cleanMonth=()=>new Intl.DateTimeFormat('de-AT',{month:'long',year:'numeric'}).format(new Date()).toUpperCase('de-AT');
const activeProfile=()=>{try{return state?.name||'Neuer Clan'}catch{return 'Neuer Clan'}};
const currentPlan=()=>{try{return lastPlan?.dayPlans||[]}catch{return []}};
const currentState=()=>{try{return state}catch{return null}};
function withCore(name,...args){try{const fn=window[name];if(typeof fn==='function')return fn(...args)}catch(err){console.error('ARENA operation failed:',name,err)}}
// The original HTML's core business script and cloud runtime remain intact.
// All original elements keep their IDs and are still in the document.
const oldHeader=document.querySelector('.topbar');const title=oldHeader?.querySelector('.titleblock');const topActions=oldHeader?.querySelector('.top-actions');const pbar=oldHeader?.querySelector('.profilebar');
const brand=e('div','ar4-brand',`<span class="ar4-brand-mark">${ic('shield')}</span><span><strong>CWL <em>/ Planer</em></strong><small>ARENA · WEEKVIEW</small></span>`);
const bar=e('div','ar4-siteheader');const barInner=e('div','ar4-header-inner');const controls=e('div','ar4-header-controls');
const stage=e('span','ar4-test-label','TEST');stage.title='Nur Testversion – keine Verbindung zur produktiven Cloud';
const account=e('button','ar4-account',`${ic('cloud')}<span>Clan & Konto</span>`);account.type='button';account.onclick=()=>{if(stageReady())$('cloudOpen')?.click();else{route('settings');openPage('account')}};
const theme=e('button','ar4-theme',ic('sun'));theme.type='button';theme.title='Hell / Dunkel';theme.setAttribute('aria-label','Farbschema wechseln');
controls.append(account,stage,theme);barInner.append(brand,controls);bar.append(barInner);
oldHeader?.parentNode?.insertBefore(bar,oldHeader);oldHeader.classList.add('ar4-original-header');
const selector=$('themeSelect');if(selector){for(const opt of [...selector.options])if(!['dark','light'].includes(opt.value))opt.remove();try{if(!['dark','light'].includes(uiSettings.theme)){uiSettings.theme='dark';saveUiSettings();applyTheme()}}catch{}}
const refreshTheme=()=>{theme.innerHTML=ic(document.documentElement.dataset.theme==='light'?'moon':'sun')};refreshTheme();
theme.onclick=()=>{if(!selector)return;selector.value=document.documentElement.dataset.theme==='light'?'dark':'light';selector.dispatchEvent(new Event('change',{bubbles:true}));requestAnimationFrame(refreshTheme)};
selector?.addEventListener('change',()=>requestAnimationFrame(refreshTheme));
// Preserve cloud control, but move profile selector into its own settings subpage.
const nav=document.querySelector('.bottomnav'),navInner=nav?.querySelector('.navinner');if(navInner){
 const hiddenStats=$('statsNav');if(hiddenStats)hiddenStats.hidden=true;
 const n=e('button','navbtn ar4-more');n.type='button';n.dataset.view='settings';navInner.append(n);
 const specs={plan:['plan','Plan'],members:['users','Mitglieder'],summary:['chart','Analyse'],settings:['more','Mehr']};
 for(const button of [...navInner.querySelectorAll('.navbtn')]){if(button.id==='statsNav')continue;const x=specs[button.dataset.view];if(x)button.innerHTML=`${ic(x[0])}<span>${x[1]}</span>`;button.onclick=()=>route(button.dataset.view)}
}
function titleHead(where,kicker,titleTxt,desc,act){const node=e('div','ar4-section-head',`<div><div class="ar4-kicker">${kicker}</div><h2>${titleTxt}</h2><p>${desc}</p></div>`);if(act)node.append(act);where.prepend(node);return node;}
// ===== WEEKVIEW — recreate actual reference hierarchy, not old day-card skinned =====
const hero=e('section','ar4-feature',`<div class="ar4-feature-main"><div class="ar4-kicker" id="ar4Season"></div><h1>Sieben Tage.<br>Ein starkes Team.</h1><p>Deine ganze CWL im Überblick. Wechsle zwischen Kriegstagen und behalte die Aufstellung im Blick.</p><div class="ar4-feature-actions"><button class="btn primary" type="button" id="ar4Edit">${ic('edit')} Aufstellung bearbeiten</button><button class="btn" type="button" id="ar4Copy">${ic('copy')} Plan kopieren</button></div></div><div class="ar4-feature-art" aria-hidden="true"><svg viewBox="0 0 300 220" fill="none" stroke="currentColor" stroke-width="2"><circle cx="146" cy="107" r="94" opacity=".21"/><circle cx="146" cy="107" r="72" opacity=".13" stroke-dasharray="4 6"/><path d="M79 172V99h17V77h15V49h25v25h21V45h26v33h17v21h16v73M65 180h164M96 99h20V77h45v22h22M116 172v-41h60v41M123 172v-33h46v33M141 65h12v18h-12M91 117h14v16H91M193 117h15v16h-15"/><path d="m49 70 9-19 9 19-9 18-9-18Zm189 12 8-17 8 17-8 17-8-17ZM71 198h152" stroke-width="2.5"/><path d="M144 108h14M149 102v13" opacity=".65"/></svg></div>`);
main.prepend(hero);
const metrics=e('div','ar4-metrics');if(originalKpis)metrics.append(originalKpis);
main.insertBefore(metrics,hero.nextSibling);
const stateBadge=e('div','ar4-live-status',`${ic('check')}<span id="ar4StatusText">CWL vorbereiten</span>`);
main.insertBefore(stateBadge,metrics.nextSibling);
const weekTitle=e('div','ar4-week-title',`<div><h2>Die Kriegswoche</h2><p>Wähle einen Kriegstag für die Details.</p></div><div class="ar4-week-modes"><button type="button" id="ar4One" class="active">Einzeltag</button><button type="button" id="ar4All">Alle Tage</button></div>`);
main.insertBefore(weekTitle,stateBadge.nextSibling);
const week=e('div','ar4-weekstrip');week.setAttribute('role','group');week.setAttribute('aria-label','Kriegstag wählen');main.insertBefore(week,weekTitle.nextSibling);
const detailWrap=e('div','ar4-detail-layout');main.insertBefore(detailWrap,week.nextSibling);
const lineup=e('section','ar4-panel ar4-lineup');lineup.innerHTML=`<div class="ar4-panel-head"><div><span class="ar4-kicker">AUSGEWÄHLTER KRIEG</span><h2 id="ar4LineupTitle">Line-up · Tag 1</h2><p id="ar4LineupSub"></p></div><button class="btn small" id="ar4DetailEdit">${ic('edit')} Bearbeiten</button></div><div id="ar5Changes" class="ar5-changes" aria-live="polite"></div><div id="ar5Warnings" class="ar5-warnings" aria-live="polite"></div><div id="ar5DayActions" class="ar5-day-actions"></div><details id="ar5LineupDisclosure" class="ar5-lineup-disclosure"><summary><span id="ar5LineupSummary">Spielerliste anzeigen</span>${ic('chevron')}</summary><div id="ar4LineupRows" class="ar4-player-table"></div></details><div class="ar4-lineup-footer"><button class="btn" id="ar4AllPlayers">Weitere CWL-Werkzeuge ${ic('arrow')}</button></div></section>`;
const insights=e('aside','ar4-panel ar4-insight');insights.innerHTML=`<div class="ar4-kicker">TEAMBERICHT</div><h2 id="ar4InsightTitle">Dein Team im Blick.</h2><p id="ar4InsightText">Überprüfe den ausgewählten Kriegstag und seine Aufstellung.</p><div class="ar4-insight-metrics" id="ar4InsightMetrics"></div><div class="ar4-insight-note"><strong id="ar4InsightNoteTitle">Der Fokus für Tag 1</strong><p id="ar4InsightNoteText">Aufstellung und Tagesregeln berücksichtigen.</p></div><button type="button" class="btn" id="ar4Why">${ic('info')} Warum diese Auswahl?</button></aside>`;
detailWrap.append(lineup,insights);
const nativeControls=e('div','ar6-native-controls');nativeControls.setAttribute('aria-hidden','true');
main.append(nativeControls);nativeControls.append(originalWeek,originalPlan);
const management=e('section','ar6-management');
management.innerHTML='<div class="ar6-management-title"><strong>CWL verwalten</strong><span>Planung zurücksetzen, nächste Kriegstage und Sicherungen</span></div>';
main.append(management);management.append(overview);
const dayFocus=e('section','ar4-panel ar6-day-focus');
dayFocus.innerHTML='<div class="ar6-focus-title"><div><div class="ar4-kicker">TAGESPLAN</div><h2 id="ar6FocusTitle">Tag 1 · Wechsel</h2><p id="ar6FocusDesc">Wer kommt rein, wer geht raus?</p></div><button type="button" class="ar6-focus-info" id="ar6FocusInfo" aria-label="Tagesauswahl erklären">'+ic('info')+'</button></div>';
detailWrap.parentNode.insertBefore(dayFocus,detailWrap);
dayFocus.append($('ar5Changes'),$('ar5Warnings'),$('ar5DayActions'));
const dayMode=e('div','ar6-day-modes');
dayMode.innerHTML='<button class="btn" type="button" id="ar4MobileOne">Einzeltag</button><button class="btn" type="button" id="ar4MobileAll">Alle 7 Tage</button>';
management.append(dayMode);
const weekBtns=[];
function days(){const st=currentState();return Math.min(7,Math.max(1,st?.config?.days||7))}
function chooseDay(i){selectedDay=Math.max(0,Math.min(days()-1,i));
 try{mobileSelectedDay=selectedDay;uiSettings.dayViewMode='single';saveUiSettings();renderMobileDays()}catch{}
 weekMode='single';updateModes();renderReference();}
function updateModes(){$('ar4One').classList.toggle('active',weekMode==='single');$('ar4All').classList.toggle('active',weekMode==='all');}
$('ar4One').onclick=()=>{weekMode='single';try{uiSettings.dayViewMode='single';saveUiSettings();renderMobileDays()}catch{}updateModes();renderReference()};
$('ar4All').onclick=()=>{weekMode='all';try{uiSettings.dayViewMode='all';saveUiSettings();renderMobileDays()}catch{}updateModes();renderReference()};
$('ar4MobileOne').onclick=()=>$('ar4One').click();$('ar4MobileAll').onclick=()=>{$('ar4All').click();dayFocus.scrollIntoView({block:'start',behavior:'smooth'})};
function slotHtml(m,i){const strength=m?.threeStar||'unknown';const skill={high:'Hoch',medium:'Solide',low:'Selten',verylow:'Kaum',unknown:'Unbekannt'}[strength]||'Unbekannt';const name=m?.name||'Unbekannt';return `<div class="ar4-player"><span class="ar4-player-num">${String(i+1).padStart(2,'0')}</span><span class="ar4-avatar">${esc(name.slice(0,1).toUpperCase())}</span><span class="ar4-player-name"><b>${esc(name)}</b><small>${m.fixed?'Fester Einsatz':'Rotationsspieler'}</small></span><span class="ar4-th">RH ${esc(m.townHall||'–')}</span><span class="ar4-skill">${skill}</span><span class="ar4-player-status ${m.fixed?'fixed':''}">${m.fixed?'Fix':'Dabei'}</span></div>`}
function playerOf(id,index){const st=currentState();try{const p=st.members.find(m=>m.id===id)||st.archivedMembers?.find(m=>m.id===id);return p||((typeof lineupPlayer==='function')?lineupPlayer(id,index):null)}catch{return null}}
function renderReference(){const st=currentState(),dps=currentPlan();if(!st)return;
 const dlen=days();selectedDay=Math.min(selectedDay,dlen-1);$('ar4Season').textContent=`${activeProfile()} / ${cleanMonth()}`;
 const participants=st.members?.filter(m=>m.participating&&m.name?.trim())||[];const played=st.locks?.filter(x=>x.locked).length||0;
 const kpis=metrics.querySelectorAll('.kpi');kpis.forEach(k=>k.classList.add('ar4-kpi'));
 $('ar4StatusText').textContent=played===dlen?'CWL abgeschlossen':played>0?`CWL läuft · ${played} / ${dlen} gespielt`:'CWL vorbereitet';
 const originalButtons=$('mobileDayTabs')?.querySelectorAll('button')||[];
 if(week.children.length!==dlen){week.replaceChildren();weekBtns.length=0;for(let i=0;i<dlen;i++){
  const button=e('button','ar4-daycard');button.type='button';button.setAttribute('aria-label',`Kriegstag ${i+1} wählen`);button.onclick=()=>chooseDay(i);button.innerHTML=`<span class="ar4-kicker">KRIEGSTAG</span><span class="ar4-day-number">${String(i+1).padStart(2,'0')}</span><span class="ar4-day-sub"></span><span class="ar4-day-divider"></span><span class="ar4-day-bottom"><span></span>${ic('arrow')}</span>`;week.append(button);weekBtns.push(button)}}
 weekBtns.forEach((b,i)=>{const dp=dps[i];const locked=!!st.locks?.[i]?.locked;const c=dp?.lineup?.length||0;
 b.classList.toggle('active',i===selectedDay);b.classList.toggle('complete',locked);b.setAttribute('aria-pressed',String(i===selectedDay));
 b.querySelector('.ar4-day-sub').textContent=locked?'Gespielt':i===played?'Nächster Krieg':'Geplant';b.querySelector('.ar4-day-bottom span').textContent=`${c} / ${st.config.slots} Spieler`;});
 const dp=dps[selectedDay]||{lineup:[],warnings:[]};const ids=dp.lineup||[];const names=ids.map(id=>playerOf(id,selectedDay)).filter(Boolean);
 $('ar6FocusTitle').textContent=weekMode==='all'?'Alle Kriegstage':`Tag ${selectedDay+1} · Wechsel`;
 $('ar6FocusDesc').textContent=weekMode==='all'?'Tage vergleichen und für die Bearbeitung auswählen.':selectedDay===0?'Startaufstellung und Tagesaktionen':'Ein- und Auswechslungen für diesen Kriegstag';
 $('ar4LineupTitle').textContent=`Line-up · Tag ${selectedDay+1}`;$('ar4LineupSub').textContent=`${ids.length} / ${st.config.slots} eingeplant · ${st.locks?.[selectedDay]?.locked?'gespielt':'automatisch berechnet'}`;

 // The actual Rein/Raus delta is the primary daily decision information.
 const changes=$('ar5Changes'),warnings=$('ar5Warnings'),actions=$('ar5DayActions');
 const renderNames=(identifiers,previous=false)=> (identifiers||[]).map(id=>playerOf(id,previous?Math.max(0,selectedDay-1):selectedDay)?.name).filter(Boolean);
 if(weekMode==='all') {
   changes.innerHTML='<p class="ar5-change-all">Wähle einen Kriegstag, um Ein- und Auswechslungen zu sehen.</p>';
   warnings.replaceChildren();actions.replaceChildren();
 } else {
   const incoming=renderNames(dp.rein),outgoing=renderNames(dp.raus,true);
   const chips=(list)=>list.length?list.map(name=>`<span class="ar5-change-chip">${esc(name)}</span>`).join(''):'<span class="ar5-change-none">Keine</span>';
   changes.innerHTML=selectedDay===0
     ?'<div class="ar5-start-lineup"><strong>Startaufstellung</strong><span>Am ersten Kriegstag gibt es noch keine Ein- oder Auswechslungen.</span></div>'
     :`<div class="ar5-change-side in"><div class="ar5-change-head"><b>Rein</b><span>${incoming.length} Spieler</span></div><div class="ar5-change-list">${chips(incoming)}</div></div><div class="ar5-change-side out"><div class="ar5-change-head"><b>Raus</b><span>${outgoing.length} Spieler</span></div><div class="ar5-change-list">${chips(outgoing)}</div></div>`;
   const issues=dp.warnings||[]; warnings.replaceChildren();
   for(const warn of issues){const p=e('p','ar5-warning');p.textContent='Hinweis: '+warn;warnings.append(p)}
   actions.replaceChildren();
   const next=typeof playedPrefixLength==='function'?playedPrefixLength():0;
   const last=typeof lastUnlockableDay==='function'?lastUnlockableDay():-1;
   const daily=(caption,fn,primary=false)=>{const button=e('button','btn'+(primary?' primary':''),caption);button.type='button';button.onclick=fn;actions.append(button)};
   if(dp.locked){
      daily('Gespielte Aufstellung bearbeiten',()=>openLineupModal(selectedDay));
      if(selectedDay===last)daily('Tag entsperren',()=>unlockDay(selectedDay));
   } else if(selectedDay===next)daily('Tag als gespielt speichern',()=>openLineupModal(selectedDay),true);
   else {const wait=e('div','ar6-pending-hint',`Erst Tag ${next+1} abschließen, bevor dieser Krieg gespeichert werden kann.`);actions.append(wait)}
   if(selectedDay>0)daily('Wechseltext kopieren',()=>copyChanges(selectedDay));
 }
 $('ar5LineupSummary').textContent=weekMode==='all'?( $('ar5LineupDisclosure').open?'Alle Tagesaufstellungen einklappen':'Alle Tagesaufstellungen einblenden'):( $('ar5LineupDisclosure').open?'Spielerliste einklappen':`Spielerliste anzeigen · ${ids.length} Spieler`);
 $('ar4InsightNoteTitle').textContent=`Der Fokus für Tag ${selectedDay+1}`;
 $('ar4InsightTitle').textContent=ids.length===st.config.slots&&!(dp.warnings||[]).length?'Dein Team ist bereit.':participants.length?'Aufstellung prüfen.':'Deinen Kader vorbereiten.';
 $('ar4InsightText').textContent=participants.length?'Deine Aufstellung mit Fixspielern, Tagesregeln und sinnvoller Rotation im Blick.':'Füge zuerst Spieler hinzu oder importiere deinen Clan-Kader.';
 const fixed=names.filter(m=>m.fixed).length;const nonfixed=names.length-fixed;const avg=names.length?Math.round(names.reduce((sum,m)=>sum+(Number(m.townHall)||0),0)/names.length):0;
 $('ar4InsightMetrics').innerHTML=`<div><b>${fixed}</b><span>Fixspieler</span></div><div><b>${nonfixed}</b><span>Rotation</span></div><div><b>${avg||'–'}</b><span>Ø Rathaus</span></div><div><b>${names.filter(m=>m.threeStar==='high').length}</b><span>3★-Stärke hoch</span></div>`;
 $('ar4InsightNoteText').textContent=(dp.warnings||[]).length?(dp.warnings[0]||'Aufstellung prüfen'):'Verteilung, Verfügbarkeit und individuelle Regeln überprüfen.';
 const rows=$('ar4LineupRows');rows.replaceChildren();if(!names.length){rows.innerHTML='<div class="ar4-empty"><strong>Deine Aufstellung ist noch leer.</strong><span>Füge Mitglieder hinzu, damit der CWL-Plan berechnet werden kann.</span><button type="button" class="btn" id="ar4EmptyAdd">Mitglieder verwalten</button></div>';$('ar4EmptyAdd').onclick=()=>route('members');}
 else {names.forEach((m,i)=>{const row=e('div','',slotHtml(m,i));rows.append(row.firstChild)})}
 $('ar4AllPlayers').textContent='CWL-Verwaltung anzeigen';
 if(weekMode==='all'){$('ar4LineupTitle').textContent=`Woche · ${dlen} Kriegstage`;$('ar4LineupSub').textContent='Alle Tagesaufstellungen im Überblick';rows.replaceChildren();for(let i=0;i<dlen;i++){const d=dps[i]||{lineup:[]};const block=e('div','ar4-day-summary');block.innerHTML=`<button type="button" class="ar4-summary-head">Tag ${i+1} <span>${d.lineup?.length||0}/${st.config.slots} Spieler ${ic('arrow')}</span></button><div class="ar4-summary-names">${(d.lineup||[]).map(id=>esc(playerOf(id,i)?.name||'')).filter(Boolean).join(' · ')||'Noch keine Spieler geplant'}</div>`;block.querySelector('button').onclick=()=>chooseDay(i);rows.append(block)}}
 updateModes();
}
const openEditor=()=>{try{const idx=selectedDay;const locked=!!currentState()?.locks?.[idx]?.locked;
 if(typeof openLineupModal==='function')openLineupModal(idx);
 else {const edit=$('day-card-'+idx)?.querySelector('.edit-day,.lock-day');if(edit)edit.click()}
 }catch(err){console.error(err)}};
$('ar4Edit').onclick=openEditor;$('ar4DetailEdit').onclick=openEditor;
$('ar4Copy').onclick=()=>$('copyFullPlanBtn')?.click();
$('ar5LineupDisclosure').addEventListener('toggle',()=>{const label=$('ar5LineupSummary');if(label)label.textContent=$('ar5LineupDisclosure').open?'Spielerliste einklappen':`Spielerliste anzeigen · ${currentPlan()[selectedDay]?.lineup?.length||0} Spieler`});
$('ar4AllPlayers').onclick=()=>{management.scrollIntoView({block:'nearest',behavior:'smooth'})};
$('ar4Why').onclick=()=>{if(typeof openWhyModal==='function')openWhyModal(selectedDay);else $('day-card-'+selectedDay)?.querySelector('.why-day-btn')?.click()};$('ar6FocusInfo').onclick=$('ar4Why').onclick;
// ===== MEMBERS: exact reference list geometry, real controls retained in expanded editor =====
const add=e('button','btn primary ar4-add',`${ic('plus')} Spieler hinzufügen`);add.type='button';add.onclick=()=>$('addMemberBtn')?.click();
titleHead(members,'KADER VERWALTEN','Mitglieder','Teilnahme, Fixstatus und Spielerstärke zentral pflegen.',add);
const memberCard=$('memberList')?.closest('.card');memberCard?.classList.add('ar4-roster-card');
const rosterHead=e('div','ar4-roster-heading',`<div><h3>Clan-Kader <span id="ar4MemberCount"></span></h3><p>Spieler antippen, um seine Einstellungen zu bearbeiten.</p></div><div class="ar5-roster-quick"><button class="btn small" id="ar5RosterImport" type="button">${ic('plus')} CSV-Import</button><button class="btn small" id="ar5RosterBulk" type="button">Mehrfachauswahl</button><button class="ar5-roster-help" id="ar4Filters" type="button" title="Dabei, Fix und Priorität erklären" aria-label="Hilfe zur Mitgliederverwaltung">${ic('info')}</button></div>`);
memberCard?.prepend(rosterHead);
// One compact toolbar for everyday work. Legacy controls remain in DOM as bridges.
const bridge=e('div','ar6-member-bridge');bridge.hidden=true;memberCard.append(bridge);
const nativeBar=memberCard?.querySelector('.member-actionbar');if(nativeBar)bridge.append(nativeBar);
const nativeGuest=memberCard?.querySelector('#guestMembersTools');if(nativeGuest)bridge.append(nativeGuest);
const nativeCloud=memberCard?.querySelector('#cloudMembersTools');
if(nativeCloud){
 const syncWrap=e('details','ar6-cloud-operations');
 syncWrap.innerHTML='<summary>Clash-Clan abgleichen</summary><p>Mitglieder aus Clash übernehmen und Änderungen prüfen, ohne die Planung zu überschreiben.</p>';
 memberCard.insertBefore(syncWrap,memberCard.querySelector('.member-filters'));
 syncWrap.append(nativeCloud);
}
const helpDetail=memberCard?.querySelector('.member-help-details');
if(helpDetail){rosterHead.insertAdjacentElement('afterend',helpDetail);helpDetail.classList.add('ar6-help-details');}
const ordering=memberCard?.querySelector('.list-management');
if(ordering){memberCard.insertBefore(ordering,memberCard.querySelector('.member-filters'));ordering.classList.add('ar5-ordering')}
const filter=memberCard?.querySelector('.member-filters');if(filter){
 const label=e('label','ar6-status-label','Status');
 label.htmlFor='memberFilter';
 const select=$('memberFilter');if(select){select.parentNode.insertBefore(label,select);select.title='Nur Spieler dieses Teilnahme- oder Fixstatus anzeigen';}
}
const extras=e('details','ar6-import-extras');
extras.innerHTML='<summary>Weitere Möglichkeiten zum Hinzufügen</summary><div class="ar6-import-actions"><button class="btn small" type="button" id="ar6AddMany">Mehrere Namen eingeben</button><button class="btn small" type="button" id="ar6Template">CSV-Vorlage herunterladen</button></div>';
rosterHead.insertAdjacentElement('afterend',extras);
$('ar6AddMany').onclick=()=>$('multiAddBtn')?.click();
$('ar6Template').onclick=()=>$('membersTemplateBtn')?.click();
$('ar4Filters').onclick=()=>{if(helpDetail){helpDetail.open=!helpDetail.open;if(helpDetail.open)helpDetail.scrollIntoView({behavior:'smooth',block:'nearest'})}else $('membersHelpBtn')?.click()};
$('ar5RosterImport').onclick=()=>{const btn=$('membersImportBtn')||$('guestImportMembersBtn');if(btn)btn.click();else $('membersFile')?.click()};
function syncBulkVisual(){const selected=$('selectMembersBtn')?.getAttribute('aria-pressed')==='true';const button=$('ar5RosterBulk');button?.classList.toggle('active',selected);if(button){button.textContent=selected?'Auswahl beenden':'Mehrfachauswahl';button.setAttribute('aria-pressed',String(selected))}}
$('ar5RosterBulk').onclick=()=>{$('selectMembersBtn')?.click();syncBulkVisual()};
$('bulkDoneBtn')?.addEventListener('click',()=>requestAnimationFrame(syncBulkVisual));
function decorateMembers(){const root=$('memberList');if(!root)return;
 root.querySelectorAll('.member').forEach((card,i)=>{
  const input=card.querySelector('.member-name');if(!input)return;
  const name=input.value||'?';const m=currentState()?.members?.find(x=>x.id===card.dataset.id);
  let face=card.querySelector('.ar4-member-facing');if(!face){face=e('button','ar4-member-facing');face.type='button';card.prepend(face);}
  const fixed=!!m?.fixed;const participating=!!m?.participating;
  face.innerHTML=`<span class="ar4-member-pos">${String(i+1).padStart(2,'0')}</span><span class="ar4-avatar">${esc(name.slice(0,1).toUpperCase())}</span><span class="ar4-member-ident"><b>${esc(name)}</b><small>${fixed?'Fester Einsatz':'Rotationsspieler'}</small></span><span class="ar4-member-th">RH ${esc(m?.townHall||'–')}</span><span class="ar4-member-badge ${fixed?'fixed':''}">${fixed?'Fix':participating?'Dabei':'Pause'}</span>`;
  face.setAttribute('aria-label',`${name} – Bearbeitungsoptionen ${card.classList.contains('member-expanded')?'schließen':'öffnen'}`);
  face.setAttribute('aria-expanded',String(card.classList.contains('member-expanded')));
  face.onclick=()=>{const btn=card.querySelector('.member-edit-toggle');if(btn)btn.click();else{card.classList.toggle('ar4-open');card.querySelector('.member-details')?.classList.toggle('hidden')}};
 });
 const st=currentState();const count=$('ar4MemberCount');if(count)count.textContent=`· ${st?.members?.length||0} Mitglieder`;
}

// ===== ANALYSIS: original concept summary using real lineups, no hardcoded values =====
titleHead(summary,'SAISON · '+cleanMonth(),'Einsatzanalyse','Spielerverteilung und Rotation nachvollziehen.');
const chartGrid=e('div','ar4-analytics-grid');
const barPanel=e('section','ar4-panel ar4-analysis-bars',`<h3>Einsätze im Überblick</h3><p>Verteilung der geplanten Kriegstage</p><div id="ar4Bars"></div>`);
const fairPanel=e('section','ar4-panel ar4-analysis-fair',`<h3>Rotation und Fairness</h3><div class="ar4-fair-number" id="ar4Rotation">–</div><p>Einsätze je Rotationsspieler, je nach Fixstatus.</p><span class="ar4-pill-good" id="ar4FairLabel">${ic('check')} Noch keine Planung</span>`);
chartGrid.append(barPanel,fairPanel);summary.insertBefore(chartGrid,summary.firstElementChild.nextSibling);
const statsLink=e('button','btn ar4-stats-link',`Clan-Statistik ${ic('arrow')}`);statsLink.type='button';statsLink.onclick=()=>route('stats');summary.insertBefore(statsLink,chartGrid.nextSibling);
const originalSummaryCards=[...summary.querySelectorAll(':scope > .card')];
const analysisExtra=e('details','ar4-analysis-extra');analysisExtra.innerHTML='<summary>Detailauswertung & Filter öffnen</summary>';summary.append(analysisExtra);
for(const card of originalSummaryCards){if(card.id==='currentWarCard')summary.insertBefore(card,chartGrid);else analysisExtra.append(card)}
function renderCharts(){const st=currentState(),plan=currentPlan();if(!st)return;const p=(st.members||[]).filter(m=>m.participating&&m.name?.trim());const list=p.map(m=>({name:m.name,id:m.id,count:plan.filter(d=>d.lineup?.includes(m.id)).length})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'de')).slice(0,10);
 const bars=$('ar4Bars');if(bars){bars.replaceChildren();for(const a of list){const line=e('div','ar4-bar');const label=e('span','ar4-bar-label');label.textContent=a.name;label.title=a.name;const track=e('div','ar4-bar-track');const fill=e('span','ar4-bar-fill');fill.style.width=(100*a.count/Math.max(1,st.config.days))+'%';track.append(fill);const n=e('strong','');n.textContent=a.count;line.append(label,track,n);bars.append(line)}if(!list.length)bars.innerHTML='<p class="ar4-muted">Noch keine Spieler für eine Einsatzanalyse vorhanden.</p>'}
 const nonfixed=p.filter(m=>!m.fixed),counts=nonfixed.map(m=>plan.filter(d=>d.lineup?.includes(m.id)).length),min=counts.length?Math.min(...counts):null,max=counts.length?Math.max(...counts):null;
 $('ar4Rotation').textContent=counts.length?`${min}–${max}`:'–';$('ar4FairLabel').innerHTML=`${ic('check')} ${counts.length?(max-min<=1?'Ausgeglichen':'Rotation prüfen'):'Noch keine Planung'}`;
}
if(stats)titleHead(stats,'CLAN-DATEN','Clan-Statistik','Angriffe, Hit-Rate und vergangene Kriege auswerten.');
// ===== SETTINGS: original two-group menu. Actual settings controls in linked subpages =====
settings.removeAttribute('role');settings.removeAttribute('aria-modal');settings.removeAttribute('aria-label');
const setHead=titleHead(settings,'VERWALTUNG','Clan & Einstellungen','Alles, was du seltener brauchst – an einem verlässlichen Ort.');
const win=settings.querySelector('.settings-window');if(!win)throw Error('Cloud settings shell missing');
const origHead=win.querySelector('.settings-dialog-head');if(origHead)origHead.classList.add('ar4-hidden-old-head');
const home=e('div','ar4-settings-home');const subRoot=e('div','ar4-settings-pages');win.prepend(home);win.append(subRoot);
const pages={};const subNames={profiles:['Clanprofile','Clans wechseln und Profile verwalten.'],archive:['CWL-Archiv','Vergangene Ligen einsehen.'],planning:['CWL-Grunddaten','Kriegsgröße, Kriegstage und Clanabgleich.'],backup:['Backup & Wiederherstellung','Daten sichern und wiederherstellen.'],display:['Darstellung & Hilfe','Hell- oder Dunkelmodus und App-Informationen.'],account:['Clan & Konto','Cloud-Zugang und Zusammenarbeit.'],advanced:['Weitere Optionen','Erweiterte Einstellungen und Unterstützung.']};
for(const [id,[name,desc]]of Object.entries(subNames)){const node=e('section','ar4-settings-page');node.dataset.page=id;node.innerHTML=`<div class="ar6-subnav"><button class="ar4-back" type="button">${ic('back')} Zurück</button><span>Clan & Einstellungen</span></div><h3>${name}</h3><p>${desc}</p>`;node.querySelector('button').onclick=()=>openPage(null);subRoot.append(node);pages[id]=node;}
function group(label,description,items){const p=e('section','ar4-setting-group',`<h3>${label}</h3><p>${description}</p>`);for(const [name,help,key] of items){const b=e('button','ar4-setting-item',`<span><strong>${name}</strong><small>${help}</small></span><span class="ar4-setting-arrow">${ic('chevron')}</span>`);b.type='button';b.onclick=()=>openPage(key);p.append(b)}return p}
home.append(group('Clanprofile','Aktives Profil: <span id="ar4ActiveClan">–</span>',[
 ['Profile wechseln','Verschiedene Clans getrennt verwalten','profiles'],
 ['Profil anlegen oder duplizieren','Eigene Mitglieder und Regeln','profiles'],
 ['CWL-Archiv','Vergangene Ligen einsehen','archive']
]));
home.append(group('Planung & Daten','Deine Einstellungen und Sicherungen',[
 ['CWL-Grunddaten','15 / 30 Spieler, individuell, Kriegstage','planning'],
 ['Backup & Wiederherstellung','JSON exportieren und importieren','backup'],
 ['Darstellung & Hilfe','Hell / Dunkel, App aktualisieren','display']
]));
const util=e('div','ar4-settings-links',`<button type="button" id="ar4OpenAccount">${ic('cloud')} Clan & Konto ${ic('chevron')}</button><button type="button" id="ar4Advanced">${ic('info')} Weitere Optionen ${ic('chevron')}</button>`);home.append(util);
$('ar4OpenAccount').onclick=()=>openPage('account');$('ar4Advanced').onclick=()=>openPage('advanced');
// move original real controls, retaining their original IDs, inputs and event handlers
const local=$('localProfileCard');if(local)pages.profiles.append(local);
if(pbar){const wrap=e('div','ar4-panel ar4-profile-picker','<h3>Aktives Profil</h3>');wrap.append(pbar);pages.profiles.insertBefore(wrap,local||null)}
const cloudAcc=$('settingsCloudAccount')?.closest('.card');if(cloudAcc)pages.account.append(cloudAcc);
const archive=$('archiveList')?.closest('.card');if(archive)pages.archive.append(archive);
const source=[...win.querySelectorAll(':scope > .card')].find(c=>c.querySelector('.settings-subcard'));
if(source){for(const sub of [...source.querySelectorAll(':scope > .settings-subcard')]){const h=sub.querySelector('h4')?.textContent?.toLocaleLowerCase('de')||'';const dest=h.includes('grunddaten')||h.includes('clash')?'planning':h.includes('backup')?'backup':h.includes('darstellung')?'display':'advanced';pages[dest].append(sub)}
 const danger=source.querySelector(':scope > .actions');if(danger)pages.advanced.append(danger);
 const file=source.querySelector('#membersFile');if(file)pages.backup.append(file);
 const footer=source.querySelector('.footer-note');if(footer)pages.backup.append(footer);
 source.remove();}
const help=e('div','ar4-panel ar4-help',`<h3>Hilfe & Anleitungen</h3><p>Weitere Erklärungen zu Tagesregeln, Aufstellungen und Datensicherung.</p><button type="button" class="btn" id="ar4HelpBtn">Hilfe öffnen</button>`);pages.display.append(help);$('ar4HelpBtn').onclick=()=>$('helpBtn')?.click();
// Access to staging is deliberately low priority — never dominant on the settings home page.
const stageBox=e('div','ar4-panel ar4-staging',`<h3>Getrennte Cloud-Testumgebung</h3><p id="ar4StageStatus">${stageReady()?'Staging-Verbindung aktiv.':'Noch keine Testdatenbank eingerichtet. Anmeldung und gemeinsames Speichern sind deshalb deaktiviert.'}</p><details><summary>Testdatenbank verbinden</summary><form id="ar4StageForm"><label>Staging-URL<input type="url" name="url" required placeholder="https://...supabase.co"></label><label>Publishable Key<input type="text" name="key" required autocomplete="off" placeholder="sb_publishable_..."></label><button class="btn primary" type="submit">Verbinden</button><p>Nur eine separate Supabase-Datenbank. Keine Secret-/Service-Role-Keys!</p></form></details>`);pages.account.prepend(stageBox);
$('ar4StageForm').onsubmit=ev=>{ev.preventDefault();const form=new FormData(ev.currentTarget),url=String(form.get('url')||'').trim().replace(/\/$/,''),key=String(form.get('key')||'').trim();let u;try{u=new URL(url)}catch{alert('Ungültige URL');return}if(u.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.co$/.test(u.hostname)||u.hostname==='yjldnvfwposfwmzmcsow.supabase.co'||!(/^(sb_publishable_|eyJ)/.test(key))||key.startsWith('sb_secret_')||key.includes('service_role')){alert('Nur separate Staging-Instanz mit öffentlichem Schlüssel');return}try{sessionStorage.setItem('arena_staging_auth_v1',JSON.stringify({url,key}));location.reload()}catch{alert('Session-Speicher nicht verfügbar')}};
function stageReady(){return !!window.__arenaStagingConfigured}
function openPage(name){activeSubpage=name||null;
 home.hidden=!!activeSubpage;setHead.hidden=!!activeSubpage;
 home.style.display=activeSubpage?'none':'grid';setHead.style.display=activeSubpage?'none':'';
 subRoot.hidden=!activeSubpage;subRoot.style.display=activeSubpage?'block':'none';
 Object.entries(pages).forEach(([k,node])=>{const shown=activeSubpage===k;node.classList.toggle('active',shown);node.hidden=!shown;node.setAttribute('aria-hidden',String(!shown))});
 if(activeSubpage){const selected=pages[activeSubpage];if(selected){selected.style.animation='none';void selected.offsetWidth;selected.style.animation='ar5-slide-forward .23s cubic-bezier(.2,.7,.3,1) both'}}
 else{home.style.animation='none';void home.offsetWidth;home.style.animation='ar5-slide-back .2s ease-out both'}
 if(currentView==='settings')window.scrollTo({top:0,behavior:'instant'})
}
function updateGlobal(){renderReference();renderCharts();decorateMembers();syncBulkVisual();
 const cloudOperations=document.querySelector('.ar6-cloud-operations');if(cloudOperations)cloudOperations.hidden=!window.CWLCloud?.active;
 const label=$('ar4ActiveClan');if(label)label.textContent=activeProfile()}
// Core render functions do the data/handler binding first; visual components update afterwards.
// Avoid recursion from cloud plugins: schedule one presentation update per paint frame.
let pending=false;function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;updateGlobal()})}
const baseRenderAll=typeof renderAll==='function'?renderAll:null;if(baseRenderAll)renderAll=function(...args){const value=baseRenderAll(...args);schedule();return value};
const baseRenderMembers=typeof renderMembers==='function'?renderMembers:null;if(baseRenderMembers)renderMembers=function(...args){const value=baseRenderMembers(...args);requestAnimationFrame(decorateMembers);return value};
const baseRenderMobile=typeof renderMobileDays==='function'?renderMobileDays:null;if(baseRenderMobile)renderMobileDays=function(...args){const value=baseRenderMobile(...args);schedule();return value};
// Avoid forcing a second calculation: the original initial render already completed.
function route(which){if(!['plan','members','summary','stats','settings'].includes(which))which='plan';currentView=which;
 document.querySelectorAll('.view').forEach(node=>node.classList.toggle('active',node.id==='view-'+which));
 navInner?.querySelectorAll('.navbtn').forEach(b=>{const yes=b.dataset.view===which||(which==='stats'&&b.dataset.view==='summary');b.classList.toggle('active',yes);b.setAttribute('aria-current',yes?'page':'false')});
 if(which==='settings')openPage(null);window.scrollTo({top:0,behavior:'instant'});schedule()}
window.showPlannerView=route;
if($('settingsOpen'))$('settingsOpen').onclick=()=>route('settings');if($('settingsClose'))$('settingsClose').onclick=()=>route('plan');
// Old cloud settings was a modal. Don't let old backdrop or ESC handler dismiss this full-page screen.
settings.addEventListener('click',ev=>{if(ev.target===settings)ev.stopImmediatePropagation()},true);
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&settings.classList.contains('active')){ev.stopImmediatePropagation();ev.preventDefault();if(activeSubpage)openPage(null);else route('plan')}},true);
if(!stageReady()){$('cloudOpen').onclick=()=>{route('settings');openPage('account')};$('settingsCloudManage').onclick=()=>{route('settings');openPage('account')}}
// No stale old day cards displayed by default, but actions remain available in disclosure.
try{if(uiSettings.dayViewMode!=='single'){uiSettings.dayViewMode='single';saveUiSettings();renderMobileDays()}if(typeof mobileLineupsExpanded!=='undefined')mobileLineupsExpanded=true}catch{}
route('plan');schedule();
})();