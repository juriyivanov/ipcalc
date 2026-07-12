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
hasAll(sources['app.js'], ['const APP_VERSION', "APP_VERSION = '3.15.2'", 'function renderAppVersion()', 'function initApp()', 'document.addEventListener(\'DOMContentLoaded\', initApp, { once: true })', 'function createExportPanel', 'function refresh()', "format.addEventListener('change', refresh)", "name.addEventListener('input', refresh)", "action.addEventListener('change', refresh)", 'setDisabled(!output.value)', 'function resizeOutput()', 'output.scrollHeight', "output.style.height = '0'", "rangeStart.addEventListener('input', updateRangeOutput)", "rangeEnd.addEventListener('input', updateRangeOutput)", "input.dispatchEvent(new Event('input', { bubbles: true }))", 'function updateRangeOutput()', 'updateRangeOutput();', "navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })", 'registration.update()', "serviceWorker.addEventListener('controllerchange'"]);
hasAll(sources['app.css'], ['.app-version', ':root', 'body.dark-mode', '.export-panel', '.step-buttons', '.range-input-group', '.formats-table-card', '.formats-table thead', '.formats-table td:first-child', '.range-status.is-error', '.examples-label', '.examples .example', '.examples .random-mac-action', '.formats-table th:first-child', '.formats-table td:last-child', '.clearable-field', '.field-clear-button']);
hasNone(sources['index.html'], ['0.14.0', '0.14.1', 'convertRangeBtn', 'Convert Range']);
oldRuntime.forEach((file) => assert(!fs.existsSync(path.join(root, file)), `${file} must be removed`));

['prevRangeStartBtn', 'nextRangeStartBtn', 'decreaseRangeStartPrefixBtn', 'increaseRangeStartPrefixBtn', 'prevRangeEndBtn', 'nextRangeEndBtn', 'decreaseRangeEndPrefixBtn', 'increaseRangeEndPrefixBtn'].forEach((id) => {
  assert.strictEqual(count(sources['index.html'], `id="${id}"`), 1, `${id} should appear exactly once`);
  assert.strictEqual(count(full, `id="${id}"`), 1, `${id} should appear exactly once in Full standalone`);
  assert.strictEqual(count(lite, `id="${id}"`), 1, `${id} should appear exactly once in Lite standalone`);
});
assert.strictEqual(count(sources['index.html'], 'class="step-button"'), 8, 'Range tab should have exactly eight step buttons');
hasAll(sources['index.html'], ['value="192.168.100.0/24"', 'value="192.168.100.255/24"', 'data-prefix="24"', 'class="input-group range-input-group"', 'class="matched-prefix-line"', 'id="flagBadges"', 'id="rangeStatus"', 'class="range-status"', 'class="examples-label"', 'random-mac-action', 'id="cidrAggregatedDetails"', 'id="cidrSubtractDetails"', 'class="data-table cidr-table"']);
hasNone(sources['index.html'], ['OUI database', '<h3>Result</h3>', '<h3>Copy formats</h3>', 'convertRangeBtn', 'Convert Range']);
hasAll(sources['app.js'], ["document.createElement('table')", "document.createElement('thead')", "document.createElement('tbody')", "document.createElement('tr')", "document.createElement('td')", 'formats-table', 'function renderMacBaseResult', 'const state = renderMacBaseResult(normalized)', 'const db = await loadOuiDb()', 'if (sequence !== macLookupSequence) return', 'function renderVendorResult', 'let macLookupSequence = 0', 'Colon uppercase']);
assert(sources['app.js'].indexOf('const state = renderMacBaseResult(normalized)') < sources['app.js'].indexOf('const db = await loadOuiDb()'), 'MAC base formats should render before OUI load awaits');
hasNone(sources['app.js'], ['MutationObserver', 'format-row', 'Colon uppercase (MikroTik/Linux style)', 'output.style.overflowY', "alert('Invalid start or end IP')", "alert('Start IP must be less than or equal to End IP')", 'convertRangeBtn', "document.createElement('div');\n          row.className = 'format-row'", "document.createElement('button');\n        button.className = 'step-button'"]);
hasNone(sources['app.css'], ['max-height: 70vh', 'overflow-y: auto', 'resize: vertical', 'format-row']);

hasAll(full, ['<!DOCTYPE html>', '<html lang="en" data-standalone="true">', 'IPv4 Address Analyzer', 'IPv4 Range to Prefix Converter', 'IPv4 Subnet Calculator', 'CIDR Set Calculator', 'Aggregated result', 'Cleaned input before aggregation', 'Set analysis', 'Networks to exclude', 'Export format', 'Copy output', 'Download', 'prevRangeStartBtn', 'nextRangeStartBtn', 'decreaseRangeStartPrefixBtn', 'increaseRangeStartPrefixBtn', 'prevRangeEndBtn', 'nextRangeEndBtn', 'decreaseRangeEndPrefixBtn', 'increaseRangeEndPrefixBtn', 'Cisco prefix-list', 'MikroTik address-list', 'VyOS prefix-list', 'nftables set', 'MAC Vendor / Formats', 'embedded-oui-db', 'Random vendor MAC', "APP_VERSION = '3.15.2'"]);
hasAll(lite, ['<!DOCTYPE html>', '<html lang="en" data-standalone="true">', 'CIDR Set Calculator', 'Aggregated result', 'Cleaned input before aggregation', 'Set analysis', 'Export format', 'Copy output', 'Download', 'MAC Formats', 'Random MAC', 'Unicast', 'Globally administered', "APP_VERSION = '3.15.2'"]);
hasNone(full + lite + sources['index.html'], ['Process set', 'Subtract exclusions', 'Generate', '0 invalid lines', 'convertRangeBtn', 'Convert Range']);
hasNone(full + lite, oldRuntime);
noExternal(full);
noExternal(lite);
hasNone(lite, ['Vendor', 'Matched prefix', 'Assignment type', 'Random vendor MAC', 'oui-db.json', 'embedded-oui-db', 'lookupVendor', 'loadOuiDb', 'Vendor not found', 'OUI database', 'bundled vendor database']);
assert.strictEqual(count(full, 'id="embedded-oui-db"'), 1, 'Full must contain exactly one embedded OUI database');
assert(lite.length < full.length * 0.7, 'Lite should be noticeably smaller than Full');
assertIds(lite, ['appVersion', 'toggleDarkModeBtn', 'analyzer', 'range', 'subnet', 'cidr-set', 'mac-vendor', 'rangeStart', 'rangeEnd', 'prevRangeStartBtn', 'nextRangeStartBtn', 'decreaseRangeStartPrefixBtn', 'increaseRangeStartPrefixBtn', 'prevRangeEndBtn', 'nextRangeEndBtn', 'decreaseRangeEndPrefixBtn', 'increaseRangeEndPrefixBtn', 'cidrSetInput', 'cidrExcludeInput', 'cidrExportSource', 'macInput', 'randomMacBtn'], ['randomVendorMacBtn', 'vendorName', 'matchedPrefix', 'assignmentType', 'dbStatus']);

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
hasAll(sw, ['ipcalc-pwa-v22', 'SHELL_ASSET_PATHS', '/ipcalc/app.css', '/ipcalc/app.js', './app.css', './app.js', './ipv4-utils.js', './cidr-set-utils.js', "searchParams.has('standalone-source')", "searchParams.delete('standalone-source')", "cache:'no-store'", 'standaloneSourceNetworkFirst', 'shellNetworkFirst']);
hasNone(sw, ['enhanceHtml', 'response.text()', "replace('</head>'", "replace('</body>'", ...oldRuntime]);

assert.deepStrictEqual(Core.SOURCE_FILES, ['index.html', 'app.css', 'ipv4-utils.js', 'cidr-set-utils.js', 'app.js']);
assert.strictEqual(Core.standaloneSourceCacheKey('https://example.test/ipcalc/index.html?standalone-source=v3'), 'https://example.test/ipcalc/index.html');
assert.strictEqual(Core.standaloneSourceCacheKey('https://example.test/ipcalc/index.html?foo=bar&standalone-source=v3'), 'https://example.test/ipcalc/index.html?foo=bar');

const builderJs = fs.readFileSync(path.join(root, 'standalone-builder.js'), 'utf8');
hasAll(builderJs, ["const BUILD_REVISION = 'standalone-builder-v3'", "fetch(freshUrl, { cache: 'reload' })", 'Core.standaloneSourceCacheKey(canonicalUrl.href)']);
hasNone(builderJs, ['ignoreSearch: true', 'force-cache']);
console.log(`Full ${Core.formatBytes(Core.bytes(full))}; Lite ${Core.formatBytes(Core.bytes(lite))}`);

assert.strictEqual(count(sources['index.html'], 'class="data-table cidr-table"'), 3);
hasAll(sources['app.css'], ['grid-template-columns: repeat(2, minmax(0, 1fr))', '.cidr-table th:nth-child(2)']);
hasAll(sources['app.js'], ['exclude.items.length > 0', "cidrExportSource.value = 'after-exclusions'"]);


{ // input workflow regressions are present in canonical sources
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const appCss = fs.readFileSync(path.join(root, 'app.css'), 'utf8');
  const ipv4Utils = fs.readFileSync(path.join(root, 'ipv4-utils.js'), 'utf8');
  assert.doesNotMatch(indexHtml, /subnetCalcBtn/);
  assert.doesNotMatch(indexHtml.match(/<div class="tab-content" id="subnet">[\s\S]*?<\/div>\n\s*<\/div>/)?.[0] || '', />Calculate</);
  assert.doesNotMatch(appJs, /alert\(/);
  assert.match(indexHtml, /id="subnetStatus"/);
  assert.match(appJs, /baseNetworkInput\.addEventListener\('input', scheduleSubnetUpdate\)/);
  assert.match(appJs, /baseCIDRInput\.addEventListener\('input', scheduleSubnetUpdate\)/);
  assert.match(appJs, /newCIDRInput\.addEventListener\('input', scheduleSubnetUpdate\)/);
  assert.match(appJs, /dispatchInput\(baseNetworkInput\)/);
  assert.match(appJs, /const APP_VERSION = '3\.15\.2'/);
  for (const id of ['ipInput','subnetInput','rangeStart','rangeEnd','baseNetwork','baseCIDR','newCIDR','cidrSetInput','cidrExcludeInput','macInput']) {
    assert.match(indexHtml, new RegExp(`class="clearable-field"[\\s\\S]{0,200}id="${id}"`), id);
  }
  assert.doesNotMatch(indexHtml, /clearBtn/);
  assert.doesNotMatch(indexHtml, /export-output[\s\S]{0,120}field-clear-button/);
  assert.doesNotMatch(appCss, /padding-top:\s*2rem/);
  assert.match(appCss, /textarea \+ \.field-clear-button \{[^}]*right:\s*22px/);
  assert.match(appCss, /\.mac-input-row > \.clearable-field \{[^}]*flex:\s*1 1 auto;[^}]*width:\s*100%;[^}]*min-width:\s*0/);
  const calculateBody = appJs.match(/function calculateAnalyzer\(\) \{[\s\S]*?\n      \}/)?.[0] || '';
  assert.doesNotMatch(calculateBody, /ipInput\.value\s*=/);
  assert.doesNotMatch(calculateBody, /subnetInput\.value\s*=/);
  assert.match(appJs, /function normalizeAnalyzerAddressInput\(\)/);
  assert.match(appJs, /ipInput\.addEventListener\('paste',[\s\S]*normalizeAnalyzerAddressInput/);
  assert.match(appJs, /ipInput\.addEventListener\('blur', normalizeAnalyzerAddressInput\)/);
  assert.match(appJs, /function ensureStepInputValue\(input\) \{[\s\S]*input\.value = value;[\s\S]*dispatchInput\(input\);[\s\S]*return true;/);
  assert.match(ipv4Utils, /maskText: normalizedMaskText/);
  assert.match(full, /function normalizeAnalyzerAddressInput\(\)/);
  assert.match(lite, /function normalizeAnalyzerAddressInput\(\)/);
  const max915 = appCss.match(/@media \(max-width: 915px\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(appCss, /@media \(max-width: 915px\)/);
  assert.match(max915, /\.examples-label,[\s\S]*\.examples \.example \{ display: none; \}/);
  assert.match(max915, /repeat\(auto-fit, minmax\(160px, 1fr\)\)/);
  assert.doesNotMatch(max915, /overflow-x:\s*auto/);
  assert.match(max915, /overflow:\s*visible/);
  const max590 = appCss.match(/@media \(max-width: 590px\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(appCss, /@media \(max-width: 590px\)/);
  assert.match(max590, /h1 \{[^}]*padding-inline:\s*(?:[6-9]\d|\d{3,})px/);
  assert.match(max590, /#toggleDarkModeBtn \{[^}]*opacity:\s*0\.62/);
  assert.match(appCss, /#toggleDarkModeBtn:hover,[\s\S]*#toggleDarkModeBtn:focus-visible \{ opacity: 1; \}/);
  assert.match(full, /@media \(max-width: 915px\)/);
  assert.match(lite, /@media \(max-width: 915px\)/);
  assert.match(full, /@media \(max-width: 590px\)/);
  assert.match(lite, /@media \(max-width: 590px\)/);
}

