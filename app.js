(function () {
  'use strict';

  const APP_VERSION = '0.14.0';

  function renderAppVersion() {
    const element = document.getElementById('appVersion');
    if (element) element.textContent = `v${APP_VERSION}`;
  }

  function initServiceWorker() {
    if ('serviceWorker' in navigator && window.isSecureContext && location.protocol !== 'file:') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((registration) => { console.log('Service worker registered:', registration.scope); })
          .catch((error) => { console.warn('Service worker registration failed:', error); });
      });
    } else {
      console.log('Service worker is not available in this context. The app still works as a normal HTML page.');
    }
  }

  function createExportPanel({ container, getItems, defaultName, getDisabledMessage }) {
    const FORMATS = [
      ['plain', 'Plain CIDR'], ['cisco-prefix-list', 'Cisco prefix-list'], ['mikrotik-address-list', 'MikroTik address-list'],
      ['vyos-prefix-list', 'VyOS prefix-list'], ['nftables-set', 'nftables set'], ['json', 'JSON'], ['csv', 'CSV']
    ];
    function filename(format) { if (format === 'json') return 'networks.json'; if (format === 'csv') return 'networks.csv'; if (format === 'plain') return 'networks.txt'; return 'networks.conf'; }
    function create(tag, attrs, text) { const el = document.createElement(tag); Object.entries(attrs || {}).forEach(([k, v]) => { if (k === 'className') el.className = v; else if (k === 'hidden') el.hidden = !!v; else el.setAttribute(k, v); }); if (text) el.textContent = text; return el; }
    container.className = 'export-panel';
    const fields = create('div', { className: 'export-fields' });
    const actions = create('div', { className: 'export-actions' });
    const formatId = `${container.id || 'export'}Format`, nameId = `${container.id || 'export'}Name`, actionId = `${container.id || 'export'}Action`;
    const formatWrap = create('div', {}), formatLabel = create('label', { for: formatId }, 'Export format'), format = create('select', { id: formatId });
    FORMATS.forEach(([value, text]) => format.append(create('option', { value }, text))); formatWrap.append(formatLabel, format);
    const nameWrap = create('div', {}), nameLabel = create('label', { for: nameId }, 'List name'), name = create('input', { id: nameId, type: 'text', value: defaultName || 'NETWORKS' }); nameWrap.append(nameLabel, name);
    const actionWrap = create('div', {}), actionLabel = create('label', { for: actionId }, 'Action'), action = create('select', { id: actionId }); action.append(create('option', { value: 'permit' }, 'permit'), create('option', { value: 'deny' }, 'deny')); actionWrap.append(actionLabel, action);
    const copy = create('button', { type: 'button', disabled: 'disabled' }, 'Copy output'), download = create('button', { type: 'button', disabled: 'disabled' }, 'Download');
    const status = create('div', { className: 'error', role: 'alert' }), output = create('textarea', { className: 'export-output', readonly: 'readonly', 'aria-label': 'Export output' });
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
      try { output.value = window.CidrSetUtils.exportCidrList(items, format.value, { name: name.value, action: action.value }); }
      catch (error) { status.textContent = error.message; }
      setDisabled(!output.value); resizeOutput();
    }
    copy.addEventListener('click', () => { if (!output.value) return; output.select(); document.execCommand('copy'); });
    download.addEventListener('click', () => { if (!output.value) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([output.value], { type: 'text/plain' })); a.download = filename(format.value); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); });
    format.addEventListener('change', refresh); name.addEventListener('input', refresh); action.addEventListener('change', refresh); window.addEventListener('resize', resizeOutput);
    refresh();
    return { clear, refresh, output };
  }

  function initApp() {
      const CONFIG_EXPORT_LIMIT = 16384;
      const CIDR_VISIBLE_ROWS = 4096;
      const { IPV4_MAX, SUBNET_RENDER_LIMIT, parseIPv4, intToIPv4, parseCIDR, cidrToMask, maskToCIDR, parseSubnet, parseIPv4WithPrefix, safeSubnetStep, rangeToSubnets, prepareSubnetCalculation, classifyIPv4, ipv4ToPtrName, reverseZoneForPrefix } = window.IPv4Utils;
      const ipToInt = parseIPv4;
      const intToIp = intToIPv4;
      const CidrSetUtils = window.CidrSetUtils;
      const ipInput         = document.getElementById('ipInput');
      const subnetInput     = document.getElementById('subnetInput');
      const ipError         = document.getElementById('ipError');
      const subnetError     = document.getElementById('subnetError');
      const analyzerResults = document.getElementById('analyzerResults');
      const networkAddress  = document.getElementById('networkAddress');
      const broadcastAddress= document.getElementById('broadcastAddress');
      const firstHost       = document.getElementById('firstHost');
      const lastHost        = document.getElementById('lastHost');
      const totalHosts      = document.getElementById('totalHosts');
      const subnetOutput    = document.getElementById('subnetOutput');
      const wildcardMask    = document.getElementById('wildcardMask');
      const addressType = document.getElementById('addressType');
      const specialBlock = document.getElementById('specialBlock');
      const specialReference = document.getElementById('specialReference');
      const globallyReachable = document.getElementById('globallyReachable');
      const forwardable = document.getElementById('forwardable');
      const classificationNoteRow = document.getElementById('classificationNoteRow');
      const classificationNote = document.getElementById('classificationNote');
      const ptrLookupName = document.getElementById('ptrLookupName');
      const reverseZoneRow = document.getElementById('reverseZoneRow');
      const reverseZone = document.getElementById('reverseZone');
      const reverseDelegationRow = document.getElementById('reverseDelegationRow');
      const reverseDelegation = document.getElementById('reverseDelegation');
      const delegationBoundaryRow = document.getElementById('delegationBoundaryRow');
      const delegationBoundary = document.getElementById('delegationBoundary');
      const parentReverseZoneRow = document.getElementById('parentReverseZoneRow');
      const parentReverseZone = document.getElementById('parentReverseZone');
      const addressRangeRow = document.getElementById('addressRangeRow');
      const addressRange = document.getElementById('addressRange');
      const rfc2317ChildRow = document.getElementById('rfc2317ChildRow');
      const rfc2317ChildZone = document.getElementById('rfc2317ChildZone');
      const reverseDnsNoteRow = document.getElementById('reverseDnsNoteRow');
      const reverseDnsNote = document.getElementById('reverseDnsNote');

      function calculateAnalyzer() {
        ipError.textContent = '';
        subnetError.textContent = '';

        const ipInt = ipToInt(ipInput.value.trim());
        if (ipInt === null) {
          ipError.textContent = 'Invalid IP address.';
          analyzerResults.style.display = 'none';
          return;
        }
        const mask = parseSubnet(subnetInput.value);
        if (mask === null) {
          subnetError.textContent = 'Invalid subnet mask.';
          analyzerResults.style.display = 'none';
          return;
        }

        const cidr = maskToCIDR(mask);
        const network = (ipInt & mask) >>> 0;
        const broadcast = (network | (~mask >>> 0)) >>> 0;
        const total = (cidr === 32) ? 1 :
                      (cidr === 31) ? 2 :
                      Math.max(0, Math.pow(2, 32 - cidr) - 2);
        const first = (cidr >= 31) ? network : network + 1;
        const last  = (cidr >= 31) ? broadcast : broadcast - 1;
        const wildcard = (~mask) >>> 0;

        networkAddress.textContent   = intToIp(network);
        broadcastAddress.textContent = intToIp(broadcast);
        firstHost.textContent        = intToIp(first);
        lastHost.textContent         = intToIp(last);
        totalHosts.textContent       = total;
        subnetOutput.textContent     = intToIp(mask) + " (/" + cidr + ")";
        wildcardMask.textContent     = intToIp(wildcard);

        const classification = classifyIPv4(ipInt);
        addressType.textContent = classification.category + (classification.name && classification.name !== classification.category ? ' / ' + classification.name : '');
        specialBlock.textContent = classification.block;
        specialReference.textContent = classification.reference;
        globallyReachable.textContent = classification.globallyReachableLabel;
        forwardable.textContent = classification.forwardableLabel;
        classificationNoteRow.style.display = classification.note ? 'block' : 'none';
        classificationNote.textContent = classification.note || '';

        const reverseInfo = reverseZoneForPrefix(ipInt, cidr);
        ptrLookupName.textContent = ipv4ToPtrName(ipInt);
        reverseZoneRow.style.display = 'none';
        reverseDelegationRow.style.display = 'none';
        delegationBoundaryRow.style.display = 'none';
        parentReverseZoneRow.style.display = 'none';
        addressRangeRow.style.display = 'none';
        rfc2317ChildRow.style.display = 'none';
        reverseDnsNoteRow.style.display = 'none';
        if (reverseInfo.kind === 'zone') {
          reverseZone.textContent = reverseInfo.reverseZone;
          reverseZoneRow.style.display = 'block';
        } else if (reverseInfo.kind === 'multiple') {
          reverseDelegation.textContent = reverseInfo.message + (reverseInfo.zonesRequired ? ` (${reverseInfo.zonesRequired} zones)` : '');
          delegationBoundary.textContent = reverseInfo.delegationBoundary;
          reverseDelegationRow.style.display = 'block';
          delegationBoundaryRow.style.display = 'block';
        } else if (reverseInfo.kind === 'rfc2317') {
          parentReverseZone.textContent = reverseInfo.parentZone;
          addressRange.textContent = reverseInfo.addressRange;
          rfc2317ChildZone.textContent = reverseInfo.suggestedChildZone;
          reverseDnsNote.textContent = reverseInfo.note;
          parentReverseZoneRow.style.display = 'block';
          addressRangeRow.style.display = 'block';
          rfc2317ChildRow.style.display = 'block';
          reverseDnsNoteRow.style.display = 'block';
        }
        analyzerResults.style.display = 'block';
      }

      function jumpToNextSubnet() {
        const ipInt = ipToInt(ipInput.value.trim());
        const mask = parseSubnet(subnetInput.value);
        if (ipInt === null || mask === null) return;
        const cidr = maskToCIDR(mask);
        const newIp = safeSubnetStep(ipInt, cidr, 1, cidr >= 31 ? 0 : 1);
        if (newIp === null) return;
        ipInput.value = intToIp(newIp);
        calculateAnalyzer();
      }

      function jumpToPrevSubnet() {
        const ipInt = ipToInt(ipInput.value.trim());
        const mask = parseSubnet(subnetInput.value);
        if (ipInt === null || mask === null) return;
        const cidr = maskToCIDR(mask);
        const newIp = safeSubnetStep(ipInt, cidr, -1, cidr >= 31 ? 0 : 1);
        if (newIp === null) return;
        ipInput.value = intToIp(newIp);
        calculateAnalyzer();
      }

      function updateMask(increment) {
        let input = subnetInput.value.trim();
        let cidr;
        if (input.startsWith('/')) {
          cidr = parseCIDR(input);
        } else {
          cidr = maskToCIDR(parseSubnet(input));
        }
        if (cidr === null) return;
        cidr += increment;
        if (cidr < 0) cidr = 0;
        if (cidr > 32) cidr = 32;
        subnetInput.value = "/" + cidr;
        calculateAnalyzer();
      }

      document.getElementById('copyPtrNameBtn').addEventListener('click', (event) => copyText(ptrLookupName.textContent, event.currentTarget));
      document.getElementById('copyReverseZoneBtn').addEventListener('click', (event) => copyText(reverseZone.textContent, event.currentTarget));
      document.getElementById('copyRfc2317ChildBtn').addEventListener('click', (event) => copyText(rfc2317ChildZone.textContent, event.currentTarget));

      ipInput.addEventListener('input', calculateAnalyzer);
      subnetInput.addEventListener('input', calculateAnalyzer);
      document.getElementById('nextSubnetBtn').addEventListener('click', jumpToNextSubnet);
      document.getElementById('prevSubnetBtn').addEventListener('click', jumpToPrevSubnet);
      document.getElementById('increaseMaskBtn').addEventListener('click', () => updateMask(1));
      document.getElementById('decreaseMaskBtn').addEventListener('click', () => updateMask(-1));
      const rangeStart      = document.getElementById('rangeStart');
      const rangeEnd        = document.getElementById('rangeEnd');
      const convertRangeBtn = document.getElementById('convertRangeBtn');
      const rangeResults    = document.getElementById('rangeResults');
      const rangeTableBody  = document.querySelector('#rangeTable tbody');
      let rangeResultItems = [];
      const rangeExport = createExportPanel({ container: document.getElementById('rangeExportPanel'), getItems: () => rangeResultItems, defaultName: 'RANGE_NETWORKS' });

      function convertRange() {
        rangeTableBody.innerHTML = '';
        rangeResults.style.display = 'none';
        rangeResultItems = [];
        rangeExport.clear();

        const startParsed = parseIPv4WithPrefix(rangeStart.value.trim(), Number(rangeStart.dataset.prefix || 24));
        const endParsed = parseIPv4WithPrefix(rangeEnd.value.trim(), Number(rangeEnd.dataset.prefix || 24));
        const startInt = startParsed && startParsed.ip;
        const endInt = endParsed && endParsed.ip;
        if (!startParsed || !endParsed) {
          alert('Invalid start or end IP');
          return;
        }
        if (startInt > endInt) {
          alert('Start IP must be less than or equal to End IP');
          return;
        }
        const subnets = rangeToSubnets(startInt, endInt);
        rangeResultItems = subnets.map((s) => ({ network: s.network, prefix: s.prefix }));
        subnets.forEach(s => {
          const row = document.createElement('tr');
          const netCell = document.createElement('td');
          const maskCell = document.createElement('td');
          netCell.textContent = intToIp(s.network) + '/' + s.prefix;
          maskCell.textContent = intToIp(s.mask);
          row.appendChild(netCell);
          row.appendChild(maskCell);
          rangeTableBody.appendChild(row);
        });
        if (subnets.length > 0) {
          rangeResults.style.display = 'block';
        }
        rangeExport.refresh();
      }

      function parseRangeValue(input) {
        return parseIPv4WithPrefix(input.value.trim(), Number(input.dataset.prefix || 24));
      }
      function formatRangeValue(ip, prefix) {
        return `${intToIp(ip)}/${prefix}`;
      }
      function updateRangeValue(input, action) {
        const parsed = parseRangeValue(input);
        if (!parsed) return;
        let { ip, prefix } = parsed;
        if (action === 'prefix-down') prefix = Math.max(0, prefix - 1);
        if (action === 'prefix-up') prefix = Math.min(32, prefix + 1);
        if (action === 'ip-down' || action === 'ip-up') {
          const step = Math.pow(2, 32 - prefix);
          const next = ip + (action === 'ip-up' ? step : -step);
          if (next < 0 || next > IPV4_MAX) return;
          ip = next >>> 0;
        }
        input.dataset.prefix = String(prefix);
        input.value = formatRangeValue(ip, prefix);
        if (parseRangeValue(rangeStart) && parseRangeValue(rangeEnd)) convertRange();
      }

      convertRangeBtn.addEventListener('click', convertRange);
      document.getElementById('prevRangeStartBtn').addEventListener('click', () => updateRangeValue(rangeStart, 'ip-down'));
      document.getElementById('nextRangeStartBtn').addEventListener('click', () => updateRangeValue(rangeStart, 'ip-up'));
      document.getElementById('decreaseRangeStartPrefixBtn').addEventListener('click', () => updateRangeValue(rangeStart, 'prefix-down'));
      document.getElementById('increaseRangeStartPrefixBtn').addEventListener('click', () => updateRangeValue(rangeStart, 'prefix-up'));
      document.getElementById('prevRangeEndBtn').addEventListener('click', () => updateRangeValue(rangeEnd, 'ip-down'));
      document.getElementById('nextRangeEndBtn').addEventListener('click', () => updateRangeValue(rangeEnd, 'ip-up'));
      document.getElementById('decreaseRangeEndPrefixBtn').addEventListener('click', () => updateRangeValue(rangeEnd, 'prefix-down'));
      document.getElementById('increaseRangeEndPrefixBtn').addEventListener('click', () => updateRangeValue(rangeEnd, 'prefix-up'));
      const baseNetworkInput = document.getElementById('baseNetwork');
      const baseCIDRInput    = document.getElementById('baseCIDR');
      const newCIDRInput     = document.getElementById('newCIDR');
      const subnetCalcBtn    = document.getElementById('subnetCalcBtn');
      const subnetResults    = document.getElementById('subnetResults');
      const subnetTableBody  = document.querySelector('#subnetTable tbody');
      const subnetLimitWarning = document.getElementById('subnetLimitWarning');
      const subnetExportNotice = document.getElementById('subnetExportNotice');
      let subnetResultItems = [];
      let subnetExportBlocked = '';
      const subnetExport = createExportPanel({ container: document.getElementById('subnetExportPanel'), getItems: () => subnetResultItems, defaultName: 'SUBNETS', getDisabledMessage: () => subnetExportBlocked });

      // New functions for Subnet Calculator inline controls:
      function jumpToNextBaseNetwork() {
        const netInt = ipToInt(baseNetworkInput.value.trim());
        const mask = parseSubnet(baseCIDRInput.value.trim());
        if(netInt === null || mask === null) return;
        const cidr = maskToCIDR(mask);
        const nextNetwork = safeSubnetStep(netInt, cidr, 1, 0);
        if (nextNetwork === null) return;
        baseNetworkInput.value = intToIp(nextNetwork);
      }
      function jumpToPrevBaseNetwork() {
        const netInt = ipToInt(baseNetworkInput.value.trim());
        const mask = parseSubnet(baseCIDRInput.value.trim());
        if(netInt === null || mask === null) return;
        const cidr = maskToCIDR(mask);
        const prevNetwork = safeSubnetStep(netInt, cidr, -1, 0);
        if (prevNetwork === null) return;
        baseNetworkInput.value = intToIp(prevNetwork);
      }
      function updateBaseCIDR(increment) {
        let input = baseCIDRInput.value.trim();
        let cidr;
        if(input.startsWith('/')) {
          cidr = parseCIDR(input);
        } else {
          cidr = maskToCIDR(parseSubnet(input));
        }
        if(cidr === null) return;
        cidr += increment;
        if(cidr < 0) cidr = 0;
        if(cidr > 32) cidr = 32;
        baseCIDRInput.value = "/" + cidr;
      }
      function updateNewCIDR(increment) {
        let input = newCIDRInput.value.trim();
        let cidr;
        if(input.startsWith('/')) {
          cidr = parseCIDR(input);
        } else {
          cidr = maskToCIDR(parseSubnet(input));
        }
        if(cidr === null) return;
        cidr += increment;
        if(cidr < 0) cidr = 0;
        if(cidr > 32) cidr = 32;
        newCIDRInput.value = "/" + cidr;
      }

      // Subnet Calculator: Calculate subnets
      function calcSubnets() {
        subnetTableBody.innerHTML = '';
        subnetResults.style.display = 'none';
        subnetLimitWarning.style.display = 'none';
        subnetLimitWarning.textContent = '';
        subnetExportNotice.textContent = '';
        subnetExportBlocked = '';
        subnetResultItems = [];
        subnetExport.clear();

        const calculation = prepareSubnetCalculation(
          baseNetworkInput.value,
          baseCIDRInput.value,
          newCIDRInput.value
        );
        if (!calculation.ok) {
          alert(calculation.message);
          return;
        }

        subnetLimitWarning.style.display = calculation.totalSubnets > SUBNET_RENDER_LIMIT ? 'block' : 'none';
        subnetLimitWarning.textContent = calculation.totalSubnets > SUBNET_RENDER_LIMIT
          ? `The calculation contains ${calculation.totalSubnets.toLocaleString()} subnets. Showing the first ${calculation.visibleSubnets.toLocaleString()} entries.`
          : '';
        if (calculation.totalSubnets > CONFIG_EXPORT_LIMIT) {
          subnetExportBlocked = 'Export is unavailable because the result contains more than 16,384 networks.';
          subnetExportNotice.textContent = subnetExportBlocked;
        } else {
          for (let i = 0; i < calculation.totalSubnets; i++) {
            subnetResultItems.push({ network: calculation.network + i * Math.pow(2, 32 - calculation.newCidr), prefix: calculation.newCidr });
          }
        }

        const fragment = document.createDocumentFragment();
        for (let i = 0; i < calculation.visibleSubnets; i++) {
          const offset = i * Math.pow(2, 32 - calculation.newCidr);
          const subNetwork = calculation.network + offset;
          const row = document.createElement('tr');
          const netCell = document.createElement('td');
          const maskCell = document.createElement('td');
          netCell.textContent = intToIp(subNetwork) + '/' + calculation.newCidr;
          maskCell.textContent = intToIp(cidrToMask(calculation.newCidr));
          row.appendChild(netCell);
          row.appendChild(maskCell);
          fragment.appendChild(row);
        }
        subnetTableBody.appendChild(fragment);
        subnetResults.style.display = 'block';
        subnetExport.refresh();
      }

      subnetCalcBtn.addEventListener('click', calcSubnets);

      // Event listeners for Subnet Calculator inline controls
      document.getElementById('prevBaseNetworkBtn').addEventListener('click', jumpToPrevBaseNetwork);
      document.getElementById('nextBaseNetworkBtn').addEventListener('click', jumpToNextBaseNetwork);
      document.getElementById('decreaseBaseCIDRBtn').addEventListener('click', () => updateBaseCIDR(-1));
      document.getElementById('increaseBaseCIDRBtn').addEventListener('click', () => updateBaseCIDR(1));
      document.getElementById('decreaseNewCIDRBtn').addEventListener('click', () => updateNewCIDR(-1));
      document.getElementById('increaseNewCIDRBtn').addEventListener('click', () => updateNewCIDR(1));
      const cidrSetInput = document.getElementById('cidrSetInput');
      const cidrExcludeInput = document.getElementById('cidrExcludeInput');
      const cidrSetResults = document.getElementById('cidrSetResults');
      const cidrPrimarySummary = document.getElementById('cidrPrimarySummary');
      const cidrNoticeSummary = document.getElementById('cidrNoticeSummary');
      const cidrErrorDetails = document.getElementById('cidrErrorDetails');
      const cidrSetErrors = document.getElementById('cidrSetErrors');
      const cidrCleanedDetails = document.getElementById('cidrCleanedDetails');
      const cidrAnalysisDetails = document.getElementById('cidrAnalysisDetails');
      const cidrContainedSection = document.getElementById('cidrContainedSection');
      const cidrMergeableSection = document.getElementById('cidrMergeableSection');
      const cidrExportSource = document.getElementById('cidrExportSource');
      let cidrNormalizedItems = [], cidrAggregatedItems = [], cidrSubtractionItems = null, cidrUpdateTimer = null;
      const cidrExport = createExportPanel({ container: document.getElementById('cidrExportPanel'), getItems: () => cidrExportSource.value === 'after-exclusions' ? (cidrSubtractionItems || []) : (cidrExportSource.value === 'cleaned' ? cidrNormalizedItems : cidrAggregatedItems), defaultName: 'CIDR_SET' });
      function addressCount(prefix) { return 2 ** (32 - prefix); }
      function plural(count, singular, pluralText) { return `${count.toLocaleString()} ${count === 1 ? singular : (pluralText || singular + 's')}`; }
      function totalAddresses(items) { return items.reduce((n, x) => n + addressCount(x.prefix), 0); }
      function renderCidrTable(selector, items, warningId) {
        const tbody = document.querySelector(selector + ' tbody'); tbody.innerHTML = '';
        const warning = warningId ? document.getElementById(warningId) : null;
        if (warning) warning.textContent = items.length > CIDR_VISIBLE_ROWS ? `Showing first ${CIDR_VISIBLE_ROWS.toLocaleString()} of ${items.length.toLocaleString()} networks.` : '';
        const frag = document.createDocumentFragment();
        items.slice(0, CIDR_VISIBLE_ROWS).forEach((item) => {
          const mask = cidrToMask(item.prefix), last = item.network + addressCount(item.prefix) - 1;
          const row = document.createElement('tr');
          [CidrSetUtils.formatCidr(item), intToIp(mask), intToIp(item.network), intToIp(last), addressCount(item.prefix).toLocaleString()].forEach((text) => { const td = document.createElement('td'); td.textContent = text; row.appendChild(td); });
          frag.appendChild(row);
        }); tbody.appendChild(frag);
      }
      function renderMessageList(container, messages) {
        container.innerHTML = '';
        messages.slice(0, CIDR_VISIBLE_ROWS).forEach((m) => { const div = document.createElement('div'); div.textContent = m.message || m; container.appendChild(div); });
      }
      function renderErrors(errors) {
        cidrSetErrors.textContent = errors.join('\n');
        cidrErrorDetails.style.display = errors.length ? 'block' : 'none';
      }
      function updateExportSources(hasSubtraction) {
        const old = cidrExportSource.value;
        cidrExportSource.innerHTML = '<option value="aggregated">Aggregated result</option><option value="cleaned">Cleaned input</option>';
        if (hasSubtraction) cidrExportSource.appendChild(new Option('After exclusions', 'after-exclusions'));
        cidrExportSource.value = hasSubtraction && old === 'after-exclusions' ? 'after-exclusions' : (old === 'cleaned' ? 'cleaned' : 'aggregated');
      }
      function updateCidrSet() {
        const include = CidrSetUtils.parseCidrList(cidrSetInput.value);
        const normalized = CidrSetUtils.normalizeCidrSet(include.items);
        const aggregated = CidrSetUtils.aggregateCidrSet(normalized.items);
        const analysis = CidrSetUtils.analyzeCidrSet(include.items);
        const errors = include.errors.map((e) => `Include line ${e.line}: ${e.input} — ${e.message}`);
        cidrNormalizedItems = normalized.items; cidrAggregatedItems = aggregated.items; cidrSubtractionItems = null;
        let summaryItems = aggregated.items, afterText = '';
        if (cidrExcludeInput.value.trim()) {
          const exclude = CidrSetUtils.parseCidrList(cidrExcludeInput.value);
          errors.push(...exclude.errors.map((e) => `Exclude line ${e.line}: ${e.input} — ${e.message}`));
          const sub = CidrSetUtils.subtractCidrSets(include.items, exclude.items);
          if (sub.error) errors.push(sub.error);
          cidrSubtractionItems = sub.items; summaryItems = sub.items;
          afterText = ` → ${plural(sub.items.length, 'after exclusions', 'after exclusions')}`;
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
        cidrCleanedDetails.querySelector('summary').textContent = `Cleaned input before aggregation (${normalized.items.length.toLocaleString()} networks)`;
        const hasSubtraction = Array.isArray(cidrSubtractionItems);
        document.getElementById('cidrSubtractHeading').style.display = hasSubtraction ? 'block' : 'none';
        document.getElementById('cidrSubtractTable').style.display = hasSubtraction ? 'table' : 'none';
        if (hasSubtraction) renderCidrTable('#cidrSubtractTable', cidrSubtractionItems);
        renderMessageList(document.getElementById('cidrContainedList'), analysis.contained);
        renderMessageList(document.getElementById('cidrMergeableList'), analysis.adjacentMergeable);
        cidrContainedSection.style.display = analysis.contained.length ? 'block' : 'none';
        cidrMergeableSection.style.display = analysis.adjacentMergeable.length ? 'block' : 'none';
        cidrAnalysisDetails.style.display = (analysis.contained.length || analysis.adjacentMergeable.length) ? 'block' : 'none';
        updateExportSources(hasSubtraction);
        cidrSetResults.style.display = 'block';
        cidrExport.refresh();
      }
      function scheduleCidrSetUpdate() {
        clearTimeout(cidrUpdateTimer);
        cidrUpdateTimer = setTimeout(updateCidrSet, 250);
      }
      cidrSetInput.addEventListener('input', scheduleCidrSetUpdate);
      cidrExcludeInput.addEventListener('input', scheduleCidrSetUpdate);
      cidrExportSource.addEventListener('change', () => cidrExport.refresh());
      updateCidrSet();

      const macInput = document.getElementById('macInput');
      const randomMacBtn = document.getElementById('randomMacBtn');
      /* MAC_VENDOR_JS_START */
      const randomVendorMacBtn = document.getElementById('randomVendorMacBtn');
      /* MAC_VENDOR_JS_END */
      const clearBtn = document.getElementById('clearBtn');
      const macError = document.getElementById('macError');
      const resultCard = document.getElementById('resultCard');
      const formatsCard = document.getElementById('formatsCard');
      /* MAC_VENDOR_JS_START */
      const vendorName = document.getElementById('vendorName');
      const matchedPrefix = document.getElementById('matchedPrefix');
      const assignmentType = document.getElementById('assignmentType');
      const dbStatus = document.getElementById('dbStatus');
      /* MAC_VENDOR_JS_END */
      const flagBadges = document.getElementById('flagBadges');
      const formatsList = document.getElementById('formatsList');

      /* MAC_VENDOR_JS_START */
      let ouiDb = null;
      let ouiDbLoadState = 'not loaded';

      /* OUI_LOADER_JS_START */
      async function loadOuiDb() {
        if (ouiDb) return ouiDb;
        try {
          const response = await fetch('./oui-db.json', { cache: 'force-cache' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          ouiDb = await response.json();
          ouiDbLoadState = ouiDb.generatedAt ? `loaded, generated ${ouiDb.generatedAt}` : 'loaded';
        } catch (error) {
          console.warn('OUI database load failed:', error);
          ouiDb = { entries: {} };
          ouiDbLoadState = 'not available';
        }
        return ouiDb;
      }
      /* OUI_LOADER_JS_END */

      /* MAC_VENDOR_JS_END */

      function normalizeMac(input) {
        const hex = input.trim().replace(/[^0-9a-fA-F]/g, '').toUpperCase();
        if (!hex) return { error: 'Enter a MAC address or vendor prefix.' };
        if (hex.length < 6 || hex.length > 12) {
          return { error: `Enter 6 to 12 hex digits for a vendor prefix or full MAC address; got ${hex.length}.` };
        }
        if (!/^[0-9A-F]{6,12}$/.test(hex)) return { error: 'MAC must contain only hexadecimal digits.' };
        return { hex, isFullAddress: hex.length === 12 };
      }

      function group(hex, size, sep) {
        return hex.match(new RegExp(`.{1,${size}}`, 'g')).join(sep);
      }

      function formatMacs(hex) {
        const lower = hex.toLowerCase();
        return [
          ['Colon uppercase (MikroTik/Linux style)', group(hex, 2, ':')],
          ['Colon lowercase', group(lower, 2, ':')],
          ['Hyphen uppercase (D-Link style)', group(hex, 2, '-')],
          ['Hyphen lowercase', group(lower, 2, '-')],
          ['Cisco dotted lowercase', group(lower, 4, '.')],
          ['Cisco dotted uppercase', group(hex, 4, '.')],
          ['Plain uppercase', hex],
          ['Plain lowercase', lower],
          ['Space separated', group(hex, 2, ' ')],
          ['0x-prefixed', '0x' + hex]
        ];
      }

      function macFlags(hex) {
        const firstOctet = parseInt(hex.slice(0, 2), 16);
        return {
          isBroadcast: hex === 'FFFFFFFFFFFF',
          isMulticast: (firstOctet & 1) === 1,
          isLocal: (firstOctet & 2) === 2,
          firstOctet
        };
      }

      /* MAC_VENDOR_JS_START */
      function assignmentTypeForPrefix(prefix) {
        if (prefix.length === 9) return 'MA-S / OUI-36, 36-bit prefix';
        if (prefix.length === 7) return 'MA-M / OUI-28, 28-bit prefix';
        if (prefix.length === 6) return 'MA-L / OUI, 24-bit prefix';
        return `${prefix.length * 4}-bit prefix`;
      }

      function lookupVendor(db, hex) {
        const entries = db.entries || db;
        const prefixLengths = [9, 7, 6].filter((length) => hex.length >= length);
        const prefixes = prefixLengths.map((length) => hex.slice(0, length));
        for (const prefix of prefixes) {
          const record = entries[prefix];
          if (!record) continue;
          if (typeof record === 'string') {
            return { prefix, vendor: record, type: assignmentTypeForPrefix(prefix) };
          }
          return {
            prefix,
            vendor: record.vendor || record.organization || 'Unknown',
            type: record.type || assignmentTypeForPrefix(prefix)
          };
        }
        return null;
      }

      /* MAC_VENDOR_JS_END */

      function renderBadges(flags, isFullAddress) {
        flagBadges.innerHTML = '';
        const badges = [];

        if (flags.isBroadcast) {
          badges.push(['Broadcast', 'warn']);
        } else if (flags.isMulticast) {
          badges.push(['Multicast / group address', 'warn']);
        } else {
          badges.push(['Unicast', 'ok']);
        }

        badges.push(flags.isLocal
          ? ['Locally administered / randomized possible', 'warn']
          : ['Globally administered', 'ok']);

        badges.forEach(([text, kind]) => {
          const badge = document.createElement('span');
          badge.className = `badge ${kind}`;
          badge.textContent = text;
          flagBadges.appendChild(badge);
        });
      }

      function copyText(text, button) {
        if (!navigator.clipboard) {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        } else {
          navigator.clipboard.writeText(text);
        }
        const old = button.textContent;
        button.textContent = 'Copied';
        setTimeout(() => button.textContent = old, 900);
      }

      function renderFormats(hex) {
        formatsList.innerHTML = '';
        formatMacs(hex).forEach(([label, value]) => {
          const row = document.createElement('div');
          row.className = 'format-row';

          const labelEl = document.createElement('div');
          labelEl.className = 'format-label';
          labelEl.textContent = label;

          const valueEl = document.createElement('div');
          valueEl.className = 'format-value';
          valueEl.textContent = value;

          const copyBtn = document.createElement('button');
          copyBtn.className = 'copy-button';
          copyBtn.textContent = 'Copy';
          copyBtn.addEventListener('click', () => copyText(value, copyBtn));

          row.append(labelEl, valueEl, copyBtn);
          formatsList.appendChild(row);
        });
      }

      /* MAC_VENDOR_JS_START */
      async function runLookup() {
        macError.textContent = '';
        const normalized = normalizeMac(macInput.value);
        if (normalized.error) {
          resultCard.style.display = 'none';
          formatsCard.style.display = 'none';
          macError.textContent = normalized.error;
          return;
        }

        const hex = normalized.hex;
        const flags = macFlags(hex.padEnd(12, '0'));
        const db = await loadOuiDb();
        const match = lookupVendor(db, hex);
        const isFullAddress = normalized.isFullAddress;

        resultCard.style.display = 'block';
        formatsCard.style.display = isFullAddress ? 'block' : 'none';

        if (isFullAddress && flags.isBroadcast) {
          vendorName.textContent = 'Not applicable for broadcast address';
          matchedPrefix.textContent = '—';
          assignmentType.textContent = 'Broadcast';
        } else if (isFullAddress && flags.isMulticast) {
          vendorName.textContent = 'Not reliable for multicast/group address';
          matchedPrefix.textContent = '—';
          assignmentType.textContent = 'Multicast / group address';
        } else if (isFullAddress && flags.isLocal) {
          vendorName.textContent = match ? `${match.vendor} (prefix match, but MAC is local/randomized)` : 'Locally administered or randomized MAC';
          matchedPrefix.textContent = match ? match.prefix : '—';
          assignmentType.textContent = match ? match.type : 'Local address';
        } else if (match) {
          vendorName.textContent = match.vendor;
          matchedPrefix.textContent = match.prefix;
          assignmentType.textContent = match.type;
        } else {
          vendorName.textContent = 'Vendor not found in bundled database';
          matchedPrefix.textContent = hex.length >= 6 ? hex.slice(0, Math.min(hex.length, 9)) : '—';
          assignmentType.textContent = 'No matching MA-L/MA-M/MA-S prefix';
        }

        dbStatus.textContent = ouiDbLoadState;
        renderBadges(flags, isFullAddress);
        if (isFullAddress) renderFormats(hex);
      }

      /* MAC_VENDOR_JS_END */

      function runFormatterOnly() {
        macError.textContent = '';
        const normalized = normalizeMac(macInput.value);
        if (normalized.error) {
          resultCard.style.display = 'none';
          formatsCard.style.display = 'none';
          macError.textContent = normalized.error;
          return;
        }
        const hex = normalized.hex;
        const flags = macFlags(hex.padEnd(12, '0'));
        const isFullAddress = normalized.isFullAddress;
        resultCard.style.display = 'block';
        formatsCard.style.display = isFullAddress ? 'block' : 'none';
        renderBadges(flags, isFullAddress);
        if (isFullAddress) renderFormats(hex);
      }

      function generateRandomMac() {
        const bytes = crypto.getRandomValues(new Uint8Array(6));
        bytes[0] = (bytes[0] | 0x02) & 0xfe;
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(':');
      }

      /* MAC_VENDOR_JS_START */
      function randomHex(length) {
        const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2)));
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join('').slice(0, length);
      }

      function generateRandomVendorMac(db) {
        const entries = db.entries || db;
        const prefixes = Object.keys(entries).filter((prefix) => /^[0-9A-F]{6,9}$/.test(prefix));
        if (!prefixes.length) return null;

        const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % prefixes.length;
        const prefix = prefixes[randomIndex];
        const hex = `${prefix}${randomHex(12 - prefix.length)}`;
        return group(hex, 2, ':');
      }

      /* MAC_VENDOR_JS_END */

      randomMacBtn.addEventListener('click', () => {
        macInput.value = generateRandomMac();
        runLookup();
      });
      /* MAC_VENDOR_JS_START */
      randomVendorMacBtn.addEventListener('click', async () => {
        macError.textContent = '';
        const db = await loadOuiDb();
        const mac = generateRandomVendorMac(db);
        if (!mac) {
          macError.textContent = 'OUI database is not available for random vendor MAC generation.';
          return;
        }
        macInput.value = mac;
        runLookup();
      });
      /* MAC_VENDOR_JS_END */
      macInput.addEventListener('input', runLookup);
      macInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') runLookup();
      });
      clearBtn.addEventListener('click', () => {
        macInput.value = '';
        macInput.focus();
        resultCard.style.display = 'none';
        formatsCard.style.display = 'none';
        macError.textContent = '';
      });
      document.querySelectorAll('.example').forEach((button) => {
        button.addEventListener('click', () => {
          macInput.value = button.dataset.mac;
          runLookup();
        });
      });

      /* MAC_VENDOR_JS_START */
      loadOuiDb().then(runLookup);
      /* MAC_VENDOR_JS_END */
      const tabButtons = document.querySelectorAll('.tab-button');
      const tabContents  = document.querySelectorAll('.tab-content');
      tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          tabButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const target = btn.getAttribute('data-tab');
          tabContents.forEach(tc => {
            tc.classList.toggle('active', tc.id === target);
          });
        });
      });
      const toggleDarkModeBtn = document.getElementById('toggleDarkModeBtn');
      toggleDarkModeBtn.addEventListener('click', function () {
        document.body.classList.toggle('dark-mode');
      });

      calculateAnalyzer();
      renderAppVersion();
      initServiceWorker();
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();
