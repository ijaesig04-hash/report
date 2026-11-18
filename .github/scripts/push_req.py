"""관리자 요청 알림 보내기 — 보관함에 쌓인 요청(예: 공지 미확인자 다시 알림)을 지정한 직원에게만 푸시."""
import json, os, sys, subprocess, urllib.parse, urllib.request
url, key = os.environ.get('PUSH_URL', ''), os.environ.get('PUSH_SECRET', '')
if not url or not key:
    print('PUSH_URL/PUSH_SECRET 없음'); sys.exit(0)
def call(**q):
    q['key'] = key
    return json.load(urllib.request.urlopen(url + '?' + urllib.parse.urlencode(q), timeout=60))
from pywebpush import webpush, WebPushException
import re

def ai_alert():
    """💳 AI 응대 충전 잔액 — 다 썼거나(empty) 2천 원 미만(low)이 되면 파트장(이재식)에게 한 번만 알림"""
    try:
        m = re.search(r'RP_API\s*=\s*"([^"]+)"', open('roleplay.html', encoding='utf-8').read())
        if not m: return
        rp = m.group(1); subs_ai = None
        for ev, title in (('empty', '⛔ AI 응대 사용량을 다 썼어요'), ('low', '⚠️ AI 응대 충전 잔액 2천 원 미만')):
            j = json.load(urllib.request.urlopen(rp + '?' + urllib.parse.urlencode({'action': 'aiclaim', 'ev': ev}), timeout=60))
            if not j.get('claim'): continue
            b = j.get('bal') or {}
            body = 'AI Studio에서 충전해 주세요. 충전 전까지 실시간 통화·채점이 멈춰요.' if ev == 'empty' else '추정 잔액 약 {:,}원 — AI Studio에서 충전해 주세요.'.format(int(b.get('est') or 0))
            if subs_ai is None: subs_ai = call(action='list2').get('subs') or []
            n = 0
            for s2 in subs_ai:
                if s2.get('name') != '이재식': continue
                try:
                    webpush(s2['s'], json.dumps({'title': title, 'body': body, 'tag': 'aibal-' + ev}, ensure_ascii=False), vapid_private_key=os.environ['VAPID_PRIVATE_KEY'], vapid_claims={'sub': 'mailto:ujinlov01@gmail.com'}, ttl=86400); n += 1
                except WebPushException as e:
                    print('AI 알림 실패', getattr(e.response, 'status_code', 0))
            print('AI 잔액 알림', ev, '발송', n)
    except Exception as e:
        print('AI 잔액 확인 실패', e)

ai_alert()
reqs = call(action='reqs').get('reqs') or []
if not reqs:
    print('요청 없음'); sys.exit(0)
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
