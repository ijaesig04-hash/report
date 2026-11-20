"""AI 현장진단 지식베이스 묶음 만들기 (kb/kb.dat)
- 원문 텍스트를 1,600자 조각으로 나눠 JSON → gzip → 암호화(ChaCha20) → base64
- 키는 저장소에 넣지 않는다: 환경변수 KB_KEY (Apps Script 스크립트 속성 KB_KEY와 같은 값)
- 사용:  KB_KEY=... python3 tools/kb_build.py list.tsv        (목록 파일: 제목<TAB>구분(manual|case|memo)<TAB>원문경로)
         KB_KEY=... python3 tools/kb_build.py --add list.tsv  (기존 kb.dat에 추가·같은 제목은 교체)
         KB_KEY=... python3 tools/kb_build.py --show            (들어 있는 문서 목록)
"""
import sys, os, re, json, gzip, hashlib, base64

OUT = os.path.join(os.path.dirname(__file__), '..', 'kb', 'kb.dat')
KEY = os.environ.get('KB_KEY', '')
SIZE, OVER = 1600, 200

def _rotl(v, c): return ((v << c) & 0xffffffff) | (v >> (32 - c))
def _qr(x, a, b, c, d):
    x[a] = (x[a] + x[b]) & 0xffffffff; x[d] = _rotl(x[d] ^ x[a], 16)
    x[c] = (x[c] + x[d]) & 0xffffffff; x[b] = _rotl(x[b] ^ x[c], 12)
    x[a] = (x[a] + x[b]) & 0xffffffff; x[d] = _rotl(x[d] ^ x[a], 8)
    x[c] = (x[c] + x[d]) & 0xffffffff; x[b] = _rotl(x[b] ^ x[c], 7)
def chacha(data):
    """ChaCha20 (RFC 7539, nonce 0) — 키 = SHA-256(KB_KEY). 서버(roleplay-core.js kbCrypt)와 같은 방식"""
    import struct
    k = struct.unpack('<8I', hashlib.sha256(KEY.encode()).digest())
    out = bytearray(len(data))
    for blk in range((len(data) + 63) // 64):
        st = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574, *k, blk, 0, 0, 0]
        x = st[:]
        for _ in range(10):
            _qr(x, 0, 4, 8, 12); _qr(x, 1, 5, 9, 13); _qr(x, 2, 6, 10, 14); _qr(x, 3, 7, 11, 15)
            _qr(x, 0, 5, 10, 15); _qr(x, 1, 6, 11, 12); _qr(x, 2, 7, 8, 13); _qr(x, 3, 4, 9, 14)
        ks = struct.pack('<16I', *[(x[i] + st[i]) & 0xffffffff for i in range(16)])
        o = blk * 64
        for i, b in enumerate(data[o:o + 64]): out[o + i] = b ^ ks[i]
    return bytes(out)

def enc(obj):
    raw = gzip.compress(json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode(), 9)
    return base64.b64encode(chacha(raw)).decode()

def dec(txt):
    return json.loads(gzip.decompress(chacha(base64.b64decode(txt))).decode())

def clean(t):
    t = re.sub(r'\[[A-Z]:\\[^\]]*\]', '', t)          # 그림 경로
    t = re.sub(r'\[\]\s*', '', t)
    t = re.sub(r'[ \t　]+', ' ', t)
    t = re.sub(r'(\| *)+\|', '|', t)
    lines = [l.strip() for l in t.split('\n')]
    out, prev = [], None
    for l in lines:
        if not l or l == prev or re.fullmatch(r'[-=|· .]*', l) or re.fullmatch(r'(페이지 )?\d+( / \d+)?', l): continue
        out.append(l); prev = l
    return '\n'.join(out)

def chunks(title, kind, text):
    text = clean(text); res = []; i = 0
    while i < len(text):
        j = min(len(text), i + SIZE)
        if j < len(text):
            k = text.rfind('\n', i + SIZE // 2, j)
            if k > 0: j = k
        res.append({'t': title, 'k': kind, 'x': text[i:j].strip()})
        if j >= len(text): break
        i = max(j - OVER, i + 1)
    return res

def load_list(p):
    docs = []
    for line in open(p, encoding='utf-8'):
        if not line.strip() or line.startswith('#'): continue
        title, kind, path = line.rstrip('\n').split('\t')
        docs.append((title, kind, open(path, encoding='utf-8', errors='ignore').read()))
    return docs

if __name__ == '__main__':
    assert KEY, 'KB_KEY 환경변수가 필요해요'
    a = sys.argv[1:]
    old = dec(open(OUT).read()) if os.path.exists(OUT) and ('--add' in a or '--show' in a) else {'v': 0, 'c': []}
    if '--show' in a:
        from collections import Counter
        for t, n in Counter(c['t'] for c in old['c']).items(): print(n, t)
        sys.exit()
    docs = load_list([x for x in a if not x.startswith('--')][0])
    titles = {d[0] for d in docs}
    C = [c for c in old['c'] if c['t'] not in titles]
    for t, k, x in docs: C += chunks(t, k, x)
    import time
    data = {'v': int(time.time()), 'c': C}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w').write(enc(data))
    assert dec(open(OUT).read())['v'] == data['v']
    print('docs', len({c['t'] for c in C}), 'chunks', len(C), 'chars', sum(len(c['x']) for c in C), 'bytes', os.path.getsize(OUT))
