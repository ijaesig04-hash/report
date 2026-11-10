// 북서울 Report — 빠른 열기 (v7.3 · patrol·directmall.html 허용 · 업데이트 아이콘 뱃지)
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
    if(/\.html$/i.test(name) && !/^(index|404|risk|patrol|directmall|card|mail-setup|roleplay|roleplay-setup)\.html$/i.test(name)){ e.respondWith(Response.redirect(home()+u.hash,302)); return; }
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

/* ===== 업데이트 아이콘 뱃지 =====
   앱이 꺼져 있어도 폰이 가끔(약 12시간 이상 간격) 깨워서 새 버전이 있는지 확인하고, 있으면 앱 아이콘에 숫자 뱃지를 붙입니다.
   앱을 열면 페이지 쪽에서 뱃지를 지웁니다. 지원하지 않는 폰에서는 조용히 아무 일도 하지 않습니다. */
function verOf(html){ var m=/name="bsr-ver" content="([^"]+)"/.exec(html||""); return m?m[1]:""; }
function checkUpd(){
  return caches.open(C).then(function(c){ return c.match(home()); }).then(function(hit){
    if(!hit) return;
    return hit.text().then(function(old){
      return fetch(home()+"?t="+Date.now(),{cache:"no-store"}).then(function(r){ return r.ok ? r.text() : ""; }).then(function(t){
        var a=verOf(old), b=verOf(t);
        if(a && b && a!==b && self.registration.setAppBadge) return self.registration.setAppBadge(1);
      });
    });
  }).catch(function(){});
}
self.addEventListener("periodicsync",function(e){ if(e.tag==="bsr-upd") e.waitUntil(checkUpd()); });

/* ===== 업데이트 푸시 알림 (앱이 꺼져 있어도 서버가 보내는 알림) ===== */
self.addEventListener("push",function(e){
  var d={}; try{ d=e.data?e.data.json():{}; }catch(x){}
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title||"북서울 Report 업데이트",{body:d.body||"새 내용이 반영되었어요",tag:d.tag||"bsr-upd",icon:"icon-192.png",badge:"badge-96.png",renotify:true}),
    self.registration.setAppBadge?self.registration.setAppBadge(1).catch(function(){}):0
  ]));
});
self.addEventListener("notificationclick",function(e){
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(function(ws){
    var tg=e.notification.tag||"", u=home()+"?t="+Date.now()+(/^noti-/.test(tg)?"#"+tg:"");
    for(var i=0;i<ws.length;i++){ if(ws[i].focus){ ws[i].navigate&&ws[i].navigate(u); return ws[i].focus(); } }
    return self.clients.openWindow(u);
  }));
});
