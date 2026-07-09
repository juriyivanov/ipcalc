#!/usr/bin/env python3
"""Build oui-db.json for the offline MAC Vendor Lookup page.

The script prefers the local systemd OUI database when available:
  /usr/lib/udev/hwdb.d/20-OUI.hwdb

If that file is not available, it downloads Wireshark's generated manufacturer
database, which combines IEEE MA-L, MA-M, MA-S and other public prefix data.
If Wireshark is unavailable, it falls back to the IEEE Registration Authority
assignment files for MA-L, MA-M, and MA-S.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import urllib.request
from pathlib import Path
from typing import Dict, Iterable, Tuple

SYSTEMD_HWDB = Path('/usr/lib/udev/hwdb.d/20-OUI.hwdb')

WIRESHARK_MANUF_URL = 'https://www.wireshark.org/download/automated/data/manuf'

IEEE_SOURCES = {
    'MA-L / OUI, 24-bit prefix': 'https://standards-oui.ieee.org/oui/oui.txt',
    'MA-M / OUI-28, 28-bit prefix': 'https://standards-oui.ieee.org/oui28/mam.txt',
    'MA-S / OUI-36, 36-bit prefix': 'https://standards-oui.ieee.org/oui36/oui36.txt',
}

PREFIX_TYPES = {
    6: 'MA-L / OUI, 24-bit prefix',
    7: 'MA-M / OUI-28, 28-bit prefix',
    9: 'MA-S / OUI-36, 36-bit prefix',
}


def clean_prefix(raw: str) -> str:
    return re.sub(r'[^0-9A-Fa-f]', '', raw).upper()


def parse_systemd_hwdb(path: Path) -> Dict[str, Dict[str, str]]:
    entries: Dict[str, Dict[str, str]] = {}
    current_prefix: str | None = None

    for line in path.read_text(encoding='utf-8').splitlines():
        prefix_match = re.match(r'OUI:([0-9A-F]+)\*$', line)
        if prefix_match:
            current_prefix = prefix_match.group(1)
            continue

        vendor_match = re.match(r' ID_OUI_FROM_DATABASE=(.*)$', line)
        if vendor_match and current_prefix:
            prefix = current_prefix.upper()
            entries[prefix] = {
                'vendor': vendor_match.group(1).strip(),
                'type': PREFIX_TYPES.get(len(prefix), f'{len(prefix) * 4}-bit prefix'),
            }
            current_prefix = None

    return entries


def fetch_text(url: str) -> str:
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read().decode('utf-8', errors='replace')


def parse_ieee_text(text: str, assignment_type: str) -> Iterable[Tuple[str, Dict[str, str]]]:
    """Parse IEEE text files.

    Handles lines such as:
      F8-E4-3B   (hex)        Example Corp
      F8E43B     (base 16)    Example Corp
    """

    for line in text.splitlines():
        match = re.match(r'^\s*([0-9A-Fa-f][0-9A-Fa-f:-]{4,})\s+\((?:hex|base 16)\)\s+(.+?)\s*$', line)
        if not match:
            continue

        prefix = clean_prefix(match.group(1))
        vendor = match.group(2).strip()

        if len(prefix) not in PREFIX_TYPES:
            # Some IEEE files contain related identifiers. Keep only MAC prefix sizes.
            continue

        yield prefix, {
            'vendor': vendor,
            'type': PREFIX_TYPES.get(len(prefix), assignment_type),
        }



def parse_wireshark_manuf(text: str) -> Dict[str, Dict[str, str]]:
    """Parse Wireshark's generated manufacturer database.

    Expected rows are:
      00:00:0C              Cisco              Cisco Systems, Inc
      00:50:C2:00:10:00/36 ExampleShort       Example Long Name

    The first column may be 24, 28 or 36 bits wide. The second column is
    Wireshark's short name; the rest of the line is the display vendor name.
    """

    entries: Dict[str, Dict[str, str]] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue

        parts = line.split(None, 2)
        if len(parts) < 2:
            continue

        raw_prefix, _, raw_mask = parts[0].partition('/')
        prefix = clean_prefix(raw_prefix)
        if raw_mask.isdigit():
            prefix = prefix[:(int(raw_mask) + 3) // 4]
        if len(prefix) not in PREFIX_TYPES:
            continue

        vendor = parts[2].strip() if len(parts) == 3 else parts[1].strip()
        entries[prefix] = {
            'vendor': vendor,
            'type': PREFIX_TYPES.get(len(prefix), f'{len(prefix) * 4}-bit prefix'),
        }

    return entries


def build_from_wireshark() -> Dict[str, Dict[str, str]]:
    print(f'Downloading {WIRESHARK_MANUF_URL}', file=sys.stderr)
    return parse_wireshark_manuf(fetch_text(WIRESHARK_MANUF_URL))

def build_from_ieee() -> Dict[str, Dict[str, str]]:
    entries: Dict[str, Dict[str, str]] = {}
    for assignment_type, url in IEEE_SOURCES.items():
        print(f'Downloading {url}', file=sys.stderr)
        text = fetch_text(url)
        for prefix, record in parse_ieee_text(text, assignment_type):
            entries[prefix] = record
    return entries


def main() -> int:
    parser = argparse.ArgumentParser(description='Build offline OUI database for mac.html')
    parser.add_argument('-o', '--output', default='oui-db.json', help='Output JSON path')
    parser.add_argument('--force-download', action='store_true', help='Ignore local systemd hwdb and download vendor data')
    parser.add_argument('--ieee-only', action='store_true', help='Download IEEE assignment files instead of Wireshark manufacturer data')
    parser.add_argument('--pretty', action='store_true', help='Pretty-print JSON')
    args = parser.parse_args()

    if SYSTEMD_HWDB.exists() and not args.force_download:
        print(f'Using {SYSTEMD_HWDB}', file=sys.stderr)
        entries = parse_systemd_hwdb(SYSTEMD_HWDB)
        source = str(SYSTEMD_HWDB)
    else:
        if args.ieee_only:
            entries = build_from_ieee()
            source = 'IEEE Registration Authority public assignment files'
        else:
            try:
                entries = build_from_wireshark()
                source = f'Wireshark manufacturer database ({WIRESHARK_MANUF_URL})'
            except Exception as exc:
                print(f'Wireshark download failed: {exc}', file=sys.stderr)
                print('Falling back to IEEE Registration Authority files', file=sys.stderr)
                entries = build_from_ieee()
                source = 'IEEE Registration Authority public assignment files'

    payload = {
        'generatedAt': dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        'source': source,
        'entryCount': len(entries),
        'entries': dict(sorted(entries.items(), key=lambda item: (-len(item[0]), item[0]))),
    }

    output = Path(args.output)
    output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2 if args.pretty else None, separators=None if args.pretty else (',', ':')) + '\n',
        encoding='utf-8',
    )
    print(f'Wrote {len(entries)} entries to {output}', file=sys.stderr)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
