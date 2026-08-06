# Extended IP Calculator

**English** | [**Русский**](README.ru.md)

The application is available online at **https://juriyivanov.github.io/ipcalc/**

**Extended IP Calculator v3.15.2** is a static browser application for common IPv4 network and MAC address operations. It requires no backend, npm build process, or external runtime dependencies.

## Features

- **IPv4 Address Analyzer** — strict parsing of IPv4, IP/CIDR, IP + dotted mask, and IP/dotted-mask input; network, broadcast, host range, and wildcard calculation; Previous/Next and prefix controls; IPv4 special-purpose address classification; PTR lookup name generation; octet-aligned reverse zones; and RFC 2317 classless reverse delegation hints.
- **IPv4 Range to Prefix Converter** — converts an IPv4 range into the smallest possible set of CIDR blocks, with an output size limit.
- **IPv4 Subnet Calculator** — automatically and reactively divides a network into subnets and provides masks, Previous/Next navigation, and prefix controls.
- **CIDR Set Calculator** — CIDR set normalization and aggregation, containment analysis, include/exclude subtraction, and covered IPv4 address counts.
- **Reusable Clear controls** — compact clear buttons for editable text fields that leave read-only export output untouched.
- **Shared network configuration exports** — exports network lists from the Range, Subnet, and CIDR Set tools as Plain CIDR, Cisco prefix-list, MikroTik address-list, VyOS prefix-list, nftables, JSON, or CSV.
- **MAC Vendor / Formats** — MAC normalization, copy-friendly formats, MAC flags, Random MAC, Random vendor MAC, and vendor lookup using the local offline `oui-db.json` database.
- **PWA / GitHub Pages** — a manifest, installable mode, offline caching, and stale-while-revalidate handling for `oui-db.json`.
- **Dark theme** — the application opens in dark mode by default; use `Toggle Mode` to change the theme.

IPv4 classification is based on a static in-app copy of the IANA IPv4 Special-Purpose Address Registry with additional IPv4 multicast classification. Ordinary unicast means that the address is not in that special-purpose table; it does not guarantee allocation or current global Internet reachability. Classless reverse DNS hints follow RFC 2317 conventions and require CNAME records or equivalent configuration in the parent reverse zone.

## Quick start

The current multi-file PWA starts at `index.html`. To test it locally, run an HTTP server from the repository root:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

Opening `index.html` directly from the file system is sufficient for a basic preview, but the PWA, service worker, and offline cache work correctly only over HTTP(S). See [`README-PWA.md`](README-PWA.md) for GitHub Pages and offline-mode details.

## Standalone HTML versions

The main application is a multi-file PWA that uses `index.html`, CSS and JavaScript files, a manifest, a service worker, and `oui-db.json`. When a single self-contained HTML file is needed, use the browser-based **Standalone Builder**:

https://juriyivanov.github.io/ipcalc/standalone-builder.html

The builder loads the current sources from the same origin and creates standalone files entirely in the browser. Generated standalone files are not stored in the repository or maintained manually.

1. Open the Standalone Builder.
2. Select Full or Lite.
3. Click **Build and download**.
4. Open the downloaded HTML file directly in a browser.

| Feature | Full | Lite |
| --- | ---: | ---: |
| IPv4 tools | Yes | Yes |
| MAC Formatter | Yes | Yes |
| MAC flags | Yes | Yes |
| Random MAC | Yes | Yes |
| MAC Vendor Lookup | Yes | No |
| Random vendor MAC | Yes | No |
| Embedded OUI database | Yes | No |
| Works through `file://` | Yes | Yes |

**Full** includes the IPv4 tools, MAC Formatter, and the complete embedded OUI database. **Lite** includes the IPv4 tools and MAC Formatter, but does not perform vendor lookups or include the OUI database. Both files work through `file://`, require no adjacent resources, and make no network requests.

## Usage

### Analyze an IPv4 address

1. Open the **IPv4 Address Analyzer** tab.
2. Enter an IPv4 address such as `192.168.1.1`, or paste an address with its mask: `192.168.1.10/24`, `192.168.1.10 255.255.255.0`, or `192.168.1.10/255.255.255.0`.
3. If the address does not include a mask, enter a subnet mask such as `/24` or `255.255.255.0`.
4. Results are recalculated automatically whenever a field changes.

### Convert a range to CIDR

1. Open the **IPv4 Range to Prefix Converter** tab.
2. Enter the first and last addresses in the range, for example `192.168.100.0` and `192.168.100.10`.
3. Results are recalculated automatically whenever a field changes.
4. The table displays the CIDR blocks that cover the specified range.
5. Use the **Export format** panel to generate a configuration.

### Calculate subnets

1. Open the **IPv4 Subnet Calculator** tab.
2. Enter the base network, original CIDR, and new subdivision prefix.
3. Results are recalculated automatically whenever a field or inline control changes.
4. If the result contains no more than 16,384 networks, use the **Export format** panel to export the complete safely calculated list.

### CIDR Set Calculator

1. Open the **CIDR Set Calculator** tab.
2. Enter a CIDR list in **Include networks**. Comments beginning with `#`, commas, semicolons, and dotted masks are supported.
3. Normalization and aggregation results are recalculated automatically whenever a field changes.
4. Filling in **Networks to exclude (optional)** automatically opens the **After exclusions** result.
5. The export source automatically changes to **After exclusions**; select Aggregated result or Cleaned input instead when needed.

Supported export formats are Plain CIDR, Cisco prefix-list, MikroTik address-list, VyOS prefix-list, nftables, JSON, and CSV.

### MAC Vendor / Formats

1. Open the **MAC Vendor / Formats** tab.
2. Enter a MAC address in a familiar format: `001a.2b3c.4d5e`, `00:1A:2B:3C:4D:5E`, `00-1A-2B-3C-4D-5E`, or `001A2B3C4D5E`.
3. Use **Copy** to copy the format you need.
4. The complete offline vendor database is stored in `oui-db.json`. To update it from a current source, run:

   ```bash
   python3 tools/build-oui-db.py --pretty -o oui-db.json
   ```

## Project structure

```text
.
├── index.html                         # Main PWA: IPv4 tools, MAC Vendor / Formats, and navigation
├── app.css                            # Canonical application styles
├── app.js                             # Canonical application UI runtime
├── ipv4-utils.js                      # Shared IPv4 utilities, strict parsing, and tested calculations
├── cidr-set-utils.js                  # CIDR set operations and configuration generators
├── manifest.json                      # PWA manifest
├── sw.js                              # Offline-cache service worker
├── oui-db.json                        # Offline MAC vendor database
├── standalone-builder.html            # Browser-based standalone HTML generator
├── standalone-builder.js              # Standalone Builder UI
├── standalone-builder-core.js         # Pure Full/Lite build logic
├── test/
│   ├── ipv4-utils.test.js             # Node.js unit tests for IPv4 logic
│   └── standalone-builder-core.test.js # Node.js tests for standalone builds
├── tools/
│   ├── build-oui-db.py                # Complete OUI database generator
│   └── check-index-inline-js.js       # Syntax check for inline JavaScript in index.html
├── README-PWA.md                      # PWA and GitHub Pages guide
├── README.ru.md                       # Russian project documentation
└── README.md                          # English project documentation
```

## Requirements

- A modern browser with JavaScript support.
- Python 3 is optional for running a local HTTP server.
- Updating the complete OUI database requires Python 3 and access to a local systemd hwdb or the Internet to download Wireshark/IEEE assignment files.

## Limitations

- The IP calculator supports IPv4 only.
- Large subnet exports are limited to 16,384 networks.
- Table previews may show fewer rows than the complete safe export set.
- All calculations run on the client.
- MAC vendor lookup accuracy depends on how current the local `oui-db.json` is.
- Vendor information may be unreliable or unavailable for locally administered/randomized MAC addresses.

## Development

The application version scheme is `3.<PR number>.<revision inside PR>`; this change uses `3.15.2`.

The project remains a static HTML/CSS/JavaScript application without an npm build process or external runtime dependencies. The main file for development and local testing is `index.html`; serve it through an HTTP server, such as `python3 -m http.server 8000`.

Primary checks:

```bash
node --check ipv4-utils.js
node --check cidr-set-utils.js
node --check app.js
node --check sw.js
node --check standalone-builder.js
node --check standalone-builder-core.js
node --check tools/check-index-inline-js.js
node tools/check-index-inline-js.js
node test/standalone-builder-core.test.js
node --test
```

## License

This project is licensed under the **GNU General Public License v3.0 or later (GPL-3.0-or-later)**. See [`LICENSE`](LICENSE) for the complete license text.
