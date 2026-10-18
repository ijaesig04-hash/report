// 항상 최신 리포트를 먼저 받아오고, 인터넷이 끊겼을 때만 마지막으로 본 화면을 보여줍니다.
var C="bs-report";
self.addEventListener("install",function(e){self.skipWaiting()});
self.addEventListener("activate",function(e){e.waitUntil(self.clients.claim())});
self.addEventListener("fetch",function(e){
  if(e.request.method!=="GET")return;
  e.respondWith(fetch(e.request).then(function(r){
    var cp=r.clone(); caches.open(C).then(function(c){c.put(e.request,cp)}); return r;
  }).catch(function(){return caches.match(e.request)}));
});
