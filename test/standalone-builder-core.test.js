const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Core = require('../standalone-builder-core.js');

const root = path.join(__dirname, '..');
const sources = Object.fromEntries(Core.SOURCE_FILES.map((f) => [f, fs.readFileSync(path.join(root, f), 'utf8')]));
sources[Core.BINARY_SOURCE] = fs.readFileSync(path.join(root, Core.BINARY_SOURCE)).toString('base64');

function hasAll(text, items) { for (const item of items) assert(text.includes(item), `missing ${item}`); }
function hasNone(text, items) { for (const item of items) assert(!text.includes(item), `unexpected ${item}`); }
function count(text, needle) { return text.split(needle).length - 1; }
function checkScripts(html) { Core.getInlineScripts(html).forEach((code, i) => new vm.Script(code, { filename: `inline-${i}.js` })); }

const full = Core.buildFull(sources);
const lite = Core.buildLite(sources);
Core.validateStandaloneOutput(full, 'full');
Core.validateStandaloneOutput(lite, 'lite');
checkScripts(full);
checkScripts(lite);

hasAll(sources['index.html'], [
  '<link rel="stylesheet" href="./app.css" />',
  '<script src="./ipv4-utils.js"></script>',
  '<script src="./cidr-set-utils.js"></script>',
  '<script src="./app.js"></script>',
  'id="appVersion"', 'data-tab="mac-vendor"'
]);
hasAll(sources['app.js'], [
  "const CORE_SCRIPT = './app-core.js'",
  "const COMPACT_DB_PATH = './oui-db.bin.gz'",
  "const MAGIC = 'DecompressionStream'",
  'new DataView(buffer)',
  'function findVendorId',
  'function decodeVendorBlock',
  'new Proxy(Object.create(null)',
  'window.fetch = async function compactOuiFetch'
]);
hasAll(sources['app-core.js'], [
  "const APP_VERSION = '3.16'",
  'function initApp()',
  'function lookupVendor',
  'function renderVendorResult',
  "document.addEventListener('DOMContentLoaded', initApp, { once: true })"
]);

hasAll(full, [
  '<!DOCTYPE html>', '<html lang="en" data-standalone="true">',
  'IPv4 Address Analyzer', 'CIDR Set Calculator', 'MAC Vendor / Formats',
  'id="embedded-oui-db-gzip"', 'DecompressionStream', 'function lookupVendor',
  'Random vendor MAC', "APP_VERSION = '3.16'"
]);
hasNone(full, ['<script src=', 'rel="stylesheet"', 'rel="manifest"', 'src="./oui-db.bin.gz"', 'src="./app-core.js"']);
assert.strictEqual(count(full, 'id="embedded-oui-db-gzip"'), 1);

hasAll(lite, [
  '<!DOCTYPE html>', '<html lang="en" data-standalone="true">',
  'CIDR Set Calculator', 'MAC Formats', 'Random MAC', 'Unicast',
  'Globally administered', "APP_VERSION = '3.16'"
]);
hasNone(lite, [
  'embedded-oui-db-gzip', 'lookupVendor', 'loadOuiDb', 'Random vendor MAC',
  'Matched prefix', 'Vendor not found', '<script src=', 'rel="stylesheet"', 'rel="manifest"'
]);
assert(lite.length < full.length * 0.25, 'Lite should stay much smaller than compact Full');
assert(full.length < 2 * 1024 * 1024, 'Compact Full standalone should stay below 2 MiB');

const summary = Core.summarize(sources);
assert.match(summary.generatedAt || '', /^\d{4}-\d{2}-\d{2}$/);
assert(summary.fullSize > summary.liteSize);
assert.deepStrictEqual(Core.SOURCE_FILES, ['index.html', 'app.css', 'ipv4-utils.js', 'cidr-set-utils.js', 'app.js', 'app-core.js']);
assert.strictEqual(Core.BINARY_SOURCE, 'oui-db.bin.gz');
assert.strictEqual(Core.standaloneSourceCacheKey('https://example.test/ipcalc/index.html?standalone-source=v4'), 'https://example.test/ipcalc/index.html');

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
hasAll(sw, [
  'ipcalc-pwa-v25', "const OUI_DB_PATH='/ipcalc/oui-db.bin.gz'", './oui-db.bin.gz',
  './app-core.js', "u.pathname.endsWith('/oui-db.bin.gz')", 'standaloneSourceNetworkFirst', 'shellNetworkFirst'
]);
hasNone(sw, ['./oui-db.json', "u.pathname.endsWith('/oui-db.json')"]);

const builderJs = fs.readFileSync(path.join(root, 'standalone-builder.js'), 'utf8');
hasAll(builderJs, [
  "const BUILD_REVISION = 'standalone-builder-v5'",
  'const files = [...Core.SOURCE_FILES, Core.BINARY_SOURCE]',
  'arrayBufferToBase64',
  "fetch(freshUrl, { cache: 'reload' })"
]);
hasNone(builderJs, ['oui-db.json', 'force-cache']);

console.log(`Full ${Core.formatBytes(Core.bytes(full))}; Lite ${Core.formatBytes(Core.bytes(lite))}`);
