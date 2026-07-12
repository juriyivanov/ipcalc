(function (root, factory) {
  root.ListExportUI = factory(root.CidrSetUtils);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CidrSetUtils) {
  'use strict';
  const FORMATS = [
    ['plain', 'Plain CIDR'], ['cisco-prefix-list', 'Cisco prefix-list'], ['mikrotik-address-list', 'MikroTik address-list'],
    ['vyos-prefix-list', 'VyOS prefix-list'], ['nftables-set', 'nftables set'], ['json', 'JSON'], ['csv', 'CSV']
  ];
  function filename(format) { if (format === 'json') return 'networks.json'; if (format === 'csv') return 'networks.csv'; if (format === 'plain') return 'networks.txt'; return 'networks.conf'; }
  function create(tag, attrs, text) { const el = document.createElement(tag); Object.entries(attrs || {}).forEach(([k,v]) => { if (k === 'className') el.className = v; else el.setAttribute(k, v); }); if (text) el.textContent = text; return el; }
  function createExportPanel({ container, getItems, defaultName, getDisabledMessage }) {
    container.className = 'export-panel';
    const controls = create('div', { className: 'export-controls' });
    const formatId = `${container.id || 'export'}Format`, nameId = `${container.id || 'export'}Name`, actionId = `${container.id || 'export'}Action`;
    const formatLabel = create('label', { for: formatId }, 'Export format');
    const format = create('select', { id: formatId }); FORMATS.forEach(([v,t]) => format.append(create('option', { value: v }, t)));
    const nameWrap = create('div', {}), nameLabel = create('label', { for: nameId }, 'List name'), name = create('input', { id: nameId, type: 'text', value: defaultName || 'NETWORKS' }); nameWrap.append(nameLabel, name);
    const actionWrap = create('div', {}), actionLabel = create('label', { for: actionId }, 'Action'), action = create('select', { id: actionId }); action.append(create('option',{value:'permit'},'permit'), create('option',{value:'deny'},'deny')); actionWrap.append(actionLabel, action);
    const generate = create('button', { type: 'button' }, 'Generate'); const copy = create('button', { type: 'button' }, 'Copy output'); const download = create('button', { type: 'button' }, 'Download');
    const status = create('div', { className: 'error', role: 'alert' }); const output = create('textarea', { className: 'export-output', readonly: 'readonly', 'aria-label': 'Export output' });
    controls.append(formatLabel, format, nameWrap, actionWrap, generate, copy, download); container.append(controls, status, output);
    function refresh() { const f = format.value; actionWrap.style.display = (f === 'cisco-prefix-list' || f === 'vyos-prefix-list') ? '' : 'none'; nameWrap.style.display = f === 'plain' ? 'none' : ''; }
    function clear() { output.value = ''; status.textContent = ''; }
    generate.addEventListener('click', () => { clear(); const msg = getDisabledMessage && getDisabledMessage(); if (msg) { status.textContent = msg; return; } const items = getItems(); if (!items || !items.length) { status.textContent = 'No networks are available to export.'; return; } try { output.value = CidrSetUtils.exportCidrList(items, format.value, { name: name.value, action: action.value }); } catch (e) { status.textContent = e.message; } });
    copy.addEventListener('click', () => { if (!output.value) return; output.select(); document.execCommand('copy'); });
    download.addEventListener('click', () => { if (!output.value) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([output.value], { type: 'text/plain' })); a.download = filename(format.value); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); });
    format.addEventListener('change', refresh); refresh();
    return { clear, generate, output };
  }
  return { createExportPanel };
});
