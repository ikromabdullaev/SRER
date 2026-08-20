# -*- coding: utf-8 -*-
import io, re, sys

src = "../SCHEMA.md"
out = "./schema.sql"

text = io.open(src, encoding="utf-8").read()
lines = text.split("\n")

blocks = []
cur = None
heading = ""
for ln in lines:
    if ln.startswith("#"):
        if cur is None:
            heading = ln.strip("# ").strip()
    if cur is None:
        if ln.strip() == "```sql":
            cur = []
        continue
    if ln.strip() == "```":
        blocks.append((heading, "\n".join(cur)))
        cur = None
        continue
    cur.append(ln)

if cur is not None:
    sys.exit("unterminated sql fence")

with io.open(out, "w", encoding="utf-8", newline="\n") as f:
    for i, (h, b) in enumerate(blocks):
        f.write("\n-- ===== block %d : %s =====\n" % (i + 1, h))
        f.write(b + "\n")

print("%d sql blocks extracted -> %s" % (len(blocks), out))
for i, (h, b) in enumerate(blocks):
    first = [x for x in b.split("\n") if x.strip() and not x.strip().startswith("--")]
    print("  %2d  %-28s %s" % (i + 1, h[:28], (first[0][:60] if first else "(empty)")))
