const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Core = require('../standalone-builder-core.js');
const root = path.join(__dirname, '..');
const sourceFiles = [...Core.SOURCE_FILES, 'oui-db.json'];
const sources = Object.fromEntries(sourceFiles.map((f) => [f, fs.readFileSync(path.join(root, f), 'utf8')]));

function hasAll(html, items) { for (const item of items) assert(html.includes(item), `missing ${item}`); }
function hasNone(html, items) { for (const item of items) assert(!html.includes(item), `unexpected ${item}`); }
function scripts(html) { return Core.getInlineScripts(html); }
function checkScripts(html) { scripts(html).forEach((code, i) => new vm.Script(code, { filename: `inline-${i}.js` })); }
function noExternal(html) { hasNone(html, ['<script src=', 'rel="stylesheet"', 'rel="manifest"', 'navigator.serviceWorker.register', "fetch('./oui-db.json'"]); }
function count(html, text) { return html.split(text).length - 1; }
function ids(html) { return new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])); }
function assertIds(html, required, forbidden = []) {
  const actual = ids(html);
  required.forEach((id) => assert(actual.has(id), `missing DOM id #${id}`));
  forbidden.forEach((id) => assert(!actual.has(id), `unexpected DOM id #${id}`));
}
function buildAndValidate(src = sources) {
  const full = Core.buildFull(src);
  const lite = Core.buildLite(src);
  Core.validateStandaloneOutput(full, 'full');
  Core.validateStandaloneOutput(lite, 'lite');
  checkScripts(full);
  checkScripts(lite);
  return { full, lite };
}

const { full, lite } = buildAndValidate();
const forbiddenBindTemplates = ['Absolute PTR record', 'Zone-relative PTR template', 'host.example.net.', 'Copy PTR record', 'Copy zone template'];
hasNone(sources['index.html'], forbiddenBindTemplates);

hasAll(full, ['<!DOCTYPE html>', '<html lang="en" data-standalone="true">', 'IPv4 Address Analyzer', 'Address type', 'PTR lookup name', 'Reverse zone', 'IPv4 Range to Prefix Converter', 'IPv4 Subnet Calculator', 'CIDR Set Calculator', 'Aggregated result', 'Cleaned input before aggregation', 'Set analysis', 'Networks to exclude', 'Export format', 'Copy output', 'Download', 'prevRangeStartBtn', 'nextRangeStartBtn', 'prevRangeEndBtn', 'nextRangeEndBtn', 'Cisco prefix-list', 'MikroTik address-list', 'VyOS prefix-list', 'nftables set', 'MAC Vendor / Formats', 'Copy formats', 'embedded-oui-db', 'Vendor', 'Matched prefix', 'Assignment type', 'Random vendor MAC', 'function lookupVendor']);
noExternal(full);
hasNone(full, forbiddenBindTemplates);
assert.strictEqual(count(full, 'id="embedded-oui-db"'), 1, 'Full must contain exactly one embedded OUI database');
const embeddedIndex = full.indexOf('id="embedded-oui-db"');
const initialLookupIndex = full.indexOf('loadOuiDb().then(runLookup)');
const appScriptIndex = full.indexOf('/***************************************************');
assert(embeddedIndex >= 0, 'embedded OUI database must exist');
assert(initialLookupIndex >= 0, 'initial OUI lookup must exist');
assert(appScriptIndex >= 0, 'application script marker must exist');
assert(embeddedIndex < initialLookupIndex, 'embedded OUI database must appear before the initial lookup');
assert(embeddedIndex < appScriptIndex, 'embedded OUI database must be parsed before application JavaScript');

hasAll(lite, ['<!DOCTYPE html>', '<html lang="en" data-standalone="true">', 'IPv4 Address Analyzer', 'Address type', 'PTR lookup name', 'Reverse zone', 'IPv4 Range to Prefix Converter', 'IPv4 Subnet Calculator', 'CIDR Set Calculator', 'Aggregated result', 'Cleaned input before aggregation', 'Set analysis', 'Networks to exclude', 'Export format', 'Copy output', 'Download', 'prevRangeStartBtn', 'nextRangeStartBtn', 'prevRangeEndBtn', 'nextRangeEndBtn', 'Cisco prefix-list', 'MikroTik address-list', 'VyOS prefix-list', 'nftables set', 'MAC Formats', 'Colon uppercase', 'Colon lowercase', 'Hyphen uppercase', 'Hyphen lowercase', 'Cisco dotted lowercase', 'Cisco dotted uppercase', 'Plain uppercase', 'Plain lowercase', 'Space separated', '0x-prefixed', 'Random MAC', 'Unicast', 'Multicast / group address', 'Broadcast', 'Globally administered', 'Locally administered / randomized possible', 'function runFormatterOnly']);
hasNone(full + lite + sources['index.html'], ['Process set', 'Subtract exclusions', 'Generate', '0 invalid lines']);
hasNone(lite, ['Vendor', 'Matched prefix', 'Assignment type', 'Random vendor MAC', 'oui-db.json', 'embedded-oui-db', 'lookupVendor', 'loadOuiDb', 'Vendor not found', 'OUI database', 'bundled vendor database']);
noExternal(lite);
hasNone(lite, forbiddenBindTemplates);
assert(!/const\s+response\s*=\s*await\s*(?:[;\n\r]|$)/.test(lite), 'Lite must not contain dangling await');
assert(lite.length < full.length * 0.7, 'Lite should be noticeably smaller than Full');
assert(!fs.existsSync(path.join(root, 'ipcalc2.html')), 'ipcalc2.html must be absent');
assert(!fs.existsSync(path.join(root, 'mac.html')), 'mac.html must be absent');

const builder = fs.readFileSync(path.join(root, 'standalone-builder.html'), 'utf8');
hasAll(builder, ['Build and download Full standalone', 'Build and download Lite standalone']);

assertIds(lite, [
  'toggleDarkModeBtn', 'analyzer', 'range', 'subnet', 'cidr-set', 'mac-vendor', 'ipInput', 'subnetInput', 'rangeStart', 'rangeEnd',
  'baseNetwork', 'baseCIDR', 'newCIDR', 'convertRangeBtn', 'subnetCalcBtn', 'macInput', 'clearBtn',
  'prevRangeStartBtn', 'nextRangeStartBtn', 'prevRangeEndBtn', 'nextRangeEndBtn', 'cidrSetInput', 'cidrExcludeInput', 'cidrExportSource', 'macError', 'resultCard', 'formatsCard', 'flagBadges', 'formatsList', 'randomMacBtn'
], ['randomVendorMacBtn', 'vendorName', 'matchedPrefix', 'assignmentType', 'dbStatus']);
hasAll(lite, [
  "tabButtons.forEach(btn =>", "btn.addEventListener('click'", "toggleDarkModeBtn.addEventListener('click'",
  "convertRangeBtn.addEventListener('click'",
  "subnetCalcBtn.addEventListener('click'", "randomMacBtn.addEventListener('click'",
  "macInput.addEventListener('input'", "clearBtn.addEventListener('click'"
]);

const staleSources = { ...sources };
staleSources['index.html'] = sources['index.html']
  .replace(/\s*<!-- MAC_VENDOR_HTML_START -->/g, '')
  .replace(/\s*<!-- MAC_VENDOR_HTML_END -->/g, '')
  .replace(/\s*\/\* MAC_VENDOR_JS_START \*\//g, '')
  .replace(/\s*\/\* MAC_VENDOR_JS_END \*\//g, '')
  .replace(/\s*\/\* OUI_LOADER_JS_START \*\//g, '')
  .replace(/\s*\/\* OUI_LOADER_JS_END \*\//g, '')
  .replace(/\n\s*function runFormatterOnly\(\) \{[\s\S]*?\n\s*}\n\n\s*function generateRandomMac/, '\n    function generateRandomMac');
assert.throws(() => Core.buildLite(staleSources), /incompatible|stale|markers/i);

const enhancedSources = { ...sources };
enhancedSources['index.html'] = sources['index.html']
  .replace('</head>', '  <link rel="stylesheet" href="./theme-overrides.css">\n  <link rel="stylesheet" href="./range-controls.css">\n</head>')
  .replace('</body>', '  <script src="./ui-enhancements.js" defer></script>\n  <script src="./range-controls.js" defer></script>\n</body>');
const enhanced = buildAndValidate(enhancedSources);
[enhanced.full, enhanced.lite].forEach((html) => {
  noExternal(html);
  assert.strictEqual(count(html, 'data-standalone-source="theme-overrides.css"'), 1, 'theme CSS should be inlined once');
  assert.strictEqual(count(html, 'data-standalone-source="range-controls.css"'), 1, 'range CSS should be inlined once');
  assert.strictEqual(count(html, 'data-standalone-source="ui-enhancements.js"'), 1, 'UI JS should be inlined once');
  assert.strictEqual(count(html, 'data-standalone-source="range-controls.js"'), 1, 'range JS should be inlined once');
  assert.strictEqual(count(html, 'data-standalone-source="cidr-set-utils.js"'), 1, 'CIDR set utils should be inlined once');
  assert.strictEqual(count(html, 'data-standalone-source="list-export-ui.js"'), 1, 'export UI should be inlined once');
  checkScripts(html);
});


assert.strictEqual(
  Core.standaloneSourceCacheKey('https://example.test/ipcalc/index.html?standalone-source=v3'),
  'https://example.test/ipcalc/index.html'
);
assert.strictEqual(
  Core.standaloneSourceCacheKey('https://example.test/ipcalc/index.html?foo=bar&standalone-source=v3'),
  'https://example.test/ipcalc/index.html?foo=bar'
);

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
hasAll(sw, ['cidr-set-utils.js', 'list-export-ui.js', "searchParams.has('standalone-source')", "searchParams.delete('standalone-source')", "cache:'no-store'", 'standaloneSourceNetworkFirst']);
assert(sw.indexOf("searchParams.has('standalone-source')") < sw.indexOf('caches.match(e.request)'), 'standalone-source branch must run before cache-first runtime fallback');
assert(sw.indexOf("searchParams.delete('standalone-source')") < sw.indexOf('cache.match(canonicalUrl.href)'), 'standalone-source must be removed before canonical fallback lookup');
assert(!/c\.put\(e\.request[\s\S]{0,120}standalone-source/.test(sw), 'standalone-source query requests must not be cached');

const builderJs = fs.readFileSync(path.join(root, 'standalone-builder.js'), 'utf8');
hasAll(builderJs, ["const BUILD_REVISION = 'standalone-builder-v3'", "fetch(freshUrl, { cache: 'reload' })", 'Core.standaloneSourceCacheKey(canonicalUrl.href)']);
hasNone(builderJs, ['ignoreSearch: true', 'force-cache']);

console.log(`Full ${Core.formatBytes(Core.bytes(full))}; Lite ${Core.formatBytes(Core.bytes(lite))}`);

hasAll(sources['index.html'], ['cidr-set-utils.js', 'list-export-ui.js']);
hasAll(Core.SOURCE_FILES, ['cidr-set-utils.js', 'list-export-ui.js']);

const exportUi = sources['list-export-ui.js'];
hasAll(exportUi, ['function refresh()', "format.addEventListener('change', refresh)", "name.addEventListener('input', refresh)", "action.addEventListener('change', refresh)", 'setDisabled(!output.value)', 'function resizeOutput()', 'output.scrollHeight']);
hasNone(exportUi, ['Generate', 'return { clear, generate']);
