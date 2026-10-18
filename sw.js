// 앱을 열 때마다 항상 서버에서 최신 화면을 받아옵니다(폰 임시저장 무시).
// 인터넷이 끊겼을 때만 마지막으로 본 화면을 보여줍니다.
var C="bs-report-v2";
self.addEventListener("install",function(e){self.skipWaiting()});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==C}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener("fetch",function(e){
  var r=e.request; if(r.method!=="GET"||new URL(r.url).origin!==location.origin)return;
  e.respondWith(fetch(r,{cache:"no-store"}).then(function(res){
    var cp=res.clone(); caches.open(C).then(function(c){c.put(r,cp)}); return res;
  }).catch(function(){return caches.match(r)}));
});
