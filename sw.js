// Mountain Peak SW — HTMLはnetwork-first、静的アセットはcache-first（山では圏外が普通）
var V="mp-static-v2";
self.addEventListener("install",function(e){self.skipWaiting()});
self.addEventListener("activate",function(e){
  e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==V}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}));
});
self.addEventListener("fetch",function(e){
  var req=e.request;
  if(req.method!=="GET")return;
  var u=new URL(req.url);
  if(u.origin!==location.origin)return;
  if(req.mode==="navigate"){
    e.respondWith(fetch(req).then(function(r){var c=r.clone();caches.open(V).then(function(x){x.put(req,c)});return r}).catch(function(){return caches.match(req).then(function(r){return r||caches.match(new URL(self.registration.scope).pathname)})}));
    return;
  }
  e.respondWith(caches.match(req).then(function(r){return r||fetch(req).then(function(r2){if(r2.ok){var c=r2.clone();caches.open(V).then(function(x){x.put(req,c)})}return r2})}));
});
