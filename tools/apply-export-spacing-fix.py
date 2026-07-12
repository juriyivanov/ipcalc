from pathlib import Path


def replace_once(path, old, new):
    text = Path(path).read_text()
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old}')
    Path(path).write_text(text.replace(old, new, 1))


replace_once(
    'app.css',
    '.export-output { width: 100%; min-height: 4.75rem; height: auto; max-height: none; overflow: hidden; resize: none; field-sizing: content; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }',
    '.export-output { width: 100%; min-height: 3.5rem; height: auto; max-height: none; margin-top: 8px; overflow: hidden; resize: none; field-sizing: content; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }'
)
replace_once('app.js', "const APP_VERSION = '0.14.3';", "const APP_VERSION = '0.14.4';")
replace_once('sw.js', "const CACHE_NAME='ipcalc-pwa-v18';", "const CACHE_NAME='ipcalc-pwa-v19';")
replace_once('test/standalone-builder-core.test.js', "APP_VERSION = '0.14.3'", "APP_VERSION = '0.14.4'")
replace_once('test/standalone-builder-core.test.js', 'ipcalc-pwa-v18', 'ipcalc-pwa-v19')
