# PWA / GitHub Pages

Этот репозиторий можно опубликовать как статическое PWA-приложение через GitHub Pages.

## Основные файлы

- `index.html` — PWA-точка входа: IPv4-инструменты и вкладка **MAC Vendor / Formats**.
- `oui-db.json` — offline OUI-база для MAC Vendor Lookup.
- `standalone-builder.html` — браузерный генератор автономных Full/Lite HTML-файлов.
- `standalone-builder.js` и `standalone-builder-core.js` — UI и чистая логика standalone-сборки.
- `tools/build-oui-db.py` — генератор полной offline-базы из локального systemd hwdb, Wireshark manufacturer database или публичных IEEE assignment files.
- `manifest.json` — манифест приложения для установки на главный экран.
- `sw.js` — service worker для офлайн-кэша и stale-while-revalidate для `oui-db.json`.
- `icon.svg`, `icon-192.svg`, `icon-512.svg` — SVG-иконки приложения.

PWA-функции работают при запуске через HTTPS, `localhost` или `127.0.0.1`. При открытии через `file://` service worker не регистрируется. Для `file://`-сценариев используйте standalone-файлы, созданные builder-ом.

## Проверка локально

Из корня репозитория:

```bash
python3 -m http.server 8080
```

Открыть:

```text
http://127.0.0.1:8080/
```

Проверить в DevTools:

- Application → Manifest
- Application → Service Workers
- Application → Cache Storage
- Network → Offline, затем обновить страницу

## MAC Vendor Lookup

Вкладка **MAC Vendor / Formats** принимает MAC-адрес почти в любом обычном формате:

```text
AA:BB:CC:DD:EE:FF
AA-BB-CC-DD-EE-FF
AABB.CCDD.EEFF
AABBCCDDEEFF
aa bb cc dd ee ff
```

Выводит:

- vendor по локальной OUI-базе;
- совпавший префикс;
- тип назначения: MA-L / MA-M / MA-S;
- признаки broadcast, multicast/group, locally administered/randomized;
- варианты MAC для копипаста: colon, hyphen, Cisco dotted, plain, lowercase/uppercase, space-separated, `0x`.

### Полная OUI-база

Для обновления базы запустите:

```bash
python3 tools/build-oui-db.py --pretty -o oui-db.json
```

Service worker кэширует `oui-db.json`, поэтому lookup будет работать офлайн после первого открытия. Для базы используется stale-while-revalidate: кэшированный файл отдаётся сразу, а свежая версия обновляется в фоне.

## Standalone Builder

После публикации GitHub Pages генератор будет доступен по адресу:

```text
https://juriyivanov.github.io/ipcalc/standalone-builder.html
```

Service worker кэширует файлы builder-а и исходники приложения. Builder загружает исходники network-first с cache-busting revision и использует Cache Storage только как offline fallback; несовместимый старый `index.html` блокирует сборку с понятной ошибкой. После первого успешного открытия Lite можно собрать из кэша; Full требует доступную закэшированную или сетевую `oui-db.json`.

## Публикация через GitHub Pages

В GitHub:

```text
Settings → Pages → Build and deployment
Source: Deploy from a branch
Branch: main
Folder: /root
Save
```

После публикации приложение будет доступно по адресу:

```text
https://juriyivanov.github.io/ipcalc/
```

## Установка на Android / Samsung

1. Открыть опубликованный URL в Chrome или Samsung Internet.
2. Открыть меню браузера.
3. Выбрать **Add to Home screen** / **Добавить на главный экран**.
4. Запустить приложение с созданной иконки.
5. После первого открытия приложение должно запускаться офлайн из кэша service worker.

## Важные детали

- Все пути относительные, чтобы приложение работало из подпапки GitHub Pages `/ipcalc/`.
- Service worker кэширует PWA, builder, JS/CSS-исходники, `oui-db.json`, `manifest.json` и иконки.
- В приложении нет серверной части, сборщика, npm-зависимостей или внешних CDN.
- MAC lookup не отправляет введённые MAC-адреса во внешние API.
