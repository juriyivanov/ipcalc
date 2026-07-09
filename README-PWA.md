# PWA / GitHub Pages

Этот репозиторий можно опубликовать как статическое PWA-приложение через GitHub Pages.

## Что добавлено

- `index.html` — PWA-точка входа для GitHub Pages. Она загружает существующий `ipcalc2.html` без изменения его логики.
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
- Основная логика остаётся в `ipcalc2.html`.
- Service worker кэширует `index.html`, `ipcalc2.html`, `manifest.json` и иконки.
- В приложении нет серверной части, сборщика, npm-зависимостей или внешних CDN.
