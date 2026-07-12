# Extended IP Calculator

**Extended IP Calculator** — это статическое браузерное приложение для базовых операций с IPv4-сетями и MAC-адресами. Оно не требует backend, npm-сборки или внешних runtime-зависимостей.

## Возможности

- **IPv4 Address Analyzer** — строгий разбор IPv4/CIDR или dotted mask, network/broadcast/host range, wildcard, Previous/Next, кнопки изменения префикса, IPv4 special-purpose address classification, Reverse DNS / in-addr.arpa generation и RFC 2317 classless reverse delegation hints.
- **IPv4 Range to Prefix Converter** — преобразование IPv4-диапазона в минимальный набор CIDR-блоков с ограничением объёма вывода.
- **IPv4 Subnet Calculator** — разбиение сети на подсети, вывод масок, Previous/Next и prefix controls.
- **MAC Vendor / Formats** — нормализация MAC, copy-friendly форматы, MAC flags, Random MAC, Random vendor MAC и lookup по локальной offline OUI-базе `oui-db.json`.
- **PWA / GitHub Pages** — manifest, installable mode, offline cache и stale-while-revalidate для `oui-db.json`.
- **Темная тема** — приложение по умолчанию открывается в темном режиме, тему можно переключить кнопкой `Toggle Mode`.

IPv4 classification is based on a static in-app copy of the IANA IPv4 Special-Purpose Address Registry with additional IPv4 multicast classification. Ordinary unicast means the address is not in that special-purpose table; it does not guarantee allocation or current global Internet reachability. Classless reverse DNS hints follow RFC 2317 conventions and require CNAME records or equivalent configuration in the parent reverse zone.

## Быстрый старт

Актуальная многофайловая PWA находится в `index.html`. Для локальной проверки запускайте приложение через HTTP-сервер из корня репозитория:

```bash
python3 -m http.server 8000
```

Откройте:

```text
http://localhost:8000/
```

Прямое открытие `index.html` из файловой системы возможно для базового просмотра, но PWA/service worker и офлайн-кэш корректно работают только через HTTP(S). Подробности по GitHub Pages и офлайн-режиму: [`README-PWA.md`](README-PWA.md).

## Standalone HTML versions

Основная версия приложения является многофайловой PWA: она использует `index.html`, CSS/JS-файлы, manifest, service worker и `oui-db.json`. Для случаев, когда нужен один автономный HTML-файл без соседних ресурсов, добавлен браузерный **Standalone Builder**:

https://juriyivanov.github.io/ipcalc/standalone-builder.html

Builder загружает текущие исходники с того же origin и создаёт standalone-файлы прямо в браузере. Готовые standalone-файлы не хранятся в репозитории и не поддерживаются вручную.

1. Открыть Standalone Builder.
2. Выбрать Full или Lite.
3. Нажать Build and download.
4. Открыть скачанный HTML напрямую в браузере.

| Функция                | Full | Lite |
| ---------------------- | ---: | ---: |
| IPv4-инструменты       |   Да |   Да |
| MAC Formatter          |   Да |   Да |
| MAC flags              |   Да |   Да |
| Random MAC             |   Да |   Да |
| MAC Vendor Lookup      |   Да |  Нет |
| Random vendor MAC      |   Да |  Нет |
| Встроенная OUI-база    |   Да |  Нет |
| Работа через `file://` |   Да |   Да |

**Full** содержит IPv4-инструменты, MAC Formatter и встроенную полную OUI-базу. **Lite** содержит IPv4-инструменты и MAC Formatter, но не ищет производителя и не включает OUI-базу. Оба файла открываются через `file://`, не требуют соседних файлов и не выполняют сетевых запросов.

## Как пользоваться

### Анализ IPv4-адреса

1. Откройте вкладку **IPv4 Address Analyzer**.
2. Введите IPv4-адрес, например `192.168.1.1`.
3. Введите маску подсети в формате `/24` или `255.255.255.0`.
4. Результаты пересчитываются автоматически при изменении полей.

### Конвертация диапазона в CIDR

1. Откройте вкладку **IPv4 Range to Prefix Converter**.
2. Укажите начальный и конечный адреса диапазона, например `192.168.100.0` и `192.168.100.10`.
3. Нажмите **Convert Range**.
4. В таблице появится список CIDR-блоков, которые покрывают указанный диапазон.

### Расчет подсетей

1. Откройте вкладку **IPv4 Subnet Calculator**.
2. Укажите базовую сеть, исходный CIDR и новый префикс для разбиения.
3. Нажмите **Calculate**.

### MAC Vendor / Formats

1. Откройте вкладку **MAC Vendor / Formats**.
2. Введите MAC-адрес в привычном формате: `001a.2b3c.4d5e`, `00:1A:2B:3C:4D:5E`, `00-1A-2B-3C-4D-5E` или `001A2B3C4D5E`.
3. Скопируйте нужный формат кнопкой **Copy**.
4. Полная offline vendor-база хранится в `oui-db.json`. Чтобы обновить ее из актуального источника, выполните:

   ```bash
   python3 tools/build-oui-db.py --pretty -o oui-db.json
   ```

## Структура проекта

```text
.
├── index.html                         # Основная PWA: IPv4-инструменты, MAC Vendor / Formats и навигация
├── ipv4-utils.js                      # Общие IPv4-утилиты, строгий разбор и тестируемые расчеты
├── manifest.json                      # PWA manifest
├── sw.js                              # Service worker для офлайн-кэша
├── oui-db.json                        # Offline MAC vendor database
├── range-controls.css                 # Стили дополнительных IPv4 controls
├── range-controls.js                  # Дополнительные кнопки управления диапазоном IPv4
├── standalone-builder.html            # Браузерный генератор standalone HTML
├── standalone-builder.js              # UI standalone builder-а
├── standalone-builder-core.js         # Чистая логика сборки Full/Lite standalone
├── theme-overrides.css                # Дополнительные стили темы
├── ui-enhancements.js                 # Дополнительные UI-улучшения без сборки
├── test/
│   ├── ipv4-utils.test.js             # Node.js unit-тесты IPv4-логики
│   └── standalone-builder-core.test.js # Node.js тесты standalone-сборки
├── tools/
│   ├── build-oui-db.py                # Генератор полной OUI-базы
│   └── check-index-inline-js.js       # Syntax check inline JavaScript из index.html
├── README-PWA.md                      # Инструкция по PWA/GitHub Pages
└── README.md                          # Документация проекта
```

## Требования

- Современный браузер с поддержкой JavaScript.
- Для локального HTTP-сервера опционально нужен Python 3.
- Для обновления полной OUI-базы нужен Python 3 и доступ к локальному systemd hwdb или интернету для скачивания Wireshark/IEEE assignment files.

## Ограничения

- IPv4-калькулятор поддерживает только IPv4.
- Все вычисления выполняются на стороне клиента.
- MAC vendor lookup зависит от актуальности локального `oui-db.json`.
- Для locally administered/randomized MAC vendor может быть ненадежен или не определяться.

## Разработка

Проект остаётся статическим HTML/CSS/JavaScript-приложением без npm-сборки и внешних runtime-зависимостей. Основной файл для разработки и локальной проверки — `index.html`; запускайте его через HTTP-сервер, например `python3 -m http.server 8000`.

Основные проверки:

```bash
node --check ipv4-utils.js
node --check range-controls.js
node --check sw.js
node --check standalone-builder.js
node --check standalone-builder-core.js
node --check tools/check-index-inline-js.js
node tools/check-index-inline-js.js
node test/standalone-builder-core.test.js
node --test
```

## Лицензия

Проект распространяется по лицензии **GNU General Public License v3.0 or later (GPL-3.0-or-later)**. Полный текст лицензии находится в файле [`LICENSE`](LICENSE).
