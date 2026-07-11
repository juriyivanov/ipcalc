(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.IPv4Utils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const IPV4_MAX = 0xffffffff;
  const IPV4_SIZE = 0x100000000;
  const SUBNET_RENDER_LIMIT = 4096;
  const OCTET_RE = '(?:0|[1-9]\\d*)';
  const IPV4_RE = new RegExp(`^${OCTET_RE}\\.${OCTET_RE}\\.${OCTET_RE}\\.${OCTET_RE}$`);
  const CIDR_RE = /^\/?(?:0|[1-9]\d*)$/;

  function parseIPv4(input) {
    const value = String(input).trim();
    if (!IPV4_RE.test(value)) return null;
    const parts = value.split('.').map(Number);
    if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
    return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0;
  }

  function ipv4ToInt(input) { return parseIPv4(input); }

  function intToIPv4(input) {
    if (!Number.isInteger(input) || input < 0 || input > IPV4_MAX) return null;
    const value = input >>> 0;
    return [
      Math.floor(value / 0x1000000) & 255,
      (value >>> 16) & 255,
      (value >>> 8) & 255,
      value & 255
    ].join('.');
  }

  function parseCIDR(input) {
    const value = String(input).trim();
    if (!CIDR_RE.test(value)) return null;
    const numberText = value.startsWith('/') ? value.slice(1) : value;
    if (numberText === '') return null;
    const cidr = Number(numberText);
    return Number.isInteger(cidr) && cidr >= 0 && cidr <= 32 ? cidr : null;
  }

  function cidrToMask(cidr) {
    const prefix = typeof cidr === 'number' ? cidr : parseCIDR(cidr);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
    return prefix === 0 ? 0 : (IPV4_MAX - (2 ** (32 - prefix) - 1)) >>> 0;
  }

  function isContiguousMask(mask) {
    if (!Number.isInteger(mask) || mask < 0 || mask > IPV4_MAX) return false;
    const inverted = (~mask) >>> 0;
    return ((inverted + 1) & inverted) === 0;
  }

  function maskToCIDR(mask) {
    if (!isContiguousMask(mask)) return null;
    let cidr = 0;
    for (let bit = 31; bit >= 0; bit--) {
      if ((mask & (1 << bit)) !== 0) cidr++;
      else break;
    }
    return cidr;
  }

  function parseMask(input) {
    const mask = parseIPv4(input);
    return mask !== null && isContiguousMask(mask) ? mask : null;
  }

  function parseSubnet(input) {
    const value = String(input).trim();
    if (value.startsWith('/')) {
      const cidr = parseCIDR(value);
      return cidr === null ? null : cidrToMask(cidr);
    }
    return parseMask(value);
  }

  function parseIPv4WithPrefix(input, fallbackPrefix = 24) {
    const value = String(input).trim();
    const parts = value.split('/');
    if (parts.length > 2 || parts[0] === '' || parts.some((part) => /\s/.test(part))) return null;
    const ip = parseIPv4(parts[0]);
    if (ip === null) return null;
    const prefix = parts.length === 2 ? parseCIDR(parts[1]) : fallbackPrefix;
    if (prefix === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
    return { ip, prefix };
  }

  function subnetSize(prefix) { return 2 ** (32 - prefix); }

  function safeSubnetStep(ip, prefix, direction, hostOffset = 0) {
    const size = subnetSize(prefix);
    const mask = cidrToMask(prefix);
    const network = (ip & mask) >>> 0;
    const nextNetwork = network + direction * size;
    if (nextNetwork < 0 || nextNetwork > IPV4_MAX) return null;
    const nextIp = nextNetwork + hostOffset;
    return nextIp >= 0 && nextIp <= IPV4_MAX ? nextIp >>> 0 : null;
  }

  function trailingZeroBits(value) {
    if (value === 0n) return 32;
    let bits = 0;
    while (((value >> BigInt(bits)) & 1n) === 0n && bits < 32) bits++;
    return bits;
  }

  function rangeToSubnets(start, end) {
    let current = BigInt(start);
    const last = BigInt(end);
    const subnets = [];
    while (current <= last) {
      const alignmentBits = trailingZeroBits(current);
      const remaining = last - current + 1n;
      const remainingBits = remaining === 0n ? 32 : remaining.toString(2).length - 1;
      const hostBits = Math.min(alignmentBits, remainingBits);
      const prefix = 32 - hostBits;
      const network = Number(current);
      subnets.push({ network, prefix, mask: cidrToMask(prefix) });
      current += 1n << BigInt(hostBits);
    }
    return subnets;
  }

  function subnetCount(baseCidr, newCidr) { return 2 ** (newCidr - baseCidr); }

  return { IPV4_MAX, IPV4_SIZE, SUBNET_RENDER_LIMIT, parseIPv4, ipv4ToInt, intToIPv4, parseCIDR, cidrToMask, maskToCIDR, parseMask, parseSubnet, parseIPv4WithPrefix, subnetSize, safeSubnetStep, rangeToSubnets, subnetCount };
});
