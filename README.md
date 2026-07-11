# Extended IP Calculator

**Extended IP Calculator** — это одностраничный веб-калькулятор для базовых операций с IPv4-сетями и MAC-адресами. Приложение работает полностью в браузере, не требует серверной части, сборки или внешних зависимостей.

## Возможности

- **IPv4 Address Analyzer**
  - анализ IPv4-адреса и маски подсети;
  - поддержка маски в формате CIDR (`/24`) и dotted decimal (`255.255.255.0`);
  - расчет адреса сети, broadcast-адреса, первого и последнего хоста;
  - расчет количества доступных хостов;
  - вывод subnet mask и wildcard mask;
  - быстрый переход к предыдущей или следующей подсети;
  - увеличение и уменьшение префикса маски кнопками.

- **IPv4 Range to Prefix Converter**
  - преобразование диапазона IPv4-адресов в набор CIDR-блоков;
  - точное покрытие диапазона минимально подходящими префиксами;
  - вывод сети и маски для каждого найденного блока.

- **IPv4 Subnet Calculator**
  - разбиение базовой сети на более мелкие подсети;
  - настройка исходного и нового CIDR-префикса;
  - вывод списка подсетей и соответствующих масок;
  - быстрый переход к предыдущей или следующей базовой сети.

- **MAC Vendor / Formats**
  - ввод MAC-адреса в форматах `AA:BB:CC:DD:EE:FF`, `AA-BB-CC-DD-EE-FF`, `AABB.CCDD.EEFF`, `AABBCCDDEEFF` и похожих;
  - нормализация MAC-адреса;
  - lookup vendor по локальной offline OUI-базе;
  - определение broadcast, multicast/group и locally administered/randomized MAC;
  - вывод популярных форматов для копипаста в сетевое оборудование: colon, hyphen, Cisco dotted, plain, lowercase/uppercase, space-separated, `0x`.

- **PWA / GitHub Pages**
  - установка на главный экран Android/Samsung/Chrome;
  - офлайн-запуск после первого открытия;
  - service worker кэширует основные файлы приложения и OUI-базу.

- **Темная тема**
  - IPv4-калькулятор по умолчанию открывается в темном режиме;
  - тему можно переключить кнопкой `Toggle Mode`.

## Быстрый старт

Актуальная версия приложения находится в `index.html`. Для локальной проверки запускайте приложение через HTTP-сервер из корня репозитория:

```bash
python3 -m http.server 8000
```

Откройте:

```text
http://localhost:8000/
```

Прямое открытие `index.html` из файловой системы возможно для базового просмотра, но PWA/service worker и офлайн-кэш корректно работают только через HTTP(S). Подробности по GitHub Pages и офлайн-режиму: [`README-PWA.md`](README-PWA.md).

> `ipcalc2.html` оставлен только как устаревший legacy-файл для старых прямых ссылок. Он не является актуальным способом запуска и не содержит текущие исправления IPv4-валидации, Range to CIDR и ограничения вывода подсетей.

## Как пользоваться

### Анализ IPv4-адреса

1. Откройте вкладку **IPv4 Address Analyzer**.
2. Введите IPv4-адрес, например:

   ```text
   192.168.1.1
   ```

3. Введите маску подсети в одном из форматов:

   ```text
   /24
   ```

   или

   ```text
   255.255.255.0
   ```

4. Результаты пересчитываются автоматически при изменении полей.

### Конвертация диапазона в CIDR

1. Откройте вкладку **IPv4 Range to Prefix Converter**.
2. Укажите начальный и конечный адреса диапазона, например:

   ```text
   192.168.100.0
   192.168.100.10
   ```

3. Нажмите **Convert Range**.
4. В таблице появится список CIDR-блоков, которые покрывают указанный диапазон.

### Расчет подсетей

1. Откройте вкладку **IPv4 Subnet Calculator**.
2. Укажите базовую сеть, например:

   ```text
   192.168.0.0
   ```

3. Укажите исходный CIDR, например:

   ```text
   /24
   ```

4. Укажите новый префикс для разбиения, например:

   ```text
   /28
   ```

5. Нажмите **Calculate**.

### MAC Vendor / Formats

1. В PWA-режиме откройте верхнюю вкладку **MAC Vendor / Formats**.
2. Введите MAC-адрес в любом привычном формате:

   ```text
   001a.2b3c.4d5e
   00:1A:2B:3C:4D:5E
   00-1A-2B-3C-4D-5E
   001A2B3C4D5E
   ```

3. Скопируйте нужный формат кнопкой **Copy**.
4. Полная offline vendor-база хранится в `oui-db.json`. Чтобы обновить ее из актуального источника, выполните:

   ```bash
   python3 tools/build-oui-db.py --pretty -o oui-db.json
   ```

   По умолчанию генератор берет Wireshark manufacturer database, где объединены публичные MAC-префиксы IEEE MA-L, MA-M и MA-S. Если этот источник недоступен, скрипт автоматически пробует IEEE Registration Authority files; для принудительного IEEE-режима используйте `--ieee-only`.

## Структура проекта

```text
.
├── index.html                    # Актуальная статическая версия приложения и навигация между инструментами
├── ipv4-utils.js                 # Общие IPv4-утилиты, строгий разбор и тестируемые расчеты
├── ipcalc2.html                  # Устаревший legacy-файл для старых прямых ссылок, не актуальная версия
├── mac.html                      # MAC Vendor Lookup и форматтер MAC-адресов
├── manifest.json                 # PWA manifest
├── sw.js                         # Service worker для офлайн-кэша
├── oui-db.json                   # Offline MAC vendor database
├── range-controls.js             # Дополнительные кнопки управления диапазоном IPv4
├── ui-enhancements.js            # Дополнительные UI-улучшения без сборки
├── test/
│   └── ipv4-utils.test.js        # Node.js unit-тесты IPv4-логики
├── tools/
│   ├── build-oui-db.py           # Генератор полной OUI-базы
│   └── check-index-inline-js.js  # Syntax check inline JavaScript из index.html
├── README-PWA.md                 # Инструкция по PWA/GitHub Pages
└── README.md                     # Документация проекта
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

Основные части:

- `index.html` — актуальные IPv4-инструменты, MAC Vendor / Formats и подключение общих скриптов;
- `ipv4-utils.js` — общие IPv4-операции и чистые функции, покрытые unit-тестами;
- `range-controls.js` — кнопки `IP−`, `IP+`, `/−`, `/+` для Range Converter;
- `manifest.json` + `sw.js` — PWA/offline-режим и stale-while-revalidate для `oui-db.json`;
- `mac.html` — отдельная страница MAC lookup и форматирования;
- `oui-db.json` — offline vendor database;
- `tools/build-oui-db.py` — обновление OUI-базы из systemd hwdb, Wireshark или IEEE;
- `tools/check-index-inline-js.js` — проверка синтаксиса inline JavaScript из `index.html`;
- `test/ipv4-utils.test.js` — Node.js unit-тесты.

`ipcalc2.html` — legacy-файл. Его не следует использовать как источник актуальной логики или как рекомендуемый режим запуска; файл пока сохранён только для обратной совместимости со старыми прямыми ссылками.

Минимальные проверки перед изменениями:

```bash
node --check ipv4-utils.js
node --check range-controls.js
node --check sw.js
node --check tools/check-index-inline-js.js
node tools/check-index-inline-js.js
node --test
```

## Лицензия

Проект распространяется по лицензии **GNU General Public License v3.0 or later (GPL-3.0-or-later)**. Полный текст лицензии находится в файле [`LICENSE`](LICENSE).
