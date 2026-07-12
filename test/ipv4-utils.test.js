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

test('classifies IPv4 special-purpose blocks with longest-prefix match', () => {
  const cases = [
    ['10.1.2.3', 'Private use', '10.0.0.0/8', 'Private-Use'],
    ['100.64.1.1', 'Shared Address Space / CGNAT', '100.64.0.0/10', 'Shared Address Space'],
    ['127.0.0.1', 'Loopback', '127.0.0.0/8', 'Loopback'],
    ['169.254.10.20', 'Link-local', '169.254.0.0/16', 'Link Local'],
    ['192.0.0.9', 'IETF protocol assignment', '192.0.0.9/32', 'Port Control Protocol Anycast'],
    ['192.0.0.170', 'IETF protocol assignment', '192.0.0.170/32', 'NAT64/DNS64 Discovery'],
    ['192.0.2.1', 'Documentation', '192.0.2.0/24', 'Documentation (TEST-NET-1)'],
    ['192.31.196.1', 'IETF protocol assignment', '192.31.196.0/24', 'AS112-v4'],
    ['192.52.193.1', 'IETF protocol assignment', '192.52.193.0/24', 'AMT'],
    ['192.175.48.1', 'IETF protocol assignment', '192.175.48.0/24', 'Direct Delegation AS112 Service'],
    ['198.18.1.1', 'Benchmarking', '198.18.0.0/15', 'Benchmarking'],
    ['198.51.100.1', 'Documentation', '198.51.100.0/24', 'Documentation (TEST-NET-2)'],
    ['203.0.113.1', 'Documentation', '203.0.113.0/24', 'Documentation (TEST-NET-3)'],
    ['224.0.0.1', 'Multicast', '224.0.0.0/4', 'Multicast'],
    ['240.0.0.1', 'Reserved', '240.0.0.0/4', 'Reserved'],
    ['255.255.255.255', 'Limited broadcast', '255.255.255.255/32', 'Limited Broadcast'],
    ['8.8.8.8', 'Ordinary unicast', 'Not in special-purpose registry', 'Not in IANA special-purpose registry']
  ];
  for (const [address, category, block, name] of cases) {
    const result = ip.classifyIPv4(address);
    assert.equal(result.category, category, address);
    assert.equal(result.block, block, address);
    assert.equal(result.name, name, address);
  }
  assert.equal(ip.classifyIPv4('192.0.0.9').prefix, 32);
  assert.equal(ip.classifyIPv4('192.0.0.1').block, '192.0.0.0/29');
  assert.equal(ip.classifyIPv4('192.88.99.2').globallyReachableLabel, 'No');
  assert.equal(ip.classifyIPv4('192.0.0.170').reservedByProtocol, true);
  assert.equal(ip.classifyIPv4('192.0.0.171').reservedByProtocol, true);
  assert.equal(ip.classifyIPv4('8.8.8.8').forwardableLabel, 'Not classified');
});

test('generates PTR names and reverse DNS information', () => {
  assert.equal(ip.ipv4ToPtrName('192.168.10.25'), '25.10.168.192.in-addr.arpa.');
  assert.equal(ip.ipv4ToPtrName('0.0.0.0'), '0.0.0.0.in-addr.arpa.');
  assert.equal(ip.ipv4ToPtrName('255.255.255.255'), '255.255.255.255.in-addr.arpa.');
  assert.equal(ip.reverseZoneForPrefix('10.20.30.40', 8).reverseZone, '10.in-addr.arpa.');
  assert.equal(ip.reverseZoneForPrefix('10.20.30.40', 16).reverseZone, '20.10.in-addr.arpa.');
  assert.equal(ip.reverseZoneForPrefix('10.20.30.40', 24).reverseZone, '30.20.10.in-addr.arpa.');
  assert.equal(ip.reverseZoneForPrefix('192.168.10.25', 24).absolutePtrRecord, '25.10.168.192.in-addr.arpa. IN PTR host.example.net.');
  assert.equal(ip.reverseZoneForPrefix('192.168.10.25', 24).relativeOwner, '25');
  assert.equal(ip.reverseZoneForPrefix('192.168.10.25', 16).relativeOwner, '25.10');
  assert.equal(ip.reverseZoneForPrefix('192.168.10.25', 8).relativeOwner, '25.10.168');
  assert.equal(ip.reverseZoneForPrefix('192.168.10.25', 0).relativeOwner, '25.10.168.192');
  assert.notEqual(ip.reverseZoneForPrefix('192.168.1.25', 24).absolutePtrRecord, '0 IN PTR host.example.net.');
  assert.equal(ip.reverseZoneForPrefix('0.0.0.0', 0).reverseZone, 'in-addr.arpa.');
  assert.equal(ip.reverseZoneForPrefix('8.8.8.8', 32).ptrName, '8.8.8.8.in-addr.arpa.');

  const rfc2317 = ip.reverseZoneForPrefix('192.0.2.130', 26);
  assert.equal(rfc2317.parentZone, '2.0.192.in-addr.arpa.');
  assert.equal(rfc2317.addressRange, '192.0.2.128 – 192.0.2.191');
  assert.equal(rfc2317.suggestedChildZone, '128-191.2.0.192.in-addr.arpa.');
  assert.equal(rfc2317.relativeOwner, '130');
  assert.equal(rfc2317.absolutePtrRecord, '130.2.0.192.in-addr.arpa. IN PTR host.example.net.');
  assert.equal(rfc2317.zoneFileTemplate, '$ORIGIN 128-191.2.0.192.in-addr.arpa.\n130 IN PTR host.example.net.');

  const multiple9 = ip.reverseZoneForPrefix('10.0.0.0', 9);
  assert.equal(multiple9.kind, 'multiple');
  assert.equal(multiple9.delegationBoundary, '/16');

  const multiple23 = ip.reverseZoneForPrefix('192.168.0.0', 23);
  assert.equal(multiple23.kind, 'multiple');
  assert.equal(multiple23.delegationBoundary, '/24');

  const multiple = ip.reverseZoneForPrefix('172.16.16.1', 20);
  assert.equal(multiple.kind, 'multiple');
  assert.equal(multiple.message, 'Multiple octet-boundary zones required');
  assert.equal(multiple.delegationBoundary, '/24');
  assert.equal(multiple.reverseZone, undefined);
});
