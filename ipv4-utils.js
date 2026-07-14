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

  function parseSubnetPrefix(input) {
    const mask = parseSubnet(input);
    return mask === null ? null : maskToCIDR(mask);
  }

  function parseIPv4AddressAndMask(input) {
    const value = String(input).trim();
    if (!value) return null;
    const match = value.match(/^([^\s/]+)(?:(?:\s+|\/)([^\s/]+))?$/);
    if (!match) return null;
    const ipText = match[1];
    const maskText = match[2] || null;
    const ip = parseIPv4(ipText);
    if (ip === null) return null;
    if (maskText === null) {
      return { ip, ipText, mask: null, maskText: null, prefix: null, hasEmbeddedMask: false };
    }
    let prefix = parseCIDR(maskText);
    let mask = null;
    if (prefix !== null) {
      mask = cidrToMask(prefix);
    } else {
      mask = parseSubnet(maskText);
      if (mask === null) return null;
      prefix = maskToCIDR(mask);
      if (prefix === null) return null;
    }
    const normalizedMaskText = maskText.includes('.') ? intToIPv4(mask) : `/${prefix}`;
    return { ip, ipText, mask, maskText: normalizedMaskText, prefix, hasEmbeddedMask: true };
  }


  const SPECIAL_IPV4_BLOCKS = [
    { network: '0.0.0.0', prefix: 32, name: 'This host on this network', category: 'Unspecified address', reference: 'RFC 1122', globallyReachable: false, forwardable: false, source: true, destination: false, reservedByProtocol: true },
    { network: '0.0.0.0', prefix: 8, name: 'This network', category: 'This network', reference: 'RFC 791, Section 3.2', globallyReachable: false, forwardable: false, source: true, destination: false, reservedByProtocol: true },
    { network: '10.0.0.0', prefix: 8, name: 'Private-Use', category: 'Private use', reference: 'RFC 1918', globallyReachable: false, forwardable: true, source: true, destination: true, reservedByProtocol: false },
    { network: '100.64.0.0', prefix: 10, name: 'Shared Address Space', category: 'Shared Address Space / CGNAT', reference: 'RFC 6598', globallyReachable: false, forwardable: true, source: true, destination: true, reservedByProtocol: false },
    { network: '127.0.0.0', prefix: 8, name: 'Loopback', category: 'Loopback', reference: 'RFC 1122', globallyReachable: false, forwardable: false, source: false, destination: false, reservedByProtocol: true },
    { network: '169.254.0.0', prefix: 16, name: 'Link Local', category: 'Link-local', reference: 'RFC 3927', globallyReachable: false, forwardable: false, source: true, destination: true, reservedByProtocol: true },
    { network: '172.16.0.0', prefix: 12, name: 'Private-Use', category: 'Private use', reference: 'RFC 1918', globallyReachable: false, forwardable: true, source: true, destination: true, reservedByProtocol: false },
    { network: '192.0.0.0', prefix: 29, name: 'IPv4 Service Continuity Prefix', category: 'IETF protocol assignment', reference: 'RFC 7335', globallyReachable: false, forwardable: true, source: true, destination: true, reservedByProtocol: false },
    { network: '192.0.0.8', prefix: 32, name: 'IPv4 dummy address', category: 'IETF protocol assignment', reference: 'RFC 7600', globallyReachable: false, forwardable: false, source: true, destination: false, reservedByProtocol: false },
    { network: '192.0.0.9', prefix: 32, name: 'Port Control Protocol Anycast', category: 'IETF protocol assignment', reference: 'RFC 7723', globallyReachable: true, forwardable: true, source: true, destination: true, reservedByProtocol: false },
    { network: '192.0.0.10', prefix: 32, name: 'Traversal Using Relays around NAT Anycast', category: 'IETF protocol assignment', reference: 'RFC 8155', globallyReachable: true, forwardable: true, source: true, destination: true, reservedByProtocol: false },
    { network: '192.0.0.170', prefix: 32, name: 'NAT64/DNS64 Discovery', category: 'IETF protocol assignment', reference: 'RFC 8880, RFC 7050, Section 2.2', globallyReachable: false, forwardable: false, source: false, destination: false, reservedByProtocol: true },
    { network: '192.0.0.171', prefix: 32, name: 'NAT64/DNS64 Discovery', category: 'IETF protocol assignment', reference: 'RFC 8880, RFC 7050, Section 2.2', globallyReachable: false, forwardable: false, source: false, destination: false, reservedByProtocol: true },
    { network: '192.0.0.0', prefix: 24, name: 'IETF Protocol Assignments', category: 'IETF protocol assignment', reference: 'RFC 6890', globallyReachable: false, forwardable: false, source: false, destination: false, reservedByProtocol: false },
    { network: '192.0.2.0', prefix: 24, name: 'Documentation (TEST-NET-1)', category: 'Documentation', reference: 'RFC 5737', globallyReachable: false, forwardable: false, source: false, destination: false, reservedByProtocol: false },
    { network: '192.31.196.0', prefix: 24, name: 'AS112-v4', category: 'IETF protocol assignment', reference: 'RFC 7535', globallyReachable: true, forwardable: true, source: true, destination: true, reservedByProtocol: false },
    { network: '192.52.193.0', prefix: 24, name: 'AMT', category: 'IETF protocol assignment', reference: 'RFC 7450', globallyReachable: true, forwardable: true, source: true, destination: true, reservedByProtocol: false },
    { network: '192.88.99.2', prefix: 32, name: '6a44-relay anycast address', category: 'IETF protocol assignment', reference: 'RFC 6751', globallyReachable: false, forwardable: true, source: true, destination: true, reservedByProtocol: false },
    { network: '192.88.99.0', prefix: 24, name: 'Deprecated 6to4 Relay Anycast', category: 'IETF protocol assignment', reference: 'RFC 7526', globallyReachable: false, forwardable: false, source: false, destination: false, reservedByProtocol: false },
    { network: '192.168.0.0', prefix: 16, name: 'Private-Use', category: 'Private use', reference: 'RFC 1918', globallyReachable: false, forwardable: true, source: true, destination: true, reservedByProtocol: false },
    { network: '192.175.48.0', prefix: 24, name: 'Direct Delegation AS112 Service', category: 'IETF protocol assignment', reference: 'RFC 7534', globallyReachable: true, forwardable: true, source: true, destination: true, reservedByProtocol: false },
    { network: '198.18.0.0', prefix: 15, name: 'Benchmarking', category: 'Benchmarking', reference: 'RFC 2544', globallyReachable: false, forwardable: true, source: true, destination: true, reservedByProtocol: false },
    { network: '198.51.100.0', prefix: 24, name: 'Documentation (TEST-NET-2)', category: 'Documentation', reference: 'RFC 5737', globallyReachable: false, forwardable: false, source: false, destination: false, reservedByProtocol: false },
    { network: '203.0.113.0', prefix: 24, name: 'Documentation (TEST-NET-3)', category: 'Documentation', reference: 'RFC 5737', globallyReachable: false, forwardable: false, source: false, destination: false, reservedByProtocol: false },
    { network: '224.0.0.0', prefix: 4, name: 'Multicast', category: 'Multicast', reference: 'RFC 5771', globallyReachable: false, forwardable: true, source: false, destination: true, reservedByProtocol: true },
    { network: '240.0.0.0', prefix: 4, name: 'Reserved', category: 'Reserved', reference: 'RFC 1112', globallyReachable: false, forwardable: false, source: false, destination: false, reservedByProtocol: true },
    { network: '255.255.255.255', prefix: 32, name: 'Limited Broadcast', category: 'Limited broadcast', reference: 'RFC 8190, RFC 919, Section 7', globallyReachable: false, forwardable: false, source: false, destination: true, reservedByProtocol: true }
  ].map((block) => ({ ...block, networkInt: parseIPv4(block.network) })).sort((a, b) => b.prefix - a.prefix);

  function boolLabel(value, potential = false) { return potential ? 'Potentially' : (value ? 'Yes' : 'No'); }

  function classifyIPv4(input) {
    const value = typeof input === 'number' ? input : parseIPv4(input);
    if (!Number.isInteger(value) || value < 0 || value > IPV4_MAX) return null;
    for (const block of SPECIAL_IPV4_BLOCKS) {
      const mask = cidrToMask(block.prefix);
      if (((value & mask) >>> 0) === block.networkInt) {
        return { ...block, block: `${block.network}/${block.prefix}`, globallyReachableLabel: boolLabel(block.globallyReachable), forwardableLabel: boolLabel(block.forwardable) };
      }
    }
    return {
      network: null, prefix: null, block: 'Not in special-purpose registry', name: 'Not in IANA special-purpose registry', category: 'Ordinary unicast', reference: 'IANA IPv4 Special-Purpose Address Registry',
      globallyReachable: 'potentially', forwardable: null, source: true, destination: true, reservedByProtocol: false,
      globallyReachableLabel: 'Potentially', forwardableLabel: 'Not classified', note: 'Registry classification does not confirm allocation or current Internet reachability.'
    };
  }

  function ipv4ToPtrName(input) {
    const value = typeof input === 'number' ? input : parseIPv4(input);
    if (!Number.isInteger(value) || value < 0 || value > IPV4_MAX) return null;
    return intToIPv4(value).split('.').reverse().join('.') + '.in-addr.arpa.';
  }

  function reverseZoneForPrefix(input, prefixInput) {
    const ip = typeof input === 'number' ? input : parseIPv4(input);
    const prefix = typeof prefixInput === 'number' ? prefixInput : parseCIDR(prefixInput);
    if (!Number.isInteger(ip) || ip < 0 || ip > IPV4_MAX || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
    const network = (ip & cidrToMask(prefix)) >>> 0;
    const networkOctets = intToIPv4(network).split('.');
    const ptrName = ipv4ToPtrName(ip);
    if (prefix === 32) return { kind: 'ptr', ptrName };
    if (prefix <= 24 && prefix % 8 === 0) {
      const count = prefix / 8;
      const reverseZone = count === 0 ? 'in-addr.arpa.' : networkOctets.slice(0, count).reverse().join('.') + '.in-addr.arpa.';
      return { kind: 'zone', ptrName, reverseZone };
    }
    if (prefix < 24) {
      const boundary = Math.ceil(prefix / 8) * 8;
      const zonesRequired = 2 ** (boundary - prefix);
      return { kind: 'multiple', ptrName, message: 'Multiple octet-boundary zones required', delegationBoundary: `/${boundary}`, zonesRequired };
    }
    if (prefix > 24 && prefix < 32) {
      const size = subnetSize(prefix);
      const startLast = network & 255;
      const end = network + size - 1;
      const endLast = end & 255;
      const parentZone = networkOctets.slice(0, 3).reverse().join('.') + '.in-addr.arpa.';
      const suggestedChildZone = `${startLast}-${endLast}.${parentZone}`;
      return { kind: 'rfc2317', ptrName, parentZone, addressRange: `${intToIPv4(network)} – ${intToIPv4(end)}`, suggestedChildZone, note: 'Classless reverse DNS requires CNAME records in the parent reverse zone.' };
    }
    return null;
  }


  function calculationError(error, message) {
    return { ok: false, error, message };
  }

  function prepareSubnetCalculation(baseNetworkInput, baseSubnetInput, newSubnetInput) {
    const baseIp = parseIPv4(baseNetworkInput);
    if (baseIp === null) return calculationError('invalid-base-ip', 'Enter a valid base network.');

    const baseCidr = parseSubnetPrefix(baseSubnetInput);
    if (baseCidr === null) return calculationError('invalid-base-cidr', 'Enter a valid original CIDR or subnet mask.');

    const newCidr = parseSubnetPrefix(newSubnetInput);
    if (newCidr === null) return calculationError('invalid-new-cidr', 'Enter a valid new prefix.');

    if (newCidr < baseCidr) {
      return calculationError('new-cidr-too-small', 'The new prefix must be greater than or equal to the original prefix.');
    }

    const baseMask = cidrToMask(baseCidr);
    const network = (baseIp & baseMask) >>> 0;
    const totalSubnets = subnetCount(baseCidr, newCidr);
    const visibleSubnets = Math.min(totalSubnets, SUBNET_RENDER_LIMIT);

    return { ok: true, network, baseCidr, newCidr, totalSubnets, visibleSubnets };
  }

  return { IPV4_MAX, IPV4_SIZE, SUBNET_RENDER_LIMIT, SPECIAL_IPV4_BLOCKS, classifyIPv4, ipv4ToPtrName, reverseZoneForPrefix, parseIPv4, ipv4ToInt, intToIPv4, parseCIDR, cidrToMask, maskToCIDR, parseMask, parseSubnet, parseIPv4WithPrefix, parseIPv4AddressAndMask, subnetSize, safeSubnetStep, rangeToSubnets, subnetCount, prepareSubnetCalculation };
});
