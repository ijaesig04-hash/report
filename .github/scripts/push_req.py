"""관리자 요청 알림 보내기 — 보관함에 쌓인 요청(예: 공지 미확인자 다시 알림)을 지정한 직원에게만 푸시."""
import json, os, sys, subprocess, urllib.parse, urllib.request
url, key = os.environ.get('PUSH_URL', ''), os.environ.get('PUSH_SECRET', '')
if not url or not key:
    print('PUSH_URL/PUSH_SECRET 없음'); sys.exit(0)
def call(**q):
    q['key'] = key
    return json.load(urllib.request.urlopen(url + '?' + urllib.parse.urlencode(q), timeout=60))
reqs = call(action='reqs').get('reqs') or []
if not reqs:
    print('요청 없음'); sys.exit(0)
subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'pywebpush'], check=True)
from pywebpush import webpush, WebPushException
subs = call(action='list2').get('subs') or []
dead, done = [], []
for r in reqs:
    names = set(r.get('names') or [])
    body = json.dumps({'title': r.get('title') or '북서울 Report', 'body': r.get('body') or '', 'tag': r.get('tag') or 'bsr-req'}, ensure_ascii=False)
    n = 0
    for s in subs:
        if s.get('name') not in names: continue
        try:
            webpush(s['s'], body, vapid_private_key=os.environ['VAPID_PRIVATE_KEY'], vapid_claims={'sub': 'mailto:ujinlov01@gmail.com'}, ttl=86400); n += 1
        except WebPushException as e:
            code = getattr(e.response, 'status_code', 0); print('실패', code)
            if code in (404, 410): dead.append(s['s']['endpoint'])
    print('요청', r.get('id'), '대상', len(names), '발송', n); done.append(r['id'])
call(action='reqdone', ids=','.join(done))
if dead:
    call(action='del', eps=','.join(urllib.parse.quote(d, safe='') for d in dead))
