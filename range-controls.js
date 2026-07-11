(() => {
  'use strict';

  const { parseIPv4, intToIPv4, parseIPv4WithPrefix, subnetSize, IPV4_MAX } = window.IPv4Utils;

  function ipToInt(ip) {
    return parseIPv4(ip);
  }

  function intToIp(value) {
    return intToIPv4(value);
  }

  function parseValue(value, fallbackPrefix = 24) {
    return parseIPv4WithPrefix(value, fallbackPrefix);
  }

  function formatValue(ip, prefix) {
    return `${intToIp(ip)}/${prefix}`;
  }

  function dispatchInput(input) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function changeValue(input, action) {
    const parsed = parseValue(input.value, Number(input.dataset.prefix || 24));
    if (!parsed) return;

    let { ip, prefix } = parsed;
    if (action === 'prefix-down') prefix = Math.max(0, prefix - 1);
    if (action === 'prefix-up') prefix = Math.min(32, prefix + 1);

    if (action === 'ip-down' || action === 'ip-up') {
      const step = subnetSize(prefix);
      const direction = action === 'ip-up' ? 1 : -1;
      const next = ip + direction * step;
      if (next < 0 || next > IPV4_MAX) return;
      ip = next >>> 0;
    }

    input.dataset.prefix = String(prefix);
    input.value = formatValue(ip, prefix);
    dispatchInput(input);
  }

  function createButton(text, title, action, input) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.title = title;
    button.className = 'range-step-button';
    button.addEventListener('click', () => changeValue(input, action));
    return button;
  }

  function enhanceInput(id, defaultValue) {
    const input = document.getElementById(id);
    if (!input || input.closest('.range-input-group')) return;

    const parsed = parseValue(input.value || defaultValue, 24) || parseValue(defaultValue, 24);
    input.value = formatValue(parsed.ip, parsed.prefix);
    input.dataset.prefix = String(parsed.prefix);

    const wrapper = document.createElement('div');
    wrapper.className = 'range-input-group';
    const controls = document.createElement('div');
    controls.className = 'range-step-buttons';
    controls.append(
      createButton('IP−', 'Previous subnet using current prefix', 'ip-down', input),
      createButton('IP+', 'Next subnet using current prefix', 'ip-up', input),
      createButton('/−', 'Decrease prefix length', 'prefix-down', input),
      createButton('/+', 'Increase prefix length', 'prefix-up', input)
    );

    input.parentNode.insertBefore(wrapper, input);
    wrapper.append(input, controls);
  }

  function makeConverterPrefixAware() {
    const button = document.getElementById('convertRangeBtn');
    const startInput = document.getElementById('rangeStart');
    const endInput = document.getElementById('rangeEnd');
    if (!button || !startInput || !endInput || button.dataset.prefixAware) return;

    button.dataset.prefixAware = 'true';
    button.addEventListener('click', () => {
      const start = parseValue(startInput.value, Number(startInput.dataset.prefix || 24));
      const end = parseValue(endInput.value, Number(endInput.dataset.prefix || 24));
      if (!start || !end) return;

      const originalStart = startInput.value;
      const originalEnd = endInput.value;
      startInput.value = intToIp(start.ip);
      endInput.value = intToIp(end.ip);

      setTimeout(() => {
        startInput.value = originalStart;
        endInput.value = originalEnd;
      }, 0);
    }, true);
  }

  enhanceInput('rangeStart', '192.168.100.0/24');
  enhanceInput('rangeEnd', '192.168.100.255/24');
  makeConverterPrefixAware();
})();
