const CACHE_NAME='ipcalc-pwa-v9';
const OUI_DB_PATH='/ipcalc/oui-db.json';
const ASSETS=['./','./index.html','./oui-db.json','./manifest.json','./icon.svg','./icon-192.svg','./icon-512.svg','./theme-overrides.css','./range-controls.css','./ui-enhancements.js','./range-controls.js'];

self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));

function refreshedOuiRequest(request){
  return new Request(request.url,{
    method:'GET',
    credentials:request.credentials,
    mode:request.mode,
    redirect:request.redirect,
    cache:'reload'
  });
}

async function ouiCacheFirstRefreshInBackground(event){
  const cache=await caches.open(CACHE_NAME);
  const cached=await cache.match(event.request)||await cache.match('./oui-db.json');
  const refresh=fetch(refreshedOuiRequest(event.request)).then(async response=>{
    if(response&&response.ok) await cache.put(event.request,response.clone());
    return response;
  }).catch(()=>null);

  if(cached){
    event.waitUntil(refresh);
    return cached;
  }

  const networkResponse=await refresh;
  if(networkResponse) return networkResponse;