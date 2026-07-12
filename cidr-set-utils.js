(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./ipv4-utils.js') : root.IPv4Utils);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CidrSetUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (IPv4Utils) {
  'use strict';
  const LIMIT = 16384;
  const { IPV4_MAX, parseIPv4, intToIPv4, parseCIDR, cidrToMask, maskToCIDR, parseMask } = IPv4Utils;
  function size(p) { return 2 ** (32 - p); }
  function norm(it) { const p = Number(it.prefix); const m = cidrToMask(p); return { network: (Number(it.network) & m) >>> 0, prefix: p }; }
  function end(it) { return it.network + size(it.prefix) - 1; }
  function formatCidr(it) { const n = norm(it); return `${intToIPv4(n.network)}/${n.prefix}`; }
  function contains(a, b) { return a.prefix <= b.prefix && b.network >= a.network && end(b) <= end(a); }
  function overlaps(a, b) { return a.network <= end(b) && b.network <= end(a); }
  function parseOne(input) {
    const s = input.trim();
    if (!s) return null;
    let ipText, prefix;
    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts.length !== 2) return { error: 'Invalid CIDR notation' };
      ipText = parts[0].trim(); prefix = parseCIDR(parts[1].trim());
      if (prefix === null) return { error: 'Invalid CIDR prefix' };
    } else {
      const parts = s.split(/\s+/);
      if (parts.length !== 2) return { error: 'Expected CIDR prefix or dotted subnet mask' };
      ipText = parts[0]; const mask = parseMask(parts[1]);
      if (mask === null) return { error: 'Invalid subnet mask' };
      prefix = maskToCIDR(mask);
    }
    const ip = parseIPv4(ipText);
    if (ip === null) return { error: 'Invalid IPv4 address' };
    return norm({ network: ip, prefix });
  }
  function parseCidrList(text) {
    const items = [], errors = [];
    String(text || '').split(/\n/).forEach((lineText, idx) => {
      const line = idx + 1;
      const noComment = lineText.replace(/#.*/, '');
      noComment.split(/[;,]/).forEach((chunk) => {
        const input = chunk.trim(); if (!input) return;
        const parsed = parseOne(input);
        if (parsed && parsed.error) errors.push({ line, input, message: parsed.error });
        else if (parsed) items.push(Object.assign(parsed, { line, input }));
      });
    });
    return { items, errors };
  }
  function sortItems(items) { return items.map(norm).sort((a,b)=>a.network-b.network || a.prefix-b.prefix); }
  function normalizeCidrSet(items) {
    const sorted = sortItems(items); const unique = []; let duplicateCount = 0, containedCount = 0; const seen = new Set();
    for (const it of sorted) { const k = formatCidr(it); if (seen.has(k)) { duplicateCount++; continue; } seen.add(k); unique.push(it); }
    const out = [];
    for (const it of unique) { if (out.some((p) => contains(p, it))) containedCount++; else out.push(it); }
    return { items: out, duplicateCount, containedCount };
  }
  function canMerge(a,b){ if(a.prefix!==b.prefix||a.prefix===0)return null; const step=size(a.prefix); if(b.network-a.network!==step)return null; const parentPrefix=a.prefix-1; const parent=norm({network:a.network,prefix:parentPrefix}); return contains(parent,a)&&contains(parent,b)?parent:null; }
  function aggregateCidrSet(items) { let cur = normalizeCidrSet(items).items, changed = true; while (changed) { changed=false; const next=[]; for(let i=0;i<cur.length;i++){ const m=i+1<cur.length?canMerge(cur[i],cur[i+1]):null; if(m){next.push(m); i++; changed=true;} else next.push(cur[i]); } cur=normalizeCidrSet(next).items; } return { items: cur }; }
  function analyzeCidrSet(items) { const s = sortItems(items), exactDuplicates=[], contained=[], overlapping=[], adjacentMergeable=[]; const seen=new Map(); s.forEach((it)=>{const k=formatCidr(it); if(seen.has(k)) exactDuplicates.push({ first: seen.get(k), duplicate: it, message: `${k} duplicates ${k}` }); else seen.set(k,it);}); for(let i=0;i<s.length;i++) for(let j=i+1;j<s.length;j++){ if(s[j].network>end(s[i])) break; if(contains(s[i],s[j])) { const msg=`${formatCidr(s[i])} contains ${formatCidr(s[j])}`; contained.push({ container:s[i], item:s[j], message:msg }); overlapping.push({ a:s[i], b:s[j], message:msg }); } } for(let i=0;i<s.length-1;i++){ const m=canMerge(s[i],s[i+1]); if(m) adjacentMergeable.push({ a:s[i], b:s[i+1], merged:m, message:`${formatCidr(s[i])} + ${formatCidr(s[i+1])} → ${formatCidr(m)}`}); } return { exactDuplicates, contained, overlapping, adjacentMergeable }; }
  function subtractOne(inc, exc, out) { if (!overlaps(inc, exc)) { out.push(inc); return; } if (contains(exc, inc)) return; if (inc.prefix >= 32) return; const p=inc.prefix+1, half=size(p); const a={network:inc.network,prefix:p}, b={network:(inc.network+half)>>>0,prefix:p}; subtractOne(a, exc, out); subtractOne(b, exc, out); if(out.length>LIMIT) throw new Error(`CIDR set result exceeds ${LIMIT.toLocaleString()} networks`); }
  function subtractCidrSets(includeItems, excludeItems) { try { let result=aggregateCidrSet(includeItems).items; const excludes=aggregateCidrSet(excludeItems).items; for(const ex of excludes){ const next=[]; result.forEach((inc)=>subtractOne(inc, ex, next)); result=next; if(result.length>LIMIT) throw new Error(`CIDR set result exceeds ${LIMIT.toLocaleString()} networks`); } return { items: aggregateCidrSet(result).items, error: null }; } catch(error){ return { items: [], error: error.message }; } }
  function sanitizeName(name){ const s=String(name||'NETWORKS').trim().replace(/\s+/g,'_').replace(/[^A-Za-z0-9_-]/g,'_'); return s || 'NETWORKS'; }
  function csv(v){ const s=String(v); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
  function exportCidrList(items, format, options={}) { const list=sortItems(items); const name=sanitizeName(options.name); const action=options.action==='deny'?'deny':'permit'; const start=Number(options.sequenceStart)||10, step=Number(options.sequenceStep)||10; const rows=list.map((it,i)=>({it,cidr:formatCidr(it),mask:intToIPv4(cidrToMask(it.prefix)),seq:start+i*step,first:intToIPv4(it.network),last:intToIPv4(end(it)),count:size(it.prefix)}));
    if(format==='plain') return rows.map(r=>r.cidr).join('\n');
    if(format==='cisco-prefix-list') return rows.map(r=>`ip prefix-list ${name} seq ${r.seq} ${action} ${r.cidr}`).join('\n');
    if(format==='mikrotik-address-list') return ['/ip firewall address-list'].concat(rows.map(r=>`add list=${name} address=${r.cidr}`)).join('\n');
    if(format==='vyos-prefix-list') return rows.flatMap(r=>[`set policy prefix-list ${name} rule ${r.seq} action '${action}'`,`set policy prefix-list ${name} rule ${r.seq} prefix '${r.cidr}'`]).join('\n');
    if(format==='nftables-set') { const nft=/^[0-9]/.test(name)?`_${name}`:name; return `define ${nft} = {\n${rows.map(r=>`    ${r.cidr}`).join(',\n')}\n}`; }
    if(format==='json') return JSON.stringify({ name, networks: rows.map(r=>({network:r.first,prefix:r.it.prefix,cidr:r.cidr,mask:r.mask})) }, null, 2);
    if(format==='csv') return ['network,prefix,cidr,mask,first,last,address_count'].concat(rows.map(r=>[r.first,r.it.prefix,r.cidr,r.mask,r.first,r.last,r.count].map(csv).join(','))).join('\n');
    throw new Error('Unsupported export format'); }
  return { CIDR_SET_RESULT_LIMIT: LIMIT, parseCidrList, normalizeCidrSet, aggregateCidrSet, analyzeCidrSet, subtractCidrSets, exportCidrList, formatCidr, sanitizeName };
});
