#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import gzip
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_one(path: str, old: str, new: str) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one occurrence, found {count}: {old[:100]!r}')
    p.write_text(text.replace(old, new), encoding='utf-8')


# app.js: fetch gzip asset and transparently inflate it when needed.
replace_one('app.js', "const COMPACT_DB_PATH = './oui-db.bin';", "const COMPACT_DB_PATH = './oui-db.bin.gz';")
replace_one(
    'app.js',
    "  function parseCompactDb(buffer) {",
    """  function isGzipBuffer(buffer) {
    const bytes = new Uint8Array(buffer);
    return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  }

  async function decompressCompactDb(buffer) {
    if (!isGzipBuffer(buffer)) return buffer;
    if (typeof DecompressionStream !== 'function') {
      throw new Error('This browser does not support gzip decompression via DecompressionStream.');
    }
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
  }

  function parseCompactDb(buffer) {"""
)
replace_one(
    'app.js',
    "    const db = parseCompactDb(await response.arrayBuffer());",
    "    const compressed = await response.arrayBuffer();\n    const db = parseCompactDb(await decompressCompactDb(compressed));"
)

# Standalone builder: embed the gzip bytes; app.js performs the inflate.
replace_one('standalone-builder-core.js', "const BINARY_SOURCE = 'oui-db.bin';", "const BINARY_SOURCE = 'oui-db.bin.gz';")
replace_one('standalone-builder-core.js', 'oui-db.bin must be supplied as base64', 'oui-db.bin.gz must be supplied as base64')
replace_one('standalone-builder-core.js', 'id="embedded-oui-db-bin"', 'id="embedded-oui-db-gzip"')
replace_one('standalone-builder-core.js', "getElementById('embedded-oui-db-bin')", "getElementById('embedded-oui-db-gzip')")
replace_one('standalone-builder-core.js', "endsWith('/oui-db.bin')", "endsWith('/oui-db.bin.gz')")
replace_one(
    'standalone-builder-core.js',
    "assertContains(html, ['id=\"embedded-oui-db-bin\"', 'IPCOUI02', 'function lookupVendor', 'Random vendor MAC', 'Vendor', 'Matched prefix', 'Assignment type'], 'Full standalone');",
    "assertContains(html, ['id=\"embedded-oui-db-gzip\"', 'DecompressionStream', 'function lookupVendor', 'Random vendor MAC', 'Vendor', 'Matched prefix', 'Assignment type'], 'Full standalone');"
)
replace_one(
    'standalone-builder-core.js',
    "if (count(html, 'id=\"embedded-oui-db-bin\"') !== 1) throw new Error('Full standalone must contain exactly one compact OUI database');",
    "if (count(html, 'id=\"embedded-oui-db-gzip\"') !== 1) throw new Error('Full standalone must contain exactly one compact gzip OUI database');"
)
replace_one('standalone-builder-core.js', "['src=\"./app-core.js\"', 'src=\"./oui-db.bin\"']", "['src=\"./app-core.js\"', 'src=\"./oui-db.bin.gz\"']")
replace_one('standalone-builder-core.js', "['embedded-oui-db-bin', 'loadOuiDb'", "['embedded-oui-db-gzip', 'loadOuiDb'")

old_generated = """  function generatedDateFromBase64(base64) {
    try {
      let raw;
      if (typeof atob === 'function') raw = atob(base64.slice(0, 160));
      else if (typeof Buffer !== 'undefined') raw = Buffer.from(base64, 'base64').toString('binary');
      else return null;
      if (raw.slice(0, 8) !== 'IPCOUI02') return null;
      const date = raw.slice(84, 94);
      return /^\\d{4}-\\d{2}-\\d{2}$/.test(date) ? date : null;
    } catch (_) { return null; }
  }
"""
new_generated = """  function generatedDateFromBase64(base64) {
    try {
      let raw;
      if (typeof atob === 'function') raw = atob(base64.slice(0, 160));
      else if (typeof Buffer !== 'undefined') raw = Buffer.from(base64.slice(0, 160), 'base64').toString('binary');
      else return null;
      if (raw.slice(0, 8) === 'IPCOUI02') {
        const date = raw.slice(84, 94);
        return /^\\d{4}-\\d{2}-\\d{2}$/.test(date) ? date : null;
      }
      if (raw.length >= 8 && raw.charCodeAt(0) === 0x1f && raw.charCodeAt(1) === 0x8b) {
        const mtime = (raw.charCodeAt(4) | (raw.charCodeAt(5) << 8) | (raw.charCodeAt(6) << 16) | (raw.charCodeAt(7) << 24)) >>> 0;
        return mtime ? new Date(mtime * 1000).toISOString().slice(0, 10) : null;
      }
      return null;
    } catch (_) { return null; }
  }
"""
replace_one('standalone-builder-core.js', old_generated, new_generated)
replace_one('standalone-builder.js', "const BUILD_REVISION = 'standalone-builder-v4';", "const BUILD_REVISION = 'standalone-builder-v5';")

# Service worker: cache the compressed database and roll cache generation.
replace_one('sw.js', "const CACHE_NAME='ipcalc-pwa-v24';", "const CACHE_NAME='ipcalc-pwa-v25';")
replace_one('sw.js', "const OUI_DB_PATH='/ipcalc/oui-db.bin';", "const OUI_DB_PATH='/ipcalc/oui-db.bin.gz';")
replace_one('sw.js', "'./oui-db.bin'", "'./oui-db.bin.gz'")
replace_one('sw.js', "await c.match('./oui-db.bin')", "await c.match('./oui-db.bin.gz')")
replace_one('sw.js', "u.pathname.endsWith('/oui-db.bin')", "u.pathname.endsWith('/oui-db.bin.gz')")

# Compact DB test inflates the checked-in gzip before validating the v2 format.
replace_one('test/compact-oui.test.js', "const path = require('path');", "const path = require('path');\nconst zlib = require('zlib');")
replace_one(
    'test/compact-oui.test.js',
    "const db = fs.readFileSync(path.join(__dirname, '..', 'oui-db.bin'));\nassert(db.length > 100000 && db.length < 2 * 1024 * 1024, 'compact DB size is implausible');",
    "const compressed = fs.readFileSync(path.join(__dirname, '..', 'oui-db.bin.gz'));\nassert(compressed.length > 100000 && compressed.length < 1024 * 1024, 'compressed compact DB size is implausible');\nassert.strictEqual(compressed[0], 0x1f);\nassert.strictEqual(compressed[1], 0x8b);\nconst db = zlib.gunzipSync(compressed);\nassert(db.length > 100000 && db.length < 2 * 1024 * 1024, 'compact DB size is implausible');"
)
replace_one(
    'test/compact-oui.test.js',
    "console.log(`Compact OUI DB: ${count24 + count28 + count36} prefixes, ${vendorCount} vendors, ${db.length} bytes`);",
    "console.log(`Compact OUI DB: ${count24 + count28 + count36} prefixes, ${vendorCount} vendors, ${db.length} raw bytes, ${compressed.length} gzip bytes`);"
)

# Standalone regression expectations.
for old, new in [
    ("const COMPACT_DB_PATH = './oui-db.bin'", "const COMPACT_DB_PATH = './oui-db.bin.gz'"),
    ("'id=\"embedded-oui-db-bin\"'", "'id=\"embedded-oui-db-gzip\"'"),
    ("'IPCOUI02'", "'DecompressionStream'"),
    ("'src=\"./oui-db.bin\"'", "'src=\"./oui-db.bin.gz\"'"),
    ("'embedded-oui-db-bin'", "'embedded-oui-db-gzip'"),
    ("assert.strictEqual(Core.BINARY_SOURCE, 'oui-db.bin');", "assert.strictEqual(Core.BINARY_SOURCE, 'oui-db.bin.gz');"),
    ("'ipcalc-pwa-v24'", "'ipcalc-pwa-v25'"),
    ("const OUI_DB_PATH='/ipcalc/oui-db.bin'", "const OUI_DB_PATH='/ipcalc/oui-db.bin.gz'"),
    ("'./oui-db.bin'", "'./oui-db.bin.gz'"),
    ("u.pathname.endsWith('/oui-db.bin')", "u.pathname.endsWith('/oui-db.bin.gz')"),
    ("""hasNone(sw, ['./oui-db.json', \"u.pathname.endsWith('/oui-db.json')\"]);""", """hasNone(sw, ['./oui-db.json', \"u.pathname.endsWith('/oui-db.json')\"]);"""),
    ("const BUILD_REVISION = 'standalone-builder-v4'", "const BUILD_REVISION = 'standalone-builder-v5'"),
]:
    p = ROOT / 'test/standalone-builder-core.test.js'
    text = p.read_text(encoding='utf-8')
    if old == new:
        continue
    if old not in text:
        raise RuntimeError(f'test/standalone-builder-core.test.js: missing {old!r}')
    p.write_text(text.replace(old, new), encoding='utf-8')

# Python builder: gzip by default, deterministic payload with DB date in gzip mtime.
replace_one('tools/build-oui-db.py', 'import hashlib\n', 'import hashlib\nimport gzip\n')
replace_one('tools/build-oui-db.py', 'parser.add_argument("-o", "--output", default="oui-db.bin", help="Output binary path")', 'parser.add_argument("-o", "--output", default="oui-db.bin.gz", help="Output compact DB path (.gz for gzip, otherwise raw binary)")')
replace_one(
    'tools/build-oui-db.py',
    "    output = Path(args.output)\n    output.write_bytes(db)\n",
    """    output = Path(args.output)
    if output.suffix == '.gz':
        gzip_mtime = int(dt.datetime.fromisoformat(generated_date).replace(tzinfo=dt.timezone.utc).timestamp())
        output_bytes = gzip.compress(db, compresslevel=9, mtime=gzip_mtime)
    else:
        output_bytes = db
    output.write_bytes(output_bytes)
"""
)
replace_one(
    'tools/build-oui-db.py',
    "        f\"to {output} ({len(db):,} bytes); verification passed\",",
    "        f\"to {output} ({len(output_bytes):,} bytes; raw {len(db):,}); verification passed\"," 
)

# Produce gzip from the already verified binary. Preserve the DB generation date in gzip mtime.
raw_path = ROOT / 'oui-db.bin'
raw = raw_path.read_bytes()
if raw[:8] != b'IPCOUI02':
    raise RuntimeError('oui-db.bin has unexpected magic')
generated = raw[84:94].decode('ascii')
mtime = int(dt.datetime.fromisoformat(generated).replace(tzinfo=dt.timezone.utc).timestamp())
compressed = gzip.compress(raw, compresslevel=9, mtime=mtime)
(ROOT / 'oui-db.bin.gz').write_bytes(compressed)
raw_path.unlink()
print(f'oui-db.bin: {len(raw):,} -> oui-db.bin.gz: {len(compressed):,} bytes ({100 * len(compressed) / len(raw):.1f}% of raw)')

# Remove the one-shot migration machinery from the resulting branch.
(ROOT / '.github/workflows/one-shot-gzip-migration.yml').unlink(missing_ok=True)
Path(__file__).unlink()
