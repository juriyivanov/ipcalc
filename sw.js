const CACHE_NAME='ipcalc-pwa-v8';
const OUI_DB_PATH='/ipcalc/oui-db.json';
const ASSETS=['./','./index.html','./oui-db.json','./manifest.json','./icon.svg','./icon-192.svg','./icon-512.svg','./theme-overrides.css','./range-controls.css','./ui-enhancements.js','./range-controls.js'];

self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));

async function ouiNetworkFirst(request){
  const cache=await caches.open(CACHE_NAME);
  try{
    const response=await fetch(new Request(request.url,{cache:'reload',credentials:request.credentials,mode:request.mode,redirect:request.redirect}));
    if(response.ok) await cache.put(request,response.clone());
    return response;
  }catch(error){
    return await cache.match(request)||await cache.match('./oui-db.json');
  }
}

async function enhanceHtml(response){
  if(!response||!response.ok||!(response.headers.get('content-type')||'').includes('text/html')) return response;
  let html=await response.text();
  const tags=[
    ['theme-overrides.css','<link rel="stylesheet" href="./theme-overrides.css">','</head>'],
    ['range-controls.css','<link rel="stylesheet" href="./range-controls.css">','</head>'],
    ['ui-enhancements.js','<script src="./ui-enhancements.js" defer></script>','</body>'],
    ['range-controls.js','<script src="./range-controls.js" defer></script>','</body>']
  ];
  for(const [needle,tag,close] of tags){
    if(html.includes(needle)) continue;
    html=html.includes(close)?html.replace(close,`  ${tag}\n${close}`):`${html}\n${tag}`;
  }
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}

async function documentNetworkFirst(request){
  const cache=await caches.open(CACHE_NAME);
  try{
    const response=await enhanceHtml(await fetch(request));
    if(response&&response.ok) await cache.put(request,response.clone());
    return response;
  }catch(error){
    return await cache.match(request)||enhanceHtml(await cache.match('./index.html'));
  }
}

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin) return;
  if(url.pathname===OUI_DB_PATH||url.pathname.endsWith('/oui-db.json')) return e.respondWith(ouiNetworkFirst(e.request));
  if(e.request.mode==='navigate'||e.request.destination==='document') return e.respondWith(documentNetworkFirst(e.request));
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(response=>{
    if(!response||response.status!==200||response.type!=='basic') return response;
    caches.open(CACHE_NAME).then(cache=>cache.put(e.request,response.clone()));
    return response;
  })));
});
