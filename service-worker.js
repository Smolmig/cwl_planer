const CACHE="cwl-planer-v1-0-3";
const ASSETS=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./CWL_Mitgliederliste_Vorlage.csv"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const url=new URL(e.request.url);
  // The Cloud app is online-only. Never serve stale JavaScript modules from
  // the offline planner's cache: old code broke Safari member synchronization.
  const cloudModule=/\/(?:cloud-app\.html|cloud-sync\.mjs|cloud-backups\.mjs|cloud-version\.json|cwl-live(?:-core)?\.mjs|cwl-current-war\.mjs|cwl-stats(?:-core)?\.mjs)$/.test(url.pathname);
  if(url.origin===self.location.origin && cloudModule){
    e.respondWith(fetch(e.request,{cache:"no-store"}));return;
  }
  const isNavigation=e.request.mode==="navigate"||url.pathname.endsWith("/index.html")||url.pathname.endsWith("/cwl_planer/");
  if(isNavigation){
    // Only the main planner may update the offline index.html fallback.
    // Alpha/extra HTML pages must never replace the offline main application.
    const isMain=url.pathname.endsWith("/index.html")||url.pathname.endsWith("/cwl_planer/");
    if(!isMain){e.respondWith(fetch(e.request,{cache:"no-store"}).catch(()=>caches.match(e.request).then(r=>r||Response.error())));return}
    e.respondWith(fetch(e.request,{cache:"no-store"}).then(r=>{if(r&&r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put("./index.html",copy))}return r}).catch(()=>caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{if(r&&r.ok&&url.origin===self.location.origin){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r})));
});
