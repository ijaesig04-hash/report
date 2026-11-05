/* 북서울 Report · 업데이트 알림 구독자 보관함 (Apps Script) — v2
   v2: 관리자가 앱에서 '미확인자에게 다시 알림'을 누르면 요청을 보관 → GitHub이 10분마다 확인해 해당 직원에게만 발송
   배포: 웹 앱 / 실행 사용자=나 / 액세스=모든 사용자 */
var SECRET = '__PUSH_SECRET__';   // GitHub 비밀값 PUSH_SECRET 과 같아야 함
var MGR_PIN = '__MGR_PIN__';      // 서비스 Report 관리자 PIN
function out_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function get_(k,d){ try{ return JSON.parse(PropertiesService.getScriptProperties().getProperty(k)||d); }catch(e){ return JSON.parse(d); } }
function put_(k,v){ PropertiesService.getScriptProperties().setProperty(k, JSON.stringify(v)); }
function doGet(e){
  var p = e.parameter || {}, lock = LockService.getScriptLock(); lock.waitLock(10000);
  try{
    var m = get_('subs','{}');
    if(p.action==='sub'){
      var s = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(p.d)).getDataAsString());
      if(!s.endpoint) return out_({ok:false});
      m[s.endpoint] = {s:s, name:String(p.name||'').slice(0,20), t:new Date().toISOString()}; put_('subs',m); return out_({ok:true});
    }
    if(p.action==='names' || p.action==='req'){
      if(String(p.pin||'')!==MGR_PIN) return out_({ok:false, err:'pin'});
      if(p.action==='names'){ var o={}; Object.keys(m).forEach(function(k){ if(m[k].name) o[m[k].name]=1; }); return out_({ok:true, names:Object.keys(o)}); }
      var r = get_('reqs','[]');
      r.push({id:String(Date.now())+Math.floor(Math.random()*1000), names:String(p.names||'').split(',').filter(String).slice(0,40),
              title:String(p.title||'').slice(0,60), body:String(p.body||'').slice(0,120), tag:String(p.tag||'').slice(0,40), t:new Date().toISOString()});
      put_('reqs', r.slice(-30)); kick_(); return out_({ok:true});
    }
    if(p.key!==SECRET) return out_({ok:false});
    if(p.action==='list') return out_({ok:true, subs:Object.keys(m).map(function(k){return m[k].s;})});
    if(p.action==='list2') return out_({ok:true, subs:Object.keys(m).map(function(k){return {s:m[k].s, name:m[k].name||''};})});
    if(p.action==='reqs') return out_({ok:true, reqs:get_('reqs','[]')});
    if(p.action==='reqdone'){ var ids=String(p.ids||'').split(','); put_('reqs', get_('reqs','[]').filter(function(x){return ids.indexOf(x.id)<0;})); return out_({ok:true}); }
    if(p.action==='del'){ String(p.eps||'').split(',').forEach(function(k){ delete m[decodeURIComponent(k)]; }); put_('subs',m); return out_({ok:true}); }
    return out_({ok:true, n:Object.keys(m).length});
  } finally { lock.releaseLock(); }
}

// 요청이 들어오면 GitHub 발송 작업을 바로 실행 (스크립트 속성 GH_TOKEN 필요, 없으면 5분 주기 발송으로 대체)
function kick_(){ try{ var t=PropertiesService.getScriptProperties().getProperty('GH_TOKEN'); if(!t) return;
  UrlFetchApp.fetch('https://api.github.com/repos/ijaesig04-hash/report/actions/workflows/push-req.yml/dispatches',
    {method:'post', contentType:'application/json', muteHttpExceptions:true,
     headers:{Authorization:'Bearer '+t.trim(), Accept:'application/vnd.github+json'}, payload:JSON.stringify({ref:'main'})});
  }catch(e){} }
