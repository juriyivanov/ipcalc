const test = require('node:test');
const assert = require('node:assert/strict');
const ip = require('../ipv4-utils.js');

const toCidr = (start, end) => ip.rangeToSubnets(ip.parseIPv4(start), ip.parseIPv4(end)).map((s) => `${ip.intToIPv4(s.network)}/${s.prefix}`);

test('strict IPv4 parser accepts only four complete decimal octets', () => {
  assert.equal(ip.parseIPv4('192.168.1.1'), 0xc0a80101);
  assert.equal(ip.parseIPv4(' 0.0.0.0 '), 0);
  for (const value of ['192.168.1', '192.168.1.256', '192.168.1.-1', '192.168.1.1abc', '1.2.3.4.5', '1.2.3', '']) {
    assert.equal(ip.parseIPv4(value), null, value);
  }
});

test('strict IP/prefix parser rejects internal garbage', () => {
  assert.deepEqual(ip.parseIPv4WithPrefix('192.168.1.1/24'), { ip: 0xc0a80101, prefix: 24 });
  assert.deepEqual(ip.parseIPv4WithPrefix('192.168.1.1', 25), { ip: 0xc0a80101, prefix: 25 });
  for (const value of ['192.168.1.1/24abc', '192.168.1.1abc/24', '192.168.1.1 /24', '192.168.1.1/33']) {
    assert.equal(ip.parseIPv4WithPrefix(value), null, value);
  }
});

test('strict CIDR parser rejects trailing or out-of-range input', () => {
  assert.equal(ip.parseCIDR('/0'), 0);
  assert.equal(ip.parseCIDR('32'), 32);
  for (const value of ['/33', '/-1', '/24abc', '24garbage', '/', '']) {
    assert.equal(ip.parseCIDR(value), null, value);
  }
});

test('CIDR masks round-trip and non-contiguous dotted masks are invalid', () => {
  for (let cidr = 0; cidr <= 32; cidr++) {
    const mask = ip.cidrToMask(cidr);
    assert.equal(ip.maskToCIDR(mask), cidr);
    assert.equal(ip.parseMask(ip.intToIPv4(mask)), mask);
  }
  assert.equal(ip.parseMask('255.0.255.0'), null);
  assert.equal(ip.parseSubnet('/24abc'), null);
});

test('range to CIDR covers IPv4 edge cases minimally', () => {
  assert.deepEqual(toCidr('0.0.0.0', '0.0.0.0'), ['0.0.0.0/32']);
  assert.deepEqual(toCidr('0.0.0.0', '0.0.0.255'), ['0.0.0.0/24']);
  assert.deepEqual(toCidr('128.0.0.0', '128.0.0.0'), ['128.0.0.0/32']);
  assert.deepEqual(toCidr('128.0.0.0', '128.0.0.255'), ['128.0.0.0/24']);
  assert.deepEqual(toCidr('255.255.255.255', '255.255.255.255'), ['255.255.255.255/32']);
  assert.deepEqual(toCidr('0.0.0.0', '255.255.255.255'), ['0.0.0.0/0']);
  assert.deepEqual(toCidr('127.255.255.255', '128.0.0.1'), ['127.255.255.255/32', '128.0.0.0/31']);
});

test('previous/next subnet stepping does not wrap around IPv4 bounds', () => {
  const cases = [
    ['0.0.0.0', 0], ['0.0.0.0', 24], ['255.255.255.255', 32], ['255.255.255.0', 24], ['128.0.0.0', 1]
  ];
  for (const [addr, prefix] of cases) {
    const value = ip.parseIPv4(addr);
    const prev = ip.safeSubnetStep(value, prefix, -1, prefix >= 31 ? 0 : 1);
    const next = ip.safeSubnetStep(value, prefix, 1, prefix >= 31 ? 0 : 1);
    if (addr.startsWith('0.0.0.0')) assert.equal(prev, null, `${addr}/${prefix} prev`);
    if (addr.startsWith('255.255.255') || prefix === 0) assert.equal(next, null, `${addr}/${prefix} next`);
    if (addr === '128.0.0.0' && prefix === 1) assert.equal(ip.intToIPv4(prev), '0.0.0.1');
  }
});

test('subnet counts and display limiting are bounded', () => {
  assert.equal(ip.subnetCount(8, 32), 16777216);
  assert.equal(ip.SUBNET_RENDER_LIMIT, 4096);
  assert.equal(Math.min(ip.subnetCount(8, 32), ip.SUBNET_RENDER_LIMIT), 4096);
});
