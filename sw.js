const APP_CACHE='stok-foto-app-v17';
const OCR_CACHE='stok-foto-ocr-v2';
const APP_ASSETS=['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./icons/icon.svg'];
const OCR_HOSTS=['cdn.jsdelivr.net','tessdata.projectnaptha.com'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(APP_CACHE).then(c=>c.addAll(APP_ASSETS)).then(()=>self.skipWaiting()))
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('stok-foto-app-')&&k!==APP_CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })())
});

self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  const isOcr=OCR_HOSTS.includes(u.hostname);

  if(isOcr){
    e.respondWith((async()=>{
      const cached=await caches.match(e.request);
      if(cached)return cached;
      const res=await fetch(e.request);
      if(res&&(res.ok||res.type==='opaque')){
        const c=await caches.open(OCR_CACHE);
        c.put(e.request,res.clone()).catch(()=>{});
      }
      return res;
    })());
    return;
  }

  if(u.origin===self.location.origin){
    e.respondWith((async()=>{
      try{
        const res=await fetch(e.request);
        if(res&&res.ok){
          const c=await caches.open(APP_CACHE);
          c.put(e.request,res.clone()).catch(()=>{});
        }
        return res;
      }catch(err){
        const cached=await caches.match(e.request);
        if(cached)return cached;
        if(e.request.mode==='navigate')return caches.match('./index.html');
        throw err;
      }
    })());
  }
});