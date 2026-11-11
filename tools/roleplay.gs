/* AI 고객응대 연습 — 북서울 Report (구글 Apps Script 웹 앱)
   하는 일: ① AI 고객 역할 대답 ② 연습 후 점수·피드백 ③ 연습 기록을 구글 시트에 저장 ④ 파트장 현황용 기록 내려주기
   필요한 설정(프로젝트 설정 → 스크립트 속성):  ANTHROPIC_KEY = Claude API 키 (또는 GEMINI_KEY = 구글 AI 스튜디오 키)  /  ADMIN_PIN = 파트장 현황 비밀번호
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
  if (p.action === 'ping') return out({ ok: true });   // 앱을 열 때 미리 깨워 두기 (첫 대답이 빨라짐)
  if (p.action === 'board') return out(board());                       // 이달 순위 (이름·평균·횟수만)
  if (p.action === 'me') return out(mine(String(p.name || '').slice(0, 10)));   // 내 항목별 평균 (약한 항목 추천용)
  if (p.action === 'rows') {
    if (!P.getProperty('ADMIN_PIN') || p.pin !== P.getProperty('ADMIN_PIN')) return out({ ok: false, err: 'pin' });
    return out({ ok: true, rows: rows(600) });
  }
  if (p.action === 'test') {   // 브라우저에서 주소 뒤에 ?action=test 를 붙여 열면 AI 연결·속도를 점검
    const t0 = Date.now();
    try { const r = chat({ sc: { persona: '시험 통화' }, level: '중', hist: [{ r: 'c', t: '여보세요?' }, { r: 's', t: '안녕하세요, 에스원입니다.' }] }); return out({ ok: true, ms: Date.now() - t0, model: P.getProperty('ANTHROPIC_KEY') ? (P.getProperty('CLAUDE_MODEL') || 'claude-haiku-5-5') : LAST_MODEL, r: r }); }
    catch (err) { return out({ ok: false, ms: Date.now() - t0, err: String(err) }); }
  }
  return out({ ok: true, ready: !!P.getProperty('GEMINI_KEY') });
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* AI 부르기: ANTHROPIC_KEY 속성이 있으면 Claude, 없으면 Gemini */
function gemini(sys, contents, maxTok, fast) {
  if (P.getProperty('ANTHROPIC_KEY')) return claude(sys, contents, maxTok, fast);
  return geminiCall(sys, contents, maxTok, fast);
}
function claude(sys, contents, maxTok, fast) {
  const model = P.getProperty('CLAUDE_MODEL') || 'claude-haiku-5-5';
  const msgs = [];
  contents.forEach(function (c) {
    const role = c.role === 'model' ? 'assistant' : 'user', text = c.parts.map(function (x) { return x.text || ''; }).join('');
    if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += '\n' + text;
    else msgs.push({ role: role, content: text });
  });
  const body = { model: model, max_tokens: fast ? 300 : Math.max(maxTok || 1000, 1000), system: sys + '\n\n반드시 JSON 한 덩어리만 출력하세요. 설명·코드블록 금지.', messages: msgs };
  let r;
  for (let k = 0; k < 3; k++) {
    r = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', { method: 'post', contentType: 'application/json',
      headers: { 'x-api-key': P.getProperty('ANTHROPIC_KEY'), 'anthropic-version': '2023-06-01' }, payload: JSON.stringify(body), muteHttpExceptions: true });
    if ([429, 500, 502, 503, 529].indexOf(r.getResponseCode()) < 0) break;
    Utilities.sleep(1500 * (k + 1));
  }
  const j = JSON.parse(r.getContentText());
  if (r.getResponseCode() !== 200) throw new Error((j.error && j.error.message) || ('HTTP ' + r.getResponseCode()));
  const t = (j.content || []).map(function (x) { return x.text || ''; }).join('');
  const i = t.indexOf('{'), e = t.lastIndexOf('}');
  if (i < 0 || e < i) throw new Error('AI가 빈 답을 줬어요');
  return JSON.parse(t.slice(i, e + 1));
}
/* 무료 키는 모델마다 하루 한도가 따로 있음 → 한 모델이 막히면(한도 초과·없는 모델) 다른 모델로 자동으로 넘어감 */
function modelList(key) {
  const c = CacheService.getScriptCache(), hit = c.get('models');
  if (hit) return JSON.parse(hit);
  let list = [];
  try {
    const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + key, { muteHttpExceptions: true });
    list = (JSON.parse(r.getContentText()).models || []).filter(function (m) {
      return (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0 && /flash/.test(m.name) && !/image|tts|audio|live|embed|robot|computer/.test(m.name);
    }).map(function (m) { return m.name.replace('models/', ''); });
    list.sort(function (x, y) { const lx = /lite/.test(x) ? 0 : 1, ly = /lite/.test(y) ? 0 : 1; return lx - ly || (x < y ? 1 : -1); });   // 가벼운(lite) 모델 먼저, 그다음 최신순
  } catch (e) {}
  if (list.length) c.put('models', JSON.stringify(list), 21600);
  return list;
}
function geminiCall(sys, contents, maxTok, fast) {
  const key = P.getProperty('GEMINI_KEY');
  if (!key) throw new Error('GEMINI_KEY 없음');
  const c = CacheService.getScriptCache(), tryList = [];
  [c.get('okModel'), P.getProperty('MODEL')].concat(modelList(key)).forEach(function (m) { if (m && tryList.indexOf(m) < 0) tryList.push(m); });
  if (!tryList.length) tryList.push('gemini-3.8-flash');
  let lastErr = '';
  for (let i = 0; i < tryList.length && i < 8; i++) {
    const model = tryList[i], url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + key;
    /* 생각(thinking) 설정: 대화는 가장 짧게(빠름), 채점은 조금(정확). 모델마다 받는 설정이 달라서 되는 것을 기억해 둠 */
    const modes = fast ? ['minimal', 'b0', 'none'] : ['low', 'none'];
    const call = function (mode) {
      const cfg = { temperature: 0.8, maxOutputTokens: fast ? 512 : Math.max(maxTok || 1200, 2048), responseMimeType: 'application/json' };
      if (mode === 'minimal' || mode === 'low') cfg.thinkingConfig = { thinkingLevel: mode };
      else if (mode === 'b0') cfg.thinkingConfig = { thinkingBudget: 0 };
      return UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: contents, generationConfig: cfg }) });
    };
    const mk = 'thk_' + (fast ? 'f_' : 's_') + model, known = c.get(mk);
    let order = known ? [known].concat(modes.filter(function (m) { return m !== known; })) : modes, r, used = order[0];
    for (let q = 0; q < order.length; q++) { used = order[q]; r = call(used); if (r.getResponseCode() !== 400) break; }
    if (r.getResponseCode() === 200) c.put(mk, used, 21600);
    const code = r.getResponseCode();
    if (code === 200) {
      try {
        const j = JSON.parse(r.getContentText()), cd = j.candidates && j.candidates[0];
        const t = cd && cd.content && cd.content.parts ? cd.content.parts.map(function (x) { return x.text || ''; }).join('') : '';
        const a = t.indexOf('{'), b = t.lastIndexOf('}');
        if (a >= 0 && b > a) { c.put('okModel', model, 21600); LAST_MODEL = model; return JSON.parse(t.slice(a, b + 1)); }
        lastErr = model + ': 빈 답';
      } catch (e) { lastErr = model + ': ' + e; }
    } else {
      let msg = ''; try { msg = JSON.parse(r.getContentText()).error.message; } catch (e) {}
      lastErr = model + ' (' + code + '): ' + String(msg).slice(0, 160);
      if (c.get('okModel') === model) c.remove('okModel');
    }
  }
  throw new Error('쓸 수 있는 무료 모델이 없어요 — ' + lastErr);
}
let LAST_MODEL = '';

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
  (d.hist || []).slice(-12).forEach(function (m) {
    contents.push({ role: m.r === 'c' ? 'model' : 'user', parts: [{ text: String(m.t || '').slice(0, 500) }] });
  });
  const r = gemini(sys, contents, 600, true);
  return { ok: true, customer: String(r.customer || '').slice(0, 300), tip: String(r.tip || '').slice(0, 80), end: !!r.end };
}

function evaluate(d) {
  const sc = d.sc || {};
  const talk = (d.hist || []).slice(-30).map(function (m) { return (m.r === 'c' ? '고객: ' : '직원: ') + String(m.t || '').slice(0, 400); }).join('\n');
  const sys = '당신은 보안회사 고객응대 코치입니다. 아래 연습 통화에서 "직원"의 응대를 평가하세요.\n상황: ' + String(sc.title || '') + ' / 난이도 ' + (d.level || '중') + '\n' +
    '항목(각 0~100점): 공감·사과(감정을 먼저 받아 주고 진심으로 사과했는가), 원인 설명(왜 그런지 쉽고 정확하게 설명했는가), 해결책 제시(구체적이고 실행 가능한 다음 단계를 말했는가), 해지 방어(해지·불만을 존중하면서 계속 이용할 이유와 대안을 제시했는가). ' +
    '직원이 거의 말하지 않았으면 낮게 주세요. 잘한 점과 개선할 점은 각각 2~3개, 한 줄씩 쉬운 말로. 마지막에 "이렇게 말해 보세요" 예시 한마디(60자 이내).\n' +
    '또 모범 답안 비교: 직원이 실제로 한 말 중 가장 아쉬운 것 2~3개를 골라(원문 그대로, 40자 이내로 줄여도 됨) 각각 더 좋은 말(60자 이내, 실제 현장에서 바로 쓸 수 있는 존댓말)로 바꿔 주세요.\n' +
    '반드시 JSON만: {"scores":{"공감·사과":0,"원인 설명":0,"해결책 제시":0,"해지 방어":0},"good":["..."],"improve":["..."],"example":"...","pairs":[{"me":"직원이 한 말","better":"이렇게 말하면 더 좋아요"}]}';
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
    try { CacheService.getScriptCache().remove('board'); } catch (e) {}
    sh.appendRow([new Date(), name, String(sc.id || ''), String(d.level || ''), total, v[0], v[1], v[2], v[3], Number(d.turns) || 0]);
  }
  return { ok: true, total: total, scores: { '공감·사과': v[0], '원인 설명': v[1], '해결책 제시': v[2], '해지 방어': v[3] },
    good: (r.good || []).slice(0, 3), improve: (r.improve || []).slice(0, 3), example: String(r.example || ''), prev: prev,
    pairs: (r.pairs || []).slice(0, 3).map(function (x) { return { me: String(x.me || '').slice(0, 80), better: String(x.better || '').slice(0, 120) }; }).filter(function (x) { return x.me && x.better; }) };
}

/* 이달(한국 시간) 이름별 평균 점수 — 브리핑 '이달의 응대왕'용. 10분 동안 기억해 둠 */
function board() {
  const c = CacheService.getScriptCache(), hit = c.get('board');
  if (hit) return JSON.parse(hit);
  const ym = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM'), by = {};
  rows(800).forEach(function (r) {
    if (!r.name || Utilities.formatDate(new Date(r.t), 'Asia/Seoul', 'yyyy-MM') !== ym) return;
    const b = by[r.name] || (by[r.name] = { name: r.name, sum: 0, n: 0, best: 0 });
    b.sum += Number(r.total) || 0; b.n++; b.best = Math.max(b.best, Number(r.total) || 0);
  });
  const list = Object.keys(by).map(function (k) { const b = by[k]; return { name: b.name, avg: Math.round(b.sum / b.n), n: b.n, best: b.best }; })
    .sort(function (a, b) { return b.avg - a.avg || b.n - a.n; });
  const o = { ok: true, ym: ym, list: list };
  c.put('board', JSON.stringify(o), 600);
  return o;
}
/* 한 사람의 최근 10번 항목별 평균 */
function mine(name) {
  if (!name) return { ok: false, err: 'name' };
  const my = rows(800).filter(function (r) { return r.name === name; }).slice(-10);
  const avg = [0, 1, 2, 3].map(function (i) { return my.length ? Math.round(my.reduce(function (a, r) { return a + (Number(r.s[i]) || 0); }, 0) / my.length) : null; });
  return { ok: true, n: my.length, avg: avg, done: my.map(function (r) { return r.sc; }) };
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
