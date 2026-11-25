// Presentation only: the winner must already be returned by a successful
// server draw. No random numbers, no client-side winner selection.
const el=(tag,text="",cls="")=>{const x=document.createElement(tag);x.textContent=text;if(cls)x.className=cls;return x};
export function drawRandomnessInfo(weighted=false){
 const details=el("details","","draw-randomness-info"),summary=el("summary","i");
 summary.setAttribute("aria-label","Wie wird zufällig gezogen?");
 summary.title="Wie wird zufällig gezogen?";
 const text=weighted?"Jedes gültige Los hat dieselbe Chance. Wer mehr Lose hat, hat entsprechend mehr Gewinnchancen.":"Jeder qualifizierte Teilnehmer hat genau ein Los und dieselbe Gewinnchance.";
 details.append(summary,el("p",text+" Der Server verwendet kryptografische Zufallsbytes und verwirft Werte, die eine ungleiche Verteilung verursachen würden. Die Ziehung speichert Gewinner und Teilnehmerstand einmalig; Wiederholen oder Neuladen erzeugt keinen neuen Gewinner. Die Animation zeigt nur das bereits gespeicherte Ergebnis. Der Nachweis dokumentiert die Ziehung, ist aber keine unabhängige externe Zufallsprüfung.","statusline"));
 return details;
}
export function renderDrawReveal({winnerName,winnerTag,animate=false,weighted=false,subtitle="",delay=1800}){
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
 .draw-reveal [hidden]{display:none!important}
 .draw-reveal .draw-sparks{position:absolute;inset:0;pointer-events:none;z-index:-1;background:radial-gradient(ellipse at 50% 20%,rgba(197,155,80,.22),transparent 65%)}
 @keyframes draw-ticket-spin{from{transform:rotate(-12deg) translateY(-4px)}to{transform:rotate(12deg) translateY(4px)}}
 @keyframes draw-winner-in{from{opacity:0;transform:scale(.88) translateY(8px)}to{opacity:1;transform:none}}
 @media(prefers-reduced-motion:reduce){.draw-reveal *{animation:none!important}}
 `);
 const pending=el("div"),ticket=el("div","✦","draw-ticket draw-spin"),status=el("p","Das Ergebnis wird enthüllt …","statusline");
 status.setAttribute("role","status");ticket.setAttribute("aria-hidden","true");
 const skip=el("button","Ergebnis anzeigen","btn small");skip.type="button";pending.append(ticket,status,skip);
 const result=el("div","","draw-winner");result.setAttribute("role","status");
 const top=el("p","OFFIZIELLES ERGEBNIS","more-eyebrow");
 const heading=el("h3",String(winnerName||winnerTag||""));
 result.append(top,el("div","♛","draw-ticket"),heading,el("p",String(winnerTag||""),"statusline"));
 if(subtitle)result.append(el("p",subtitle,"statusline"));
 wrap.append(style,el("div","","draw-sparks"),pending,result,drawRandomnessInfo(weighted));
 const motion=animate&&!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
 let timer=null;
 const reveal=()=>{if(timer!==null){clearTimeout(timer);timer=null}pending.hidden=true;result.hidden=false;};
 skip.onclick=reveal;
 if(motion){result.hidden=true;timer=setTimeout(()=>{if(wrap.isConnected)reveal()},Math.max(0,Math.min(2500,delay)))}
 else{result.classList.remove("draw-winner");reveal()}
 return wrap;
}
