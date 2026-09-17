const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const db = fs.readFileSync(path.join(__dirname, '..', 'oui-db.bin'));
assert(db.length > 100000 && db.length < 2 * 1024 * 1024, 'compact DB size is implausible');
assert.strictEqual(db.subarray(0, 8).toString('ascii'), 'IPCOUI02');
assert.strictEqual(db.readUInt16LE(8), 2);
assert.strictEqual(db.readUInt16LE(10), 3);

const count24 = db.readUInt32LE(12);
const count28 = db.readUInt32LE(16);
const count36 = db.readUInt32LE(20);
const vendorCount = db.readUInt32LE(24);
const off24 = db.readUInt32LE(28);
const off28 = db.readUInt32LE(32);
const off36 = db.readUInt32LE(36);
const offBlocks = db.readUInt32LE(40);
const offStrings = db.readUInt32LE(44);
const fileSize = db.readUInt32LE(48);

assert(count24 > 10000 && count28 > 1000 && count36 > 1000, 'prefix tables look unexpectedly small');
assert(vendorCount > 5000 && vendorCount <= 65535, 'vendor table size is implausible');
assert.strictEqual(fileSize, db.length);
assert.strictEqual(off24, 96);
assert.strictEqual(off28, off24 + count24 * 5);
assert.strictEqual(off36, off28 + count28 * 6);
assert.strictEqual(offBlocks, off36 + count36 * 7);
const blockCount = Math.ceil(vendorCount / 32);
assert.strictEqual(offStrings, offBlocks + blockCount * 4);

const expectedHash = db.subarray(52, 84).toString('hex');
const actualHash = crypto.createHash('sha256').update(db.subarray(96)).digest('hex');
assert.strictEqual(actualHash, expectedHash, 'payload SHA-256 mismatch');
assert.match(db.subarray(84, 94).toString('ascii'), /^\d{4}-\d{2}-\d{2}$/);

function prefixValue(offset, bytes) {
  let value = 0n;
  for (let i = 0; i < bytes; i += 1) value = (value << 8n) | BigInt(db[offset + i]);
  return value;
}
for (const [count, offset, prefixBytes, recordSize] of [
  [count24, off24, 3, 5], [count28, off28, 4, 6], [count36, off36, 5, 7]
]) {
  let previous = -1n;
  for (let i = 0; i < count; i += 1) {
    const pos = offset + i * recordSize;
    const current = prefixValue(pos, prefixBytes);
    assert(current > previous, 'prefix table must be strictly sorted');
    assert(db.readUInt16LE(pos + prefixBytes) < vendorCount, 'vendor id out of range');
    previous = current;
  }
}

let decodedVendors = 0;
for (let block = 0; block < blockCount; block += 1) {
  let pos = offStrings + db.readUInt32LE(offBlocks + block * 4);
  let previous = Buffer.alloc(0);
  const end = Math.min(vendorCount, (block + 1) * 32);
  for (let id = block * 32; id < end; id += 1) {
    const common = db.readUInt16LE(pos);
    const suffixLength = db.readUInt16LE(pos + 2);
    pos += 4;
    assert(common <= previous.length, 'front-code prefix exceeds previous vendor');
    const current = Buffer.concat([previous.subarray(0, common), db.subarray(pos, pos + suffixLength)]);
    pos += suffixLength;
    assert(current.length > 0, 'empty vendor string');
    new TextDecoder('utf-8', { fatal: true }).decode(current);
    previous = current;
    decodedVendors += 1;
  }
}
assert.strictEqual(decodedVendors, vendorCount);
console.log(`Compact OUI DB: ${count24 + count28 + count36} prefixes, ${vendorCount} vendors, ${db.length} bytes`);
