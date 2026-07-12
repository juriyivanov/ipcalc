const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../cidr-set-utils.js');
function f(items){ return items.map(C.formatCidr); }
test('parse CIDR, masks, comments, separators and invalid lines', () => {
  const r = C.parseCidrList('10.0.0.7/24, 192.168.1.0 255.255.255.0; # ok\n10.0.999.1/24');
  assert.deepEqual(f(r.items), ['10.0.0.0/24','192.168.1.0/24']);
  assert.equal(r.errors.length, 1); assert.equal(r.errors[0].message, 'Invalid IPv4 address');
});
test('deduplication and containment', () => {
  assert.deepEqual(f(C.normalizeCidrSet(C.parseCidrList('10.0.0.0/24\n10.0.0.0/24').items).items), ['10.0.0.0/24']);
  const n = C.normalizeCidrSet(C.parseCidrList('10.0.0.0/8\n10.1.0.0/16').items);
  assert.deepEqual(f(n.items), ['10.0.0.0/8']); assert.equal(n.containedCount, 1);
});
test('aggregation', () => {
  assert.deepEqual(f(C.aggregateCidrSet(C.parseCidrList('10.0.0.0/24\n10.0.1.0/24').items).items), ['10.0.0.0/23']);
  assert.deepEqual(f(C.aggregateCidrSet(C.parseCidrList('10.0.0.0/24\n10.0.1.0/24\n10.0.2.0/24\n10.0.3.0/24').items).items), ['10.0.0.0/22']);
  assert.deepEqual(f(C.aggregateCidrSet(C.parseCidrList('10.0.0.0/24\n10.0.2.0/24').items).items), ['10.0.0.0/24','10.0.2.0/24']);
});
test('subtraction', () => {
  assert.deepEqual(f(C.subtractCidrSets(C.parseCidrList('10.0.0.0/24').items, C.parseCidrList('10.0.0.128/25').items).items), ['10.0.0.0/25']);
  assert.deepEqual(f(C.subtractCidrSets(C.parseCidrList('10.0.0.0/24').items, C.parseCidrList('10.0.0.64/26').items).items), ['10.0.0.0/26','10.0.0.128/25']);
  assert.deepEqual(f(C.subtractCidrSets(C.parseCidrList('10.0.0.0/24').items, C.parseCidrList('192.168.0.0/16').items).items), ['10.0.0.0/24']);
  assert.deepEqual(f(C.subtractCidrSets(C.parseCidrList('10.0.0.0/24').items, C.parseCidrList('10.0.0.0/24').items).items), []);
});
test('boundaries and analysis', () => {
  assert.deepEqual(f(C.parseCidrList('0.0.0.0/0\n255.255.255.255/32').items), ['0.0.0.0/0','255.255.255.255/32']);
  assert.equal(C.analyzeCidrSet(C.parseCidrList('10.0.0.0/8\n10.1.0.0/16').items).contained.length, 1);
});
test('exports and name sanitization', () => {
  const items = C.parseCidrList('10.0.0.0/24\n10.0.1.0/24').items;
  assert.equal(C.exportCidrList(items, 'plain'), '10.0.0.0/24\n10.0.1.0/24');
  assert.equal(C.exportCidrList(items, 'cisco-prefix-list', { name: 'NETWORKS' }), 'ip prefix-list NETWORKS seq 10 permit 10.0.0.0/24\nip prefix-list NETWORKS seq 20 permit 10.0.1.0/24');
  assert.equal(C.exportCidrList(items, 'mikrotik-address-list'), '/ip firewall address-list\nadd list=NETWORKS address=10.0.0.0/24\nadd list=NETWORKS address=10.0.1.0/24');
  assert.equal(C.exportCidrList(items, 'vyos-prefix-list'), "set policy prefix-list NETWORKS rule 10 action 'permit'\nset policy prefix-list NETWORKS rule 10 prefix '10.0.0.0/24'\nset policy prefix-list NETWORKS rule 20 action 'permit'\nset policy prefix-list NETWORKS rule 20 prefix '10.0.1.0/24'");
  assert.equal(C.exportCidrList(items, 'nftables-set', { name: '123-test' }), 'define _123-test = {\n    10.0.0.0/24,\n    10.0.1.0/24\n}');
  assert.equal(JSON.parse(C.exportCidrList(items, 'json')).networks[0].mask, '255.255.255.0');
  assert.equal(C.exportCidrList(items, 'csv').split('\n')[0], 'network,prefix,cidr,mask,first,last,address_count');
  assert.equal(C.sanitizeName('Office Networks!'), 'Office_Networks_');
});
