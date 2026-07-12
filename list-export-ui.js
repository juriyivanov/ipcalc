(function (root, factory) {
  root.ListExportUI = factory(root.CidrSetUtils);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CidrSetUtils) {
  'use strict';
  const FORMATS = [
    ['plain', 'Plain CIDR'], ['cisco-prefix-list', 'Cisco prefix-list'], ['mikrotik-address-list', 'MikroTik address-list'],
    ['vyos-prefix-list', 'VyOS prefix-list'], ['nftables-set', 'nftables set'], ['json', 'JSON'], ['csv', 'CSV']
  ];
  function filename(format) { if (format === 'json') return 'networks.json'; if (format === 'csv') return 'networks.csv'; if (format === 'plain') return 'networks.txt'; return 'networks.conf'; }
  function create(tag, attrs, text) { const el = document.createElement(tag); Object.entries(attrs || {}).forEach(([k,v]) => { if (k === 'className') el.className = v; else if (k === 'hidden') el.hidden = !!v; else el.setAttribute(k, v); }); if (text) el.textContent = text; return el; }
  function createExportPanel({ container, getItems, defaultName, getDisabledMessage }) {
    container.className = 'export-panel';
    const fields = create('div', { className: 'export-fields' });
    const actions = create('div', { className: 'export-actions' });
    const formatId = `${container.id || 'export'}Format`, nameId = `${container.id || 'export'}Name`, actionId = `${container.id || 'export'}Action`;
    const formatWrap = create('div', {}), formatLabel = create('label', { for: formatId }, 'Export format'), format = create('select', { id: formatId });
    FORMATS.forEach(([v,t]) => format.append(create('option', { value: v }, t))); formatWrap.append(formatLabel, format);
    const nameWrap = create('div', {}), nameLabel = create('label', { for: nameId }, 'List name'), name = create('input', { id: nameId, type: 'text', value: defaultName || 'NETWORKS' }); nameWrap.append(nameLabel, name);
    const actionWrap = create('div', {}), actionLabel = create('label', { for: actionId }, 'Action'), action = create('select', { id: actionId }); action.append(create('option',{value:'permit'},'permit'), create('option',{value:'deny'},'deny')); actionWrap.append(actionLabel, action);
    const copy = create('button', { type: 'button', disabled: 'disabled' }, 'Copy output'); const download = create('button', { type: 'button', disabled: 'disabled' }, 'Download');
    const status = create('div', { className: 'error', role: 'alert' }); const output = create('textarea', { className: 'export-output', readonly: 'readonly', 'aria-label': 'Export output' });
    fields.append(formatWrap, nameWrap, actionWrap); actions.append(copy, download); container.append(fields, actions, status, output);
    function resizeOutput() { output.style.height = 'auto'; output.style.height = `${output.scrollHeight}px`; output.style.overflowY = output.scrollHeight > output.clientHeight ? 'auto' : 'hidden'; }
    function setDisabled(disabled) { copy.disabled = disabled; download.disabled = disabled; }
    function updateOptionalFields() { const f = format.value; actionWrap.hidden = !(f === 'cisco-prefix-list' || f === 'vyos-prefix-list'); nameWrap.hidden = f === 'plain'; }
    function clear() { output.value = ''; status.textContent = ''; setDisabled(true); resizeOutput(); }
    function refresh() {
      updateOptionalFields(); output.value = ''; status.textContent = ''; setDisabled(true);
      const msg = getDisabledMessage && getDisabledMessage();
      if (msg) { status.textContent = msg; resizeOutput(); return; }
      const items = getItems();
      if (!items || !items.length) { status.textContent = 'No networks are available to export.'; resizeOutput(); return; }
      try { output.value = CidrSetUtils.exportCidrList(items, format.value, { name: name.value, action: action.value }); }
      catch (e) { status.textContent = e.message; }
      setDisabled(!output.value); resizeOutput();
    }
    copy.addEventListener('click', () => { if (!output.value) return; output.select(); document.execCommand('copy'); });
    download.addEventListener('click', () => { if (!output.value) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([output.value], { type: 'text/plain' })); a.download = filename(format.value); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); });
    format.addEventListener('change', refresh); name.addEventListener('input', refresh); action.addEventListener('change', refresh); window.addEventListener('resize', resizeOutput);
    refresh();
    return { clear, refresh, output };
  }
  return { createExportPanel };
});
