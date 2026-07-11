(() => {
  'use strict';
  const Core = window.StandaloneBuilderCore;
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
  async function loadFile(file) {
    const response = await fetch(`./${file}`, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Cannot load ${file}: HTTP ${response.status}`);
    return response.text();
  }
  async function loadSources() {
    setError('');
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
    sourceStatus.textContent = 'Sources loaded';
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
  async function build(variant) {
    try {
      setError(''); setProgress(15, `Preparing ${variant} build…`);
      await new Promise((resolve) => setTimeout(resolve, 30));
      if (variant === 'full' && !sources['oui-db.json']) throw new Error('Full standalone requires oui-db.json. Open the app online once so the service worker can cache the database, then retry.');
      setProgress(55, `Inlining ${variant} assets…`);
      const html = variant === 'full' ? Core.buildFull(sources) : Core.buildLite(sources);
      setProgress(85, `Creating ${variant} download…`);
      download(variant === 'full' ? Core.FULL_FILENAME : Core.LITE_FILENAME, html);
      setProgress(100, `${variant} standalone ready (${Core.formatBytes(Core.bytes(html))})`);
    } catch (error) { setError(error.message); buildStatus.textContent = 'Build failed'; progress.hidden = true; }
  }
  fullButton.addEventListener('click', () => build('full'));
  liteButton.addEventListener('click', () => build('lite'));
  loadSources().catch((error) => { sourceStatus.textContent = 'Failed to load sources'; setError(error.message); });
})();
