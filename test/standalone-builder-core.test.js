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

const oldRuntime = ['theme-overrides.css', 'range-controls.css', 'range-controls.js', 'ui-enhancements.js', 'list-export-ui.js', 'mobile-overrides.css'];
hasAll(sources['index.html'], ['<link rel="stylesheet" href="./app.css" />', '<script src="./ipv4-utils.js"></script>', '<script src="./cidr-set-utils.js"></script>', '<script src="./app.js"></script>', 'id="appVersion"']);
hasNone(sources['index.html'], [...oldRuntime, '<style>', '/***************************************************']);
hasAll(sources['app.js'], ['const APP_VERSION', "APP_VERSION = '0.14.2'", 'function renderAppVersion()', 'function initApp()', 'document.addEventListener(\'DOMContentLoaded\', initApp, { once: true })', 'function createExportPanel', 'function refresh()', "format.addEventListener('change', refresh)", "name.addEventListener('input', refresh)", "action.addEventListener('change', refresh)", 'setDisabled(!output.value)', 'function resizeOutput()', 'output.scrollHeight', "output.style.height = '0'", "rangeStart.addEventListener('input', updateRangeOutput)", "rangeEnd.addEventListener('input', updateRangeOutput)", "input.dispatchEvent(new Event('input', { bubbles: true }))", 'function updateRangeOutput()', 'updateRangeOutput();', "navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })", 'registration.update()', "serviceWorker.addEventListener('controllerchange'"]);
hasAll(sources['app.css'], ['.app-version', ':root', 'body.dark-mode', '.export-panel', '.step-buttons', '.range-input-group', '.formats-table-card', '.formats-table thead', '.formats-table td:first-child', '.range-status.is-error', '.examples-label', '.examples .example', '.examples .random-mac-action', '.formats-table th:first-child', '.formats-table td:last-child']);
hasNone(sources['index.html'], ['0.14.0', '0.14.1', 'convertRangeBtn', 'Convert Range']);
oldRuntime.forEach((file) => assert(!fs.existsSync(path.join(root, file)), `${file} must be removed`));

['prevRangeStartBtn', 'nextRangeStartBtn', 'decreaseRangeStartPrefixBtn', 'increaseRangeStartPrefixBtn', 'prevRangeEndBtn', 'nextRangeEndBtn', 'decreaseRangeEndPrefixBtn', 'increaseRangeEndPrefixBtn'].forEach((id) => {
  assert.strictEqual(count(sources['index.html'], `id="${id}"`), 1, `${id} should appear exactly once`);
  assert.strictEqual(count(full, `id="${id}"`), 1, `${id} should appear exactly once in Full standalone`);
  assert.strictEqual(count(lite, `id="${id}"`), 1, `${id} should appear exactly once in Lite standalone`);
});
assert.strictEqual(count(sources['index.html'], 'class="step-button"'), 8, 'Range tab should have exactly eight step buttons');
hasAll(sources['index.html'], ['value="192.168.100.0/24"', 'value="192.168.100.255/24"', 'data-prefix="24"', 'class="input-group range-input-group"', 'class="matched-prefix-line"', 'id="flagBadges"', 'id="rangeStatus"', 'class="range-status"', 'class="examples-label"', 'random-mac-action']);
hasNone(sources['index.html'], ['OUI database', '<h3>Result</h3>', '<h3>Copy formats</h3>', 'convertRangeBtn', 'Convert Range']);
hasAll(sources['app.js'], ["document.createElement('table')", "document.createElement('thead')", "document.createElement('tbody')", "document.createElement('tr')", "document.createElement('td')", 'formats-table', 'function renderMacBaseResult', 'const state = renderMacBaseResult(normalized)', 'const db = await loadOuiDb()', 'if (sequence !== macLookupSequence) return', 'function renderVendorResult', 'let macLookupSequence = 0', 'Colon uppercase']);
assert(sources['app.js'].indexOf('const state = renderMacBaseResult(normalized)') < sources['app.js'].indexOf('const db = await loadOuiDb()'), 'MAC base formats should render before OUI load awaits');
hasNone(sources['app.js'], ['MutationObserver', 'format-row', 'Colon uppercase (MikroTik/Linux style)', 'output.style.overflowY', "alert('Invalid start or end IP')", "alert('Start IP must be less than or equal to End IP')", 'convertRangeBtn', "document.createElement('div');\n          row.className = 'format-row'", "document.createElement('button');\n        button.className = 'step-button'"]);
hasNone(sources['app.css'], ['max-height: 70vh', 'overflow-y: auto', 'resize: vertical', 'format-row']);

hasAll(full, ['<!DOCTYPE html>', '<html lang="en" data-standalone="true">', 'IPv4 Address Analyzer', 'IPv4 Range to Prefix Converter', 'IPv4 Subnet Calculator', 'CIDR Set Calculator', 'Aggregated result', 'Cleaned input before aggregation', 'Set analysis', 'Networks to exclude', 'Export format', 'Copy output', 'Download', 'prevRangeStartBtn', 'nextRangeStartBtn', 'decreaseRangeStartPrefixBtn', 'increaseRangeStartPrefixBtn', 'prevRangeEndBtn', 'nextRangeEndBtn', 'decreaseRangeEndPrefixBtn', 'increaseRangeEndPrefixBtn', 'Cisco prefix-list', 'MikroTik address-list', 'VyOS prefix-list', 'nftables set', 'MAC Vendor / Formats', 'embedded-oui-db', 'Random vendor MAC', "APP_VERSION = '0.14.2'"]);
hasAll(lite, ['<!DOCTYPE html>', '<html lang="en" data-standalone="true">', 'CIDR Set Calculator', 'Aggregated result', 'Cleaned input before aggregation', 'Set analysis', 'Export format', 'Copy output', 'Download', 'MAC Formats', 'Random MAC', 'Unicast', 'Globally administered', "APP_VERSION = '0.14.2'"]);
hasNone(full + lite + sources['index.html'], ['Process set', 'Subtract exclusions', 'Generate', '0 invalid lines', 'convertRangeBtn', 'Convert Range']);
hasNone(full + lite, oldRuntime);
noExternal(full);
noExternal(lite);
hasNone(lite, ['Vendor', 'Matched prefix', 'Assignment type', 'Random vendor MAC', 'oui-db.json', 'embedded-oui-db', 'lookupVendor', 'loadOuiDb', 'Vendor not found', 'OUI database', 'bundled vendor database']);
assert.strictEqual(count(full, 'id="embedded-oui-db"'), 1, 'Full must contain exactly one embedded OUI database');
assert(lite.length < full.length * 0.7, 'Lite should be noticeably smaller than Full');
assertIds(lite, ['appVersion', 'toggleDarkModeBtn', 'analyzer', 'range', 'subnet', 'cidr-set', 'mac-vendor', 'rangeStart', 'rangeEnd', 'prevRangeStartBtn', 'nextRangeStartBtn', 'decreaseRangeStartPrefixBtn', 'increaseRangeStartPrefixBtn', 'prevRangeEndBtn', 'nextRangeEndBtn', 'decreaseRangeEndPrefixBtn', 'increaseRangeEndPrefixBtn', 'cidrSetInput', 'cidrExcludeInput', 'cidrExportSource', 'macInput', 'randomMacBtn'], ['randomVendorMacBtn', 'vendorName', 'matchedPrefix', 'assignmentType', 'dbStatus']);

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
hasAll(sw, ['ipcalc-pwa-v17', 'SHELL_ASSET_PATHS', '/ipcalc/app.css', '/ipcalc/app.js', './app.css', './app.js', './ipv4-utils.js', './cidr-set-utils.js', "searchParams.has('standalone-source')", "searchParams.delete('standalone-source')", "cache:'no-store'", 'standaloneSourceNetworkFirst', 'shellNetworkFirst']);
hasNone(sw, ['enhanceHtml', 'response.text()', "replace('</head>'", "replace('</body>'", ...oldRuntime]);

assert.deepStrictEqual(Core.SOURCE_FILES, ['index.html', 'app.css', 'ipv4-utils.js', 'cidr-set-utils.js', 'app.js']);
assert.strictEqual(Core.standaloneSourceCacheKey('https://example.test/ipcalc/index.html?standalone-source=v3'), 'https://example.test/ipcalc/index.html');
assert.strictEqual(Core.standaloneSourceCacheKey('https://example.test/ipcalc/index.html?foo=bar&standalone-source=v3'), 'https://example.test/ipcalc/index.html?foo=bar');

const builderJs = fs.readFileSync(path.join(root, 'standalone-builder.js'), 'utf8');
hasAll(builderJs, ["const BUILD_REVISION = 'standalone-builder-v3'", "fetch(freshUrl, { cache: 'reload' })", 'Core.standaloneSourceCacheKey(canonicalUrl.href)']);
hasNone(builderJs, ['ignoreSearch: true', 'force-cache']);
console.log(`Full ${Core.formatBytes(Core.bytes(full))}; Lite ${Core.formatBytes(Core.bytes(lite))}`);
