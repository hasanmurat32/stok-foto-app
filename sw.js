const APP_CACHE='stok-foto-app-v2';
const OCR_CACHE='stok-foto-ocr-v2';
const APP_ASSETS=['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./icons/icon.svg'];
const OCR_HOSTS=['cdn.jsdelivr.net','tessdata.projectnaptha.com'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(APP_CACHE).then(c=>c.addAll(APP_ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  const isOcr=OCR_HOSTS.includes(u.hostname);
  e.respondWith((async()=>{
    const cached=await caches.match(e.request);
    if(cached) return cached;
    try{
      const res=await fetch(e.request);
      if(res && (res.ok || res.type==='opaque')){
        const c=await caches.open(isOcr?OCR_CACHE:APP_CACHE);
        c.put(e.request,res.clone()).catch(()=>{});
      }
      return res;
    }catch(err){
      if(e.request.mode==='navigate') return caches.match('./index.html');
      throw err;
    }
  })());
});