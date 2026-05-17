#!/usr/bin/env python3
"""Parse Odoo 19.0 SCSS variables → DTCG-shaped JSON.

Reads `$variable: value !default;` lines, resolves simple variable refs
and `$other * <number>` multiplications. Skips entries whose value
involves Sass functions (darken/mix/etc.) — we don't fabricate, we omit.
Categorises into color / dimension / fontWeight / opacity.
"""
import re, json, sys
from pathlib import Path

SOURCES = [
    "addons/web/static/src/scss/primary_variables.scss",
    "addons/web/static/src/scss/secondary_variables.scss",
    "addons/web/static/src/views/form/form.variables.scss",
    "addons/web/static/src/views/kanban/kanban.variables.scss",
    "addons/web/static/src/webclient/navbar/navbar.variables.scss",
]
BASE = Path("/Users/dkendall/projects/ledoent/erp/odoo-19/custom/src/odoo")

# ----------------------- parse ---------------------------------------------

raw = {}
order = []
for relpath in SOURCES:
    p = BASE / relpath
    if not p.exists():
        print(f"# missing: {p}", file=sys.stderr)
        continue
    src = p.read_text()
    # Match `$name: value !default;` with value being everything up to the
    # !default. Allows whitespace and inline comments.
    for m in re.finditer(r"^\s*\$([a-zA-Z0-9_-]+)\s*:\s*(.+?)\s*!default\s*;", src, re.M):
        name, val = m.group(1).strip(), m.group(2).strip()
        if name in raw:
            continue  # first definition wins; later files don't redefine the base
        raw[name] = (val, relpath)
        order.append(name)
print(f"# parsed {len(raw)} variables from {len(SOURCES)} files", file=sys.stderr)

# ----------------------- resolve -------------------------------------------

HEX = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
DIM = re.compile(r"^(-?(?:\d+(?:\.\d+)?|\.\d+))(px|rem|em|vh|vw|%)$")
NUM = re.compile(r"^-?(?:\d+(?:\.\d+)?|\.\d+)$")
VARREF = re.compile(r"^\$([a-zA-Z0-9_-]+)$")
MUL = re.compile(r"^\$([a-zA-Z0-9_-]+)\s*\*\s*(\d+(?:\.\d+)?)$")
OTOREM = re.compile(r"^o-to-rem\((\d+(?:\.\d+)?)px\)$")
NAMED_COLORS = {
    "white": "#FFFFFF", "black": "#000000", "transparent": "transparent",
    "red": "#FF0000", "green": "#008000", "blue": "#0000FF",
}

def resolve(name, val, depth=0):
    if depth > 10:
        return None
    v = val.strip()
    # direct hex
    if HEX.match(v):
        return ("color", v if v.startswith("#") else f"#{v}")
    # CSS named color
    if v in NAMED_COLORS:
        cv = NAMED_COLORS[v]
        return ("color", cv) if cv.startswith("#") else None
    # direct dimension
    m = DIM.match(v)
    if m:
        return ("dimension", v)
    # bare number — depends on context (font weight, opacity, line-height)
    if NUM.match(v):
        n = float(v)
        if n in (100, 200, 300, 400, 500, 600, 700, 800, 900) and n.is_integer():
            return ("fontWeight", int(n))
        if 0 <= n <= 1:
            return ("opacity", n)
        return ("number", n)
    # o-to-rem(<px>) → multiply px by 1/16 = rem (Odoo uses 16px root)
    m = OTOREM.match(v)
    if m:
        rem = float(m.group(1)) / 16.0
        return ("dimension", f"{rem}rem")
    # simple var ref
    m = VARREF.match(v)
    if m:
        target = m.group(1)
        if target in raw:
            return resolve(target, raw[target][0], depth+1)
    # var * number (e.g. $o-spacer * 1.5)
    m = MUL.match(v)
    if m:
        target, factor = m.group(1), float(m.group(2))
        if target in raw:
            inner = resolve(target, raw[target][0], depth+1)
            if inner and inner[0] == "dimension":
                im = DIM.match(inner[1])
                if im:
                    new = float(im.group(1)) * factor
                    return ("dimension", f"{new:g}{im.group(2)}")
    return None  # not resolvable (function call etc.)

resolved = {}
unresolved = []
for name in order:
    val, source = raw[name]
    r = resolve(name, val)
    if r is None:
        unresolved.append((name, val, source))
    else:
        resolved[name] = (r[0], r[1], source)
print(f"# resolved: {len(resolved)}  unresolved: {len(unresolved)}", file=sys.stderr)

# ----------------------- categorise to DTCG --------------------------------

def dtcg_type(kind):
    return {
        "color": "color",
        "dimension": "dimension",
        "fontWeight": "fontWeight",
        "opacity": "opacity",
        "number": "number",
    }.get(kind, kind)

# DTCG (Penpot-flavoured) uses nested objects, `$type` + `$value` per leaf.
# We keep the SCSS variable name as the leaf key (drop leading `o-`).
out_set = {}
for name, (kind, value, source) in resolved.items():
    # group by category
    cat = {
        "color": "color",
        "dimension": "dimension",
        "fontWeight": "font-weight",
        "opacity": "opacity",
        "number": "number",
    }[kind]
    leaf = name[2:] if name.startswith("o-") else name
    out_set.setdefault(cat, {})[leaf] = {
        "$type": dtcg_type(kind),
        "$value": value,
        "$description": f"Odoo 19.0 ${name} (from {source})",
    }

result = {
    "odoo-19-dtcg": out_set,
    "$themes": [],
    "$metadata": {
        "tokenSetOrder": ["odoo-19-dtcg"],
        "source": "odoo/odoo:19.0 — addons/web/static/src/scss/* (primary, secondary, view variables)",
        "generator": "scripts/scss-to-dtcg.py",
    },
}

print(json.dumps(result, indent=2, ensure_ascii=False))

if "--debug-unresolved" in sys.argv:
    print(f"\n--- unresolved ({len(unresolved)}) ---", file=sys.stderr)
    for n, v, s in unresolved[:50]:
        print(f"  ${n} = {v}  ({s})", file=sys.stderr)
