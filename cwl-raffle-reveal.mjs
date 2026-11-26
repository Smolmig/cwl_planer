// Presentation only: the winner must already be returned by a successful
// server draw. No random numbers, no client-side winner selection.
const el=(tag,text="",cls="")=>{const x=document.createElement(tag);x.textContent=text;if(cls)x.className=cls;return x};
export function drawRandomnessInfo(weighted=false,test=false){
 const details=el("details","","draw-randomness-info"),summary=el("summary","i");
 summary.setAttribute("aria-label","Wie wird zufällig gezogen?");
 summary.title="Wie wird zufällig gezogen?";
 const text=weighted?"Jedes gültige Los hat dieselbe Chance. Wer mehr Lose hat, hat entsprechend mehr Gewinnchancen.":"Jeder qualifizierte Teilnehmer hat genau ein Los und dieselbe Gewinnchance.";
 details.append(summary,el("p",text+(test?" Die Testziehung nutzt kryptografische Zufallswerte des Browsers mit unverzerrter Loswahl. Sie wird nicht gespeichert und hat keinen Einfluss auf die offizielle Ziehung.":" Der Server verwendet kryptografische Zufallsbytes und verwirft Werte, die eine ungleiche Verteilung verursachen würden. Die Ziehung speichert Gewinner und Teilnehmerstand einmalig; Wiederholen oder Neuladen erzeugt keinen neuen Gewinner. Die Animation zeigt nur das bereits gespeicherte Ergebnis. Der Nachweis dokumentiert die Ziehung, ist aber keine unabhängige externe Zufallsprüfung."),"statusline"));
 return details;
}
export function raffleWheel(rows,ticket){
 const pool=(rows||[]).filter(r=>Number.isSafeInteger(r.tickets)&&r.tickets>0);
 const total=pool.reduce((s,r)=>s+r.tickets,0);
 if(!total)return null;
 const colors=["#bc974b","#587e91","#9970a8","#468b78","#ba6e5d","#7785b6","#8b934c","#a36f8a"];
 let pos=0;
 const segments=pool.map((r,i)=>{
  const from=pos/total*360;pos+=r.tickets;
  return {tag:r.tag,name:r.name,tickets:r.tickets,from,to:pos/total*360,color:colors[i%colors.length]};
 });
 return {segments,total,rotation:Number.isInteger(ticket)&&ticket>=0&&ticket<total?1440+360-(ticket+.5)/total*360:0};
}
export function renderDrawReveal({winnerName,winnerTag,animate=false,weighted=false,subtitle="",delay=1800,onReveal=()=>{},rows=[],ticket=null,test=false}){
 const wrap=el("section","","draw-reveal");
 const style=el("style",`
 .draw-reveal{position:relative;overflow:hidden;text-align:center;border:1px solid var(--primary,#c59b50);border-radius:16px;padding:20px;margin:12px 0 18px;isolation:isolate}
 .draw-reveal .draw-randomness-info{position:absolute;top:10px;right:10px;z-index:2;text-align:left;max-width:min(290px,calc(100% - 20px))}
 .draw-randomness-info summary{display:grid;place-items:center;list-style:none;border:1px solid var(--line,#888);border-radius:50%;width:26px;height:26px;font-weight:700;cursor:pointer;margin-left:auto}
 .draw-randomness-info summary::-webkit-details-marker{display:none}
 .draw-randomness-info[open] p{padding:10px;background:var(--card,#242424);border:1px solid var(--line,#888);border-radius:8px;line-height:1.5}
 .draw-reveal .draw-ticket{width:74px;height:48px;display:grid;place-items:center;margin:14px auto;border:2px solid #c59b50;border-radius:10px;font-size:26px;color:#c59b50}
 .draw-reveal .draw-spin{animation:draw-ticket-spin .48s ease-in-out infinite alternate}
 .draw-reveal .draw-winner{animation:draw-winner-in .45s cubic-bezier(.16,1,.3,1) both}
 .draw-reveal .draw-winner h3{margin:8px 0;font-size:clamp(22px,5vw,36px);color:var(--primary,#c59b50);overflow-wrap:anywhere}
 .draw-reveal .wheel-shell{position:relative;width:min(220px,74vw);aspect-ratio:1;margin:20px auto 10px}
 .draw-reveal .wheel-disc{width:100%;height:100%;border-radius:50%;border:2px solid var(--line,#888);box-sizing:border-box;transform:rotate(var(--wheel-angle,0deg))}
 .draw-reveal .wheel-disc.spinning{animation:raffle-wheel-spin 1.8s cubic-bezier(.12,.62,.15,1) both}
 .draw-reveal .wheel-pointer{position:absolute;top:-7px;left:50%;transform:translateX(-50%);z-index:1;border-left:9px solid transparent;border-right:9px solid transparent;border-top:17px solid #fff;filter:drop-shadow(0 1px 2px #111)}
 .draw-reveal .wheel-legend{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:5px 12px;text-align:left;max-height:180px;overflow:auto;margin:8px 0}
 .draw-reveal .wheel-legend-item{display:flex;align-items:center;gap:6px;min-width:0;font-size:12px}
 .draw-reveal .wheel-legend-name{flex:1;overflow-wrap:anywhere}
 .draw-reveal .wheel-swatch{width:10px;height:10px;border-radius:2px;flex-shrink:0}
 @keyframes raffle-wheel-spin{from{transform:rotate(0deg)}to{transform:rotate(var(--wheel-angle))}}
 .draw-reveal [hidden]{display:none!important}
 .draw-reveal .draw-sparks{position:absolute;inset:0;pointer-events:none;z-index:-1;background:radial-gradient(ellipse at 50% 20%,rgba(197,155,80,.22),transparent 65%)}
 @keyframes draw-ticket-spin{from{transform:rotate(-12deg) translateY(-4px)}to{transform:rotate(12deg) translateY(4px)}}
 @keyframes draw-winner-in{from{opacity:0;transform:scale(.88) translateY(8px)}to{opacity:1;transform:none}}
 @media(prefers-reduced-motion:reduce){.draw-reveal *{animation:none!important}}
 `);
 const pending=el("div"),ticketIcon=el("div","✦","draw-ticket draw-spin"),status=el("p","Das Ergebnis wird enthüllt …","statusline");
 status.setAttribute("role","status");ticketIcon.setAttribute("aria-hidden","true");
 const skip=el("button","Ergebnis anzeigen","btn small");skip.type="button";pending.append(ticketIcon,status,skip);
 const result=el("div","","draw-winner");result.setAttribute("role","status");
 const top=el("p",test?"TESTZIEHUNG – UNVERBINDLICH":"OFFIZIELLES ERGEBNIS","more-eyebrow");
 const heading=el("h3",String(winnerName||winnerTag||""));
 result.append(top,el("div","♛","draw-ticket"),heading,el("p",String(winnerTag||""),"statusline"));
 if(subtitle)result.append(el("p",subtitle,"statusline"));
 wrap.append(style,el("div","","draw-sparks"));
 const wheel=raffleWheel(rows,ticket);
 if(wheel){
  const shell=el("div","","wheel-shell"),disc=el("div","","wheel-disc"),pointer=el("div","","wheel-pointer");
  shell.setAttribute("aria-hidden","true");disc.style.background="conic-gradient("+wheel.segments.map(s=>s.color+" "+s.from+"deg "+s.to+"deg").join(",")+")";
  disc.style.setProperty("--wheel-angle",wheel.rotation+"deg");
  if(animate&&!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)disc.classList.add("spinning");
  shell.append(disc,pointer);wrap.append(shell);
  const legend=el("details"),legendRows=el("div","","wheel-legend");
  for(const s of wheel.segments){const item=el("div","","wheel-legend-item"),swatch=el("span","","wheel-swatch");swatch.style.backgroundColor=s.color;swatch.setAttribute("aria-hidden","true");
   item.append(swatch,el("span",String(s.name||s.tag),"wheel-legend-name"),el("span",new Intl.NumberFormat("de-AT",{style:"percent",maximumFractionDigits:2}).format(s.tickets/wheel.total)));legendRows.append(item)}
  legend.append(el("summary","Anteile am Glücksrad"),legendRows);wrap.append(legend);
 }
 wrap.append(pending,result,drawRandomnessInfo(weighted,test));
 result.dataset.raffleWinner="true";pending.dataset.raffleAnimation="true";
 const motion=animate&&!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
 let timer=null;
 const reveal=()=>{if(timer!==null){clearTimeout(timer);timer=null}wrap.querySelector(".wheel-disc")?.classList.remove("spinning");pending.hidden=true;result.hidden=false;onReveal();};
 skip.onclick=reveal;
 if(motion){result.hidden=true;timer=setTimeout(()=>{if(wrap.isConnected)reveal()},Math.max(0,Math.min(2500,delay)))}
 else{result.classList.remove("draw-winner");reveal()}
 return wrap;
}
