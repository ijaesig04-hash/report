# 북서울 Report 매일 아침 점검 — 사이트 접속, 자료 기준일, 월말·다음 달 근무표 확인
import re, sys, datetime, urllib.request, json, os
KST = datetime.timezone(datetime.timedelta(hours=9))
today = datetime.datetime.now(KST).date()
html = open("index.html", encoding="utf-8").read()
msgs, ok = [], []

# 1) 사이트 접속
try:
    r = urllib.request.urlopen("https://ijaesig04-hash.github.io/report/?t=%d" % datetime.datetime.now().timestamp(), timeout=30)
    body = r.read().decode("utf-8", "ignore")
    if r.status == 200 and 'name="bsr-ver"' in body:
        ok.append("사이트 정상 접속")
    else:
        msgs.append("⚠️ 사이트 응답 이상 (상태 %s)" % r.status)
except Exception as e:
    msgs.append("⚠️ 사이트에 접속되지 않습니다: %s" % e)

def days_old(d):
    return (today - datetime.date.fromisoformat(d)).days

# 2) 자료 기준일
veh = sorted(re.findall(r'\{d:"(\d{4}-\d{2}-\d{2})", br:', html))
cs = sorted(re.findall(r'"(\d{4}-\d{2}-\d{2})":\{"period"', html))
drv_block = html[html.find("var DRIVE"):html.find("var DRIVE") + 400000]
drv = sorted(set(re.findall(r'"(\d{4}-\d{2}-\d{2})":\[\["', drv_block)))
for name, arr, lim in [("서비스 지표(지사·차량·개인)", veh, 5), ("고객체감", cs, 3), ("운전성향", drv, 4)]:
    if not arr:
        continue
    d = arr[-1]; n = days_old(d)
    line = "%s 기준일 %s (%d일 전)" % (name, d[5:].replace("-", "/"), n)
    (msgs if n > lim else ok).append(("⏰ " + line + " — 새 자료를 보내주세요") if n > lim else line)

# 3) 월말 · 다음 달 근무표
last = (today.replace(day=28) + datetime.timedelta(days=4)).replace(day=1) - datetime.timedelta(days=1)
if today == last:
    msgs.append("📅 오늘은 월말(%d/%d)입니다 — 월말 결산 자료(지표·고객체감·운전성향)를 보내주세요" % (today.month, today.day))
if today.day == 1:
    msgs.append("📅 새 달이 시작됐습니다 — 지난달 말일 기준 지표 자료를 보내주시면 결산·가점이 확정 표시됩니다")
nxt = (last + datetime.timedelta(days=1)).strftime("%Y-%m")
if today.day >= 20 and ('"%s":[[' % nxt) not in html:
    msgs.append("🗓️ %s월 근무표가 아직 없습니다 — 나오면 보내주세요" % int(nxt[5:]))

title = "[점검] %d/%d 북서울 Report" % (today.month, today.day)
body = "\n".join(["## 확인이 필요한 것"] + ["- " + m for m in msgs] + ["", "## 정상"] + ["- " + m for m in ok] +
                 ["", "_매일 아침 7시 30분 자동 점검 · 이 알림은 확인할 것이 있을 때만 옵니다_"])
print(title); print(body)
with open(os.environ.get("GITHUB_OUTPUT", "/dev/null"), "a") as f:
    f.write("need=%s\n" % ("1" if msgs else "0"))
open("check_title.txt", "w").write(title)
open("check_body.txt", "w").write(body)
