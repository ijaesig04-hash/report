# Claude가 git commit 하기 직전에 실행 — index.html이 바뀌었으면 tools/verify.py로 검사하고, 문제가 있으면 커밋을 멈춤
import json, sys, subprocess, os

data = json.load(sys.stdin)
cmd = data.get("tool_input", {}).get("command", "")
if "git commit" not in cmd:
    sys.exit(0)
root = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or "."
changed = subprocess.run(["git", "-C", root, "diff", "HEAD", "--name-only"], capture_output=True, text=True).stdout.split()
if "index.html" not in changed:
    sys.exit(0)
r = subprocess.run([sys.executable, os.path.join(root, "tools", "verify.py"), os.path.join(root, "index.html")],
                   capture_output=True, text=True, cwd=root)
if r.returncode:
    sys.stderr.write(r.stdout + r.stderr + "\n위 문제를 고친 뒤 다시 커밋하세요.\n")
    sys.exit(2)  # 2 = 커밋 막기
sys.exit(0)
