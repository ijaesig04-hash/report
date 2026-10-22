// 북서울 Report — 항상 최신 화면으로 열기 (v3)
// 1) 예전 파일 주소(즐겨찾기·홈 화면 바로가기)로 열어도 index.html이 가리키는 최신 파일로 자동 이동
// 2) 앱을 열 때마다 서버에서 새로 받아옴. 인터넷이 끊겼을 때만 마지막 화면 표시
var C="bs-report-v3";
self.addEventListener("install",function(e){self.skipWaiting()});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==C}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))});
function latest(){
  return fetch("index.html?t="+Date.now(),{cache:"no-store"}).then(function(r){return r.text()}).then(function(t){
    var m=/url=([^"'>\s]+\.html)/i.exec(t||""); return m?m[1]:null;
  }).catch(function(){return null});
}
self.addEventListener("fetch",function(e){
  var r=e.request, u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin)return;
  var name=u.pathname.split("/").pop();
  var isPage=r.mode==="navigate" && /\.html$/i.test(name) && !/^(index|risk)\.html$/i.test(name);
  if(isPage){
    e.respondWith(latest().then(function(lt){
      if(lt && lt!==name){
        return new Response('<!doctype html><meta charset="utf-8"><meta name="color-scheme" content="only light"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;text-align:center;padding-top:40vh;color:#1f4fd8">최신 화면으로 이동 중…<script>location.replace("'+lt+'")<\/script>',{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
      }
      return fetch(r,{cache:"no-store"}).then(function(res){var cp=res.clone();caches.open(C).then(function(c){c.put(r,cp)});return res;}).catch(function(){return caches.match(r)});
    }));
    return;
  }
  e.respondWith(fetch(r,{cache:"no-store"}).then(function(res){
    var cp=res.clone(); caches.open(C).then(function(c){c.put(r,cp)}); return res;
  }).catch(function(){return caches.match(r)}));
});
