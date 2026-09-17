#!/usr/bin/env python3
"""Build the compact binary MAC vendor database used by IP Calculator.

Format v2 is intentionally browser-friendly:
  * /24 records: 3-byte prefix + uint16 vendor_id
  * /28 records: 4-byte prefix + uint16 vendor_id
  * /36 records: 5-byte prefix + uint16 vendor_id
  * sorted prefix tables for binary search
  * deduplicated UTF-8 vendor strings
  * front-coded vendor strings in blocks of 32 with a uint32 block index

The default data source behavior is kept compatible with the old JSON builder:
prefer the local systemd OUI hwdb, otherwise try Wireshark's manuf database,
then fall back to IEEE Registration Authority text files.

For one-time migrations and deterministic tests, --input-json accepts the old
oui-db.json representation.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import gzip
import json
import re
import struct
import sys
import urllib.request
from pathlib import Path
from typing import Dict, Iterable, Tuple

SYSTEMD_HWDB = Path("/usr/lib/udev/hwdb.d/20-OUI.hwdb")
WIRESHARK_MANUF_URL = "https://www.wireshark.org/download/automated/data/manuf"

IEEE_SOURCES = {
    "MA-L / OUI, 24-bit prefix": "https://standards-oui.ieee.org/oui/oui.txt",
    "MA-M / OUI-28, 28-bit prefix": "https://standards-oui.ieee.org/oui28/mam.txt",
    "MA-S / OUI-36, 36-bit prefix": "https://standards-oui.ieee.org/oui36/oui36.txt",
}

PREFIX_BITS = {6: 24, 7: 28, 9: 36}
PREFIX_BYTES = {24: 3, 28: 4, 36: 5}

MAGIC = b"IPCOUI02"
FORMAT_VERSION = 2
FLAG_UTF8 = 0x0001
FLAG_FRONT_CODED = 0x0002
FLAGS = FLAG_UTF8 | FLAG_FRONT_CODED
VENDOR_BLOCK_SIZE = 32

# 8s magic
# H format version
# H flags
# 10I:
#   count24, count28, count36, vendor_count,
#   off24, off28, off36, off_vendor_blocks, off_strings, file_size
# 32s SHA-256(payload)
# 12s YYYY-MM-DD + two NUL bytes
HEADER_STRUCT = struct.Struct("<8sHH10I32s12s")
HEADER_SIZE = HEADER_STRUCT.size
assert HEADER_SIZE == 96


def clean_prefix(raw: str) -> str:
    return re.sub(r"[^0-9A-Fa-f]", "", raw or "").upper()


def clean_vendor(raw: str) -> str:
    return " ".join((raw or "").replace("\x00", "").split()).strip()


def parse_systemd_hwdb(path: Path) -> Dict[str, str]:
    entries: Dict[str, str] = {}
    current_prefix: str | None = None

    for line in path.read_text(encoding="utf-8").splitlines():
        prefix_match = re.match(r"OUI:([0-9A-F]+)\*$", line)
        if prefix_match:
            current_prefix = prefix_match.group(1).upper()
            continue

        vendor_match = re.match(r" ID_OUI_FROM_DATABASE=(.*)$", line)
        if vendor_match and current_prefix:
            if len(current_prefix) in PREFIX_BITS:
                vendor = clean_vendor(vendor_match.group(1))
                if vendor:
                    entries[current_prefix] = vendor
            current_prefix = None

    return entries


def fetch_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "ipcalc-oui-builder/2.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8", errors="replace")


def parse_ieee_text(text: str) -> Iterable[Tuple[str, str]]:
    for line in text.splitlines():
        match = re.match(
            r"^\s*([0-9A-Fa-f][0-9A-Fa-f:-]{4,})\s+\((?:hex|base 16)\)\s+(.+?)\s*$",
            line,
        )
        if not match:
            continue
        prefix = clean_prefix(match.group(1))
        vendor = clean_vendor(match.group(2))
        if len(prefix) in PREFIX_BITS and vendor:
            yield prefix, vendor


def parse_wireshark_manuf(text: str) -> Dict[str, str]:
    entries: Dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        parts = line.split(None, 2)
        if len(parts) < 2:
            continue

        raw_prefix, _, raw_mask = parts[0].partition("/")
        prefix = clean_prefix(raw_prefix)
        if raw_mask.isdigit():
            prefix = prefix[: (int(raw_mask) + 3) // 4]
        if len(prefix) not in PREFIX_BITS:
            continue

        vendor = clean_vendor(parts[2] if len(parts) == 3 else parts[1])
        if vendor:
            entries[prefix] = vendor

    return entries


def build_from_wireshark() -> Dict[str, str]:
    print(f"Downloading {WIRESHARK_MANUF_URL}", file=sys.stderr)
    return parse_wireshark_manuf(fetch_text(WIRESHARK_MANUF_URL))


def build_from_ieee() -> Dict[str, str]:
    entries: Dict[str, str] = {}
    for _, url in IEEE_SOURCES.items():
        print(f"Downloading {url}", file=sys.stderr)
        for prefix, vendor in parse_ieee_text(fetch_text(url)):
            entries[prefix] = vendor
    return entries


def load_legacy_json(path: Path) -> Tuple[Dict[str, str], str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    raw_entries = payload.get("entries")
    if not isinstance(raw_entries, dict):
        raise RuntimeError(f"{path}: entries must be an object")

    entries: Dict[str, str] = {}
    for raw_prefix, record in raw_entries.items():
        prefix = clean_prefix(raw_prefix)
        if len(prefix) not in PREFIX_BITS:
            continue
        if isinstance(record, str):
            vendor = clean_vendor(record)
        elif isinstance(record, dict):
            vendor = clean_vendor(record.get("vendor") or record.get("organization") or "")
        else:
            continue
        if vendor:
            entries[prefix] = vendor

    generated_at = str(payload.get("generatedAt") or "")
    date = generated_at[:10] if re.match(r"^\d{4}-\d{2}-\d{2}", generated_at) else current_date()
    return entries, date


def current_date() -> str:
    return dt.datetime.now(dt.timezone.utc).date().isoformat()


def common_prefix_bytes(left: bytes, right: bytes) -> int:
    limit = min(len(left), len(right), 0xFFFF)
    index = 0
    while index < limit and left[index] == right[index]:
        index += 1
    return index


def pack_prefix(prefix: str) -> bytes:
    bits = PREFIX_BITS[len(prefix)]
    return int(prefix, 16).to_bytes(PREFIX_BYTES[bits], "big")


def build_binary(entries: Dict[str, str], generated_date: str) -> bytes:
    normalized: Dict[str, str] = {}
    for raw_prefix, raw_vendor in entries.items():
        prefix = clean_prefix(raw_prefix)
        vendor = clean_vendor(raw_vendor)
        if len(prefix) not in PREFIX_BITS or not vendor:
            continue
        normalized[prefix] = vendor

    by_bits: Dict[int, Dict[str, str]] = {24: {}, 28: {}, 36: {}}
    for prefix, vendor in normalized.items():
        by_bits[PREFIX_BITS[len(prefix)]][prefix] = vendor

    vendors = sorted(set(normalized.values()), key=lambda value: (value.casefold(), value))
    if len(vendors) > 0xFFFF:
        raise RuntimeError(
            f"{len(vendors):,} unique vendors exceed uint16 vendor_id capacity; bump the format"
        )
    vendor_id = {vendor: index for index, vendor in enumerate(vendors)}

    tables: Dict[int, bytes] = {}
    for bits in (24, 28, 36):
        blob = bytearray()
        for prefix, vendor in sorted(by_bits[bits].items(), key=lambda item: int(item[0], 16)):
            blob += pack_prefix(prefix)
            blob += struct.pack("<H", vendor_id[vendor])
        tables[bits] = bytes(blob)

    vendor_blocks = bytearray()
    string_blob = bytearray()
    for block_start in range(0, len(vendors), VENDOR_BLOCK_SIZE):
        vendor_blocks += struct.pack("<I", len(string_blob))
        previous = b""
        for vendor in vendors[block_start : block_start + VENDOR_BLOCK_SIZE]:
            encoded = vendor.encode("utf-8")
            common = 0 if not previous else common_prefix_bytes(previous, encoded)
            suffix = encoded[common:]
            if common > 0xFFFF or len(suffix) > 0xFFFF:
                raise RuntimeError(f"vendor string is too long for v2 encoding: {vendor!r}")
            string_blob += struct.pack("<HH", common, len(suffix))
            string_blob += suffix
            previous = encoded

    off24 = HEADER_SIZE
    off28 = off24 + len(tables[24])
    off36 = off28 + len(tables[28])
    off_vendor_blocks = off36 + len(tables[36])
    off_strings = off_vendor_blocks + len(vendor_blocks)

    payload = tables[24] + tables[28] + tables[36] + bytes(vendor_blocks) + bytes(string_blob)
    file_size = HEADER_SIZE + len(payload)
    payload_sha = hashlib.sha256(payload).digest()
    date_bytes = generated_date.encode("ascii")
    if len(date_bytes) != 10:
        raise RuntimeError(f"generated date must be YYYY-MM-DD, got {generated_date!r}")

    header = HEADER_STRUCT.pack(
        MAGIC,
        FORMAT_VERSION,
        FLAGS,
        len(by_bits[24]),
        len(by_bits[28]),
        len(by_bits[36]),
        len(vendors),
        off24,
        off28,
        off36,
        off_vendor_blocks,
        off_strings,
        file_size,
        payload_sha,
        date_bytes + b"\0\0",
    )
    return header + payload


def read_prefix_value(db: bytes, offset: int, size: int) -> int:
    return int.from_bytes(db[offset : offset + size], "big")


def verify_binary(db: bytes, entries: Dict[str, str]) -> None:
    if len(db) < HEADER_SIZE:
        raise RuntimeError("generated DB is shorter than its header")

    unpacked = HEADER_STRUCT.unpack_from(db, 0)
    (
        magic,
        version,
        flags,
        count24,
        count28,
        count36,
        vendor_count,
        off24,
        off28,
        off36,
        off_vendor_blocks,
        off_strings,
        file_size,
        payload_sha,
        _reserved,
    ) = unpacked

    if magic != MAGIC or version != FORMAT_VERSION or flags != FLAGS:
        raise RuntimeError("generated DB header is invalid")
    if file_size != len(db):
        raise RuntimeError("generated DB file_size does not match actual size")
    if hashlib.sha256(db[HEADER_SIZE:]).digest() != payload_sha:
        raise RuntimeError("generated DB payload SHA-256 mismatch")

    expected_offsets = (
        HEADER_SIZE,
        HEADER_SIZE + count24 * 5,
        HEADER_SIZE + count24 * 5 + count28 * 6,
    )
    if (off24, off28, off36) != expected_offsets:
        raise RuntimeError("generated DB prefix table offsets are inconsistent")
    if off_vendor_blocks != off36 + count36 * 7:
        raise RuntimeError("generated DB vendor block index offset is inconsistent")

    block_count = (vendor_count + VENDOR_BLOCK_SIZE - 1) // VENDOR_BLOCK_SIZE
    if off_strings != off_vendor_blocks + block_count * 4 or off_strings > len(db):
        raise RuntimeError("generated DB string offsets are inconsistent")

    decoded_vendors = []
    for block in range(block_count):
        relative = struct.unpack_from("<I", db, off_vendor_blocks + block * 4)[0]
        position = off_strings + relative
        previous = b""
        block_end = min(vendor_count, (block + 1) * VENDOR_BLOCK_SIZE)
        for _vendor_index in range(block * VENDOR_BLOCK_SIZE, block_end):
            common, suffix_len = struct.unpack_from("<HH", db, position)
            position += 4
            suffix = db[position : position + suffix_len]
            position += suffix_len
            if common > len(previous):
                raise RuntimeError("front-coded vendor prefix length exceeds previous string")
            current = previous[:common] + suffix
            decoded_vendors.append(current.decode("utf-8"))
            previous = current

    if len(decoded_vendors) != vendor_count:
        raise RuntimeError("generated DB vendor count mismatch")

    tables = {
        24: (off24, count24, 3, 5),
        28: (off28, count28, 4, 6),
        36: (off36, count36, 5, 7),
    }

    normalized = {
        clean_prefix(prefix): clean_vendor(vendor)
        for prefix, vendor in entries.items()
        if len(clean_prefix(prefix)) in PREFIX_BITS and clean_vendor(vendor)
    }
    if sum((count24, count28, count36)) != len(normalized):
        raise RuntimeError("generated DB prefix count mismatch")

    for prefix, expected_vendor in normalized.items():
        bits = PREFIX_BITS[len(prefix)]
        table_offset, count, prefix_bytes, record_size = tables[bits]
        target = int(prefix, 16)
        lo, hi = 0, count - 1
        found_vendor_id = None
        while lo <= hi:
            mid = (lo + hi) // 2
            record_offset = table_offset + mid * record_size
            value = read_prefix_value(db, record_offset, prefix_bytes)
            if value < target:
                lo = mid + 1
            elif value > target:
                hi = mid - 1
            else:
                found_vendor_id = struct.unpack_from("<H", db, record_offset + prefix_bytes)[0]
                break
        if found_vendor_id is None:
            raise RuntimeError(f"verification lookup missed prefix {prefix}")
        if decoded_vendors[found_vendor_id] != expected_vendor:
            raise RuntimeError(
                f"verification mismatch for {prefix}: "
                f"{decoded_vendors[found_vendor_id]!r} != {expected_vendor!r}"
            )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build compact binary OUI database for IP Calculator MAC tools"
    )
    parser.add_argument("-o", "--output", default="oui-db.bin.gz", help="Output compact DB path (.gz for gzip, otherwise raw binary)")
    parser.add_argument(
        "--input-json",
        help="Convert an existing legacy oui-db.json instead of downloading sources",
    )
    parser.add_argument(
        "--force-download",
        action="store_true",
        help="Ignore local systemd hwdb and download vendor data",
    )
    parser.add_argument(
        "--ieee-only",
        action="store_true",
        help="Download IEEE assignment files instead of Wireshark manufacturer data",
    )
    args = parser.parse_args()

    if args.input_json:
        source_path = Path(args.input_json)
        print(f"Converting {source_path}", file=sys.stderr)
        entries, generated_date = load_legacy_json(source_path)
    elif SYSTEMD_HWDB.exists() and not args.force_download:
        print(f"Using {SYSTEMD_HWDB}", file=sys.stderr)
        entries = parse_systemd_hwdb(SYSTEMD_HWDB)
        generated_date = current_date()
    else:
        if args.ieee_only:
            entries = build_from_ieee()
        else:
            try:
                entries = build_from_wireshark()
            except Exception as exc:
                print(f"Wireshark download failed: {exc}", file=sys.stderr)
                print("Falling back to IEEE Registration Authority files", file=sys.stderr)
                entries = build_from_ieee()
        generated_date = current_date()

    db = build_binary(entries, generated_date)
    verify_binary(db, entries)

    output = Path(args.output)
    if output.suffix == '.gz':
        gzip_mtime = int(dt.datetime.fromisoformat(generated_date).replace(tzinfo=dt.timezone.utc).timestamp())
        output_bytes = gzip.compress(db, compresslevel=9, mtime=gzip_mtime)
    else:
        output_bytes = db
    output.write_bytes(output_bytes)

    counts = {digits: 0 for digits in PREFIX_BITS}
    for prefix in entries:
        cleaned = clean_prefix(prefix)
        if len(cleaned) in counts:
            counts[len(cleaned)] += 1
    print(
        f"Wrote {sum(counts.values()):,} prefixes "
        f"(/24={counts[6]:,}, /28={counts[7]:,}, /36={counts[9]:,}) "
        f"to {output} ({len(output_bytes):,} bytes; raw {len(db):,}); verification passed",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
