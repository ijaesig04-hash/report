// 북서울 Report — 빠른 열기 (v7)
// 1) 화면(index.html)은 휴대폰에 저장된 것을 바로 띄우고, 뒤에서 새 버전을 받아 저장본을 바꿔 둠
// 2) 새 버전이 받아지면 화면 쪽 버전 확인이 자동으로 새로고침 → 항상 최신 유지
// 3) 인터넷이 끊겨도 마지막 화면 표시
var C="bs-report-v7";
self.addEventListener("install",function(e){self.skipWaiting(); e.waitUntil(caches.open(C).then(function(c){ return fetch(new URL("./",self.registration.scope).href,{cache:"no-store"}).then(function(res){ if(res.ok) return c.put(new URL("./",self.registration.scope).href,res); }).catch(function(){}); }));});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k.indexOf("bs-report-v7")!==0}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))});
function home(){ return new URL("./",self.registration.scope).href; }
self.addEventListener("fetch",function(e){
  var r=e.request, u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin)return;
  var name=u.pathname.split("/").pop();
  /* 버전 확인용 요청(?t=)은 항상 서버에서 */
  if(u.searchParams.has("t")){
    e.respondWith(fetch(r,{cache:"no-store"}).then(function(res){
      if(res.ok && (name===""||name==="index.html")){ var cp=res.clone(); caches.open(C).then(function(c){c.put(home(),cp)}); }
      return res; }).catch(function(){return caches.match(home())}));
    return;
  }
  if(r.mode==="navigate"){
    if(/\.html$/i.test(name) && !/^(index|404|risk)\.html$/i.test(name)){ e.respondWith(Response.redirect(home()+u.hash,302)); return; }
    if(name!=="" && !/^index\.html$/i.test(name)){ e.respondWith(fetch(r,{cache:"no-store"}).catch(function(){return caches.match(r)})); return; }
    e.respondWith(caches.open(C).then(function(c){
      return c.match(home()).then(function(hit){
        var net = fetch(home(),{cache:"no-store"}).then(function(res){ if(res.ok) c.put(home(),res.clone()); return res; });
        if(hit){ e.waitUntil(net.catch(function(){})); return hit; }
        return net.catch(function(){ return hit; });
      });
    }));
    return;
  }
  e.respondWith(fetch(r,{cache:"no-store"}).then(function(res){ if(res.ok){var cp=res.clone(); caches.open(C).then(function(c){c.put(r,cp)});} return res; }).catch(function(){return caches.match(r,{ignoreSearch:true})}));
});
