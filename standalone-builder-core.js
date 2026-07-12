(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StandaloneBuilderCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SOURCE_FILES = ['index.html', 'ipv4-utils.js', 'theme-overrides.css', 'range-controls.css', 'range-controls.js', 'ui-enhancements.js'];
  const FULL_FILENAME = 'ipcalc-standalone-full.html';
  const LITE_FILENAME = 'ipcalc-standalone-lite.html';
  const INCOMPATIBLE_INDEX_MESSAGE = 'The cached index.html is incompatible with this Standalone Builder. Reload sources from the network or clear the old site cache.';
  const MAC_MARKERS = ['MAC_VENDOR_HTML', 'MAC_VENDOR_JS'];
  const REQUIRED_INDEX_SNIPPETS = [
    '<script src="./ipv4-utils.js"></script>',
    'IPv4 Address Analyzer', 'Address type', 'PTR lookup name', 'Reverse zone', 'Absolute PTR record',
    'IPv4 Range to Prefix Converter',
    'IPv4 Subnet Calculator',
    'data-tab="mac-vendor"',
    'id="toggleDarkModeBtn"',
    'id="analyzer"',
    'id="range"',
    'id="subnet"',
    'id="mac-vendor"',
    'id="macInput"',
    'id="randomMacBtn"',
    'id="formatsList"',
    'function runFormatterOnly()'
  ];
  const REQUIRED_OUTPUT_SNIPPETS = ['<!DOCTYPE html>', 'IPv4 Address Analyzer', 'Address type', 'PTR lookup name', 'Reverse zone', 'Absolute PTR record', 'IPv4 Range to Prefix Converter', 'IPv4 Subnet Calculator', 'data-tab="mac-vendor"'];
  const FORBIDDEN_RUNTIME_REFS = [/<script\b[^>]*\bsrc=/i, /<link\b[^>]*\brel=["']stylesheet["']/i, /<link\b[^>]*\brel=["']manifest["']/i];
  const FORBIDDEN_LOCAL_FETCHES = [/fetch\(\s*["'`]\.\//, /fetch\(\s*new Request\(\s*["'`]\.\//];

  function assertSource(sources, name) {
    if (!sources || typeof sources[name] !== 'string') throw new Error(`Missing source file: ${name}`);
    return sources[name];
  }
  function failIncompatible(reason) { throw new Error(`${INCOMPATIBLE_INDEX_MESSAGE} (${reason})`); }
  function escapeScriptJson(json) {
    return json.replace(/</g, '\\u003C').replace(/>/g, '\\u003E').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  }
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
  function count(text, needle) { return (text.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length; }
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
  function replaceFirstJsMarked(text, marker, replacement) {
    const pattern = new RegExp(`/\\* ${marker}_START \\*/[\\s\\S]*?/\\* ${marker}_END \\*/`);
    if (!pattern.test(text)) failIncompatible(`missing ${marker} block`);
    return text.replace(pattern, replacement);
  }
  function validateIndexSource(indexHtml) {
    if (typeof indexHtml !== 'string' || !indexHtml.trim()) failIncompatible('empty index.html');
    MAC_MARKERS.forEach((marker) => {
      const starts = count(indexHtml, `${marker}_START`);
      const ends = count(indexHtml, `${marker}_END`);
      if (!starts || !ends) failIncompatible(`missing ${marker} markers`);
      if (starts !== ends) failIncompatible(`unbalanced ${marker} markers`);
    });
    const ouiStarts = count(indexHtml, 'OUI_LOADER_JS_START');
    const ouiEnds = count(indexHtml, 'OUI_LOADER_JS_END');
    if (ouiStarts !== 1 || ouiEnds !== 1) failIncompatible('missing or unbalanced OUI loader markers');
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
  function inlineAssets(html, sources) {
    const css = `<style data-standalone-source="theme-overrides.css">\n${assertSource(sources, 'theme-overrides.css')}\n</style>\n<style data-standalone-source="range-controls.css">\n${assertSource(sources, 'range-controls.css')}\n</style>`;
    html = html.replace('</head>', () => `${css}\n</head>`);
    const ipv4Script = `<script data-standalone-source="ipv4-utils.js">\n${assertSource(sources, 'ipv4-utils.js')}\n</script>\n  <script>\n    /***************************************************`;
    html = html.replace('<script>\n    /***************************************************', () => ipv4Script);
    const trailingScripts = `<script data-standalone-source="ui-enhancements.js">\n${assertSource(sources, 'ui-enhancements.js')}\n</script>\n<script data-standalone-source="range-controls.js">\n${assertSource(sources, 'range-controls.js')}\n</script>\n</body>`;
    html = html.replace('</body>', () => trailingScripts);
    return html;
  }
  function removeServiceWorker(html) {
    return html.replace(/\n\s*if \('serviceWorker'[\s\S]*?\n\s*}\s*(?=\n\s*<\/script>)/, '\n    console.log(\'Standalone HTML: service worker disabled.\');');
  }
  function embeddedOuiLoader(ouiJson) {
    return `/* OUI_LOADER_JS_START */\n    async function loadOuiDb() {\n      if (ouiDb) return ouiDb;\n      const embedded = document.getElementById('embedded-oui-db');\n      if (!embedded) throw new Error('Embedded OUI database is missing.');\n      ouiDb = JSON.parse(embedded.textContent);\n      ouiDbLoadState = ouiDb.generatedAt ? \`loaded, generated \${ouiDb.generatedAt}\` : 'loaded from embedded database';\n      return ouiDb;\n    }\n    /* OUI_LOADER_JS_END */`;
  }
  function liteRunLookupAlias(html) {
    return html.replace(/runLookup\(\)/g, 'runFormatterOnly()').replace(/runLookup/g, 'runFormatterOnly');
  }
  function assertNoExternalRuntime(html) {
    FORBIDDEN_RUNTIME_REFS.forEach((pattern) => { if (pattern.test(html)) throw new Error(`Standalone output contains external runtime reference: ${pattern}`); });
  }
  function assertNoLocalFetch(html) {
    FORBIDDEN_LOCAL_FETCHES.forEach((pattern) => { if (pattern.test(html)) throw new Error(`Standalone output contains local fetch call: ${pattern}`); });
  }
  function assertNoMarkers(html) {
    ['MAC_VENDOR_HTML_START', 'MAC_VENDOR_HTML_END', 'MAC_VENDOR_JS_START', 'MAC_VENDOR_JS_END', 'OUI_LOADER_JS_START', 'OUI_LOADER_JS_END'].forEach((marker) => {
      if (html.includes(marker)) throw new Error(`Standalone output contains builder marker: ${marker}`);
    });
  }
  function getInlineScripts(html) {
    return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter((match) => !/type=["']application\/json["']/i.test(match[1]))
      .map((match) => match[2]);
  }
  function validateInlineScripts(html, compiler) {
    const compile = compiler || ((code) => { Function(code); });
    getInlineScripts(html).forEach((scriptText, index) => {
      try { compile(scriptText, index); }
      catch (error) { throw new Error(`Inline script ${index + 1} is invalid: ${error.message}`); }
    });
  }
  function validateEmbeddedOuiOrder(html) {
    const embeddedCount = count(html, 'id="embedded-oui-db"');
    if (embeddedCount !== 1) throw new Error(`Full standalone must contain exactly one embedded OUI database; found ${embeddedCount}`);
    const embeddedScriptIndex = html.indexOf('<script type="application/json" id="embedded-oui-db"');
    if (embeddedScriptIndex < 0) throw new Error('Full standalone embedded OUI database must be an application/json script');
    const appScriptIndex = html.indexOf('/***************************************************');
    const firstLoadIndex = html.indexOf('loadOuiDb()');
    const initialLookupIndex = html.indexOf('loadOuiDb().then(runLookup)');
    if (appScriptIndex < 0) throw new Error('Full standalone application script was not found');
    if (firstLoadIndex < 0) throw new Error('Full standalone loadOuiDb call was not found');
    if (initialLookupIndex < 0) throw new Error('Full standalone initial OUI lookup was not found');
    if (embeddedScriptIndex > appScriptIndex) throw new Error('Embedded OUI database must be parsed before application JavaScript');
    if (embeddedScriptIndex > firstLoadIndex) throw new Error('Embedded OUI database must appear before the first loadOuiDb call');
    if (embeddedScriptIndex > initialLookupIndex) throw new Error('Embedded OUI database must appear before the initial lookup');
  }
  function validateStandaloneOutput(html, variant, options) {
    if (variant !== 'full' && variant !== 'lite') throw new Error('variant must be full or lite');
    assertContains(html, REQUIRED_OUTPUT_SNIPPETS, `${variant} standalone`);
    assertNoExternalRuntime(html);
    assertNoLocalFetch(html);
    assertNoMarkers(html);
    if (html.includes('navigator.serviceWorker.register')) throw new Error(`${variant} standalone registers a service worker`);
    validateInlineScripts(html, options && options.compileScript);
    if (variant === 'full') {
      assertContains(html, ['embedded-oui-db', 'function lookupVendor', 'Random vendor MAC', 'Vendor', 'Matched prefix', 'Assignment type'], 'Full standalone');
      assertNotContains(html, ['oui-db.json', "fetch('./oui-db.json'"], 'Full standalone');
      validateEmbeddedOuiOrder(html);
    } else {
      assertContains(html, ['function runFormatterOnly', 'Copy formats', 'Random MAC', 'Unicast', 'Multicast / group address', 'Globally administered'], 'Lite standalone');
      assertNotContains(html, ["fetch('./oui-db.json'", 'loadOuiDb', 'lookupVendor', 'embedded-oui-db', 'Random vendor MAC', 'Vendor', 'Matched prefix', 'Assignment type', 'OUI database', 'Vendor not found'], 'Lite standalone');
      if (/const\s+response\s*=\s*await\s*(?:[;\n\r]|$)/.test(html)) throw new Error('Lite standalone contains a dangling await expression');
    }
    return true;
  }
  function buildStandalone(sources, options) {
    const variant = options && options.variant;
    if (variant !== 'full' && variant !== 'lite') throw new Error('variant must be full or lite');
    let html = assertSource(sources, 'index.html');
    validateIndexSource(html);
    html = removeExternalReferences(html);
    html = inlineAssets(html, sources);
    html = removeExternalReferences(html);
    html = removeServiceWorker(html);
    html = html.replace(/<html lang="en">/, '<html lang="en" data-standalone="true">');
    html = html.replace(/<title>.*?<\/title>/, `<title>IP Calculator Standalone ${variant === 'full' ? 'Full' : 'Lite'}</title>`);
    if (variant === 'full') {
      const ouiJson = assertSource(sources, 'oui-db.json');
      html = replaceFirstJsMarked(html, 'OUI_LOADER_JS', embeddedOuiLoader(ouiJson));
      html = unmark(html, 'OUI_LOADER_JS');
      html = unmark(html, 'MAC_VENDOR_JS');
      html = unmark(html, 'MAC_VENDOR_HTML');
      const embeddedOuiScript = `<script type="application/json" id="embedded-oui-db">${escapeScriptJson(ouiJson)}</script>\n`;
      html = html.replace('<script data-standalone-source="ipv4-utils.js">', () => `${embeddedOuiScript}<script data-standalone-source="ipv4-utils.js">`);
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
  function summarize(sources) {
    const result = { generatedAt: null, fullSize: null, liteSize: null };
    if (sources && sources['oui-db.json']) { try { result.generatedAt = JSON.parse(sources['oui-db.json']).generatedAt || null; } catch (_) {} }
    try { result.liteSize = bytes(buildLite(sources)); } catch (_) {}
    try { result.fullSize = bytes(buildFull(sources)); } catch (_) {}
    return result;
  }
  return { SOURCE_FILES, FULL_FILENAME, LITE_FILENAME, INCOMPATIBLE_INDEX_MESSAGE, buildStandalone, buildFull, buildLite, summarize, formatBytes, bytes, escapeScriptJson, standaloneSourceCacheKey, validateIndexSource, validateStandaloneOutput, getInlineScripts };
});
