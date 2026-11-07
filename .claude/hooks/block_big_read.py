# 큰 파일(1.5MB 넘음, 예: 8MB index.html)을 통째로 읽으려 하면 막고 grep/파이썬으로 필요한 부분만 보도록 안내
import json, sys, os

data = json.load(sys.stdin)
inp = data.get("tool_input", {})
p = inp.get("file_path", "")
if not p or inp.get("limit") or not os.path.isfile(p):
    sys.exit(0)
if p.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf")):
    sys.exit(0)
size = os.path.getsize(p)
if size > 1_500_000:
    sys.stderr.write("%s 는 %.1fMB라 통째로 읽으면 안 됩니다. grep -o '검색어.\\{0,200\\}' 또는 파이썬으로 필요한 부분만 보세요.\n"
                     % (os.path.basename(p), size / 1e6))
    sys.exit(2)
sys.exit(0)
