const CACHE_NAME='ipcalc-pwa-v13';
const OUI_DB_PATH='/ipcalc/oui-db.json';
const ASSETS=['./','./index.html','./oui-db.json','./manifest.json','./icon.svg','./icon-192.svg','./icon-512.svg','./theme-overrides.css','./range-controls.css','./ipv4-utils.js','./ui-enhancements.js','./range-controls.js','./standalone-builder.html','./standalone-builder.js','./standalone-builder-core.js'];
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

async function enhanceHtml(r){
  if(!r||!r.ok||!(r.headers.get('content-type')||'').includes('text/html'))return r;
  let h=await r.text();
  for(const [n,t,z] of [
    ['theme-overrides.css','<link rel="stylesheet" href="./theme-overrides.css">','</head>'],
    ['range-controls.css','<link rel="stylesheet" href="./range-controls.css">','</head>'],
    ['ipv4-utils.js','<script src="./ipv4-utils.js"></script>','</head>'],
    ['ui-enhancements.js','<script src="./ui-enhancements.js" defer></script>','</body>'],
    ['range-controls.js','<script src="./range-controls.js" defer></script>','</body>']])
    if(!h.includes(n))h=h.includes(z)?h.replace(z,`  ${t}\n${z}`):`${h}\n${t}`;
  const headers=new Headers(r.headers);headers.delete('content-length');
  return new Response(h,{status:r.status,statusText:r.statusText,headers});
}

async function documentNetworkFirst(q){
  const c=await caches.open(CACHE_NAME);
  try{const r=await enhanceHtml(await fetch(q));if(r&&r.ok)await c.put(q,r.clone());return r;}
  catch(e){return await c.match(q)||enhanceHtml(await c.match('./index.html'));}
}

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;
  if(u.searchParams.has('standalone-source'))return e.respondWith(standaloneSourceNetworkFirst(e.request));
  if(u.pathname===OUI_DB_PATH||u.pathname.endsWith('/oui-db.json'))return e.respondWith(ouiStaleWhileRevalidate(e));
  if(e.request.mode==='navigate'||e.request.destination==='document')return e.respondWith(documentNetworkFirst(e.request));
  e.respondWith(caches.match(e.request).then(x=>x||fetch(e.request).then(r=>{if(r&&r.status===200&&r.type==='basic')caches.open(CACHE_NAME).then(c=>c.put(e.request,r.clone()));return r;})));
});
