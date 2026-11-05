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
from pywebpush import webpush, WebPushException
subs = call(action='list2').get('subs') or []
dead, done = [], []
import datetime
def age_h(r):
    try: return (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(str(r.get('t','')).replace('Z','+00:00'))).total_seconds()/3600
    except Exception: return 0
for r in reqs:
    if age_h(r) > 6:   # 6시간 넘게 밀린 요청은 보내지 않고 정리
        print('오래된 요청 건너뜀', r.get('id')); done.append(r['id']); continue
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
