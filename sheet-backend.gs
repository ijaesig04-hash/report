// 북서울 AI 근태 — 구글 시트 저장소 (Apps Script)
// 설정 방법
// 1) 구글 드라이브 > 새로 만들기 > 더보기 > Google Apps Script
// 2) 편집기 내용을 모두 지우고 이 파일 내용을 붙여넣기
// 3) 아래 KEY 값을 본인만 아는 비밀번호로 바꾸기 (영문·숫자 조합 권장)
// 4) 오른쪽 위 "배포" > "새 배포" > 종류: 웹 앱
//    - 실행 사용자: 나
//    - 액세스 권한: 모든 사용자
//    > 배포 후 나오는 "웹 앱 URL"(…/exec 로 끝남)을 복사
// 5) 대시보드에서 "구글 시트에 연결"을 누르고 그 URL과 KEY를 입력
// 저장되는 곳: 이 스크립트가 처음 실행될 때 만든 "근태 대시보드 저장" 구글 시트 (docs 탭)

var KEY = '여기에-비밀번호-입력';
var SHEET_PROP = 'ROSTER_SHEET_ID';

function sheet_() {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty(SHEET_PROP);
  var ss = id ? SpreadsheetApp.openById(id) : null;
  if (!ss) {
    ss = SpreadsheetApp.create('근태 대시보드 저장');
    p.setProperty(SHEET_PROP, ss.getId());
  }
  var sh = ss.getSheetByName('docs') || ss.insertSheet('docs');
  if (sh.getLastRow() === 0) sh.appendRow(['path', 'json', 'updatedAt']);
  return sh;
}

function findRow_(sh, path) {
  var n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  var v = sh.getRange(2, 1, n, 1).getValues();
  for (var i = 0; i < v.length; i++) if (v[i][0] === path) return i + 2;
  return 0;
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return reply_({ ok: true, name: '근태 대시보드 저장소' });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    if (req.key !== KEY) return reply_({ error: 'key' });
    var sh = sheet_();
    var out = {};
    if (req.action === 'get') {
      var r = findRow_(sh, req.path);
      out = { exists: !!r, data: r ? JSON.parse(sh.getRange(r, 2).getValue()) : null };
    } else if (req.action === 'list') {
      var last = sh.getLastRow();
      var rows = last > 1 ? sh.getRange(2, 1, last - 1, 2).getValues() : [];
      out = { docs: rows.filter(function (x) {
          var p = String(x[0]);
          return p.indexOf(req.prefix) === 0 && p.split('/').length === req.depth;
        }).map(function (x) {
          var p = String(x[0]);
          return { id: p.split('/').pop(), path: p, data: JSON.parse(x[1]) };
        }) };
    } else if (req.action === 'set') {
      var js = JSON.stringify(req.data);
      if (js.length > 49000) return reply_({ error: '저장할 내용이 너무 커요' });
      var r2 = findRow_(sh, req.path);
      if (r2) sh.getRange(r2, 2, 1, 2).setValues([[js, new Date().toISOString()]]);
      else sh.appendRow([req.path, js, new Date().toISOString()]);
      out = { ok: true };
    } else {
      out = { error: 'action' };
    }
    return reply_(out);
  } catch (err) {
    return reply_({ error: String(err) });
  }
}
