# CLAUDE.md — 작업 안내

## 사용자
- 이재식 · 에스원 북서울지사 서비스파트장
- 주 업무: 회사 서비스 업무 관련 자료 취합, 보고서·현황 분석 지표 제작
- 앞으로 사업팀이나 본부로 옮기면 **여러 지사를 함께 관리**하는 보고서가 필요해질 수 있음
  → 새 작업은 가능하면 지사를 쉽게 추가할 수 있게 만든다 (지사명·데이터를 코드에 박아 넣지 않기)
- 답변은 한국어로, 전문용어보다 쉬운 말로 설명한다

## 이 저장소: 북서울 서비스 Report
- GitHub Pages 배포 주소: https://ijaesig04-hash.github.io/report/
- 휴대폰 홈 화면에 설치해 쓰는 웹앱(PWA)

| 파일 | 내용 |
|---|---|
| `index.html` | 메인 리포트 (지사·차량·개인 서비스 지표, 고객체감, 운전성향, 근무표, 브리핑 등). 데이터·이미지가 파일 안에 함께 들어 있어 약 7MB |
| `patrol.html` | 구역별 담당차량(출동차량) 조회 |
| `risk.html` | 작업전 위험예지활동 보고 |
| `directmall.html` | **앱 안 연결 페이지.** 홍보 스튜디오 본체는 별도 저장소 `ijaesig04-hash/directmall`의 `index.html`. 이 파일은 그 본체를 fetch해서 그 자리에 띄움(주소는 /report/ 그대로 → Report 앱 범위 안이라 크롬 주소창이 안 생김). 리포트 메뉴(PROD_URL·영업 탭)는 반드시 이 `directmall.html`을 가리킬 것 — /directmall/ 주소로 직접 연결하면 앱 범위 밖이라 주소창이 뜸. fetch에 `?t=` 붙이지 말 것(sw.js가 index 캐시로 착각) |
| `roleplay.html` | **AI 응대 연습** — AI가 까다로운 고객 역을 맡고 직원이 음성으로 응대 연습 → 점수·피드백, 파트장 현황. 상단 `RP_API`가 비어 있으면 데모 모드. AI 서버 코드는 `tools/roleplay.gs`(Apps Script, Gemini), 처음 설정 안내는 `roleplay-setup.html`. 응대 상황은 `SCEN` 배열 |
| `tools/screen_check.js` | 휴대폰 크기(390px) 화면 점검 — 탭마다 캡처하고 오류·화면 넘침을 찾음 |
| `.claude/skills/` | 반영 작업 순서·체크리스트(스킬), 화면 점검·다듬기 스킬(impeccable) |
| `docs/다른프로젝트용_디자인스킬.md` | 다른 프로젝트용 디자인 스킬 보관함 (Taste · Awesome Design) — **이 리포트에는 쓰지 않음** |
| `tools/verify.py` | 반영 검사 — bsr-ver 갱신·NEWS 새 소식·근무표 원본 사진 교체·스크립트 문법·스타일 괄호 확인 |
| `.claude/settings.json` | 플러그인(frontend-design · claude-code-setup), 자주 쓰는 명령 미리 허용, 자동 검사 장치(훅) 설정 |
| `.claude/hooks/` | 자동 검사 장치: 커밋 직전 `verify.py` 실행(실패 시 커밋 막음) · 1.5MB 넘는 파일 통째 읽기 막기 |
| `sw.js` | 빠른 열기·오프라인용 서비스워커. **새 html 페이지를 추가하면 navigate 허용 목록 정규식에 추가해야 함** |
| `manifest.json`, `icon-*.png` | 앱 설치 정보·아이콘 |
| `404.html`, `report-1023x.html` | 옛 주소 → 최신 화면으로 이동 |
| `.github/workflows/daily-check.yml` + `.github/scripts/check.py` | 매일 07:30(KST) 사이트 접속·자료 기준일·월말/근무표 점검 후 필요하면 `[점검]` 이슈 생성 |

## 작업 규칙
- 지표 반영할 때마다 `index.html`의 `<meta name="bsr-ver">` 값을 갱신한다 (휴대폰 화면 자동 새로고침 기준)
- `check.py`는 `index.html` 안의 데이터 형식(예: `{d:"YYYY-MM-DD", br:`, `"YYYY-MM-DD":{"period"`, `var DRIVE`)을 읽는다. 데이터 형식을 바꾸면 `check.py`도 함께 고친다
- 커밋 메시지는 한국어로, 무엇을 반영했는지 짧게 적는다 (예: "고객체감 10/30 반영 (발송 175, 응답 55)")
- 지표·근무표·운전성향 반영 작업에는 저장소의 `.claude/skills/bukseoul-report-update/SKILL.md` 스킬을 따른다
  - claude.ai 계정에 올린 **예전 스킬(`anthropic-skills:bukseoul-report-update`)은 쓰지 않는다** — 수동 업로드·파일 이름 바꾸기 안내 등 옛 방식이라 지금과 맞지 않음
- 반영 후 push 전에 `node tools/screen_check.js index.html <폴더>`로 휴대폰 크기 화면 점검(탭별 캡처·오류 확인)을 한다
- 커밋하면 `tools/verify.py`가 자동으로 돌아 검사한다. 막히면 알려준 문제를 고치고 다시 커밋한다 (검사를 끄거나 건너뛰지 않기)
- **근무표를 고칠 때는 표(DUTY)와 함께 🗂️ 원본 사진(`DUTY_IMG`)도 항상 같은 날 최신 사진으로 교체한다** (사번 칸은 흰색으로 가림). 표만 바꾸고 원본을 빼먹지 않기
- 폰 푸시 알림은 **지표 · 자료 업데이트 소식만** 보낸다 (`push.py`: tabs에 cmp·veh·ppl·mgt·eval·cs·alm·drv·duty가 있는 공개 소식). 기능 · 화면 변경 소식은 tabs를 ["home"]으로 두거나 `nopush:1`을 title 앞에 넣는다
- 회사 내부 자료이므로 페이지는 `noindex` 유지, 개인정보는 필요한 범위만 표시한다
- 화면 점검·다듬기는 `/impeccable audit`(점검) · `/impeccable polish`(마무리) 등을 쓴다
  - 리포트는 **업무용 화면(Operate 모드)** — 화려함보다 한눈에 읽히는 것이 우선. 지금 디자인을 지키며 다듬기만 하고, 통째로 새로 디자인하지 않는다
  - 바로 고치지 말고 **고칠 점 목록을 먼저 보여주고** 허락받은 것만 고친다. 지표 숫자·문구는 바꾸지 않는다
  - impeccable의 자동 훅(편집할 때마다 검사)은 설치하지 않았다 — 매일 반영 작업이 느려지지 않게
- `docs/다른프로젝트용_디자인스킬.md`의 Taste · Awesome Design 스킬은 **이 저장소에 설치하거나 적용하지 않는다** (다른 프로젝트용)

## 앞으로의 확장 방향 (참고)
여러 지사를 다루게 되면:
1. 지표 데이터를 지사별 파일(예: `data/북서울.json`)로 분리
2. 화면은 공통 하나로 두고 지사를 골라 보기
3. 전체 지사 비교(순위표·추이 그래프) 화면 추가
- **NEWS(업데이트 이력)는 14일 지난 항목을 정리한다** — 뺀 항목은 `docs/news-archive.md`에 원문으로 보관 (앱의 이력·N 표시는 최근 소식만 사용)
- 업데이트 이력은 📊 지표·자료(데이터 탭 포함) / 🛠️ 기능·화면으로 구분해 보여 준다. 폰 알림은 지표·자료 소식만 (기능 소식은 `nopush:` 접두어 + tabs ["home"])
- 직원용 처음 이용 안내는 `index.html`의 `GUIDE` 배열, 현장 도움말은 `HELP` 배열 — 둘 다 이름 버튼 → 📖 사용 안내 · 도움말 한 화면(GUIDE는 「📖 처음 이용」 분류). 메뉴·기능이 바뀌면 함께 고친다
