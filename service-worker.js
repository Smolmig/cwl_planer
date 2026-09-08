const CACHE="cwl-planer-v9-4-2";
const ASSETS=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./CWL_Mitgliederliste_Vorlage.csv"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const url=new URL(e.request.url);
  const isNavigation=e.request.mode==="navigate"||url.pathname.endsWith("/index.html")||url.pathname.endsWith("/cwl_planer/");
  if(isNavigation){
    e.respondWith(fetch(e.request,{cache:"no-store"}).then(r=>{if(r&&r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put("./index.html",copy))}return r}).catch(()=>caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{if(r&&r.ok&&url.origin===self.location.origin){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r})));
});
