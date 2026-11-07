// 북서울 Report 화면 점검 — 휴대폰 크기(390px)로 열어 탭마다 캡처하고 오류를 찾는다
// 사용: node tools/screen_check.js [html파일] [저장폴더]
//   보는 사람을 바꾸려면 앞에 BSR_ME=이름 (기본: 이재식 — '누구신가요?' 화면을 건너뜀)
//   예) node tools/screen_check.js index.html /tmp/shots
// 결과: 저장폴더/탭이름.png + 화면에 탭별 결과 · 오류 목록. 오류가 있으면 종료코드 1
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const file = path.resolve(process.argv[2] || 'index.html');
const out = path.resolve(process.argv[3] || 'screen_check_out');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  // '누구신가요?' 선택·첫 안내창을 건너뛰도록 휴대폰에 저장된 값처럼 미리 넣어 둠
  const me = process.env.BSR_ME || '이재식';
  await ctx.addInitScript(n => { try { localStorage.setItem('bsr_me', n); localStorage.setItem('bsr_darktip', '1'); localStorage.setItem('bsr_inst_snz', String(Date.now())); } catch (e) {} }, me);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push({ tab: cur, msg: String(e.message || e).slice(0, 200) }));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push({ tab: cur, msg: 'console: ' + m.text().slice(0, 200) }); });
  // 바깥 인터넷(구글 시트·푸시 서버 등)은 막고 파일 자체만 점검
  await page.route('**/*', r => (r.request().url().startsWith('file:') || r.request().url().startsWith('data:')) ? r.continue() : r.abort());
  let cur = '시작';
  await page.goto('file://' + file, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(1500);

  const ver = await page.$eval('meta[name="bsr-ver"]', m => m.content).catch(() => '(없음)');
  const tabs = await page.$$eval('#tabs [role=tab]', bs => bs.filter(b => !b.hidden).map(b => ({ id: b.dataset.tab, name: b.textContent.trim() })));
  const rows = [];
  for (const t of tabs) {
    cur = t.name;
    const before = errors.length;
    // 화면 위에 창이 떠 있어도 기다리지 않고 탭을 바로 누름
    await page.$eval(`#tabs [role=tab][data-tab="${t.id}"]`, b => b.click()).catch(e => errors.push({ tab: cur, msg: '탭 누르기 실패: ' + e.message.slice(0, 120) }));
    await page.waitForTimeout(700);
    // 가로로 화면이 넘치는지(휴대폰에서 옆으로 밀리는 현상)
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (wide > 2) errors.push({ tab: cur, msg: `화면이 옆으로 ${wide}px 넘침` });
    // 공통 머리 그림은 건너뛰고, 탭 줄부터 그 탭 내용이 보이게 캡처
    await page.evaluate(() => { const el = document.getElementById('tabs'); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 4); });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(out, `${t.id}.png`), fullPage: false });
    rows.push(`${errors.length > before ? '❌' : '✅'} ${t.name} (${t.id}.png)`);
    console.error('  · ' + rows[rows.length - 1]);
  }
  await browser.close();

  console.log(`화면 점검: ${path.basename(file)} · 버전 ${ver} · 보는 사람 ${me} · 탭 ${tabs.length}개`);
  rows.forEach(r => console.log('  ' + r));
  if (errors.length) {
    console.log('\n오류 ' + errors.length + '건');
    errors.forEach(e => console.log(`  - [${e.tab}] ${e.msg}`));
  } else console.log('\n오류 없음');
  console.log('캡처 폴더: ' + out);
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('점검 실패:', e.message); process.exit(2); });
