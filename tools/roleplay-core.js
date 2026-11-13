/* AI 고객 응대 롤플레잉 — 서버 동작 코드 (자동 업데이트 본체)
   이 파일은 구글 Apps Script(roleplay.gs)가 GitHub에서 5분마다 읽어 가서 실행해요.
   여기만 고치면 서버 다시 배포 없이 반영돼요. 마지막 줄의 return 은 지우지 마세요. */
const P = PropertiesService.getScriptProperties();
const HEAD = ['시각', '이름', '상황', '난이도', '총점', '공감·사과', '원인 설명', '해결책 제시', '해지 방어', '말한 횟수'];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.act === 'chat') return out(chat(d));
    if (d.act === 'eval') return out(evaluate(d));
    if (d.act === 'tts') return out(tts(d));
    if (d.act === 'live') return out(live(d));
    if (d.act === 'sug') return out(sugAdd(d));                          // 💬 건의·질문함 — 남기기 (누구나)
    if (d.act === 'sugdone') return out(sugDone(d));                      // 파트장: 확인·답변 표시
    if (d.act === 'evstart') return out(evStart(d));                      // 📝 평가 시작 (한 달 3회)
    if (d.act === 'evpick') return out(evPick(d));                        // 📝 연습 결과를 평가에 반영 (본인이 고른 것만)
    if (d.act === 'evsub') return out(evAdd(d));                          // 📝 롤플레잉 평가 — 본인이 등급을 골라 제출
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
  if (p.action === 'sugs') {   // 💬 건의·질문함 — 파트장만 (비밀번호)
    if (!P.getProperty('ADMIN_PIN') || p.pin !== P.getProperty('ADMIN_PIN')) return out({ ok: false, err: 'pin' });
    return out({ ok: true, rows: sugRows() });
  }
  if (p.action === 'evbest') {   // MVP 「AI 응대 평가」 점수용 — 월별 이름: 최고 점수
    const m = {}; const sh = evSh('평가제출', EV_HEAD), n = sh.getLastRow();
    if (n >= 2) sh.getRange(2, 1, n - 1, EV_HEAD.length).getValues().forEach(function (r) { const ym = ymOf(r[1]); (m[ym] = m[ym] || {})[String(r[2])] = Number(r[5]) || 0; });
    return out({ ok: true, m: m });
  }
  if (p.action === 'myev') return out(evMine(String(p.name || '').slice(0, 10)));   // 내 이번 달 기록 + 제출한 평가
  if (p.action === 'evsubs') {   // 📝 평가 제출 현황 — 파트장만 (비밀번호)
    if (!P.getProperty('ADMIN_PIN') || p.pin !== P.getProperty('ADMIN_PIN')) return out({ ok: false, err: 'pin' });
    return out({ ok: true, ym: ymNow(), rows: evRows() });
  }
  if (p.action === 'mysug') return out({ ok: true, rows: sugRows().filter(function (x) { return x.key && x.key === String(p.key || ''); }) });   // 내가 남긴 글의 답변 보기 (이 폰 열쇠로만)
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
  const T0 = Date.now();
  const sc = d.sc || {};
  const sys = '당신은 보안회사(에스원) 고객 응대 연습에서 "까다로운 고객" 역할을 맡은 연기자입니다.\n' +
    '상황: ' + String(sc.persona || '').slice(0, 600) + '\n난이도: ' + (d.level || '중') + ' — ' + (LV[d.level] || LV['중']) + '\n' +
    '규칙: 고객 입장에서 전화로 말하듯 1~2문장(40자 안팎, 길어도 55자)으로 짧게 말합니다. 마크다운·괄호 설명 금지. 직원의 답이 공감·사과, 원인 설명, 구체적 해결책이 충분하면 점점 누그러지고, 부족하면 불만을 이어 갑니다. ' +
    '실제 개인정보(이름·전화번호·주소)는 절대 지어내서 말하지 않습니다.\n' +
    '또 직원 마지막 말을 보고 코치 팁을 한 줄(30자 이내) 줍니다. 반말·변명·책임 떠넘기기·무성의처럼 부적절할 때만 쓰고, 괜찮으면 빈 문자열.\n' +
    '고객이 충분히 납득했거나 통화를 끝내려 하면 end를 true로 합니다.\n' +
    '반드시 JSON만: {"customer":"고객 대사","tip":"코치 팁 또는 빈 문자열","end":false}';
  const contents = [{ role: 'user', parts: [{ text: '(전화가 연결되었습니다)' }] }];
  (d.hist || []).slice(-12).forEach(function (m) {
    contents.push({ role: m.r === 'c' ? 'model' : 'user', parts: [{ text: String(m.t || '').slice(0, 500) }] });
  });
  const r = gemini(sys, contents, 600, true);
  const o = { ok: true, customer: String(r.customer || '').slice(0, 300), tip: String(r.tip || '').slice(0, 80), end: !!r.end, ms: { ai: Date.now() - T0 } };
  /* 목소리도 같은 요청 안에서 바로 만들어 붙임 — 앱이 서버를 두 번 부르지 않아도 돼서 더 빨라요 */
  if (d.tts && o.customer) {
    const T1 = Date.now();
    try { const a = tts({ text: o.customer, voice: d.tts.voice, style: d.tts.style }); if (a.ok) { o.audio = a.audio; o.rate = a.rate; o.mime = a.mime; } else o.ttsErr = a.err; }
    catch (e) { o.ttsErr = String(e); }
    o.ms.tts = Date.now() - T1;
  }
  return o;
}

function evaluate(d) {
  const sc = d.sc || {};
  const talk = (d.hist || []).slice(-30).map(function (m) { return (m.r === 'c' ? '고객: ' : '직원: ') + String(m.t || '').slice(0, 400); }).join('\n');
  const sys = '당신은 보안회사 고객응대 코치입니다. 아래 연습 통화에서 "직원"의 응대를 평가하세요.\n상황: ' + String(sc.title || '') + ' / 난이도 ' + (d.level || '중') + '\n' +
    '항목(각 0~100점): 공감·사과(감정을 먼저 받아 주고 진심으로 사과했는가), 원인 설명(왜 그런지 쉽고 정확하게 설명했는가), 해결책 제시(구체적이고 실행 가능한 다음 단계를 말했는가), 해지 방어(해지·불만을 존중하면서 계속 이용할 이유와 대안을 제시했는가). ' +
    '채점은 후하게 하세요. 현장 직원의 연습이므로 칭찬 위주로 봅니다. 고객이 결국 이해·만족하고 통화가 좋게 끝났다면 각 항목 85~100점을 주세요. 기본 예절을 지키며 응대를 끝까지 했다면 70점 이상을 주세요. ' +
    '해지 방어: 이 상황에 해지·계약 문제가 없었다면 "고객이 만족해 계속 믿고 이용하게 만들었는가"로 보고, 고객이 만족했다면 85점 이상을 주세요(0점 금지). ' +
    '직원이 거의 말하지 않았거나 고객에게 무례했을 때만 낮게 주세요. 잘한 점과 개선할 점은 각각 2~3개, 한 줄씩 쉬운 말로. 마지막에 "이렇게 말해 보세요" 예시 한마디(60자 이내).\n' +
    '또 모범 답안 비교: 직원이 실제로 한 말 중 가장 아쉬운 것 2~3개를 골라(원문 그대로, 40자 이내로 줄여도 됨) 각각 더 좋은 말(60자 이내, 실제 현장에서 바로 쓸 수 있는 존댓말)로 바꿔 주세요.\n' +
    '반드시 JSON만: {"scores":{"공감·사과":0,"원인 설명":0,"해결책 제시":0,"해지 방어":0},"good":["..."],"improve":["..."],"example":"...","pairs":[{"me":"직원이 한 말","better":"이렇게 말하면 더 좋아요"}]}';
  const r = gemini(sys, [{ role: 'user', parts: [{ text: talk || '(대화 없음)' }] }], 1200);
  const s = r.scores || {};
  const k = ['공감·사과', '원인 설명', '해결책 제시', '해지 방어'];
  const v = k.map(function (n) { return Math.max(0, Math.min(100, Math.round(Number(s[n]) || 0))); });
  /* 해지 방어가 상황에 안 맞아 0점이면 나머지 세 항목 평균으로 대신 (부당하게 깎이지 않게) */
  if (v[3] === 0 && (v[0] + v[1] + v[2]) > 0) v[3] = Math.round((v[0] + v[1] + v[2]) / 3);
  /* 후한 보정: 원점수 50→65, 70→79, 80→86, 90→93 (대화가 거의 없으면 보정 안 함) */
  const raw = v.reduce(function (a, b) { return a + b; }, 0) / 4;
  const total = Math.min(100, Math.round((d.hist || []).length >= 4 ? raw * 0.7 + 30 : raw));
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
/* 🗣️ 고객 목소리 — 구글 Gemini 음성 모델로 사람 같은 목소리 만들기 (GEMINI_KEY 필요)
   안 되면 앱이 폰 기본 목소리로 자동으로 바꿔서 읽어 줌 */
function tts(d) {
  const key = P.getProperty('GEMINI_KEY');
  if (!key) return { ok: false, err: 'nokey' };
  const text = String(d.text || '').slice(0, 400), voice = String(d.voice || 'Kore').replace(/[^A-Za-z]/g, '');
  if (!text) return { ok: false, err: 'text' };
  const c = CacheService.getScriptCache();
  const list = [P.getProperty('TTS_MODEL'), c.get('tts_ok'), 'gemini-2.5-flash-preview-tts', 'gemini-2.5-flash-tts', 'gemini-2.5-pro-preview-tts']
    .filter(function (m, i, a) { return m && a.indexOf(m) === i; });
  let last = '';
  for (let i = 0; i < list.length; i++) {
    const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + list[i] + ':generateContent?key=' + key, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ contents: [{ parts: [{ text: String(d.style || '실제 한국 사람이 전화로 말하듯 자연스럽게') + ': ' + text }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } })
    });
    const code = r.getResponseCode();
    if (code === 200) {
      const j = JSON.parse(r.getContentText());
      const part = (((j.candidates || [])[0] || {}).content || {}).parts || [];
      const au = part.filter(function (p) { return p.inlineData && p.inlineData.data; })[0];
      if (au) { c.put('tts_ok', list[i], 21600); const m = /rate=(\d+)/.exec(au.inlineData.mimeType || ''); return { ok: true, audio: au.inlineData.data, rate: m ? +m[1] : 24000, mime: au.inlineData.mimeType || '' }; }
      last = 'noaudio';
    } else { last = code + ' ' + r.getContentText().slice(0, 160); if (code === 429) break; }
  }
  return { ok: false, err: last };
}
/* 📞 실시간 통화 모드 — 폰이 구글과 바로 연결할 수 있게 '임시 키'(1번 쓰고 30분 뒤 사라짐)를 만들어 줌.
   진짜 키는 서버 밖으로 나가지 않아요. 고객 역할 지시문도 여기서 만들어서 같이 보냄 */
function liveModels(key) {
  const c = CacheService.getScriptCache(), hit = c.get('live_models');
  if (hit) return JSON.parse(hit);
  let list = [];
  try {
    const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=300&key=' + key, { muteHttpExceptions: true });
    list = (JSON.parse(r.getContentText()).models || []).filter(function (m) {
      return (m.supportedGenerationMethods || []).indexOf('bidiGenerateContent') >= 0;
    }).map(function (m) { return m.name.replace('models/', ''); });
    const rank = function (n) { return (/native-audio|live/.test(n) ? 0 : 2) + (/flash/.test(n) ? 0 : 1); };
    list.sort(function (x, y) { return rank(x) - rank(y) || (x < y ? 1 : -1); });
  } catch (e) {}
  if (!list.length) list = ['gemini-2.5-flash-native-audio-preview-12-2025', 'gemini-3.1-flash-live-preview', 'gemini-2.5-flash-native-audio-preview-09-2025'];
  c.put('live_models', JSON.stringify(list), 21600);
  return list;
}
function live(d) {
  const key = P.getProperty('GEMINI_KEY');
  if (!key) return { ok: false, err: 'nokey' };
  const sc = d.sc || {}, now = Date.now();
  const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=' + key, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ uses: 1, expireTime: new Date(now + 30 * 60000).toISOString(), newSessionExpireTime: new Date(now + 2 * 60000).toISOString() })
  });
  if (r.getResponseCode() !== 200) return { ok: false, err: 'token ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 200) };
  const tok = JSON.parse(r.getContentText()).name;
  const models = liveModels(key), pick = String(d.model || '');
  const sys = '당신은 보안회사 에스원의 고객 응대 연습에서 "까다로운 고객" 역할을 맡은 한국인 연기자입니다. 반드시 한국어로만, 실제 전화 통화하듯 자연스럽게 말합니다.\n' +
    '상황: ' + String(sc.persona || '').slice(0, 700) + '\n난이도: ' + (d.level || '중') + ' — ' + (LV[d.level] || LV['중']) + '\n' +
    '규칙: 한 번에 1~2문장으로 짧게 말하고, 직원이 말할 차례를 줍니다. 직원의 공감·사과, 원인 설명, 구체적 해결책이 충분하면 점점 누그러지고, 부족하면 불만을 이어 갑니다. ' +
    '감정은 목소리 톤으로 실감 나게 표현하되 욕설은 하지 않습니다. 실제 이름·전화번호·주소는 지어내지 않습니다. 당신은 AI라거나 연습이라는 말을 하지 않습니다.\n' +
    '첫마디는 이렇게 시작합니다: "' + String(sc.open || '') + '"';
  return { ok: true, token: tok, models: pick ? [pick].concat(models.filter(function (m) { return m !== pick; })) : models, sys: sys };
}
function sheet() {
  let id = P.getProperty('SHEET_ID'), ss;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create('AI 고객 응대 롤플레잉 기록 (북서울 Report)'); P.setProperty('SHEET_ID', ss.getId()); }
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

/* ───── 💬 건의·질문함 — 같은 기록 파일의 「건의함」 시트. 익명이면 이름 칸을 비워 저장 ───── */
const SUG_HEAD = ['시각', '이름', '분류', '내용', '확인', '답변', '열쇠'];
function sugSheet() {
  const sh0 = sheet(), ss = sh0.getParent();
  let sh = ss.getSheetByName('건의함');
  if (!sh) { sh = ss.insertSheet('건의함', ss.getSheets().length); sh.appendRow(SUG_HEAD); sh.setFrozenRows(1); }
  return sh;
}
function sugAdd(d) {
  const t = String(d.text || '').trim().slice(0, 1000);
  if (t.length < 2) return { ok: false, err: '내용을 적어 주세요' };
  const cat = ['건의', '질문', '불편', '칭찬'].indexOf(d.cat) >= 0 ? d.cat : '건의';
  const name = d.anon ? '' : String(d.name || '').slice(0, 10);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try { sugSheet().appendRow([new Date(), name, cat, t, '', '', String(d.key || '').slice(0, 40)]); } finally { lock.releaseLock(); }
  return { ok: true };
}
function sugRows() {
  const sh = sugSheet(), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, SUG_HEAD.length).getValues().map(function (r, i) {
    return { row: i + 2, t: new Date(r[0]).getTime(), name: r[1], cat: r[2], text: r[3], done: r[4] ? 1 : 0, reply: r[5], key: r[6] };
  }).reverse().slice(0, 300);
}
function sugDone(d) {
  if (!P.getProperty('ADMIN_PIN') || d.pin !== P.getProperty('ADMIN_PIN')) return { ok: false, err: 'pin' };
  const sh = sugSheet(), row = Number(d.row) || 0;
  if (row < 2 || row > sh.getLastRow()) return { ok: false, err: 'row' };
  sh.getRange(row, 5).setValue(d.done ? '확인 ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'MM/dd') : '');
  if (typeof d.reply === 'string') sh.getRange(row, 6).setValue(d.reply.slice(0, 500));
  return { ok: true };
}

/* ───── 📝 롤플레잉 평가 (서비스 전용) — 한 달에 3회까지 「평가 시작」, 그중 가장 좋은 회차를 본인이 골라 제출
   「평가회차」 시트: 회차마다 한 줄(시작 때 만들고 끝나면 점수 기록) · 「평가제출」 시트: 한 사람이 한 달에 한 줄 ───── */
const EV_MAX = 3;
const AT_HEAD = ['시작', '월', '이름', '회차', '상황', '총점', '완료'];
const EV_HEAD = ['시각', '월', '이름', '등급', '제출 회차', '점수', '소감', '확인'];
function ymNow() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM'); }
/* 시트가 '2026-11'을 날짜로 바꿔 버려서 비교가 안 되던 문제 — 읽을 때 항상 'yyyy-MM' 글자로 맞춤 */
function ymOf(v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM') : String(v).replace(/^'/, '').slice(0, 7); }
function evSh(name, head) {
  const ss = sheet().getParent();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name, ss.getSheets().length); sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}
function evGrade(t) { t = Number(t) || 0; return t >= 90 ? 'S' : t >= 80 ? 'A' : t >= 70 ? 'B' : 'C'; }
function atRows(name, ym) {
  const sh = evSh('평가회차', AT_HEAD), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, AT_HEAD.length).getValues().map(function (r, i) { return { row: i + 2, t: new Date(r[0]).getTime(), ym: ymOf(r[1]), name: String(r[2]), no: Number(r[3]) || 0, sc: r[4], total: r[5] === '' ? null : Number(r[5]), done: !!r[6] }; })
    .filter(function (x) { return x.ym === ym && x.name === name; });
}
function evStart(d) {
  const name = String(d.name || '').slice(0, 10), sc = String(d.sc || '').slice(0, 40);
  if (!name) return { ok: false, err: '이름을 먼저 골라 주세요' };
  const ym = ymNow(), lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const L = atRows(name, ym);
    if (L.length >= EV_MAX) return { ok: false, err: '이번 달 평가 3회를 모두 썼어요' };
    const no = L.length + 1;
    evSh('평가회차', AT_HEAD).appendRow([new Date(), "'" + ym, name, no, sc, '', '']);
    return { ok: true, no: no };
  } finally { lock.releaseLock(); }
}
function evPick(d) {   // 평가 회차가 끝나면 점수 기록 — 실제로 방금 AI 채점을 받은 기록이 있어야 함
  const name = String(d.name || '').slice(0, 10), sc = String(d.sc || ''), total = Number(d.total), no = Number(d.no) || 0;
  const ym = ymNow(), at = atRows(name, ym).filter(function (x) { return x.no === no; })[0];
  if (!at) return { ok: false, err: '평가 회차를 찾지 못했어요' };
  if (at.done) return { ok: true, dup: 1 };
  if (String(at.sc) !== sc) return { ok: false, err: '상황이 달라요' };
  const hit = rows(300).filter(function (r) { return r.name === name && String(r.sc) === sc && Number(r.total) === total && r.t >= at.t; })[0];
  if (!hit) return { ok: false, err: '방금 받은 점수 기록을 찾지 못했어요' };
  evSh('평가회차', AT_HEAD).getRange(at.row, 6, 1, 2).setValues([[total, '완료']]);
  evBest(name, ym);   // 3번 중 가장 좋은 점수를 자동으로 「평가제출」에 반영
  return { ok: true };
}
function evRows() {
  const sh = evSh('평가제출', EV_HEAD), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, EV_HEAD.length).getValues().map(function (r) {
    return { t: new Date(r[0]).getTime(), ym: ymOf(r[1]), name: String(r[2]), grade: r[3], no: r[4], total: r[5], text: r[6] };
  }).filter(function (x) { return x.ym === ymNow(); }).reverse();
}
function evMine(name) {
  if (!name) return { ok: false, err: 'name' };
  const ym = ymNow();
  evFix(name, ym);
  const sub = evRows().filter(function (x) { return x.name === name; })[0] || null;
  return { ok: true, ym: ym, max: EV_MAX, tries: atRows(name, ym).map(function (x) { return { no: x.no, sc: x.sc, total: x.total, done: x.done }; }), sub: sub };
}
/* 점수 기록이 빠진 회차(통신 오류 등)는 시작 후 40분 안에 같은 상황으로 받은 채점 기록으로 채움 */
function evFix(name, ym) {
  const L = atRows(name, ym), miss = L.filter(function (x) { return !x.done; });
  if (!miss.length) return;
  const R = rows(400), sh = evSh('평가회차', AT_HEAD); let ch = 0;
  miss.forEach(function (at) {
    const nx = L.filter(function (y) { return y.no === at.no + 1; })[0], end = Math.min(at.t + 40 * 60000, nx ? nx.t : Infinity);
    const hit = R.filter(function (r) { return r.name === name && String(r.sc) === String(at.sc) && r.t >= at.t && r.t <= end; })[0];
    if (hit) { sh.getRange(at.row, 6, 1, 2).setValues([[Number(hit.total) || 0, '완료']]); ch = 1; }
  });
  if (ch) evBest(name, ym);
}
function evBest(name, ym) {
  const best = atRows(name, ym).filter(function (x) { return x.done; }).sort(function (a, b) { return b.total - a.total; })[0];
  if (best) evAdd({ name: name, no: best.no, text: '' });
}
function evAdd(d) {
  const name = String(d.name || '').slice(0, 10), no = Number(d.no) || 0;
  if (!name) return { ok: false, err: '이름을 먼저 골라 주세요' };
  const ym = ymNow(), at = atRows(name, ym).filter(function (x) { return x.no === no && x.done; })[0];
  if (!at) return { ok: false, err: '제출할 회차를 골라 주세요' };
  const text = String(d.text || '').trim().slice(0, 500), lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = evSh('평가제출', EV_HEAD), n = sh.getLastRow(), vals = [new Date(), "'" + ym, name, evGrade(at.total), no, at.total, text, ''];
    let hit = 0;
    if (n >= 2) { const cur = sh.getRange(2, 2, n - 1, 2).getValues(); for (let i = 0; i < cur.length; i++) if (ymOf(cur[i][0]) === ym && String(cur[i][1]) === name) hit = i + 2; }
    if (hit) sh.getRange(hit, 1, 1, EV_HEAD.length).setValues([vals]); else sh.appendRow(vals);
  } finally { lock.releaseLock(); }
  return { ok: true, grade: evGrade(at.total) };
}

return { doPost: doPost, doGet: doGet };
