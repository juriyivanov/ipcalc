const test = require('node:test');
const assert = require('node:assert/strict');
const ip = require('../ipv4-utils.js');

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

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


test('subnet calculation preparation validates and normalizes inputs', () => {
  assert.deepEqual(ip.prepareSubnetCalculation('192.168.0.0', '/24', '/28'), {
    ok: true,
    network: ip.parseIPv4('192.168.0.0'),
    baseCidr: 24,
    newCidr: 28,
    totalSubnets: 16,
    visibleSubnets: 16
  });
  assert.deepEqual(ip.prepareSubnetCalculation('192.168.0.123', '/24', '/28'), {
    ok: true,
    network: ip.parseIPv4('192.168.0.0'),
    baseCidr: 24,
    newCidr: 28,
    totalSubnets: 16,
    visibleSubnets: 16
  });
  assert.deepEqual(ip.prepareSubnetCalculation('10.0.0.0', '/8', '/32'), {
    ok: true,
    network: ip.parseIPv4('10.0.0.0'),
    baseCidr: 8,
    newCidr: 32,
    totalSubnets: 16777216,
    visibleSubnets: ip.SUBNET_RENDER_LIMIT
  });
  assert.deepEqual(ip.prepareSubnetCalculation('0.0.0.0', '/0', '/32'), {
    ok: true,
    network: ip.parseIPv4('0.0.0.0'),
    baseCidr: 0,
    newCidr: 32,
    totalSubnets: 4294967296,
    visibleSubnets: ip.SUBNET_RENDER_LIMIT
  });
  assert.deepEqual(ip.prepareSubnetCalculation('192.168.0.0', '255.255.255.0', '255.255.255.240'), {
    ok: true,
    network: ip.parseIPv4('192.168.0.0'),
    baseCidr: 24,
    newCidr: 28,
    totalSubnets: 16,
    visibleSubnets: 16
  });
});

test('subnet calculation preparation rejects invalid integrated inputs', () => {
  assert.equal(ip.prepareSubnetCalculation('not-an-ip', '/24', '/28').error, 'invalid-base-ip');
  assert.equal(ip.prepareSubnetCalculation('192.168.1.1abc', '/24', '/28').error, 'invalid-base-ip');
  for (const value of ['/abc', '/24abc', '/33', '/-1', '/', '', '255.0.255.0']) {
    const result = ip.prepareSubnetCalculation('192.168.0.0', '/24', value);
    assert.equal(result.error, 'invalid-new-cidr', value);
    assert.equal(result.message, 'Invalid new CIDR');
  }
  assert.equal(ip.prepareSubnetCalculation('192.168.0.0', '/0', '/abc').error, 'invalid-new-cidr');
  assert.equal(ip.prepareSubnetCalculation('192.168.0.0', '/24', '/16').error, 'new-cidr-too-small');
});

test('index and service worker include shared IPv4 utilities', () => {
  const indexHtml = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
  const serviceWorker = readFileSync(join(__dirname, '..', 'sw.js'), 'utf8');
  assert.match(indexHtml, /<script src="\.\/ipv4-utils\.js"><\/script>/);
  assert.match(serviceWorker, /ipv4-utils\.js/);
});
