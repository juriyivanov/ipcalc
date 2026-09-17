(function () {
  'use strict';

  const CORE_SCRIPT = './app-core.js';
  const COMPACT_DB_PATH = './oui-db.bin';
  const LEGACY_DB_SUFFIX = '/oui-db.json';
  const MAGIC = 'IPCOUI02';
  const HEADER_SIZE = 96;
  const VENDOR_BLOCK_SIZE = 32;
  const TABLES = {
    24: { countOffset: 12, tableOffsetOffset: 28, prefixBytes: 3, recordSize: 5 },
    28: { countOffset: 16, tableOffsetOffset: 32, prefixBytes: 4, recordSize: 6 },
    36: { countOffset: 20, tableOffsetOffset: 36, prefixBytes: 5, recordSize: 7 }
  };

  const originalFetch = window.fetch.bind(window);
  const textDecoder = new TextDecoder('utf-8');
  let compactDbPromise = null;

  function ascii(bytes, offset, length) {
    let out = '';
    for (let i = 0; i < length; i += 1) {
      const value = bytes[offset + i];
      if (!value) break;
      out += String.fromCharCode(value);
    }
    return out;
  }

  function parseCompactDb(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < HEADER_SIZE) {
      throw new Error('Compact OUI database is truncated.');
    }

    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    if (ascii(bytes, 0, 8) !== MAGIC) throw new Error('Compact OUI database has an invalid magic header.');
    if (view.getUint16(8, true) !== 2) throw new Error('Unsupported compact OUI database version.');

    const vendorCount = view.getUint32(24, true);
    const vendorBlocksOffset = view.getUint32(40, true);
    const stringsOffset = view.getUint32(44, true);
    const fileSize = view.getUint32(48, true);
    if (fileSize !== buffer.byteLength) throw new Error('Compact OUI database size does not match its header.');

    const tables = {};
    for (const [bitsText, definition] of Object.entries(TABLES)) {
      const bits = Number(bitsText);
      tables[bits] = {
        count: view.getUint32(definition.countOffset, true),
        offset: view.getUint32(definition.tableOffsetOffset, true),
        prefixBytes: definition.prefixBytes,
        recordSize: definition.recordSize
      };
    }

    if (tables[24].offset !== HEADER_SIZE ||
        tables[28].offset !== tables[24].offset + tables[24].count * tables[24].recordSize ||
        tables[36].offset !== tables[28].offset + tables[28].count * tables[28].recordSize ||
        vendorBlocksOffset !== tables[36].offset + tables[36].count * tables[36].recordSize) {
      throw new Error('Compact OUI database table offsets are inconsistent.');
    }

    const blockCount = Math.ceil(vendorCount / VENDOR_BLOCK_SIZE);
    if (stringsOffset !== vendorBlocksOffset + blockCount * 4 || stringsOffset > buffer.byteLength) {
      throw new Error('Compact OUI database string offsets are inconsistent.');
    }

    return {
      bytes,
      view,
      tables,
      vendorCount,
      vendorBlocksOffset,
      stringsOffset,
      generatedAt: ascii(bytes, 84, 10),
      vendorBlockCache: new Map()
    };
  }

  function readPrefixNumber(bytes, offset, length) {
    let value = 0;
    for (let i = 0; i < length; i += 1) value = value * 256 + bytes[offset + i];
    return value;
  }

  function prefixNumberToHex(value, digits) {
    return value.toString(16).toUpperCase().padStart(digits, '0');
  }

  function findVendorId(db, prefix) {
    const bits = prefix.length * 4;
    const table = db.tables[bits];
    if (!table) return null;

    const target = Number.parseInt(prefix, 16);
    let low = 0;
    let high = table.count - 1;
    while (low <= high) {
      const mid = (low + high) >>> 1;
      const recordOffset = table.offset + mid * table.recordSize;
      const value = readPrefixNumber(db.bytes, recordOffset, table.prefixBytes);
      if (value < target) low = mid + 1;
      else if (value > target) high = mid - 1;
      else return db.view.getUint16(recordOffset + table.prefixBytes, true);
    }
    return null;
  }

  function decodeVendorBlock(db, blockIndex) {
    if (db.vendorBlockCache.has(blockIndex)) return db.vendorBlockCache.get(blockIndex);

    const relativeOffset = db.view.getUint32(db.vendorBlocksOffset + blockIndex * 4, true);
    let position = db.stringsOffset + relativeOffset;
    let previous = new Uint8Array(0);
    const values = [];
    const firstVendorId = blockIndex * VENDOR_BLOCK_SIZE;
    const lastVendorId = Math.min(db.vendorCount, firstVendorId + VENDOR_BLOCK_SIZE);

    for (let vendorId = firstVendorId; vendorId < lastVendorId; vendorId += 1) {
      if (position + 4 > db.bytes.length) throw new Error('Compact OUI vendor string table is truncated.');
      const commonLength = db.view.getUint16(position, true);
      const suffixLength = db.view.getUint16(position + 2, true);
      position += 4;
      if (commonLength > previous.length || position + suffixLength > db.bytes.length) {
        throw new Error('Compact OUI vendor string entry is invalid.');
      }
      const current = new Uint8Array(commonLength + suffixLength);
      current.set(previous.subarray(0, commonLength), 0);
      current.set(db.bytes.subarray(position, position + suffixLength), commonLength);
      position += suffixLength;
      values.push(textDecoder.decode(current));
      previous = current;
    }

    db.vendorBlockCache.set(blockIndex, values);
    return values;
  }

  function vendorById(db, vendorId) {
    if (!Number.isInteger(vendorId) || vendorId < 0 || vendorId >= db.vendorCount) return null;
    const blockIndex = Math.floor(vendorId / VENDOR_BLOCK_SIZE);
    return decodeVendorBlock(db, blockIndex)[vendorId % VENDOR_BLOCK_SIZE] || null;
  }

  function lookupExactPrefix(db, prefix) {
    const vendorId = findVendorId(db, prefix);
    return vendorId === null ? undefined : vendorById(db, vendorId);
  }

  function allPrefixes(db) {
    const result = [];
    for (const bits of [24, 28, 36]) {
      const table = db.tables[bits];
      const digits = bits / 4;
      for (let index = 0; index < table.count; index += 1) {
        const offset = table.offset + index * table.recordSize;
        result.push(prefixNumberToHex(readPrefixNumber(db.bytes, offset, table.prefixBytes), digits));
      }
    }
    return result;
  }

  function makeLegacyEntriesProxy(db) {
    let keys = null;
    return new Proxy(Object.create(null), {
      get(_target, property) {
        if (typeof property !== 'string') return undefined;
        if (!/^[0-9A-F]{6,9}$/.test(property)) return undefined;
        return lookupExactPrefix(db, property);
      },
      has(_target, property) {
        return typeof property === 'string' && lookupExactPrefix(db, property) !== undefined;
      },
      ownKeys() {
        if (!keys) keys = allPrefixes(db);
        return keys;
      },
      getOwnPropertyDescriptor(_target, property) {
        if (typeof property !== 'string') return undefined;
        const value = lookupExactPrefix(db, property);
        if (value === undefined) return undefined;
        return { configurable: true, enumerable: true, value, writable: false };
      }
    });
  }

  async function loadCompactCompatibilityDb() {
    const response = await originalFetch(COMPACT_DB_PATH, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const db = parseCompactDb(await response.arrayBuffer());
    return {
      generatedAt: db.generatedAt || null,
      entries: makeLegacyEntriesProxy(db),
      compactFormat: 2
    };
  }

  function isLegacyOuiRequest(input) {
    let raw;
    if (typeof input === 'string') raw = input;
    else if (input instanceof URL) raw = input.href;
    else if (input && typeof input.url === 'string') raw = input.url;
    else return false;
    try {
      return new URL(raw, location.href).pathname.endsWith(LEGACY_DB_SUFFIX);
    } catch (_) {
      return raw.endsWith('oui-db.json');
    }
  }

  window.fetch = async function compactOuiFetch(input, init) {
    if (!isLegacyOuiRequest(input)) return originalFetch(input, init);
    if (!compactDbPromise) compactDbPromise = loadCompactCompatibilityDb();
    try {
      const db = await compactDbPromise;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        url: new URL(COMPACT_DB_PATH, location.href).href,
        json: async () => db
      };
    } catch (error) {
      compactDbPromise = null;
      console.warn('Compact OUI database load failed:', error);
      return {
        ok: false,
        status: 503,
        statusText: 'Compact OUI database unavailable',
        url: new URL(COMPACT_DB_PATH, location.href).href,
        json: async () => { throw error; }
      };
    }
  };

  let domContentLoadedSeen = document.readyState !== 'loading';
  if (!domContentLoadedSeen) {
    document.addEventListener('DOMContentLoaded', () => {
      domContentLoadedSeen = true;
    }, { once: true });
  }

  const core = document.createElement('script');
  core.src = CORE_SCRIPT;
  core.async = false;
  core.addEventListener('load', () => {
    if (domContentLoadedSeen) {
      document.dispatchEvent(new Event('DOMContentLoaded'));
    }
  }, { once: true });
  document.head.appendChild(core);
})();
