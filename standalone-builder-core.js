(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StandaloneBuilderCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SOURCE_FILES = ['index.html', 'app.css', 'ipv4-utils.js', 'cidr-set-utils.js', 'app.js', 'app-core.js'];
  const BINARY_SOURCE = 'oui-db.bin.gz';
  const FULL_FILENAME = 'ipcalc-standalone-full.html';
  const LITE_FILENAME = 'ipcalc-standalone-lite.html';
  const INCOMPATIBLE_INDEX_MESSAGE = 'The cached index.html is incompatible with this Standalone Builder. Reload sources from the network or clear the old site cache.';
  const REQUIRED_INDEX_SNIPPETS = [
    '<link rel="stylesheet" href="./app.css" />',
    '<script src="./ipv4-utils.js"></script>',
    '<script src="./cidr-set-utils.js"></script>',
    '<script src="./app.js"></script>',
    'IPv4 Address Analyzer', 'IPv4 Range to Prefix Converter', 'IPv4 Subnet Calculator',
    'CIDR Set Calculator', 'data-tab="mac-vendor"', 'id="macInput"', 'id="formatsList"'
  ];
  const REQUIRED_OUTPUT_SNIPPETS = [
    '<!DOCTYPE html>', 'IPv4 Address Analyzer', 'IPv4 Range to Prefix Converter',
    'IPv4 Subnet Calculator', 'CIDR Set Calculator', 'data-tab="mac-vendor"'
  ];
  const FORBIDDEN_RUNTIME_REFS = [
    /<script\b[^>]*\bsrc=/i,
    /<link\b[^>]*\brel=["']stylesheet["']/i,
    /<link\b[^>]*\brel=["']manifest["']/i
  ];

  function assertSource(sources, name) {
    if (!sources || typeof sources[name] !== 'string' || !sources[name]) throw new Error(`Missing source file: ${name}`);
    return sources[name];
  }
  function failIncompatible(reason) { throw new Error(`${INCOMPATIBLE_INDEX_MESSAGE} (${reason})`); }
  function bytes(text) { return new TextEncoder().encode(text).length; }
  function formatBytes(n) {
    if (!Number.isFinite(n)) return 'unknown';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
    return `${(n / 1024 / 1024).toFixed(2)} MiB`;
  }
  function standaloneSourceCacheKey(url) {
    const canonicalUrl = new URL(String(url));
    canonicalUrl.searchParams.delete('standalone-source');
    return canonicalUrl.href;
  }
  function count(text, needle) { return text.split(needle).length - 1; }
  function assertContains(text, snippets, label) {
    snippets.forEach((snippet) => { if (!text.includes(snippet)) throw new Error(`${label} is missing required content: ${snippet}`); });
  }
  function assertNotContains(text, snippets, label) {
    snippets.forEach((snippet) => { if (text.includes(snippet)) throw new Error(`${label} contains forbidden content: ${snippet}`); });
  }
  function stripMarked(text, marker) {
    const htmlPattern = new RegExp(`\\s*<!-- ${marker}_START -->[\\s\\S]*?<!-- ${marker}_END -->`, 'g');
    const jsPattern = new RegExp(`\\s*/\\* ${marker}_START \\*/[\\s\\S]*?/\\* ${marker}_END \\*/`, 'g');
    return text.replace(htmlPattern, '').replace(jsPattern, '');
  }
  function unmark(text, marker) {
    return text.replace(new RegExp(`\\s*(?:<!-- ${marker}_(?:START|END) -->|/\\* ${marker}_(?:START|END) \\*/)`, 'g'), '');
  }
  function validateIndexSource(indexHtml) {
    if (typeof indexHtml !== 'string' || !indexHtml.trim()) failIncompatible('empty index.html');
    REQUIRED_INDEX_SNIPPETS.forEach((snippet) => { if (!indexHtml.includes(snippet)) failIncompatible(`missing ${snippet}`); });
    return true;
  }
  function removeExternalReferences(html) {
    return html
      .replace(/\s*<link\b[^>]*\brel=["']manifest["'][^>]*>\s*/gi, '\n')
      .replace(/\s*<link\b[^>]*\brel=["'](?:icon|apple-touch-icon)["'][^>]*>\s*/gi, '\n')
      .replace(/\s*<link\b[^>]*\brel=["']stylesheet["'][^>]*>\s*/gi, '\n')
      .replace(/\s*<script\b[^>]*\bsrc=["'][^"']+["'][^>]*><\/script>\s*/gi, '\n');
  }
  function standaloneWrapper(source) {
    const stripped = source.replace(/\n\s*const core = document\.createElement\('script'\);[\s\S]*?document\.head\.appendChild\(core\);\s*\n?/, '\n');
    if (stripped === source) throw new Error('app.js compact loader does not contain the expected app-core loader block');
    return stripped;
  }
  function embeddedBinaryBootstrap(base64) {
    if (!/^[A-Za-z0-9+/=]+$/.test(base64)) throw new Error('oui-db.bin.gz must be supplied as base64');
    return `<script type="application/octet-stream" id="embedded-oui-db-gzip">${base64}</script>\n<script data-standalone-source="oui-db-bootstrap">\n(function(){\n  'use strict';\n  const encoded = document.getElementById('embedded-oui-db-gzip').textContent.trim();\n  let decoded = null;\n  function binaryBuffer(){\n    if (decoded) return decoded.slice(0);\n    const raw = atob(encoded);\n    const bytes = new Uint8Array(raw.length);\n    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);\n    decoded = bytes.buffer;\n    return decoded.slice(0);\n  }\n  const networkFetch = window.fetch.bind(window);\n  window.fetch = async function(input, init){\n    const raw = typeof input === 'string' ? input : (input && input.url) || String(input);\n    let path = raw;\n    try { path = new URL(raw, location.href).pathname; } catch (_) {}\n    if (String(path).endsWith('/oui-db.bin.gz')) {\n      return { ok: true, status: 200, statusText: 'OK', arrayBuffer: async () => binaryBuffer() };\n    }\n    return networkFetch(input, init);\n  };\n})();\n</script>`;
  }
  function inlineAssets(html, sources, variant) {
    const css = `<style data-standalone-source="app.css">\n${assertSource(sources, 'app.css')}\n</style>`;
    html = html.replace(/\s*<link\b[^>]*href=["']\.\/app\.css["'][^>]*>\s*/i, () => `\n${css}\n`);
    const common = `<script data-standalone-source="ipv4-utils.js">\n${assertSource(sources, 'ipv4-utils.js')}\n</script>\n<script data-standalone-source="cidr-set-utils.js">\n${assertSource(sources, 'cidr-set-utils.js')}\n</script>`;
    let appScripts;
    if (variant === 'full') {
      const binary = embeddedBinaryBootstrap(assertSource(sources, BINARY_SOURCE));
      appScripts = `${binary}\n<script data-standalone-source="app.js">\n${standaloneWrapper(assertSource(sources, 'app.js'))}\n</script>\n<script data-standalone-source="app-core.js">\n${assertSource(sources, 'app-core.js')}\n</script>`;
    } else {
      appScripts = `<script data-standalone-source="app-core.js">\n${assertSource(sources, 'app-core.js')}\n</script>`;
    }
    const scripts = `${common}\n${appScripts}`;
    html = html.replace('  <script src="./ipv4-utils.js"></script>\n  <script src="./cidr-set-utils.js"></script>\n  <script src="./app.js"></script>\n', () => `  ${scripts}\n`);
    return html;
  }
  function liteRunLookupAlias(html) {
    return html.replace(/runLookup\(\)/g, 'runFormatterOnly()').replace(/runLookup/g, 'runFormatterOnly');
  }
  function assertNoExternalRuntime(html) {
    FORBIDDEN_RUNTIME_REFS.forEach((pattern) => { if (pattern.test(html)) throw new Error(`Standalone output contains external runtime reference: ${pattern}`); });
  }
  function assertNoMarkers(html) {
    ['MAC_VENDOR_HTML_START', 'MAC_VENDOR_HTML_END', 'MAC_VENDOR_JS_START', 'MAC_VENDOR_JS_END', 'OUI_LOADER_JS_START', 'OUI_LOADER_JS_END'].forEach((marker) => {
      if (html.includes(marker)) throw new Error(`Standalone output contains builder marker: ${marker}`);
    });
  }
  function getInlineScripts(html) {
    return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter((match) => !/type=["'](?:application\/json|application\/octet-stream)["']/i.test(match[1]))
      .map((match) => match[2]);
  }
  function validateInlineScripts(html, compiler) {
    const compile = compiler || ((code) => { Function(code); });
    getInlineScripts(html).forEach((scriptText, index) => {
      try { compile(scriptText, index); }
      catch (error) { throw new Error(`Inline script ${index + 1} is invalid: ${error.message}`); }
    });
  }
  function validateStandaloneOutput(html, variant, options) {
    if (variant !== 'full' && variant !== 'lite') throw new Error('variant must be full or lite');
    assertContains(html, REQUIRED_OUTPUT_SNIPPETS, `${variant} standalone`);
    assertNoExternalRuntime(html);
    assertNoMarkers(html);
    if (html.includes('navigator.serviceWorker.register')) throw new Error(`${variant} standalone registers a service worker`);
    validateInlineScripts(html, options && options.compileScript);
    if (variant === 'full') {
      assertContains(html, ['id="embedded-oui-db-gzip"', 'DecompressionStream', 'function lookupVendor', 'Random vendor MAC', 'Vendor', 'Matched prefix', 'Assignment type'], 'Full standalone');
      if (count(html, 'id="embedded-oui-db-gzip"') !== 1) throw new Error('Full standalone must contain exactly one compact gzip OUI database');
      assertNotContains(html, ['src="./app-core.js"', 'src="./oui-db.bin.gz"'], 'Full standalone');
    } else {
      assertContains(html, ['function runFormatterOnly', 'formats-table', 'Random MAC', 'Unicast', 'Multicast / group address', 'Globally administered'], 'Lite standalone');
      assertNotContains(html, ['embedded-oui-db-gzip', 'loadOuiDb', 'lookupVendor', 'Random vendor MAC', 'Matched prefix', 'Assignment type', 'Vendor not found'], 'Lite standalone');
      if (/const\s+response\s*=\s*await\s*(?:[;\n\r]|$)/.test(html)) throw new Error('Lite standalone contains a dangling await expression');
    }
    return true;
  }
  function buildStandalone(sources, options) {
    const variant = options && options.variant;
    if (variant !== 'full' && variant !== 'lite') throw new Error('variant must be full or lite');
    let html = assertSource(sources, 'index.html');
    validateIndexSource(html);
    html = inlineAssets(html, sources, variant);
    html = html.replace(/function initServiceWorker\(\) \{[\s\S]*?\n  \}\n\n  function initClearableField/, "function initServiceWorker() { console.log('Standalone HTML: service worker disabled.'); }\n\n  function initClearableField");
    html = removeExternalReferences(html);
    html = html.replace(/<html lang="en">/, '<html lang="en" data-standalone="true">');
    html = html.replace(/<title>.*?<\/title>/, `<title>IP Calculator Standalone ${variant === 'full' ? 'Full' : 'Lite'}</title>`);
    if (variant === 'full') {
      html = unmark(html, 'OUI_LOADER_JS');
      html = unmark(html, 'MAC_VENDOR_JS');
      html = unmark(html, 'MAC_VENDOR_HTML');
    } else {
      html = stripMarked(html, 'MAC_VENDOR_HTML');
      html = stripMarked(html, 'MAC_VENDOR_JS');
      html = stripMarked(html, 'OUI_LOADER_JS');
      html = liteRunLookupAlias(html);
      html = html.replace(/MAC Vendor tab/g, 'MAC tab').replace(/Tab Content: MAC Vendor \/ Formats/g, 'Tab Content: MAC Formats');
      html = html.replace(/<span data-standalone-mac-tab-title>MAC Vendor \/ Formats<\/span>/g, '<span data-standalone-mac-tab-title>MAC Formats</span>');
      html = html.replace(/<span data-standalone-mac-heading>MAC Vendor \/ Formats<\/span>/g, '<span data-standalone-mac-heading>MAC Formats</span>');
      html = html.replace(/<span data-standalone-mac-description>[\s\S]*?<\/span>/, '<span data-standalone-mac-description>Format MAC addresses locally and show bit-based MAC flags. Manufacturer lookup is not included in the Lite standalone version.</span>');
    }
    validateStandaloneOutput(html, variant, options);
    return html;
  }
  function buildFull(sources, options) { return buildStandalone(sources, Object.assign({}, options, { variant: 'full' })); }
  function buildLite(sources, options) { return buildStandalone(sources, Object.assign({}, options, { variant: 'lite' })); }
  function generatedDateFromBase64(base64) {
    try {
      let raw;
      if (typeof atob === 'function') raw = atob(base64.slice(0, 160));
      else if (typeof Buffer !== 'undefined') raw = Buffer.from(base64.slice(0, 160), 'base64').toString('binary');
      else return null;
      if (raw.slice(0, 8) === 'IPCOUI02') {
        const date = raw.slice(84, 94);
        return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
      }
      if (raw.length >= 8 && raw.charCodeAt(0) === 0x1f && raw.charCodeAt(1) === 0x8b) {
        const mtime = (raw.charCodeAt(4) | (raw.charCodeAt(5) << 8) | (raw.charCodeAt(6) << 16) | (raw.charCodeAt(7) << 24)) >>> 0;
        return mtime ? new Date(mtime * 1000).toISOString().slice(0, 10) : null;
      }
      return null;
    } catch (_) { return null; }
  }
  function summarize(sources) {
    const result = { generatedAt: generatedDateFromBase64(sources && sources[BINARY_SOURCE] || ''), fullSize: null, liteSize: null };
    try { result.liteSize = bytes(buildLite(sources)); } catch (_) {}
    try { result.fullSize = bytes(buildFull(sources)); } catch (_) {}
    return result;
  }

  return {
    SOURCE_FILES, BINARY_SOURCE, FULL_FILENAME, LITE_FILENAME, INCOMPATIBLE_INDEX_MESSAGE,
    buildStandalone, buildFull, buildLite, summarize, formatBytes, bytes,
    standaloneSourceCacheKey, validateIndexSource, validateStandaloneOutput, getInlineScripts
  };
});
