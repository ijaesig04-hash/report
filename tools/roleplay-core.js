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
    if (d.act === 'aiuse') return out(aiUse(d));                         // 💳 실시간 통화 사용량(토큰) 기록 → 추정 잔액
    if (d.act === 'aierr') return out(aiErr(String(d.msg || ''), Number(d.code) || 0));   // 💳 폰에서 난 사용량 소진 오류 알림
    if (d.act === 'balset') return out(balSet(d));                        // 💳 파트장: AI Studio 실제 잔액으로 맞추기
    if (d.act === 'sug') return out(sugAdd(d));                          // 💬 건의·질문함 — 남기기 (누구나)
    if (d.act === 'sugdone') return out(sugDone(d));                      // 파트장: 확인·답변 표시
    if (d.act === 'evstart') return out(evStart(d));                      // 📝 평가 시작 (한 달 3회)
    if (d.act === 'evpick') return out(evPick(d));                        // 📝 연습 결과를 평가에 반영 (본인이 고른 것만)
    if (d.act === 'evsub') return out(evAdd(d));
    if (d.act === 'diag') return out(diag(d));                            // 📸 AI 현장 진단 — 사진 → 기기·원인·조치
    if (d.act === 'diagfb') return out(diagFb(d));                        // 📸 진단 결과 도움 여부 / 실제 조치 남기기
    if (d.act === 'vbrief') return out(vbrief(d));                        // 🎬 AI 실적 영상 브리핑 — 내레이션 원고                          // 📝 롤플레잉 평가 — 본인이 등급을 골라 제출
    return out({ ok: false, err: 'act' });
  } catch (err) { return out({ ok: false, err: String(err) }); }
}
function doGet(e) {
  const p = (e && e.parameter) || {};
  evCleanOnce(); evCleanOnce2();
  if (p.action === 'ping') { if (p.kb) { try { kbLoad(); } catch (err) {} } return out({ ok: true }); }   // 앱을 열 때 미리 깨워 두기 (kb=1 이면 현장진단 자료도 미리 풀어 둠)
  if (p.action === 'kbinfo') return out(kbInfo());                      // 📚 현장진단 자료 연결 상태
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
  if (p.action === 'aibal') return out(aiBal());                         // 💳 AI 충전 잔액(추정) — 현황판용
  if (p.action === 'aiclaim') return out(aiClaim(String(p.ev || '')));    // 💳 알림 보내기(GitHub 5분 작업)용 — 새 사건이면 한 번만 true
  if (p.action === 'evbest') {   // MVP 「AI 응대 평가」 점수용 — 월별 이름: 최고 점수
    const m = {}; const sh = evSh('평가제출', EV_HEAD), n = sh.getLastRow();
    if (n >= 2) sh.getRange(2, 1, n - 1, EV_HEAD.length).getValues().forEach(function (r) { const ym = ymOf(r[1]); (m[ym] = m[ym] || {})[String(r[2])] = Number(r[5]) || 0; });
    return out({ ok: true, m: m });
  }
  if (p.action === 'diags') return out({ ok: true, rows: diagRows(40) });   // 📸 공개 사례 — 이름 없음
  if (p.action === 'diaglog') {   // 🔒 현장진단 질문 기록(이름 포함) — 파트장만 (비밀번호)
    if (!P.getProperty('ADMIN_PIN') || p.pin !== P.getProperty('ADMIN_PIN')) return out({ ok: false, err: 'pin' });
    return out({ ok: true, rows: diagLog(150) });
  }   // 📸 지사 현장 진단 사례 (최근)
  if (p.action === 'myev') return out(evMine(String(p.name || '').slice(0, 10)));   // 내 이번 달 기록 + 제출한 평가
  if (p.action === 'evsubs') {   // 📝 평가 제출 현황 — 파트장만 (비밀번호)
    if (!P.getProperty('ADMIN_PIN') || p.pin !== P.getProperty('ADMIN_PIN')) return out({ ok: false, err: 'pin' });
    try { evFixAll(ymNow()); } catch (e) {}
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
        try { const um = j.usageMetadata || {}; aiLog('text', model, { tin: um.promptTokenCount || 0, tout: (um.candidatesTokenCount || 0) + (um.thoughtsTokenCount || 0) }); } catch (e) {}
        if (a >= 0 && b > a) { c.put('okModel', model, 21600); LAST_MODEL = model; return JSON.parse(t.slice(a, b + 1)); }
        lastErr = model + ': 빈 답';
      } catch (e) { lastErr = model + ': ' + e; }
    } else {
      let msg = ''; try { msg = JSON.parse(r.getContentText()).error.message; } catch (e) {}
      lastErr = model + ' (' + code + '): ' + String(msg).slice(0, 160);
      aiErr(msg, code);
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
    '직원 말은 음성 인식으로 받아 적은 글자라서 잘못 적힌 단어·끊긴 문장이 섞일 수 있습니다. 엉뚱한 단어는 문맥상 원래 의도대로 이해하고, 받아쓰기 오류는 절대 감점하지 마세요. ' +
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
      try { const um = j.usageMetadata || {}; aiLog('tts', list[i], { tin: um.promptTokenCount || 0, aout: um.candidatesTokenCount || 0 }); } catch (e) {}
      if (au) { c.put('tts_ok', list[i], 21600); const m = /rate=(\d+)/.exec(au.inlineData.mimeType || ''); return { ok: true, audio: au.inlineData.data, rate: m ? +m[1] : 24000, mime: au.inlineData.mimeType || '' }; }
      last = 'noaudio';
    } else { last = code + ' ' + r.getContentText().slice(0, 160); aiErr(r.getContentText().slice(0, 300), code); if (code === 429) break; }
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
  if (r.getResponseCode() !== 200) { aiErr(r.getContentText().slice(0, 300), r.getResponseCode()); return { ok: false, err: 'token ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 200) }; }
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
/* ===== 💳 AI 충전 잔액(추정) =====
   구글은 선불 잔액을 앱에서 읽을 수 있게 열어 주지 않아서, 쓸 때마다 구글이 알려 주는 토큰 수 × 단가로 사용액을 추정해 빼 나감.
   파트장이 AI Studio 실제 잔액을 입력하면(balset) 그 값을 새 기준으로 다시 시작 → 오차가 쌓이지 않음.
   단가(달러/100만 토큰, 유료 1단계 기준 · 넉넉하게): 실시간 통화 텍스트 입력 0.5 · 음성 입력 3 · 텍스트 출력 2 · 음성 출력 12
   / 대사·채점(Flash) 입력 0.75 · 출력 3.75 / 목소리(TTS) 입력 0.5 · 음성 출력 10. 환율은 스크립트 속성 KRW (기본 1450) */
const AI_RATE = { live: { tin: 0.5, ain: 3, tout: 2, aout: 12 }, text: { tin: 0.75, tout: 3.75 }, tts: { tin: 0.5, aout: 10 } };
const USE_HEAD = ['시각', '종류', '이름', '모델', '입력(텍스트)', '입력(음성)', '출력(텍스트)', '출력(음성)', '추정(원)'];
function aiWon(kind, u) {
  const R = AI_RATE[kind] || AI_RATE.text, krw = Number(P.getProperty('KRW')) || 1450;
  const usd = ((u.tin || 0) * (R.tin || 0) + (u.ain || 0) * (R.ain || R.tin || 0) + (u.tout || 0) * (R.tout || 0) + (u.aout || 0) * (R.aout || R.tout || 0)) / 1e6;
  return Math.round(usd * krw * 100) / 100;
}
function aiLog(kind, model, u, name) {
  const won = aiWon(kind, u); if (!(won > 0)) return 0;
  const lock = LockService.getScriptLock(); try { lock.waitLock(5000); } catch (e) {}
  try {
    P.setProperty('AI_USED', String((Number(P.getProperty('AI_USED')) || 0) + won));
    const day = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'), dk = 'AI_DAY_' + day, prev = JSON.parse(P.getProperty('AI_DAY') || '{}');
    const cur = prev.d === day ? prev : { d: day, n: 0, won: 0 }; cur.won = Math.round((cur.won + won) * 100) / 100; if (kind === 'live' || kind === 'evalx') cur.n++;
    P.setProperty('AI_DAY', JSON.stringify(cur));
    if (P.getProperty('AI_EMPTY')) { P.deleteProperty('AI_EMPTY'); }   // 다시 잘 되면 '소진' 표시 해제
  } finally { try { lock.releaseLock(); } catch (e) {} }
  try { evSh('AI사용', USE_HEAD).appendRow([new Date(), kind, String(name || '').slice(0, 10), String(model || '').slice(0, 60), u.tin || 0, u.ain || 0, u.tout || 0, u.aout || 0, won]); } catch (e) {}
  return won;
}
function aiUse(d) {
  const u = d.u || {}, f = function (x) { return Math.max(0, Math.min(5e6, Number(x) || 0)); };
  const won = aiLog('live', d.model, { tin: f(u.tin), ain: f(u.ain), tout: f(u.tout), aout: f(u.aout) }, d.name);
  return { ok: true, won: won };
}
/* 사용량 소진 감지 — 선불 잔액 소진(depleted·prepay·credit) 오류는 바로, '한도 초과(quota)'는 10분에 5번 넘게 나면 소진으로 봄 */
function aiErr(msg, code) {
  msg = String(msg || ''); if (!msg && !code) return { ok: true };
  const hard = /depleted|prepay/i.test(msg), quota = (code === 429 || /RESOURCE_EXHAUSTED/.test(msg)) && /quota|exhausted/i.test(msg);
  if (!hard && !quota) return { ok: true };
  let hit = hard;
  if (!hard) {
    const c = CacheService.getScriptCache(), n = (Number(c.get('ai_q')) || 0) + 1; c.put('ai_q', String(n), 600); hit = n >= 5;
  }
  if (hit && !P.getProperty('AI_EMPTY')) P.setProperty('AI_EMPTY', JSON.stringify({ at: Date.now(), msg: msg.slice(0, 160), id: 'e' + Date.now() }));
  return { ok: true, empty: hit };
}
function aiBal() {
  if (P.getProperty('AI_BASE_V') !== '2') { P.setProperty('AI_BASE', '19927'); P.setProperty('AI_BASE_AT', String(Date.now())); P.setProperty('AI_USED', '0'); P.setProperty('AI_BASE_V', '2'); }   // 11/18 13:51 AI Studio 실제 잔액 ₩19,927 (11/17 ₩20,000 충전)
  const base = Number(P.getProperty('AI_BASE')) || 0, used = Math.round(Number(P.getProperty('AI_USED')) || 0);
  const day = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'), dd = JSON.parse(P.getProperty('AI_DAY') || '{}');
  let empty = null; try { empty = JSON.parse(P.getProperty('AI_EMPTY') || 'null'); } catch (e) {}
  const est = Math.max(0, base - used);
  return { ok: true, base: base, at: Number(P.getProperty('AI_BASE_AT')) || 0, used: used, est: est, low: est < 2000, empty: empty,
    today: dd.d === day ? { n: dd.n, won: Math.round(dd.won) } : { n: 0, won: 0 } };
}
function balSet(d) {
  if (!P.getProperty('ADMIN_PIN') || String(d.pin) !== P.getProperty('ADMIN_PIN')) return { ok: false, err: 'pin' };
  const won = Math.round(Number(d.won)); if (!(won >= 0)) return { ok: false, err: 'won' };
  P.setProperty('AI_BASE', String(won)); P.setProperty('AI_BASE_AT', String(Date.now())); P.setProperty('AI_USED', '0');
  P.deleteProperty('AI_EMPTY'); P.deleteProperty('AI_CLAIM_low');
  return aiBal();
}
/* 알림은 사건마다 한 번만: empty(소진) · low(2천 원 미만) */
function aiClaim(ev) {
  const b = aiBal(); let id = '';
  if (ev === 'empty' && b.empty) id = b.empty.id;
  if (ev === 'low' && b.low && !b.empty) id = 'l' + b.at;
  if (!id) return { ok: true, claim: false, bal: b };
  const k = 'AI_CLAIM_' + ev; if (P.getProperty(k) === id) return { ok: true, claim: false, bal: b };
  P.setProperty(k, id); return { ok: true, claim: true, bal: b };
}
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
  const name = String(d.name || '').slice(0, 10), sc = String(d.sc || ''), no = Number(d.no) || 0; let total = Number(d.total);
  const ym = ymNow(), at = atRows(name, ym).filter(function (x) { return x.no === no; })[0];
  if (!at) return { ok: false, err: '평가 회차를 찾지 못했어요' };
  if (at.done) return { ok: true, dup: 1 };
  if (String(at.sc) !== sc) return { ok: false, err: '상황이 달라요' };
  /* 방금 받은 채점 기록 — 점수가 같으면 그것, 아니면 시작 뒤 같은 상황의 가장 최근 기록 */
  const cand = rows(400).filter(function (r) { return String(r.name).trim() === name && String(r.sc) === sc && r.t >= at.t - 60000; });
  const hit = cand.filter(function (r) { return Number(r.total) === total; })[0] || cand[cand.length - 1];
  if (hit) total = Number(hit.total) || total;
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
/* 점수 기록이 빠진 회차(통신 오류 등)는 시작 후 90분 안에 같은 상황으로 받은 채점 기록으로 채움 */
function evFix(name, ym) {
  const L = atRows(name, ym), miss = L.filter(function (x) { return !x.done; });
  if (!miss.length) return;
  const R = rows(400), sh = evSh('평가회차', AT_HEAD); let ch = 0;
  miss.forEach(function (at) {
    const nx = L.filter(function (y) { return y.no === at.no + 1; })[0], end = Math.min(at.t + 90 * 60000, nx ? nx.t : Infinity);
    const hit = R.filter(function (r) { return String(r.name).trim() === name && String(r.sc) === String(at.sc) && r.t >= at.t - 60000 && r.t <= end; })[0];
    if (hit) { sh.getRange(at.row, 6, 1, 2).setValues([[Number(hit.total) || 0, '완료']]); ch = 1; }
  });
  if (ch) evBest(name, ym);
}
/* 한 번만 실행되는 정리 — 2026-11 이수열 이름으로 들어간 평가 기록은 파트장 테스트라서 삭제 (11/17 요청)
   평가제출·평가회차 두 시트에서 지우므로 이수열 본인은 이번 달 3회를 처음부터 쓸 수 있음 */
function evCleanOnce() {
  const KEY = 'EVCLEAN_202611_LSY';
  if (P.getProperty(KEY)) return;
  const lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
  try {
    if (P.getProperty(KEY)) return;
    [['평가제출', EV_HEAD], ['평가회차', AT_HEAD]].forEach(function (x) {
      const sh = evSh(x[0], x[1]), n = sh.getLastRow(); if (n < 2) return;
      const v = sh.getRange(2, 2, n - 1, 2).getValues();
      for (let i = v.length - 1; i >= 0; i--) if (ymOf(v[i][0]) === '2026-11' && String(v[i][1]).trim() === '이수열') sh.deleteRow(i + 2);
    });
    P.setProperty(KEY, String(new Date()));
  } finally { lock.releaseLock(); }
}
/* 한 번만 — 직원 현황에서 홍길동·이재식(테스트) 11월 기록 삭제 (11/17 요청, 이재식2·이재식3은 그대로) */
function evCleanOnce2() {
  const KEY = 'EVCLEAN_202611_TEST2';
  if (P.getProperty(KEY)) return;
  const lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
  try {
    if (P.getProperty(KEY)) return;
    const DEL = ['홍길동', '이재식'];
    [['평가제출', EV_HEAD], ['평가회차', AT_HEAD]].forEach(function (x) {
      const sh = evSh(x[0], x[1]), n = sh.getLastRow(); if (n < 2) return;
      const v = sh.getRange(2, 2, n - 1, 2).getValues();
      for (let i = v.length - 1; i >= 0; i--) if (ymOf(v[i][0]) === '2026-11' && DEL.indexOf(String(v[i][1]).trim()) >= 0) sh.deleteRow(i + 2);
    });
    P.setProperty(KEY, String(new Date()));
  } finally { lock.releaseLock(); }
}
/* 직원 현황을 열 때 — 점수 기록이 빠진 회차가 있는 사람은 모두 자동 보정 */
function evFixAll(ym) {
  const sh = evSh('평가회차', AT_HEAD), n = sh.getLastRow(); if (n < 2) return;
  const seen = {};
  sh.getRange(2, 1, n - 1, AT_HEAD.length).getValues().forEach(function (r) { if (ymOf(r[1]) === ym && !r[6]) seen[String(r[2])] = 1; });
  Object.keys(seen).forEach(function (nm) { evFix(nm, ym); });
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

/* ───── 📸 AI 현장 진단 — 사진·글·음성 질문 → 매뉴얼·장애사례(kb/kb.dat) 근거로 답. 사례는 「현장진단」 시트에 쌓임 ───── */
const DIAG_HEAD = ['시각', '이름', '기기', '증상', '원인', '조치', '확신도', '도움', '실제 조치', '번호', '질문'];   // 11/24 '질문'(원문) 추가 — 파트장만 보는 diaglog용

/* 📚 지식베이스: GitHub의 kb/kb.dat (매뉴얼·장애사례 조각, gzip + ChaCha20 암호화). 열쇠는 스크립트 속성 KB_KEY에만 있음.
   한 번 풀면 6시간 캐시. 새 자료는 tools/kb_build.py --add 로 kb.dat만 바꾸면 자동 반영 */
const KB_URL = 'https://raw.githubusercontent.com/ijaesig04-hash/report/main/kb/kb.dat';
let KB_MEM = null;
function kbCrypt(sb, keyStr) {
  const kd = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, keyStr, Utilities.Charset.UTF_8).map(function (b) { return b & 255; });
  const k = []; for (let i = 0; i < 8; i++) k.push((kd[i * 4] | (kd[i * 4 + 1] << 8) | (kd[i * 4 + 2] << 16) | (kd[i * 4 + 3] << 24)) >>> 0);
  const n = sb.length, outA = new Array(n), st = new Uint32Array(16), x = new Uint32Array(16);
  function R(v, c) { return ((v << c) | (v >>> (32 - c))) >>> 0; }
  function Q(a, b, c, d) {
    x[a] = x[a] + x[b]; x[d] = R(x[d] ^ x[a], 16); x[c] = x[c] + x[d]; x[b] = R(x[b] ^ x[c], 12);
    x[a] = x[a] + x[b]; x[d] = R(x[d] ^ x[a], 8); x[c] = x[c] + x[d]; x[b] = R(x[b] ^ x[c], 7);
  }
  for (let blk = 0; blk * 64 < n; blk++) {
    st[0] = 0x61707865; st[1] = 0x3320646e; st[2] = 0x79622d32; st[3] = 0x6b206574;
    for (let i = 0; i < 8; i++) st[4 + i] = k[i];
    st[12] = blk; st[13] = 0; st[14] = 0; st[15] = 0;
    x.set(st);
    for (let r = 0; r < 10; r++) { Q(0, 4, 8, 12); Q(1, 5, 9, 13); Q(2, 6, 10, 14); Q(3, 7, 11, 15); Q(0, 5, 10, 15); Q(1, 6, 11, 12); Q(2, 7, 8, 13); Q(3, 4, 9, 14); }
    const o = blk * 64;
    for (let i = 0; i < 64 && o + i < n; i++) {
      const w = (x[i >> 2] + st[i >> 2]) >>> 0, kb = (w >>> ((i & 3) * 8)) & 255;
      outA[o + i] = (((sb[o + i] & 255) ^ kb) << 24) >> 24;
    }
  }
  return outA;
}
function kbLoad() {
  if (KB_MEM) return KB_MEM;
  const key = P.getProperty('KB_KEY'); if (!key) return null;
  const c = CacheService.getScriptCache(), n = Number(c.get('kb_n') || 0);
  let gz = '';
  if (n) { const ks = []; for (let i = 0; i < n; i++) ks.push('kb_' + i); const m = c.getAll(ks); if (ks.every(function (q) { return m[q]; })) gz = ks.map(function (q) { return m[q]; }).join(''); }
  /* 10분마다 GitHub에 kb.dat가 바뀌었는지만 확인 (ETag) — 바뀌었으면 새로 풀기. 새 매뉴얼이 10분 안에 반영됨 */
  let fresh = null;
  if (gz && !c.get('kb_chk')) {
    try {
      const et = c.get('kb_etag') || '';
      const h = UrlFetchApp.fetch(KB_URL, { muteHttpExceptions: true, headers: et ? { 'If-None-Match': et } : {} });
      c.put('kb_chk', '1', 600);
      if (h.getResponseCode() === 200) { const ne = h.getHeaders()['ETag'] || h.getHeaders()['Etag'] || ''; if (!et || ne !== et) { fresh = h; gz = ''; } }
    } catch (e) {}
  }
  if (!gz) {
    const r = fresh || UrlFetchApp.fetch(KB_URL + '?t=' + Date.now(), { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return null;
    gz = Utilities.base64Encode(kbCrypt(Utilities.base64Decode(r.getContentText().trim()), key));
    const put = {}, SZ = 90000; let cnt = 0;
    for (let i = 0; i < gz.length; i += SZ) put['kb_' + (cnt++)] = gz.slice(i, i + SZ);
    const hd = r.getHeaders ? r.getHeaders() : {};
    try { c.putAll(put, 21600); c.put('kb_n', String(cnt), 21600); c.put('kb_etag', hd['ETag'] || hd['Etag'] || '', 21600); c.put('kb_chk', '1', 600); } catch (e) {}
  }
  const txt = Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(gz), 'application/x-gzip', 'kb.gz')).getDataAsString('UTF-8');
  KB_MEM = JSON.parse(txt);
  return KB_MEM;
}
function kbInfo() {
  if (!P.getProperty('KB_KEY')) return { ok: true, key: false };
  try { const kb = kbLoad(); if (!kb) return { ok: true, key: true, docs: 0 };
    const t = {}; kb.c.forEach(function (x) { if (x.k !== 'memo') t[x.t] = 1; });
    return { ok: true, key: true, docs: Object.keys(t).length, v: kb.v };
  } catch (e) { return { ok: false, key: true, err: String(e).slice(0, 120) }; }
}
function kbNorm(s) { return String(s || '').toLowerCase().replace(/[\s\-_·.,:;()\[\]{}"'“”‘’\/|]/g, ''); }
const KB_SYS = { '세콤듀얼R': ['듀얼r'], '세콤듀얼': ['세콤듀얼'], '세콤365': ['365'], '세콤365R': ['365r', '365'], '세콤마스터': ['마스터'], '세콤스마트': ['세콤스마트'],
  '세콤아트': ['세콤아트'], '세콤V': ['세콤v'], 'SBMS': ['sbms'], '세콤링크': ['세콤링크'], '세콤링크Pro': ['링크pro'], '영상기기': ['영상', 'nvr', '웹게이트', 'idis', 'smartviewer', 'ip카메라', '포트포워딩'],
  'SVMS': ['svms'], '리더기': ['리더', 'cdr10036', '통신변환기'], '세콤매니저': ['세콤매니저'], '액세스매니저': ['액세스매니저', 's1access'], 'S-1 ACCESS': ['s1access', '액세스'], '모두앱': ['모두'] };
function kbSearch(kb, terms, sys, limit) {
  const C = kb.c;
  if (!kb._n) { kb._n = C.map(function (d) { return kbNorm(d.x); }); kb._t = C.map(function (d) { return kbNorm(d.t); }); }
  const N = C.length, sc = new Array(N).fill(0), seen = {};
  terms.forEach(function (o) {
    const t = kbNorm(o.t); if (t.length < 2 || seen[t]) return; seen[t] = 1;
    const hits = []; for (let i = 0; i < N; i++) if (C[i].k !== 'memo' && kb._n[i].indexOf(t) >= 0) hits.push(i);
    if (!hits.length) return;
    const idf = Math.log(1 + N / hits.length);
    hits.forEach(function (i) { const cnt = kb._n[i].split(t).length - 1; sc[i] += (1 + Math.min(cnt, 4) * 0.5) * idf * o.w + (kb._t[i].indexOf(t) >= 0 ? idf * o.w * 1.5 : 0); });
  });
  const sk = (KB_SYS[sys] || (sys ? [kbNorm(sys)] : []));
  for (let i = 0; i < N; i++) if (sc[i] > 0) {
    if (sk.some(function (q) { return kb._t[i].indexOf(q) >= 0; })) sc[i] *= 1.6;
    if (C[i].k === 'case') sc[i] *= 1.2;
    if (/목\s?차/.test(C[i].x.slice(0, 40))) sc[i] *= 0.4;   // 목차 조각은 내용이 없어 뒤로
  }
  const order = sc.map(function (v, i) { return [v, i]; }).filter(function (a) { return a[0] > 0; }).sort(function (a, b) { return b[0] - a[0]; });
  const per = {}, res = [];
  for (let q = 0; q < order.length && res.length < limit; q++) { const d = C[order[q][1]]; per[d.t] = (per[d.t] || 0) + 1; if (per[d.t] <= 3) res.push(d); }
  return res;
}

const DIAG_PLAN = ['너는 에스원(세콤) 기기 자료 검색 도우미다. 현장 근무자의 질문(사진·글)을 보고 자료 검색어를 뽑는다.',
  '사진에 모델명·라벨·표시등·화면 글자가 보이면 그대로 읽어 검색어에 넣는다. 말로 한 질문은 오타·발음 표기를 바로잡는다 (예: 듀얼알→듀얼R, 삼육오→365).',
  'sys는 다음 중 하나: 세콤듀얼R, 세콤듀얼, 세콤365, 세콤365R, 세콤마스터, 세콤스마트, 세콤아트, 세콤V, SBMS, 세콤링크, 세콤링크Pro, 영상기기, SVMS, 리더기, 세콤매니저, 액세스매니저, S-1 ACCESS, 모두앱, 모름',
  'JSON만: {"sys":"","dev":"기기·모델(모르면 빈칸)","kind":"장애|사용법|결선사양|고객안내|기타","kw":["검색어 4~10개: 모델코드, 신호코드(BB·CM 등), 증상, 메뉴·기능 이름, 부품"],"q":"질문을 한 줄로 정리"}'].join('\n');
const DIAG_SYS = [
  '너는 에스원(세콤) 북서울지사 현장 근무자(출동·기술)를 돕는 20년 경력 기술 선배다. 근무자가 현장에서 기술적으로 막혔을 때, 기기 사용·설정 방법이 궁금할 때, 장애 내용을 물을 때 짧고 정확하게 답한다.',
  '[참고 자료]와 [핵심 메모]는 에스원 공식 매뉴얼·장애사례 발췌다. 이것을 1순위 근거로 쓰고, 자료의 수치·메뉴 이름·버튼·코드·IP·포트는 그대로 옮긴다. 같은 내용이 여러 판이면 최신판을 따른다.',
  '자료에 없는 내용은 일반 지식으로 답하되 answer나 seen에 "자료에 없음 — 일반 지식"이라고 밝히고 conf를 60 이하로 둔다. 모델명·오류코드를 지어내지 않는다. 확실하지 않으면 무엇을 확인·촬영하면 되는지 more에 쓴다.',
  '현장에서 바로 할 수 있는 조치를 순서대로 쓰고(버튼·메뉴 이름 포함), 기술팀·A/S 요청이 필요한 조건을 call에 분명히 쓴다.',
  '전기·사다리·고객 재산 관련 안전 주의는 꼭 넣는다. 고객 비밀번호를 묻거나 대신 설정하는 조치는 쓰지 않는다(영상기기 비밀번호는 고객이 직접 설정하도록 안내). 관리자·복구 계정 같은 내부 정보는 "고객 안내 금지"라고 표시한다.',
  '질문 종류에 맞춰 채운다: 장애 → causes·steps 중심 / 사용법·설정 → answer에 순서대로 / 결선·사양 → answer에 항목별로 / 고객안내 → say 중심. 해당 없는 칸은 빈칸·빈 배열.',
  '반드시 JSON만 출력: {"type":"장애|사용법|결선사양|고객안내|기타","title":"핵심 결론 한 줄(30자 안팎)","device":"기기 이름(추정이면 \'추정\' 표시)","seen":"사진에서 본 근거 한두 줄(사진 없으면 빈칸)","symptom":"증상·질문 요약",',
  '"causes":[{"c":"원인","p":"높음|보통|낮음"}] (최대 3개),"steps":["현장 조치 1", ...] (3~7개, 짧은 명령형),"answer":"설명형 답 (줄바꿈 \\n, 5~12줄)",',
  '"call":"기술팀·A/S 요청 조건 (없으면 빈칸)","safety":"안전 주의 한 줄 (없으면 빈칸)","say":"고객에게 할 안내 멘트 한두 문장 (필요할 때만)","more":"추가로 확인·촬영할 것 (없으면 빈칸)","refs":["근거로 쓴 자료 제목 (참고 자료의 《》 안 제목 그대로, 최대 3개)"],"conf":0~100}',
  '모든 문장은 한국어, 존댓말 없이 간결하게 (say만 존댓말).'
].join('\n');
function diagSh() { const sh = evSh('현장진단', DIAG_HEAD); try { if (!sh.getRange(1, 11).getValue()) sh.getRange(1, 11).setValue('질문'); } catch (e) {} return sh; }
function diag(d) {
  const imgs = (d.imgs || []).slice(0, 3).filter(function (x) { return x && String(x).length < 2500000; });
  const q = String(d.q || d.memo || '').slice(0, 1500), name = String(d.name || '').slice(0, 10);
  const kind = String(d.kind || '').slice(0, 10), sysSel = String(d.sys || '').slice(0, 20), prev = String(d.prev || '').slice(0, 1500);
  if (!imgs.length && !q.trim()) return { ok: false, err: 'empty' };
  const imgParts = imgs.map(function (b) { return { inlineData: { mimeType: 'image/jpeg', data: String(b).replace(/^data:[^,]+,/, '') } }; });
  /* 1단계: 사진·질문에서 시스템·검색어 뽑기 (빠른 모드) */
  let plan = {};
  try { plan = geminiCall(DIAG_PLAN, [{ role: 'user', parts: imgParts.concat([{ text: (sysSel ? '근무자가 고른 시스템: ' + sysSel + '\n' : '') + (kind ? '질문 종류: ' + kind + '\n' : '') + (prev ? '이전 대화: ' + prev.slice(0, 400) + '\n' : '') + '질문: ' + (q || '(사진만 보냄)') }]) }], 500, true) || {}; } catch (e) {}
  const sys = sysSel || (plan.sys && plan.sys !== '모름' ? plan.sys : '');
  /* 2단계: 자료 검색 */
  let ctx = '', memo = '', titles = [], kbOn = false;
  try {
    const kb = kbLoad();
    if (kb) {
      kbOn = true;
      memo = kb.c.filter(function (x) { return x.k === 'memo'; }).map(function (x) { return x.x; }).join('\n').slice(0, 12000);
      const terms = [];
      (plan.kw || []).forEach(function (t) { terms.push({ t: t, w: 1 }); });
      if (plan.dev) terms.push({ t: plan.dev, w: 1.3 });
      (String(q + ' ' + (plan.dev || '')).match(/[A-Za-z]{1,5}-?\d{2,6}[A-Za-z]?/g) || []).forEach(function (t) { terms.push({ t: t, w: 1.5 }); });
      String(q).split(/[\s,.?!]+/).forEach(function (t) { if (t.length >= 2) terms.push({ t: t.replace(/(은|는|이|가|을|를|에|에서|으로|로|의|도|만|요|해요|돼요|안돼요)$/, ''), w: 0.5 }); });
      const hits = kbSearch(kb, terms, sys, 8);
      let used = 0;
      ctx = hits.filter(function (h) { used += h.x.length; return used < 13000; }).map(function (h) { if (titles.indexOf(h.t) < 0) titles.push(h.t); return '《' + h.t + '》\n' + h.x; }).join('\n\n---\n\n');
    }
  } catch (e) {}
  /* 지사에 쌓인 비슷한 사례(도움 됐던 것) */
  let ref = '';
  try { const rs = diagRows(60).filter(function (r) { return r.fix || r.ok === '도움'; }).slice(0, 6);
    if (rs.length) ref = '\n\n[북서울 지사 과거 사례 — 참고만]\n' + rs.map(function (r) { return '- ' + r.dev + ' / ' + r.sym + ' → ' + (r.fix || r.cause); }).join('\n'); } catch (e) {}
  const kindU = kind || (plan.kind && plan.kind !== '기타' ? plan.kind : '');
  const txt = (kindU ? '질문 종류: ' + kindU + '\n' : '') + (sys ? '시스템: ' + sys + '\n' : '') + (plan.dev ? '추정 기기: ' + plan.dev + '\n' : '') +
    '근무자 질문: ' + (q || '(사진만 보냄 — 사진을 보고 판단)') + (prev ? '\n\n[이전 대화 — 이어서 묻는 중]\n' + prev : '') +
    '\n\n[참고 자료 — 에스원 매뉴얼·장애사례 발췌]\n' + (ctx || '(관련 자료를 못 찾음)') + ref + '\n\nJSON으로 답해.';
  let j;
  try { j = geminiCall(DIAG_SYS + (memo ? '\n\n[핵심 메모]\n' + memo : ''), [{ role: 'user', parts: imgParts.concat([{ text: txt }]) }], 2600, false); }
  catch (err) { return { ok: false, err: String(err).slice(0, 200) }; }
  j.refs = (j.refs || []).filter(function (t) { return titles.indexOf(t) >= 0; });
  if (!j.refs.length && titles.length && Number(j.conf) > 60) j.refs = titles.slice(0, 2);
  const no = 'D' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'MMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  try { diagSh().appendRow([new Date(), name, String(j.device || sys || '').slice(0, 60), String((imgs.length ? '📷 ' : '') + (j.symptom || q)).slice(0, 120),
    ((j.causes || [])[0] || {}).c || String(j.title || '').slice(0, 80), ((j.steps || []).length ? j.steps.slice(0, 3).join(' → ') : String(j.answer || '')).slice(0, 300), Number(j.conf) || 0, '', '', no, String((imgs.length ? '[사진 ' + imgs.length + '장] ' : '') + (prev ? '[이어서] ' : '') + q).slice(0, 600)]); } catch (e) {}
  j.ok = true; j.no = no; j.model = LAST_MODEL; j.kb = kbOn; j.sys = sys; return j;
}
function diagFb(d) {
  const no = String(d.no || ''); if (!no) return { ok: false };
  const sh = diagSh(), n = sh.getLastRow(); if (n < 2) return { ok: false };
  const ids = sh.getRange(2, 10, n - 1, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === no) {
    if (d.ok) sh.getRange(i + 2, 8).setValue(String(d.ok).slice(0, 10));
    if (d.fix != null) sh.getRange(i + 2, 9).setValue(String(d.fix).slice(0, 200));
    return { ok: true };
  }
  return { ok: false };
}
function diagRows(limit) {
  const sh = diagSh(), n = sh.getLastRow(); if (n < 2) return [];
  const cnt = Math.min(limit, n - 1);
  return sh.getRange(n - cnt + 1, 1, cnt, DIAG_HEAD.length).getValues().reverse().map(function (r) {
    return { t: new Date(r[0]).getTime(), dev: r[2], sym: r[3], cause: r[4], step: r[5], conf: r[6], ok: r[7], fix: r[8] };   // 11/24: 공개 사례에는 이름을 빼고 보냄
  });
}
/* 🔒 누가 어떤 질문을 했는지 — 파트장만 (ADMIN_PIN). 접속 현황 화면에서 이재식만 부름 */
function diagLog(limit) {
  const sh = diagSh(), n = sh.getLastRow(); if (n < 2) return [];
  const cnt = Math.min(limit, n - 1);
  return sh.getRange(n - cnt + 1, 1, cnt, 11).getValues().reverse().map(function (r) {
    return { t: new Date(r[0]).getTime(), name: r[1], dev: r[2], q: r[10] || r[3], sym: r[3], conf: r[6], ok: r[7] };
  });
}

/* ───── 🎬 AI 실적 영상 브리핑 — 앱이 보낸 지표 요약으로 장면별 내레이션 원고를 씀 ───── */
function vbrief(d) {
  const data = JSON.stringify(d.data || {}).slice(0, 6000), ids = (d.scenes || []).slice(0, 10);
  const sys = ['너는 에스원 북서울지사 월간 실적 영상의 내레이터 원고 작가다.',
    '아래 장면 목록 순서대로, 장면마다 한국어 내레이션 1~2문장(40~80자)을 쓴다. 뉴스 앵커처럼 또렷하고 힘 있게, 존댓말.',
    '숫자는 데이터에 있는 것만 쓰고 절대 지어내지 않는다. 숫자는 읽기 쉽게 (예: 9.88점, 3위).',
    '잘한 점은 구체적으로 칭찬하고, 약한 지표는 다음 달 과제로 긍정적으로 말한다. 직원 개인을 깎아내리지 않는다.',
    '반드시 JSON만: {"lines":{"장면id":"내레이션", ...},"title":"영상 제목(15자 이내)","one":"총평 한 줄(30자 이내)"}'].join('\n');
  try {
    const j = geminiCall(sys, [{ role: 'user', parts: [{ text: '장면 목록: ' + ids.join(', ') + '\n데이터: ' + data }] }], 1500, false);
    j.ok = true; return j;
  } catch (err) { return { ok: false, err: String(err).slice(0, 200) }; }
}

return { doPost: doPost, doGet: doGet };
