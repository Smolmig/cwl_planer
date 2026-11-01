// The ARENA cloud preview never initializes against production.
const url=window.__arenaStageUrl, key=window.__arenaStageKey;
const production="https://yjldnvfwposfwmzmcsow.supabase.co";
if(window.__arenaStagingConfigured&&url&&key&&url!==production){
  try{await import("./cloud-sync-arena.mjs");}
  catch(error){console.error("Staging initialization failed",error);
    const el=document.getElementById("arena2StageState"); if(el)el.textContent="Verbindung fehlgeschlagen: bitte Staging-URL und Publishable Key prüfen.";
  }
}else{
  const el=document.getElementById("arena2StageState");
  if(el)el.textContent="Cloud-Sandbox noch nicht verbunden. Lokale Oberfläche ist testbar; gemeinsame Speicherung erst nach Einrichtung einer separaten Testdatenbank.";
}
