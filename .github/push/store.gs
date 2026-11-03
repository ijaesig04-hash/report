/* 북서울 Report · 업데이트 알림 구독자 보관함 (Apps Script)
   배포: 웹 앱 / 실행 사용자=나 / 액세스=모든 사용자 */
var SECRET = '__PUSH_SECRET__';   // 여기에 비밀문자 (GitHub 비밀값 PUSH_SECRET 과 같아야 함)
function out_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function load_(){ try{ return JSON.parse(PropertiesService.getScriptProperties().getProperty('subs')||'{}'); }catch(e){ return {}; } }
function save_(m){ PropertiesService.getScriptProperties().setProperty('subs', JSON.stringify(m)); }
function doGet(e){
  var p = e.parameter || {}, lock = LockService.getScriptLock(); lock.waitLock(10000);
  try{
    var m = load_();
    if(p.action==='sub'){
      var s = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(p.d)).getDataAsString());
      if(!s.endpoint) return out_({ok:false});
      m[s.endpoint] = {s:s, name:String(p.name||'').slice(0,20), t:new Date().toISOString()}; save_(m); return out_({ok:true});
    }
    if(p.key!==SECRET) return out_({ok:false});
    if(p.action==='list') return out_({ok:true, subs:Object.keys(m).map(function(k){return m[k].s;})});
    if(p.action==='del'){ String(p.eps||'').split(',').forEach(function(k){ delete m[decodeURIComponent(k)]; }); save_(m); return out_({ok:true}); }
    return out_({ok:true, n:Object.keys(m).length});
  } finally { lock.releaseLock(); }
}
