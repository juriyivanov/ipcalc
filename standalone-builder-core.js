(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StandaloneBuilderCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SOURCE_FILES = ['index.html', 'ipv4-utils.js', 'theme-overrides.css', 'range-controls.css', 'range-controls.js', 'ui-enhancements.js'];
  const FULL_FILENAME = 'ipcalc-standalone-full.html';
  const LITE_FILENAME = 'ipcalc-standalone-lite.html';

  function assertSource(sources, name) {
    if (!sources || typeof sources[name] !== 'string') throw new Error(`Missing source file: ${name}`);
    return sources[name];
  }
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
  function stripMarked(text, marker) {
    const htmlPattern = new RegExp(`\\s*<!-- ${marker}_START -->[\\s\\S]*?<!-- ${marker}_END -->`, 'g');
    const jsPattern = new RegExp(`\\s*/\\* ${marker}_START \\*/[\\s\\S]*?/\\* ${marker}_END \\*/`, 'g');
    return text.replace(htmlPattern, '').replace(jsPattern, '');
  }
  function unmark(text, marker) {
    return text.replace(new RegExp(`\\s*(?:<!-- ${marker}_(?:START|END) -->|/\\* ${marker}_(?:START|END) \\*/)`, 'g'), '');
  }
  function replaceFirstJsMarked(text, marker, replacement) {
    return text.replace(new RegExp(`/\\* ${marker}_START \\*/[\\s\\S]*?/\\* ${marker}_END \\*/`), replacement);
  }
  function removeExternalReferences(html) {
    return html
      .replace(/\s*<link\s+rel="manifest"[^>]*>\s*/gi, '\n')
      .replace(/\s*<link\s+rel="(?:icon|apple-touch-icon)"[^>]*>\s*/gi, '\n')
      .replace(/\s*<script\s+src="\.\/ipv4-utils\.js"><\/script>\s*/i, '\n');
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
    return `let ouiDb = null;\n    let ouiDbLoadState = 'not loaded';\n\n    async function loadOuiDb() {\n      if (ouiDb) return ouiDb;\n      const embedded = document.getElementById('embedded-oui-db');\n      if (!embedded) throw new Error('Embedded OUI database is missing.');\n      ouiDb = JSON.parse(embedded.textContent);\n      ouiDbLoadState = ouiDb.generatedAt ? \`loaded, generated \${ouiDb.generatedAt}\` : 'loaded from embedded database';\n      return ouiDb;\n    }`;
  }
  function liteRunLookupAlias(html) {
    return html.replace(/runLookup\(\)/g, 'runFormatterOnly()').replace(/runLookup/g, 'runFormatterOnly');
  }
  function buildStandalone(sources, options) {
    const variant = options && options.variant;
    if (variant !== 'full' && variant !== 'lite') throw new Error('variant must be full or lite');
    let html = assertSource(sources, 'index.html');
    html = removeExternalReferences(html);
    html = inlineAssets(html, sources);
    html = removeServiceWorker(html);
    html = html.replace(/<html lang="en">/, '<html lang="en" data-standalone="true">');
    html = html.replace(/<title>.*?<\/title>/, `<title>IP Calculator Standalone ${variant === 'full' ? 'Full' : 'Lite'}</title>`);
    if (variant === 'full') {
      const ouiJson = assertSource(sources, 'oui-db.json');
      html = html.replace(/let ouiDb = null;[\s\S]*?async function loadOuiDb\(\) \{[\s\S]*?return ouiDb;\n    \}/, embeddedOuiLoader(ouiJson));
      html = unmark(html, 'MAC_VENDOR_JS');
      html = unmark(html, 'MAC_VENDOR_HTML');
      html = html.replace('</body>', `<script type="application/json" id="embedded-oui-db">${escapeScriptJson(ouiJson)}</script>\n</body>`);
    } else {
      html = stripMarked(html, 'MAC_VENDOR_HTML');
      html = stripMarked(html, 'MAC_VENDOR_JS');
      html = liteRunLookupAlias(html);
      html = html.replace(/MAC Vendor tab/g, 'MAC tab').replace(/Tab Content: MAC Vendor \/ Formats/g, 'Tab Content: MAC Formats');
      html = html.replace(/<span data-standalone-mac-tab-title>MAC Vendor \/ Formats<\/span>/g, '<span data-standalone-mac-tab-title>MAC Formats</span>');
      html = html.replace(/<span data-standalone-mac-heading>MAC Vendor \/ Formats<\/span>/g, '<span data-standalone-mac-heading>MAC Formats</span>');
      html = html.replace(/<span data-standalone-mac-description>[\s\S]*?<\/span>/, '<span data-standalone-mac-description>Format MAC addresses locally and show bit-based MAC flags. Manufacturer lookup is not included in the Lite standalone version.</span>');
    }
    html = html.replace(/fetch\('\.\/oui-db\.json'[\s\S]*?\);?/g, '');
    return html;
  }
  function buildFull(sources) { return buildStandalone(sources, { variant: 'full' }); }
  function buildLite(sources) { return buildStandalone(sources, { variant: 'lite' }); }
  function summarize(sources) {
    const result = { generatedAt: null, fullSize: null, liteSize: null };
    if (sources && sources['oui-db.json']) { try { result.generatedAt = JSON.parse(sources['oui-db.json']).generatedAt || null; } catch (_) {} }
    try { result.liteSize = bytes(buildLite(sources)); } catch (_) {}
    try { result.fullSize = bytes(buildFull(sources)); } catch (_) {}
    return result;
  }
  return { SOURCE_FILES, FULL_FILENAME, LITE_FILENAME, buildStandalone, buildFull, buildLite, summarize, formatBytes, bytes, escapeScriptJson };
});
