// 북서울 Report — 항상 최신 (v8 · 작은 버전 파일(ver.txt)로 먼저 확인 → 새 버전이면 끝까지 받아서 띄움)
// 1) 열 때마다 서버의 ver.txt(몇 글자)만 먼저 확인. 저장본과 같으면 저장본을 바로 띄움(빠름)
// 2) 다르면 새 화면을 끝까지(최대 90초) 받아서 띄우고 저장본도 교체 — 회선이 느려도 옛 화면으로 돌아가지 않음
// 3) 인터넷이 끊겼을 때만 마지막 저장본 표시
// 4) 이 파일(sw.js)이 바뀌면 열려 있는 화면을 모두 한 번 새로 엶
var C="bs-report-v7", VK="__bsr_ver__";
function verOf(html){ var m=/name="bsr-ver" content="([^"]+)"/.exec(html||""); return m?m[1]:""; }
function tfetch(url,ms){ var ac=self.AbortController?new AbortController():null, tm=setTimeout(function(){ if(ac) ac.abort(); },ms);
  return fetch(url, ac?{cache:"no-store",signal:ac.signal}:{cache:"no-store"}).then(function(r){ clearTimeout(tm); return r; },function(e){ clearTimeout(tm); throw e; }); }
/* 서버의 현재 버전(14자리 숫자). 못 받으면 "" */
function srvVer(ms){ return tfetch(new URL("ver.txt",self.registration.scope).href+"?t="+Date.now(),ms).then(function(r){ return r.ok?r.text():""; }).then(function(t){ t=(t||"").trim(); return /^\d{14}$/.test(t)?t:""; }).catch(function(){ return ""; }); }
/* 화면을 저장본에 넣고 그 버전도 같이 적어 둠 */
function save(c,res){ var a=res.clone(), b=res.clone();
  return c.put(home(),a).then(function(){ return b.text(); }).then(function(t){ var v=verOf(t); if(v) return c.put(home()+VK,new Response(v)); }).catch(function(){}); }
function cachedVer(c){ return c.match(home()+VK).then(function(r){ return r?r.text():""; }).catch(function(){ return ""; }); }
/* 서버에서 새 화면 받기 (끝까지 기다림) */
function fresh(c,ms){ return tfetch(home()+"?t="+Date.now(),ms).then(function(res){ if(!res.ok) throw new Error("http "+res.status); return save(c,res).then(function(){ return res; }); }); }
self.addEventListener("install",function(e){self.skipWaiting(); e.waitUntil(caches.open(C).then(function(c){ return fresh(c,90000).catch(function(){}); }));});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k.indexOf("bs-report-v7")!==0}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}).then(function(){
  /* 옛 방식으로 열려 있던 화면은 한 번 새로 열어 최신으로 맞춤 */
  return self.clients.matchAll({type:"window"}).then(function(ws){ ws.forEach(function(w){ try{ var u=new URL(w.url), n=u.pathname.split("/").pop(); if((n===""||/^index\.html$/i.test(n)) && w.navigate) w.navigate(home()+"?t="+Date.now()+u.hash).catch(function(){}); }catch(x){} }); });
}).catch(function(){}))});
function home(){ return new URL("./",self.registration.scope).href; }
self.addEventListener("fetch",function(e){
  var r=e.request, u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin)return;
  var name=u.pathname.split("/").pop();
  /* 버전 확인용 요청(?t=)은 항상 서버에서 */
  if(u.searchParams.has("t")){
    e.respondWith(fetch(r,{cache:"no-store"}).then(function(res){
      if(res.ok && (name===""||name==="index.html")){ var cp=res.clone(); e.waitUntil(caches.open(C).then(function(c){ return save(c,cp); })); }
      return res; }).catch(function(){ return (name===""||name==="index.html") ? caches.match(home()) : Response.error(); }));
    return;
  }
  if(r.mode==="navigate"){
    if(/\.html$/i.test(name) && !/^(index|404|risk|patrol|directmall|card|mail-setup|roleplay|roleplay-setup|roster)\.html$/i.test(name)){ e.respondWith(Response.redirect(home()+u.hash,302)); return; }
    if(name!=="" && !/^index\.html$/i.test(name)){ e.respondWith(fetch(r,{cache:"no-store"}).catch(function(){return caches.match(r)})); return; }
    /* 작은 버전 파일로 먼저 확인 → 같으면 저장본, 다르면 새 화면을 끝까지 받아서 띄움 */
    e.respondWith(caches.open(C).then(function(c){
      return Promise.all([c.match(home()), cachedVer(c), srvVer(5000)]).then(function(a){
        var hit=a[0], cv=a[1], sv=a[2];
        if(hit && sv && cv===sv) return hit;                       /* 이미 최신 */
        if(hit && !sv) return hit;                                 /* 인터넷 없음·버전 확인 실패 → 저장본 (화면 쪽에서 다시 확인) */
        return fresh(c,90000).catch(function(){ return hit || Response.error(); });   /* 새 버전 있음 또는 저장본 없음 */
      });
    }));
    return;
  }
  e.respondWith(fetch(r,{cache:"no-store"}).then(function(res){ if(res.ok){var cp=res.clone(); caches.open(C).then(function(c){c.put(r,cp)});} return res; }).catch(function(){return caches.match(r,{ignoreSearch:true})}));
});

/* ===== 업데이트 아이콘 뱃지 =====
   앱이 꺼져 있어도 폰이 가끔(약 12시간 이상 간격) 깨워서 새 버전이 있는지 확인하고, 있으면 앱 아이콘에 숫자 뱃지를 붙입니다.
   앱을 열면 페이지 쪽에서 뱃지를 지웁니다. 지원하지 않는 폰에서는 조용히 아무 일도 하지 않습니다. */
function checkUpd(){
  return caches.open(C).then(function(c){ return Promise.all([cachedVer(c), srvVer(15000)]); }).then(function(a){
    if(a[0] && a[1] && a[0]!==a[1] && self.registration.setAppBadge) return self.registration.setAppBadge(1);
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
