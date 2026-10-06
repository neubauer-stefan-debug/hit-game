const CACHE="hit-v3.2.0";
const CORE=["./","./index.html?v=3.2.0","./styles.css?v=3.2.0","./app.js?v=3.2.0","./highscore.js?v=3.2.0","./firebase-config.js?v=3.2.0","./manifest.json?v=3.2.0","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE).catch(()=>{})))});
self.addEventListener("activate",e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim()})())});
self.addEventListener("fetch",e=>{
  const req=e.request;if(req.method!=="GET")return;
  if(req.mode==="navigate"||["script","style","manifest"].includes(req.destination)){
    e.respondWith(fetch(req).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy));return r}).catch(()=>caches.match(req).then(r=>r||caches.match("./"))));
  }else e.respondWith(caches.match(req).then(c=>c||fetch(req).then(r=>{const copy=r.clone();caches.open(CACHE).then(x=>x.put(req,copy));return r})));
});