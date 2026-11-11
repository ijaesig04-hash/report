/* AI 고객응대 연습 — 북서울 Report (구글 Apps Script 웹 앱 · 자동 업데이트판)
   ★ 이 코드는 한 번만 붙여넣으면 끝이에요. 실제 동작 코드는 GitHub(tools/roleplay-core.js)에서
     5분마다 자동으로 받아 오기 때문에, 앞으로 기능을 고쳐도 다시 붙여넣거나 배포할 필요가 없어요.
   필요한 설정(프로젝트 설정 → 스크립트 속성):  GEMINI_KEY 또는 ANTHROPIC_KEY  /  ADMIN_PIN
   배포: 배포 → 배포 관리 → ✏️ 수정 → 새 버전 → 배포 (주소 그대로) */
var CORE_URL = 'https://raw.githubusercontent.com/ijaesig04-hash/report/main/tools/roleplay-core.js';

function core_() {
  var c = CacheService.getScriptCache(), src = c.get('core_src');
  if (!src) {
    try {
      var r = UrlFetchApp.fetch(CORE_URL + '?t=' + Date.now(), { muteHttpExceptions: true });
      if (r.getResponseCode() === 200 && /return \{ doPost/.test(r.getContentText())) {
        src = r.getContentText(); c.put('core_src', src, 300); c.put('core_bak', src, 21600);
      }
    } catch (e) {}
    if (!src) src = c.get('core_bak');            // GitHub가 잠깐 안 될 때는 마지막으로 받은 코드
  }
  if (!src) throw new Error('core');
  return new Function(src)();
}
function doPost(e) { try { return core_().doPost(e); } catch (err) { return out_({ ok: false, err: 'core ' + err }); } }
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'ping') return out_({ ok: true, loader: 1 });
  try { return core_().doGet(e); } catch (err) { return out_({ ok: false, err: 'core ' + err }); }
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
/* 권한 확인용 (지우지 마세요) — 구글이 이 줄을 보고 시트·인터넷 사용 권한을 물어봐요 */
function perm_() { SpreadsheetApp.openById('x'); SpreadsheetApp.create('x'); UrlFetchApp.fetch('x'); PropertiesService.getScriptProperties(); }
