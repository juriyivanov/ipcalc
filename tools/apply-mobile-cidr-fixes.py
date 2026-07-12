from pathlib import Path


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


css = read('app.css')
old_mobile = '@media (max-width: 640px) { body { margin: 10px; } .tabs { overflow-x: auto; } .tab-button { white-space: nowrap; } .input-group, .mac-input-row, .result-grid, .cidr-input-grid, .export-fields { grid-template-columns: 1fr; display: grid; } .step-buttons { grid-template-columns: repeat(4, minmax(0, 1fr)); } .copy-button, .step-button { width: 100%; } .examples-label, .examples .example { display: none; } .examples { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; overflow: visible; white-space: normal; } .examples .random-mac-action { width: 100%; } .examples .random-mac-action:only-of-type { grid-column: 1 / -1; } .app-version { left: 8px; right: auto; } }'
new_mobile = '@media (max-width: 640px) { body { margin: 10px; } .tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; overflow: visible; border-bottom: 0; } .tab-button { width: 100%; min-width: 0; white-space: normal; overflow-wrap: anywhere; border: 1px solid var(--panel-border); border-radius: 4px; text-align: center; padding: 8px 6px; font-size: 0.92rem; } .tab-button:last-child { grid-column: 1 / -1; } .input-group, .mac-input-row, .result-grid, .cidr-input-grid, .export-fields { grid-template-columns: 1fr; display: grid; } .step-buttons { grid-template-columns: repeat(4, minmax(0, 1fr)); } .copy-button, .step-button { width: 100%; } .examples-label, .examples .example { display: none; } .examples { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; overflow: visible; white-space: normal; } .examples .random-mac-action { width: 100%; } .examples .random-mac-action:only-of-type { grid-column: 1 / -1; } .app-version { left: 8px; right: auto; } }'
if old_mobile not in css:
    raise SystemExit('old mobile CSS not found')
css = css.replace(old_mobile, new_mobile)
if '.cidr-table th:nth-child(2)' not in css:
    css = css.rstrip() + '''

@media (max-width: 640px) {
  .cidr-table { width: 100%; max-width: 100%; table-layout: fixed; font-size: 0.82rem; }
  .cidr-table th:nth-child(2),
  .cidr-table td:nth-child(2),
  .cidr-table th:nth-child(3),
  .cidr-table td:nth-child(3) { display: none; }
  .cidr-table th,
  .cidr-table td { min-width: 0; padding: 6px 4px; overflow-wrap: anywhere; word-break: break-word; }
  .cidr-table th:nth-child(1),
  .cidr-table td:nth-child(1) { width: 42%; }
  .cidr-table th:nth-child(4),
  .cidr-table td:nth-child(4) { width: 36%; }
  .cidr-table th:nth-child(5),
  .cidr-table td:nth-child(5) { width: 22%; text-align: right; }
}
'''
write('app.css', css)

html = read('index.html')
old = '''        <h3>Aggregated result</h3><div id="cidrAggregatedWarning" class="result-item"></div><table id="cidrAggregatedTable"><thead><tr><th>Network</th><th>Subnet mask</th><th>First address</th><th>Last address</th><th>Addresses</th></tr></thead><tbody></tbody></table>
        <details id="cidrCleanedDetails"><summary>Cleaned input before aggregation (0 networks)</summary><div id="cidrNormalizedWarning" class="result-item"></div><table id="cidrNormalizedTable"><thead><tr><th>Network</th><th>Subnet mask</th><th>First address</th><th>Last address</th><th>Addresses</th></tr></thead><tbody></tbody></table></details>
        <h3 id="cidrSubtractHeading" style="display:none;">After exclusions</h3><table id="cidrSubtractTable" style="display:none;"><thead><tr><th>Network</th><th>Subnet mask</th><th>First address</th><th>Last address</th><th>Addresses</th></tr></thead><tbody></tbody></table>'''
new = '''        <details id="cidrAggregatedDetails" open><summary id="cidrAggregatedSummary">Aggregated result</summary><div id="cidrAggregatedWarning" class="result-item"></div><table id="cidrAggregatedTable" class="data-table cidr-table"><thead><tr><th>Network</th><th>Subnet mask</th><th>First address</th><th>Last address</th><th>Addresses</th></tr></thead><tbody></tbody></table></details>
        <details id="cidrCleanedDetails"><summary id="cidrCleanedSummary">Cleaned input before aggregation (0 networks)</summary><div id="cidrNormalizedWarning" class="result-item"></div><table id="cidrNormalizedTable" class="data-table cidr-table"><thead><tr><th>Network</th><th>Subnet mask</th><th>First address</th><th>Last address</th><th>Addresses</th></tr></thead><tbody></tbody></table></details>
        <details id="cidrSubtractDetails" style="display:none;"><summary id="cidrSubtractSummary">After exclusions</summary><div id="cidrSubtractWarning" class="result-item"></div><table id="cidrSubtractTable" class="data-table cidr-table"><thead><tr><th>Network</th><th>Subnet mask</th><th>First address</th><th>Last address</th><th>Addresses</th></tr></thead><tbody></tbody></table></details>'''
if old not in html:
    raise SystemExit('old CIDR HTML not found')
write('index.html', html.replace(old, new))

js = read('app.js').replace("const APP_VERSION = '0.14.2';", "const APP_VERSION = '0.14.3';")
old_refs = """      const cidrCleanedDetails = document.getElementById('cidrCleanedDetails');
      const cidrAnalysisDetails = document.getElementById('cidrAnalysisDetails');"""
new_refs = """      const cidrAggregatedDetails = document.getElementById('cidrAggregatedDetails');
      const cidrAggregatedSummary = document.getElementById('cidrAggregatedSummary');
      const cidrCleanedDetails = document.getElementById('cidrCleanedDetails');
      const cidrCleanedSummary = document.getElementById('cidrCleanedSummary');
      const cidrSubtractDetails = document.getElementById('cidrSubtractDetails');
      const cidrSubtractSummary = document.getElementById('cidrSubtractSummary');
      const cidrAnalysisDetails = document.getElementById('cidrAnalysisDetails');"""
if old_refs not in js:
    raise SystemExit('CIDR refs not found')
js = js.replace(old_refs, new_refs)
old_state = """      let cidrNormalizedItems = [], cidrAggregatedItems = [], cidrSubtractionItems = null, cidrUpdateTimer = null;
      const cidrExport = createExportPanel({ container: document.getElementById('cidrExportPanel'), getItems: () => cidrExportSource.value === 'after-exclusions' ? (cidrSubtractionItems || []) : (cidrExportSource.value === 'cleaned' ? cidrNormalizedItems : cidrAggregatedItems), defaultName: 'CIDR_SET' });"""
new_state = """      let cidrNormalizedItems = [], cidrAggregatedItems = [], cidrSubtractionItems = null, cidrUpdateTimer = null, cidrExportDisabledMessage = '';
      const cidrExport = createExportPanel({ container: document.getElementById('cidrExportPanel'), getItems: () => cidrExportSource.value === 'after-exclusions' ? (cidrSubtractionItems || []) : (cidrExportSource.value === 'cleaned' ? cidrNormalizedItems : cidrAggregatedItems), defaultName: 'CIDR_SET', getDisabledMessage: () => cidrExportDisabledMessage });"""
if old_state not in js:
    raise SystemExit('CIDR state not found')
js = js.replace(old_state, new_state)
start = js.index('      function updateExportSources(hasSubtraction) {')
end = js.index('      function scheduleCidrSetUpdate()', start)
replacement = '''      function updateExportSources(hasSubtraction) {
        cidrExportSource.replaceChildren(new Option('Aggregated result', 'aggregated'), new Option('Cleaned input', 'cleaned'));
        if (hasSubtraction) {
          cidrExportSource.appendChild(new Option('After exclusions', 'after-exclusions'));
          cidrExportSource.value = 'after-exclusions';
        } else {
          cidrExportSource.value = 'aggregated';
        }
      }
      function updateCidrSet() {
        const include = CidrSetUtils.parseCidrList(cidrSetInput.value);
        const normalized = CidrSetUtils.normalizeCidrSet(include.items);
        const aggregated = CidrSetUtils.aggregateCidrSet(normalized.items);
        const analysis = CidrSetUtils.analyzeCidrSet(include.items);
        const errors = include.errors.map((e) => `Include line ${e.line}: ${e.input} — ${e.message}`);
        cidrExportDisabledMessage = '';
        cidrNormalizedItems = normalized.items;
        cidrAggregatedItems = aggregated.items;
        cidrSubtractionItems = null;
        let summaryItems = aggregated.items;
        let afterText = '';
        let hasValidExclusions = false;
        if (cidrExcludeInput.value.trim()) {
          const exclude = CidrSetUtils.parseCidrList(cidrExcludeInput.value);
          errors.push(...exclude.errors.map((e) => `Exclude line ${e.line}: ${e.input} — ${e.message}`));
          hasValidExclusions = exclude.items.length > 0;
          if (hasValidExclusions) {
            const sub = CidrSetUtils.subtractCidrSets(include.items, exclude.items);
            if (sub.error) {
              errors.push(sub.error);
              cidrExportDisabledMessage = sub.error;
              cidrSubtractionItems = [];
              hasValidExclusions = false;
            } else {
              cidrSubtractionItems = sub.items;
              summaryItems = sub.items;
              afterText = ` → ${plural(sub.items.length, 'after exclusions', 'after exclusions')}`;
            }
          }
        }
        cidrPrimarySummary.textContent = `${plural(include.items.length, 'input network')} → ${plural(aggregated.items.length, 'aggregated')}${afterText} · ${plural(totalAddresses(summaryItems), 'address', 'addresses')}`;
        const notices = [];
        if (normalized.duplicateCount) notices.push(plural(normalized.duplicateCount, 'duplicate removed', 'duplicates removed'));
        if (normalized.containedCount) notices.push(plural(normalized.containedCount, 'contained network removed', 'contained networks removed'));
        if (errors.length) notices.push(plural(errors.length, 'invalid line', 'invalid lines'));
        cidrNoticeSummary.textContent = notices.join(' · ');
        renderErrors(errors);
        renderCidrTable('#cidrAggregatedTable', aggregated.items, 'cidrAggregatedWarning');
        renderCidrTable('#cidrNormalizedTable', normalized.items, 'cidrNormalizedWarning');
        cidrAggregatedSummary.textContent = `Aggregated result (${plural(aggregated.items.length, 'network')})`;
        cidrCleanedSummary.textContent = `Cleaned input before aggregation (${plural(normalized.items.length, 'network')})`;
        const hasSubtraction = hasValidExclusions && Array.isArray(cidrSubtractionItems);
        if (hasSubtraction) {
          cidrAggregatedDetails.open = false;
          cidrSubtractDetails.style.display = 'block';
          cidrSubtractDetails.open = true;
          cidrSubtractSummary.textContent = `After exclusions (${plural(cidrSubtractionItems.length, 'network')})`;
          renderCidrTable('#cidrSubtractTable', cidrSubtractionItems, 'cidrSubtractWarning');
        } else {
          cidrAggregatedDetails.open = true;
          cidrSubtractDetails.open = false;
          cidrSubtractDetails.style.display = 'none';
          cidrSubtractSummary.textContent = 'After exclusions';
          renderCidrTable('#cidrSubtractTable', [], 'cidrSubtractWarning');
        }
        renderMessageList(document.getElementById('cidrContainedList'), analysis.contained);
        renderMessageList(document.getElementById('cidrMergeableList'), analysis.adjacentMergeable);
        cidrContainedSection.style.display = analysis.contained.length ? 'block' : 'none';
        cidrMergeableSection.style.display = analysis.adjacentMergeable.length ? 'block' : 'none';
        cidrAnalysisDetails.style.display = (analysis.contained.length || analysis.adjacentMergeable.length) ? 'block' : 'none';
        updateExportSources(hasSubtraction);
        cidrSetResults.style.display = 'block';
        cidrExport.refresh();
      }
'''
write('app.js', js[:start] + replacement + js[end:])

write('sw.js', read('sw.js').replace("ipcalc-pwa-v17", "ipcalc-pwa-v18"))

test = read('test/standalone-builder-core.test.js').replace('0.14.2', '0.14.3').replace('ipcalc-pwa-v17', 'ipcalc-pwa-v18')
test = test.replace("'random-mac-action']);", "'random-mac-action', 'id=\"cidrAggregatedDetails\"', 'id=\"cidrSubtractDetails\"', 'class=\"data-table cidr-table\"']);")
test = test.replace("hasNone(sources['index.html'], ['OUI database', '<h3>Result</h3>,", "hasNone(sources['index.html'], ['OUI database', '<h3>Result</h3>,")
test += "\nassert.strictEqual(count(sources['index.html'], 'class=\"data-table cidr-table\"'), 3);\nhasAll(sources['app.css'], ['grid-template-columns: repeat(2, minmax(0, 1fr))', '.cidr-table th:nth-child(2)']);\nhasAll(sources['app.js'], ['exclude.items.length > 0', \"cidrExportSource.value = 'after-exclusions'\"]);\n"
write('test/standalone-builder-core.test.js', test)

readme = read('README.md').replace('''3. Нажмите **Process set**, чтобы получить normalized и aggregated списки, containment relationships и mergeable adjacent pairs.
4. При необходимости заполните **Networks to exclude (optional)** и нажмите **Subtract exclusions**.
5. Выберите источник экспорта: **Normalized**, **Aggregated** или **Subtraction result**.''', '''3. Результаты normalization и aggregation пересчитываются автоматически при изменении полей.
4. При заполнении **Networks to exclude (optional)** автоматически открывается результат **After exclusions**.
5. Источник экспорта автоматически переключается на **After exclusions**; при необходимости можно выбрать Aggregated result или Cleaned input.''')
write('README.md', readme)
