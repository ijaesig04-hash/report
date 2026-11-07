# 북서울 Report 반영 검사 — 커밋 전에 자동으로 실행됨 (직접 실행도 가능)
# 사용: python3 tools/verify.py [html파일]   (기본 index.html, 마지막 커밋본과 비교)
# 검사: ① bsr-ver 오늘(KST) 날짜로 갱신 ② 자료가 바뀌면 NEWS 맨 위 새 소식
#       ③ 근무표(DUTY)를 바꾸면 원본 사진(DUTY_IMG)도 교체 ④ 스크립트 문법 · 스타일 괄호
# 문제가 있으면 내용을 알려주고 종료코드 1
import re, sys, os, subprocess, tempfile, datetime

KST = datetime.timezone(datetime.timedelta(hours=9))
path = sys.argv[1] if len(sys.argv) > 1 else "index.html"
root = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True).stdout.strip() or "."
rel = os.path.relpath(os.path.abspath(path), root)
new = open(path, encoding="utf-8").read()
r = subprocess.run(["git", "-C", root, "show", "HEAD:" + rel], capture_output=True)
old = r.stdout.decode("utf-8", "ignore") if r.returncode == 0 else ""
if old == new:
    print("변경 없음 — 검사 생략"); sys.exit(0)

errs = []

def block(h, start, end):
    i = h.find(start)
    if i < 0: return ""
    j = h.find(end, i + len(start))
    return h[i:j if j > 0 else len(h)]

def data_keys(h):
    drv = block(h, "var DRIVE", "var NEWS")[:400000]
    return {
        "서비스 지표": set(re.findall(r'\{d:"(\d{4}-\d{2}-\d{2})", br:', h)),
        "고객체감": set(re.findall(r'"(\d{4}-\d{2}-\d{2})":\{"period"', h)),
        "운전성향": set(re.findall(r'"(\d{4}-\d{2}-\d{2})":\[\["', drv)),
    }

# ① bsr-ver
m_new = re.search(r'<meta name="bsr-ver" content="(\d{14})"', new)
m_old = re.search(r'<meta name="bsr-ver" content="(\d{14})"', old)
if m_new:
    today = datetime.datetime.now(KST).strftime("%Y%m%d")
    if m_old and m_new.group(1) == m_old.group(1):
        errs.append("bsr-ver가 그대로입니다 — 지금 시각(KST)으로 갱신하세요 (안 하면 폰 화면이 새로고침되지 않음)")
    elif not m_new.group(1).startswith(today):
        errs.append("bsr-ver(%s)가 오늘(%s) 날짜가 아닙니다" % (m_new.group(1), today))

# ② 자료 변경 → NEWS
if old and "var NEWS" in new:
    changed = [k for k, v in data_keys(new).items() if v != data_keys(old)[k]]
    duty_new, duty_old = block(new, "var DUTY =", "var DUTY_IMG"), block(old, "var DUTY =", "var DUTY_IMG")
    months = lambda d: d[d.find("months:"):]
    if months(duty_new) != months(duty_old):
        changed.append("근무표")
    top = re.search(r'var NEWS = \[\s*\{id:"([^"]+)"', new)
    old_ids = set(re.findall(r'\{id:"([^"]+)"', block(old, "var NEWS = [", "];")))
    if changed and (not top or top.group(1) in old_ids):
        errs.append("%s 자료가 바뀌었는데 NEWS 맨 위에 새 소식이 없습니다" % "·".join(changed))
    elif top and old_ids and top.group(1) <= max(old_ids):
        errs.append("NEWS 맨 위 id(%s)가 기존 id보다 커야 푸시가 나갑니다" % top.group(1))
    # ③ 근무표 ↔ 원본 사진
    if "근무표" in changed:
        img = lambda h: block(h, "var DUTY_IMG", "\n")
        if img(new) == img(old):
            errs.append("근무표(DUTY)를 바꿨는데 원본 사진(DUTY_IMG)이 그대로입니다 — 같은 날 최신 사진(사번 가림)으로 교체하세요")

# ④ 스크립트 문법 · 스타일 괄호
scripts = re.findall(r'<script(?![^>]*\bsrc=)([^>]*)>(.*?)</script>', new, re.S)
with tempfile.TemporaryDirectory() as d:
    for n, (attrs, code) in enumerate(scripts):
        if re.search(r'type="(?!text/javascript|module)', attrs) or not code.strip():
            continue
        f = os.path.join(d, "s%d.js" % n)
        open(f, "w", encoding="utf-8").write(code)
        c = subprocess.run(["node", "--check", f], capture_output=True, text=True)
        if c.returncode:
            line = next((l for l in c.stderr.splitlines() if "Error" in l), c.stderr.strip()[:200])
            errs.append("스크립트 %d번째 블록 문법 오류: %s" % (n + 1, line[:200]))
for n, css in enumerate(re.findall(r'<style[^>]*>(.*?)</style>', new, re.S)):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    css = re.sub(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', '""', css)
    if css.count("{") != css.count("}"):
        errs.append("스타일 %d번째 블록 괄호 개수가 안 맞습니다 ({ %d개, } %d개) — 화면이 깨질 수 있음" % (n + 1, css.count("{"), css.count("}")))

if errs:
    print("❌ 반영 검사에서 고칠 것이 있습니다 (%s)" % rel)
    for e in errs: print(" - " + e)
    sys.exit(1)
print("✅ 반영 검사 통과 (%s)" % rel)
