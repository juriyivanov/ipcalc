(() => {
  'use strict';
  const Core = window.StandaloneBuilderCore;
  const BUILD_REVISION = 'standalone-builder-v2';
  const sourceStatus = document.getElementById('sourceStatus');
  const buildStatus = document.getElementById('buildStatus');
  const generationDate = document.getElementById('generationDate');
  const errorBox = document.getElementById('error');
  const progress = document.getElementById('progress');
  const fullDb = document.getElementById('fullDb');
  const fullSize = document.getElementById('fullSize');
  const liteSize = document.getElementById('liteSize');
  const fullButton = document.getElementById('buildFull');
  const liteButton = document.getElementById('buildLite');
  const sources = {};
  const files = [...Core.SOURCE_FILES, 'oui-db.json'];

  function setError(message) { errorBox.textContent = message || ''; }
  function setProgress(value, text) { progress.hidden = false; progress.value = value; buildStatus.textContent = text; }
  function sourceUrl(file) { return new URL(file, window.location.href); }
  async function loadFromCache(canonicalUrl) {
    if (!('caches' in window)) return null;
    const cached = await caches.match(canonicalUrl.href, { ignoreSearch: true });
    return cached || null;
  }
  async function loadFile(file) {
    const canonicalUrl = sourceUrl(file);
    const freshUrl = new URL(canonicalUrl.href);
    freshUrl.searchParams.set('standalone-source', BUILD_REVISION);
    let networkError = null;
    try {
      const response = await fetch(freshUrl, { cache: 'reload' });
      if (response.ok) return response.text();
      networkError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      networkError = error;
    }
    const cached = await loadFromCache(canonicalUrl);
    if (cached) return cached.text();
    throw new Error(`Cannot load ${file} from network or offline cache${networkError ? ` (${networkError.message})` : ''}`);
  }
  function validateLoadedIndex() {
    Core.validateIndexSource(sources['index.html']);
  }
  async function refreshServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) await registration.update();
    } catch (error) {
      console.warn('Service worker update check failed:', error);
    }
  }
  async function loadSources() {
    setError('');
    await refreshServiceWorker();
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      sourceStatus.textContent = `Loading ${file} (${i + 1}/${files.length})…`;
      try { sources[file] = await loadFile(file); }
      catch (error) {
        if (file === 'oui-db.json') {
          sources[file] = '';
          fullDb.textContent = 'not available; Full cannot be built until the database is cached or online';
          setError(error.message);
          continue;
        }
        throw error;
      }
    }
    validateLoadedIndex();
    sourceStatus.textContent = `Sources loaded network-first (${BUILD_REVISION}); offline fallback uses Cache Storage only if network fails`;
    const summary = Core.summarize(sources);
    generationDate.textContent = new Date().toISOString();
    fullDb.textContent = summary.generatedAt || (sources['oui-db.json'] ? 'available' : 'not available');
    liteSize.textContent = summary.liteSize ? Core.formatBytes(summary.liteSize) : 'unknown';
    fullSize.textContent = summary.fullSize ? Core.formatBytes(summary.fullSize) : 'requires OUI database';
    liteButton.disabled = false;
    fullButton.disabled = !sources['oui-db.json'];
  }
  function download(filename, html) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function validateBeforeDownload(html, variant) {
    Core.validateStandaloneOutput(html, variant, {
      compileScript(scriptText) { Function(scriptText); }
    });
  }
  async function build(variant) {
    try {
      setError(''); setProgress(15, `Preparing ${variant} build…`);
      await new Promise((resolve) => setTimeout(resolve, 30));
      validateLoadedIndex();
      if (variant === 'full' && !sources['oui-db.json']) throw new Error('Full standalone requires oui-db.json. Open the app online once so the service worker can cache the database, then retry.');
      setProgress(55, `Inlining ${variant} assets…`);
      const html = variant === 'full' ? Core.buildFull(sources) : Core.buildLite(sources);
      setProgress(80, `Validating ${variant} standalone scripts…`);
      validateBeforeDownload(html, variant);
      setProgress(90, `Creating ${variant} download…`);
      download(variant === 'full' ? Core.FULL_FILENAME : Core.LITE_FILENAME, html);
      setProgress(100, `${variant} standalone ready (${Core.formatBytes(Core.bytes(html))})`);
    } catch (error) { setError(error.message); buildStatus.textContent = 'Build failed'; progress.hidden = true; }
  }
  fullButton.addEventListener('click', () => build('full'));
  liteButton.addEventListener('click', () => build('lite'));
  loadSources().catch((error) => { sourceStatus.textContent = 'Failed to load compatible sources'; setError(error.message); });
})();
