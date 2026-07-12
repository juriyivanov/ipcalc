const CACHE_NAME='ipcalc-pwa-v22';
const OUI_DB_PATH='/ipcalc/oui-db.json';
const SHELL_ASSET_PATHS=new Set(['/ipcalc/index.html','/ipcalc/app.css','/ipcalc/app.js','/ipcalc/ipv4-utils.js','/ipcalc/cidr-set-utils.js','/index.html','/app.css','/app.js','/ipv4-utils.js','/cidr-set-utils.js']);
const ASSETS=['./','./index.html','./app.css','./app.js','./ipv4-utils.js','./cidr-set-utils.js','./oui-db.json','./manifest.json','./icon.svg','./icon-192.svg','./icon-512.svg','./standalone-builder.html','./standalone-builder.js','./standalone-builder-core.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE_NAME).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));

async function standaloneSourceNetworkFirst(request){
  const requestUrl=new URL(request.url);
  const canonicalUrl=new URL(requestUrl.href);
  canonicalUrl.searchParams.delete('standalone-source');
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok)return response;
  }catch(error){}
  const cache=await caches.open(CACHE_NAME);
  const cached=await cache.match(canonicalUrl.href);
  if(cached)return cached;
  return new Response('Standalone source is unavailable',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});
}

async function ouiStaleWhileRevalidate(e){
  const c=await caches.open(CACHE_NAME);
  const cached=await c.match(e.request)||await c.match('./oui-db.json');
  const refresh=fetch(new Request(e.request.url,{cache:'reload',credentials:e.request.credentials,mode:e.request.mode,redirect:e.request.redirect}))
    .then(async r=>{if(r&&r.ok)await c.put(e.request,r.clone());return r;})
    .catch(()=>null);
  if(cached){e.waitUntil(refresh);return cached;}
  return await refresh||new Response('{}',{headers:{'content-type':'application/json'}});
}

async function shellNetworkFirst(request){
  const c=await caches.open(CACHE_NAME);
  try{
    const r=await fetch(request,{cache:'no-store'});
    if(r&&r.ok)await c.put(request,r.clone());
    return r;
  }catch(e){return await c.match(request)||await c.match('./index.html');}
}

async function cacheFirst(request){
  const c=await caches.open(CACHE_NAME);
  const cached=await c.match(request);
  if(cached)return cached;
  const r=await fetch(request);
  if(r&&r.status===200&&r.type==='basic')await c.put(request,r.clone());
  return r;
}

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;
  if(u.searchParams.has('standalone-source'))return e.respondWith(standaloneSourceNetworkFirst(e.request));
  if(u.pathname===OUI_DB_PATH||u.pathname.endsWith('/oui-db.json'))return e.respondWith(ouiStaleWhileRevalidate(e));
  if(e.request.mode==='navigate'||e.request.destination==='document'||SHELL_ASSET_PATHS.has(u.pathname))return e.respondWith(shellNetworkFirst(e.request));
  e.respondWith(cacheFirst(e.request));
});
