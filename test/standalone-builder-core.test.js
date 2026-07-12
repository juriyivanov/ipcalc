const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Core = require('../standalone-builder-core.js');
const root = path.join(__dirname, '..');
const sourceFiles = [...Core.SOURCE_FILES, 'oui-db.json'];
const sources = Object.fromEntries(sourceFiles.map((f) => [f, fs.readFileSync(path.join(root, f), 'utf8')]));

function hasAll(text, items) { for (const item of items) assert(text.includes(item), `missing ${item}`); }
function hasNone(text, items) { for (const item of items) assert(!text.includes(item), `unexpected ${item}`); }
function count(text, needle) { return text.split(needle).length - 1; }
function checkScripts(html) { Core.getInlineScripts(html).forEach((code, i) => new vm.Script(code, { filename: `inline-${i}.js` })); }
function ids(html) { return new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])); }
function assertIds(html, required, forbidden = []) { const actual = ids(html); required.forEach((id) => assert(actual.has(id), `missing DOM id #${id}`)); forbidden.forEach((id) => assert(!actual.has(id), `unexpected DOM id #${id}`)); }
function noExternal(html) { hasNone(html, ['<script src=', 'rel="stylesheet"', 'rel="manifest"', 'navigator.serviceWorker.register', "fetch('./oui-db.json'"]); }

const full = Core.buildFull(sources);
const lite = Core.buildLite(sources);
Core.validateStandaloneOutput(full, 'full');
Core.validateStandaloneOutput(lite, 'lite');
checkScripts(full);
checkScripts(lite);

const oldRuntime = ['theme-overrides.css', 'range-controls.css', 'range-controls.js', 'ui-enhancements.js', 'list-export-ui.js'];
hasAll(sources['index.html'], ['<link rel="stylesheet" href="./app.css" />', '<script src="./ipv4-utils.js"></script>', '<script src="./cidr-set-utils.js"></script>', '<script src="./app.js"></script>', 'id="appVersion"']);
hasNone(sources['index.html'], [...oldRuntime, '<style>', '/***************************************************']);
hasAll(sources['app.js'], ['const APP_VERSION', "APP_VERSION = '0.14.0'", 'function renderAppVersion()', 'function initApp()', 'document.addEventListener(\'DOMContentLoaded\', initApp)', 'function createExportPanel', 'function refresh()', "format.addEventListener('change', refresh)", "name.addEventListener('input', refresh)", "action.addEventListener('change', refresh)", 'setDisabled(!output.value)', 'function resizeOutput()', 'output.scrollHeight']);
hasAll(sources['app.css'], ['.app-version', ':root', 'body.dark-mode', '.export-panel', '.step-buttons']);
hasNone(sources['index.html'], ['0.14.0']);
oldRuntime.forEach((file) => assert(!fs.existsSync(path.join(root, file)), `${file} must be removed`));

hasAll(full, ['<!DOCTYPE html>', '<html lang="en" data-standalone="true">', 'IPv4 Address Analyzer', 'IPv4 Range to Prefix Converter', 'IPv4 Subnet Calculator', 'CIDR Set Calculator', 'Aggregated result', 'Cleaned input before aggregation', 'Set analysis', 'Networks to exclude', 'Export format', 'Copy output', 'Download', 'prevRangeStartBtn', 'nextRangeStartBtn', 'decreaseRangeStartPrefixBtn', 'increaseRangeStartPrefixBtn', 'prevRangeEndBtn', 'nextRangeEndBtn', 'decreaseRangeEndPrefixBtn', 'increaseRangeEndPrefixBtn', 'Cisco prefix-list', 'MikroTik address-list', 'VyOS prefix-list', 'nftables set', 'MAC Vendor / Formats', 'embedded-oui-db', 'Random vendor MAC', "APP_VERSION = '0.14.0'"]);
hasAll(lite, ['<!DOCTYPE html>', '<html lang="en" data-standalone="true">', 'CIDR Set Calculator', 'Aggregated result', 'Cleaned input before aggregation', 'Set analysis', 'Export format', 'Copy output', 'Download', 'MAC Formats', 'Random MAC', 'Unicast', 'Globally administered', "APP_VERSION = '0.14.0'"]);
hasNone(full + lite + sources['index.html'], ['Process set', 'Subtract exclusions', 'Generate', '0 invalid lines']);
hasNone(full + lite, oldRuntime);
noExternal(full);
noExternal(lite);
hasNone(lite, ['Vendor', 'Matched prefix', 'Assignment type', 'Random vendor MAC', 'oui-db.json', 'embedded-oui-db', 'lookupVendor', 'loadOuiDb', 'Vendor not found', 'OUI database', 'bundled vendor database']);
assert.strictEqual(count(full, 'id="embedded-oui-db"'), 1, 'Full must contain exactly one embedded OUI database');
assert(lite.length < full.length * 0.7, 'Lite should be noticeably smaller than Full');
assertIds(lite, ['appVersion', 'toggleDarkModeBtn', 'analyzer', 'range', 'subnet', 'cidr-set', 'mac-vendor', 'rangeStart', 'rangeEnd', 'prevRangeStartBtn', 'nextRangeStartBtn', 'decreaseRangeStartPrefixBtn', 'increaseRangeStartPrefixBtn', 'prevRangeEndBtn', 'nextRangeEndBtn', 'decreaseRangeEndPrefixBtn', 'increaseRangeEndPrefixBtn', 'cidrSetInput', 'cidrExcludeInput', 'cidrExportSource', 'macInput', 'randomMacBtn'], ['randomVendorMacBtn', 'vendorName', 'matchedPrefix', 'assignmentType', 'dbStatus']);

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
hasAll(sw, ['ipcalc-pwa-v15', './app.css', './app.js', './ipv4-utils.js', './cidr-set-utils.js', "searchParams.has('standalone-source')", "searchParams.delete('standalone-source')", "cache:'no-store'", 'standaloneSourceNetworkFirst']);
hasNone(sw, ['enhanceHtml', 'response.text()', "replace('</head>'", "replace('</body>'", ...oldRuntime]);

assert.deepStrictEqual(Core.SOURCE_FILES, ['index.html', 'app.css', 'ipv4-utils.js', 'cidr-set-utils.js', 'app.js']);
assert.strictEqual(Core.standaloneSourceCacheKey('https://example.test/ipcalc/index.html?standalone-source=v3'), 'https://example.test/ipcalc/index.html');
assert.strictEqual(Core.standaloneSourceCacheKey('https://example.test/ipcalc/index.html?foo=bar&standalone-source=v3'), 'https://example.test/ipcalc/index.html?foo=bar');

const builderJs = fs.readFileSync(path.join(root, 'standalone-builder.js'), 'utf8');
hasAll(builderJs, ["const BUILD_REVISION = 'standalone-builder-v3'", "fetch(freshUrl, { cache: 'reload' })", 'Core.standaloneSourceCacheKey(canonicalUrl.href)']);
hasNone(builderJs, ['ignoreSearch: true', 'force-cache']);
console.log(`Full ${Core.formatBytes(Core.bytes(full))}; Lite ${Core.formatBytes(Core.bytes(lite))}`);
