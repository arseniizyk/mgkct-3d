"""
test_challenger_js_syntax.py
=============================
Check basic bracket balancing and JS sanity across all project JS files.
"""

import os
import subprocess
import shutil

js_files = [
    "js/state.js",
    "js/materials.js",
    "js/helpers.js",
    "js/buildings/building1.js",
    "js/buildings/building2.js",
    "js/buildings/building3.js",
    "js/buildings/building4.js",
    "js/territory.js",
    "js/controls.js",
    "js/navigator.js",
    "js/ui.js",
    "js/main.js"
]

REGEX_PRECEDING_TOKENS = {
    '(', '[', '{', ';', ',', '=', ':', '?', '!', '&', '|', '^', '~', '+', '-', '*', '/', '%', '<', '>',
    'return', 'case', 'typeof', 'void', 'delete', 'yield', 'await', 'throw', 'default', 'do', 'new'
}

node_bin = shutil.which("node")

all_ok = True
for fpath in js_files:
    if not os.path.exists(fpath):
        print(f"[FAIL] Missing {fpath}")
        all_ok = False
        continue
    with open(fpath, "r", encoding="utf-8") as f:
        src = f.read()

    # Optional authoritative Node.js V8 syntax check
    if node_bin:
        res = subprocess.run([node_bin, "-c", fpath], capture_output=True, text=True)
        if res.returncode != 0:
            print(f"[FAIL] Node syntax check failed for {fpath}:\n{res.stderr.strip()}")
            all_ok = False
            continue

    # Check bracket balance (skipping comments, strings, and regex literals)
    # Lexical scan with regex awareness
    stack = []
    pairs = {')': '(', '}': '{', ']': '['}

    i = 0
    n = len(src)
    line = 1
    col = 1
    prev_token = None
    error = None

    while i < n:
        c = src[i]
        c2 = src[i:i+2]

        if c == '\n':
            line += 1
            col = 1
            i += 1
            continue

        if c.isspace():
            i += 1
            col += 1
            continue

        # Line comment
        if c2 == '//':
            i += 2
            col += 2
            while i < n and src[i] != '\n':
                i += 1
                col += 1
            continue

        # Block comment
        if c2 == '/*':
            i += 2
            col += 2
            while i < n and src[i:i+2] != '*/':
                if src[i] == '\n':
                    line += 1
                    col = 1
                else:
                    col += 1
                i += 1
            i += 2
            col += 2
            continue

        # Single quoted string
        if c == "'":
            i += 1
            col += 1
            while i < n and src[i] != "'":
                if src[i] == '\\':
                    i += 2
                    col += 2
                elif src[i] == '\n':
                    line += 1
                    col = 1
                    i += 1
                else:
                    i += 1
                    col += 1
            i += 1
            col += 1
            prev_token = 'str'
            continue

        # Double quoted string
        if c == '"':
            i += 1
            col += 1
            while i < n and src[i] != '"':
                if src[i] == '\\':
                    i += 2
                    col += 2
                elif src[i] == '\n':
                    line += 1
                    col = 1
                    i += 1
                else:
                    i += 1
                    col += 1
            i += 1
            col += 1
            prev_token = 'str'
            continue

        # Template literal
        if c == '`':
            i += 1
            col += 1
            while i < n and src[i] != '`':
                if src[i] == '\\':
                    i += 2
                    col += 2
                elif src[i] == '\n':
                    line += 1
                    col = 1
                    i += 1
                else:
                    i += 1
                    col += 1
            i += 1
            col += 1
            prev_token = 'str'
            continue

        # Slash: regex literal or division operator
        if c == '/':
            if prev_token is None or prev_token in REGEX_PRECEDING_TOKENS:
                reg_l, reg_c = line, col
                i += 1
                col += 1
                in_cc = False
                while i < n:
                    if src[i] == '\n':
                        error = f"Unterminated regex literal at {reg_l}:{reg_c}"
                        break
                    if src[i] == '\\':
                        i += 2
                        col += 2
                        continue
                    if src[i] == '[':
                        in_cc = True
                    elif src[i] == ']' and in_cc:
                        in_cc = False
                    elif src[i] == '/' and not in_cc:
                        i += 1
                        col += 1
                        while i < n and src[i].isalpha():
                            i += 1
                            col += 1
                        break
                    i += 1
                    col += 1
                if error:
                    break
                prev_token = 'regex'
                continue
            else:
                prev_token = '/'
                i += 1
                col += 1
                continue

        # Opening brackets
        if c in '({[':
            stack.append((c, line, col))
            prev_token = c
            i += 1
            col += 1
            continue

        # Closing brackets
        if c in ')}]':
            if not stack:
                error = f"Unmatched closing '{c}' at {line}:{col}"
                break
            top, tl, tc = stack.pop()
            if pairs[c] != top:
                error = f"Mismatched bracket: opened '{top}' at {tl}:{tc}, closed with '{c}' at {line}:{col}"
                break
            prev_token = c
            i += 1
            col += 1
            continue

        # Identifiers and keywords
        if c.isalpha() or c in '_$':
            w_start = i
            while i < n and (src[i].isalnum() or src[i] in '_$'):
                i += 1
                col += 1
            prev_token = src[w_start:i]
            continue

        # Number literals
        if c.isdigit():
            while i < n and (src[i].isalnum() or src[i] in '._'):
                i += 1
                col += 1
            prev_token = 'num'
            continue

        prev_token = c
        i += 1
        col += 1

    if error:
        print(f"[FAIL] {fpath}: {error}")
        all_ok = False
    elif stack:
        top, tl, tc = stack[-1]
        print(f"[FAIL] {fpath}: Unclosed bracket '{top}' opened at {tl}:{tc}")
        all_ok = False
    else:
        print(f"[OK] {fpath}: Balanced & syntactically sound ({len(src)} bytes, {line} lines)")

assert all_ok, "Syntax issues found in JS files!"
print("\nALL PROJECT JS FILES ARE SYNTACTICALLY SOUND & BALANCED 100%!")
