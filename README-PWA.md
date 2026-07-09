# PWA / GitHub Pages

Этот репозиторий можно опубликовать как статическое PWA-приложение через GitHub Pages.

## Что добавлено

- `index.html` — PWA-точка входа для GitHub Pages. Она загружает существующий `ipcalc2.html` и отдельную страницу MAC lookup без изменения логики старого файла.
- `mac.html` — офлайновый MAC Vendor Lookup и конвертер MAC-адреса во все популярные форматы для копипаста в сетевое оборудование.
- `oui-db.json` — стартовая OUI-база для тестирования. Для полноценной базы запустите `tools/build-oui-db.py`.
- `tools/build-oui-db.py` — генератор полной offline-базы из локального systemd hwdb или публичных IEEE assignment files.
- `manifest.json` — манифест приложения для установки на главный экран.
- `sw.js` — service worker для офлайн-кэша.
- `icon.svg`, `icon-192.svg`, `icon-512.svg` — SVG-иконки приложения.

Старый способ запуска остаётся рабочим:

```bash
xdg-open ipcalc2.html
```

PWA-функции работают при запуске через HTTPS, `localhost` или `127.0.0.1`. При открытии через `file://` service worker не регистрируется.

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

В репозитории лежит небольшая стартовая `oui-db.json`, чтобы интерфейс можно было проверить сразу. Для нормальной базы запустите:

```bash
python3 tools/build-oui-db.py --pretty -o oui-db.json
```

На Linux скрипт сначала попробует прочитать:

```text
/usr/lib/udev/hwdb.d/20-OUI.hwdb
```

Если файла нет, он скачает публичные IEEE списки:

```text
https://standards-oui.ieee.org/oui/oui.txt
https://standards-oui.ieee.org/oui28/mam.txt
https://standards-oui.ieee.org/oui36/oui36.txt
```

После генерации закоммитьте обновлённый `oui-db.json`. Service worker кэширует этот файл, поэтому lookup будет работать офлайн после первого открытия.

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
- Основная логика IPv4-калькулятора остаётся в `ipcalc2.html`.
- Service worker кэширует `index.html`, `ipcalc2.html`, `mac.html`, `oui-db.json`, `manifest.json` и иконки.
- В приложении нет серверной части, сборщика, npm-зависимостей или внешних CDN.
- MAC lookup не отправляет введённые MAC-адреса во внешние API.
