// 북서울 Report — 항상 최신 화면으로 열기 (v6)
// 1) 주소는 index.html(./) 하나. 예전 파일 주소(report-XXXX.html)로 열어도 ./ 로 이동
// 2) 앱을 열 때마다 서버에서 새로 받아옴. 인터넷이 끊겼을 때만 마지막 화면 표시
var C="bs-report-v6";
self.addEventListener("install",function(e){self.skipWaiting()});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==C}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener("fetch",function(e){
  var r=e.request, u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin)return;
  var name=u.pathname.split("/").pop();
  if(r.mode==="navigate" && /\.html$/i.test(name) && !/^(index|risk|404)\.html$/i.test(name)){
    e.respondWith(Response.redirect(new URL("./",self.registration.scope).href+u.hash,302));
    return;
  }
  e.respondWith(fetch(r,{cache:"no-store"}).then(function(res){
    if(res.ok){var cp=res.clone(); caches.open(C).then(function(c){c.put(r,cp)});} return res;
  }).catch(function(){return caches.match(r,{ignoreSearch:true}).then(function(m){return m||caches.match(new URL("./",self.registration.scope).href)})}));
});
