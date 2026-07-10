#!/usr/bin/env python3
"""Genera src/lib/athlete-photos.ts: mapa nombre-normalizado → foto (CDN de ESPN),
VALIDANDO cada URL (solo fotos reales: 200 + tamaño de foto, no siluetas/404). Indexa por
nombre COMPLETO y por APELLIDO único (para veladas UFC, que usan apellido). Coste 0 en
ejecución. Fuente = rankings ATP/WTA/UFC. Regenerar: python3 scripts/gen-athlete-photos.py"""
import json, unicodedata, urllib.request, sys
from concurrent.futures import ThreadPoolExecutor

SOURCES = [
    ("https://site.api.espn.com/apis/site/v2/sports/tennis/atp/rankings", "tennis"),
    ("https://site.api.espn.com/apis/site/v2/sports/tennis/wta/rankings", "tennis"),
    ("https://site.api.espn.com/apis/site/v2/sports/mma/ufc/rankings", "mma"),
]
MIN_BYTES = 9000

def norm(name):
    s = unicodedata.normalize("NFD", name or "").encode("ascii", "ignore").decode().lower()
    return " ".join(s.split())

def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.load(r)

def real_photo(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            if r.status != 200 or "image" not in r.headers.get("Content-Type", ""): return False
            return len(r.read(MIN_BYTES + 1)) > MIN_BYTES
    except Exception:
        return False

cand = {}
for url, sport in SOURCES:
    try: d = fetch_json(url)
    except Exception as e: print(f"WARN {url}: {e}", file=sys.stderr); continue
    for grp in (d.get("rankings") or []):
        for it in (grp.get("ranks") or []):
            a = it.get("athlete") or {}
            aid, name = a.get("id"), a.get("displayName")
            if not aid or not name: continue
            k = norm(name)
            if k and k not in cand:
                cand[k] = f"https://a.espncdn.com/i/headshots/{sport}/players/full/{aid}.png"

print(f"candidatos: {len(cand)} — validando URLs…", file=sys.stderr)
keys = list(cand.keys())
with ThreadPoolExecutor(max_workers=20) as ex:
    oks = list(ex.map(lambda k: real_photo(cand[k]), keys))
photos = {k: cand[k] for k, ok in zip(keys, oks) if ok}

last_counts = {}
for k in photos:
    lw = k.split()[-1] if k.split() else ""
    if lw: last_counts[lw] = last_counts.get(lw, 0) + 1
by_last = {}
for k, v in photos.items():
    parts = k.split()
    lw = parts[-1] if parts else ""
    if lw and last_counts[lw] == 1 and lw not in photos:
        by_last[lw] = v

full_items = sorted(photos.items()); last_items = sorted(by_last.items())
L = []
L += [
 "// AUTO-GENERADO por scripts/gen-athlete-photos.py — NO editar a mano.",
 "// Mapa nombre-normalizado → foto (headshot CDN de ESPN) de jugadores/luchadores TOP",
 "// (rankings ATP/WTA/UFC), SOLO fotos reales verificadas (200, no siluetas/404). Da la",
 "// CARA en la fila del calendario para los conocidos; el resto sale con el nombre. Se",
 "// indexa por nombre COMPLETO y por APELLIDO único (veladas UFC usan apellido).",
 "// Regenerar: python3 scripts/gen-athlete-photos.py",
 f"// {len(full_items)} nombres completos + {len(last_items)} apellidos únicos.",
 "",
 "const ATHLETE_PHOTOS: Record<string, string> = {",
]
for k, v in full_items: L.append(f"  '{k.replace(chr(39),chr(92)+chr(39))}': '{v}',")
L += ["}", "",
 "// Apellido único → foto (fallback para títulos que usan solo el apellido).",
 "const ATHLETE_PHOTOS_BY_LAST: Record<string, string> = {"]
for k, v in last_items: L.append(f"  '{k.replace(chr(39),chr(92)+chr(39))}': '{v}',")
L += ["}", "",
 "/** Foto (cara) del atleta por nombre; nombre completo o apellido; si no, undefined. */",
 "export function athletePhoto(name?: string | null): string | undefined {",
 "  if (!name) return undefined",
 "  const key = name",
 "    .normalize('NFD')",
 "    .replace(/[\\u0300-\\u036f]/g, '')",
 "    .toLowerCase()",
 "    .trim()",
 "    .replace(/\\s+(?:[0-9]+|jr|sr|ii|iii|iv)\\.?$/i, '')",
 "    .replace(/\\s+/g, ' ')",
 "  const hit = ATHLETE_PHOTOS[key]",
 "  if (hit) return hit",
 "  const parts = key.split(' ')",
 "  return ATHLETE_PHOTOS_BY_LAST[parts[parts.length - 1]]",
 "}",
 "",
]
open("src/lib/athlete-photos.ts","w").write("\n".join(L))
print(f"OK: {len(full_items)} completos + {len(last_items)} apellidos → src/lib/athlete-photos.ts")
