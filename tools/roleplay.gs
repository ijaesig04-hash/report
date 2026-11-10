/* AI 고객응대 연습 — 북서울 Report (구글 Apps Script 웹 앱)
   하는 일: ① AI 고객 역할 대답 ② 연습 후 점수·피드백 ③ 연습 기록을 구글 시트에 저장 ④ 파트장 현황용 기록 내려주기
   필요한 설정(프로젝트 설정 → 스크립트 속성):  GEMINI_KEY = 구글 AI 스튜디오 키  /  ADMIN_PIN = 파트장 현황 비밀번호
   배포: 배포 → 새 배포 → 유형 '웹 앱' → 실행: 나 / 액세스: 모든 사용자 */
const P = PropertiesService.getScriptProperties();
const HEAD = ['시각', '이름', '상황', '난이도', '총점', '공감·사과', '원인 설명', '해결책 제시', '해지 방어', '말한 횟수'];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.act === 'chat') return out(chat(d));
    if (d.act === 'eval') return out(evaluate(d));
    return out({ ok: false, err: 'act' });
  } catch (err) { return out({ ok: false, err: String(err) }); }
}
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'rows') {
    if (!P.getProperty('ADMIN_PIN') || p.pin !== P.getProperty('ADMIN_PIN')) return out({ ok: false, err: 'pin' });
    return out({ ok: true, rows: rows(600) });
  }
  return out({ ok: true, ready: !!P.getProperty('GEMINI_KEY') });
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function gemini(sys, contents, maxTok) {
  const key = P.getProperty('GEMINI_KEY');
  if (!key) throw new Error('GEMINI_KEY 없음');
  const model = P.getProperty('MODEL') || 'gemini-2.5-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + key;
  const body = { systemInstruction: { parts: [{ text: sys }] }, contents: contents,
    generationConfig: { temperature: 0.8, maxOutputTokens: maxTok || 1200, responseMimeType: 'application/json' } };
  const r = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true });
  const j = JSON.parse(r.getContentText());
  if (r.getResponseCode() !== 200) throw new Error((j.error && j.error.message) || ('HTTP ' + r.getResponseCode()));
  const t = j.candidates[0].content.parts.map(function (x) { return x.text || ''; }).join('');
  return JSON.parse(t);
}

const LV = { '하': '말투는 비교적 차분하고 설명을 잘 들어 줍니다.', '중': '불만이 꽤 있고 말을 자주 끊지만, 납득되면 누그러집니다.', '상': '매우 화가 나 있고 쉽게 풀리지 않으며, 형식적인 답이나 변명에는 더 화를 냅니다.' };

function chat(d) {
  const sc = d.sc || {};
  const sys = '당신은 보안회사(에스원) 고객 응대 연습에서 "까다로운 고객" 역할을 맡은 연기자입니다.\n' +
    '상황: ' + String(sc.persona || '').slice(0, 600) + '\n난이도: ' + (d.level || '중') + ' — ' + (LV[d.level] || LV['중']) + '\n' +
    '규칙: 고객 입장에서 전화로 말하듯 1~2문장(60자 안팎)으로만 말합니다. 마크다운·괄호 설명 금지. 직원의 답이 공감·사과, 원인 설명, 구체적 해결책이 충분하면 점점 누그러지고, 부족하면 불만을 이어 갑니다. ' +
    '실제 개인정보(이름·전화번호·주소)는 절대 지어내서 말하지 않습니다.\n' +
    '또 직원 마지막 말을 보고 코치 팁을 한 줄(30자 이내) 줍니다. 반말·변명·책임 떠넘기기·무성의처럼 부적절할 때만 쓰고, 괜찮으면 빈 문자열.\n' +
    '고객이 충분히 납득했거나 통화를 끝내려 하면 end를 true로 합니다.\n' +
    '반드시 JSON만: {"customer":"고객 대사","tip":"코치 팁 또는 빈 문자열","end":false}';
  const contents = [{ role: 'user', parts: [{ text: '(전화가 연결되었습니다)' }] }];
  (d.hist || []).slice(-24).forEach(function (m) {
    contents.push({ role: m.r === 'c' ? 'model' : 'user', parts: [{ text: String(m.t || '').slice(0, 500) }] });
  });
  const r = gemini(sys, contents, 600);
  return { ok: true, customer: String(r.customer || '').slice(0, 300), tip: String(r.tip || '').slice(0, 80), end: !!r.end };
}

function evaluate(d) {
  const sc = d.sc || {};
  const talk = (d.hist || []).slice(-30).map(function (m) { return (m.r === 'c' ? '고객: ' : '직원: ') + String(m.t || '').slice(0, 400); }).join('\n');
  const sys = '당신은 보안회사 고객응대 코치입니다. 아래 연습 통화에서 "직원"의 응대를 평가하세요.\n상황: ' + String(sc.title || '') + ' / 난이도 ' + (d.level || '중') + '\n' +
    '항목(각 0~100점): 공감·사과(감정을 먼저 받아 주고 진심으로 사과했는가), 원인 설명(왜 그런지 쉽고 정확하게 설명했는가), 해결책 제시(구체적이고 실행 가능한 다음 단계를 말했는가), 해지 방어(해지·불만을 존중하면서 계속 이용할 이유와 대안을 제시했는가). ' +
    '직원이 거의 말하지 않았으면 낮게 주세요. 잘한 점과 개선할 점은 각각 2~3개, 한 줄씩 쉬운 말로. 마지막에 "이렇게 말해 보세요" 예시 한마디(60자 이내).\n' +
    '반드시 JSON만: {"scores":{"공감·사과":0,"원인 설명":0,"해결책 제시":0,"해지 방어":0},"good":["..."],"improve":["..."],"example":"..."}';
  const r = gemini(sys, [{ role: 'user', parts: [{ text: talk || '(대화 없음)' }] }], 1200);
  const s = r.scores || {};
  const k = ['공감·사과', '원인 설명', '해결책 제시', '해지 방어'];
  const v = k.map(function (n) { return Math.max(0, Math.min(100, Math.round(Number(s[n]) || 0))); });
  const total = Math.round(v.reduce(function (a, b) { return a + b; }, 0) / 4);
  const name = String(d.name || '').slice(0, 10);
  let prev = null;
  if (name) {
    const sh = sheet(), n = sh.getLastRow();
    if (n > 1) {
      const vals = sh.getRange(Math.max(2, n - 300), 1, Math.min(300, n - 1), 5).getValues();
      for (let i = vals.length - 1; i >= 0; i--) { if (vals[i][1] === name) { prev = Number(vals[i][4]); break; } }
    }
    sh.appendRow([new Date(), name, String(sc.id || ''), String(d.level || ''), total, v[0], v[1], v[2], v[3], Number(d.turns) || 0]);
  }
  return { ok: true, total: total, scores: { '공감·사과': v[0], '원인 설명': v[1], '해결책 제시': v[2], '해지 방어': v[3] },
    good: (r.good || []).slice(0, 3), improve: (r.improve || []).slice(0, 3), example: String(r.example || ''), prev: prev };
}

function sheet() {
  let id = P.getProperty('SHEET_ID'), ss;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create('AI 응대 연습 기록 (북서울 Report)'); P.setProperty('SHEET_ID', ss.getId()); }
  let sh = ss.getSheets()[0];
  if (sh.getLastRow() === 0) { sh.appendRow(HEAD); sh.setFrozenRows(1); }
  return sh;
}
function rows(limit) {
  const sh = sheet(), n = sh.getLastRow();
  if (n < 2) return [];
  const cnt = Math.min(limit, n - 1);
  return sh.getRange(n - cnt + 1, 1, cnt, HEAD.length).getValues().map(function (r) {
    return { t: new Date(r[0]).getTime(), name: r[1], sc: r[2], lv: r[3], total: r[4], s: [r[5], r[6], r[7], r[8]], n: r[9] };
  });
}
