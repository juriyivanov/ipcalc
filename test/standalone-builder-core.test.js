const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Core = require('../standalone-builder-core.js');
const root = path.join(__dirname, '..');
const sources = Object.fromEntries([...Core.SOURCE_FILES, 'oui-db.json'].map((f) => [f, fs.readFileSync(path.join(root, f), 'utf8')]));
const full = Core.buildFull(sources);
const lite = Core.buildLite(sources);
function hasAll(html, items) { for (const item of items) assert(html.includes(item), `missing ${item}`); }
function hasNone(html, items) { for (const item of items) assert(!html.includes(item), `unexpected ${item}`); }
function scripts(html) { return [...html.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]); }
function checkScripts(html) { scripts(html).forEach((code, i) => new vm.Script(code, { filename: `inline-${i}.js` })); }
function noExternal(html) { hasNone(html, ['<script src=', 'rel="stylesheet"', 'rel="manifest"', 'navigator.serviceWorker.register', "fetch('./oui-db.json'"]); }

hasAll(full, ['<!DOCTYPE html>', '<html lang="en" data-standalone="true">', 'IPv4 Address Analyzer', 'IPv4 Range to Prefix Converter', 'IPv4 Subnet Calculator', 'MAC Vendor / Formats', 'Copy formats', 'embedded-oui-db', 'Vendor', 'Matched prefix', 'Assignment type', 'Random vendor MAC']);
noExternal(full);
checkScripts(full);

hasAll(lite, ['<!DOCTYPE html>', '<html lang="en" data-standalone="true">', 'IPv4 Address Analyzer', 'IPv4 Range to Prefix Converter', 'IPv4 Subnet Calculator', 'MAC Formats', 'Colon uppercase', 'Colon lowercase', 'Hyphen uppercase', 'Hyphen lowercase', 'Cisco dotted lowercase', 'Cisco dotted uppercase', 'Plain uppercase', 'Plain lowercase', 'Space separated', '0x-prefixed', 'Random MAC', 'Unicast', 'Multicast / group address', 'Broadcast', 'Globally administered', 'Locally administered / randomized possible']);
hasNone(lite, ['Vendor', 'Matched prefix', 'Assignment type', 'Random vendor MAC', 'oui-db.json', 'embedded-oui-db', 'lookupVendor', 'loadOuiDb', 'Vendor not found', 'OUI database', 'bundled vendor database']);
noExternal(lite);
checkScripts(lite);
assert(lite.length < full.length * 0.7, 'Lite should be noticeably smaller than Full');
assert(!fs.existsSync(path.join(root, 'ipcalc2.html')), 'ipcalc2.html must be absent');
assert(!fs.existsSync(path.join(root, 'mac.html')), 'mac.html must be absent');
const builder = fs.readFileSync(path.join(root, 'standalone-builder.html'), 'utf8');
hasAll(builder, ['Build and download Full standalone', 'Build and download Lite standalone']);
console.log(`Full ${Core.formatBytes(Core.bytes(full))}; Lite ${Core.formatBytes(Core.bytes(lite))}`);
