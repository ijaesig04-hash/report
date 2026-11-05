"""업데이트 알림 보내기 — index.html 의 맨 위 소식(NEWS)이 바뀌었을 때만 구독자에게 푸시."""
import json, os, re, subprocess, sys, urllib.parse, urllib.request
from pywebpush import webpush, WebPushException

DATA_TABS = {"cmp", "veh", "ppl", "mgt", "eval", "cs", "alm", "drv", "duty"}   # 지표 · 자료 탭

def entries(html):
    """NEWS 항목 목록 [(id, title, tabs, only)] — 위(최신)부터"""
    html = html or ''
    i = html.find('NEWS = ['); j = html.find('/*NEWS_END*/', i)
    seg = html[i:j] if i >= 0 else ''
    out = []
    for m in re.finditer(r'\{id:"([^"]+)"(,\s*only:"[^"]*")?[^}]*?title:"([^"]*)"\s*,\s*tabs:\[([^\]]*)\]', seg):
        tabs = set(re.findall(r'"([^"]+)"', m.group(4)))
        if 'nopush' in m.group(0): tabs = set()   # 기능 소식 표시 → 알림 제외
        out.append((m.group(1), m.group(3), tabs, bool(m.group(2))))
    return out

def top(html):
    """알림 대상: 공개 소식 중 지표 · 자료 업데이트(데이터 탭)만 — 기능 · 화면 변경은 알림 안 보냄"""
    for e in entries(html):
        if not e[3] and (e[2] & DATA_TABS):
            return (e[0], e[1])
    return (None, '')

def git(*a):
    r = subprocess.run(['git', *a], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else ''

new = top(open('index.html', encoding='utf-8').read())
old = top(git('show', 'HEAD~1:index.html'))
force = os.environ.get('FORCE') == '1'
if not new[0] or ((old[0] and new[0] <= old[0]) and not force):   # 더 새로운 소식일 때만
    print('새 소식 없음 — 알림 안 보냄', new, old); sys.exit(0)
url, key = os.environ.get('PUSH_URL', ''), os.environ.get('PUSH_SECRET', '')
if not url or not key:
    print('PUSH_URL/PUSH_SECRET 없음'); sys.exit(0)
q = urllib.parse.urlencode({'action': 'list', 'key': key})
subs = json.load(urllib.request.urlopen(url + '?' + q, timeout=60)).get('subs', [])
print('구독자', len(subs))
body = json.dumps({'title': '북서울 Report 업데이트', 'body': new[1] or '새 내용이 반영되었어요', 'tag': new[0]}, ensure_ascii=False)
dead = []
for s in subs:
    try:
        webpush(s, body, vapid_private_key=os.environ['VAPID_PRIVATE_KEY'], vapid_claims={'sub': 'mailto:ujinlov01@gmail.com'}, ttl=86400)
    except WebPushException as e:
        code = getattr(e.response, 'status_code', 0)
        print('실패', code)
        if code in (404, 410): dead.append(s['endpoint'])
if dead:
    q = urllib.parse.urlencode({'action': 'del', 'key': key, 'eps': ','.join(urllib.parse.quote(d, safe='') for d in dead)})
    urllib.request.urlopen(url + '?' + q, timeout=60); print('만료 삭제', len(dead))
