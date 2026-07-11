(() => {
  'use strict';

  function flashButton(button, label) {
    const original = button.textContent;
    button.textContent = label;
    window.setTimeout(() => {
      button.textContent = original;
    }, 1000);
  }

  async function writeClipboard(text, button) {
    if (!text) {
      flashButton(button, 'Nothing to copy');
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      flashButton(button, 'Copied');
    } catch (error) {
      console.warn('Clipboard write failed:', error);
      flashButton(button, 'Copy failed');
    }
  }

  function tableText(table, mode) {
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    return rows.map((row) => {
      const first = row.cells[0]?.textContent.trim() || '';
      const mask = row.cells[1]?.textContent.trim() || '';

      if (mode === 'cidr') return first;

      const network = first.includes('/') ? first.slice(0, first.lastIndexOf('/')) : first;
      return mask ? `${network} ${mask}` : network;
    }).filter(Boolean).join('\n');
  }

  function addCopyActions(resultsId, tableId) {
    const results = document.getElementById(resultsId);
    const table = document.getElementById(tableId);
    if (!results || !table || results.querySelector('.copy-actions')) return;

    const actions = document.createElement('div');
    actions.className = 'copy-actions';

    const cidrButton = document.createElement('button');
    cidrButton.type = 'button';
    cidrButton.textContent = 'Copy CIDR';
    cidrButton.addEventListener('click', () => {
      writeClipboard(tableText(table, 'cidr'), cidrButton);
    });

    const dottedButton = document.createElement('button');
    dottedButton.type = 'button';
    dottedButton.textContent = 'Copy dotted mask';
    dottedButton.addEventListener('click', () => {
      writeClipboard(tableText(table, 'dotted'), dottedButton);
    });

    actions.append(cidrButton, dottedButton);
    results.insertBefore(actions, table);
  }

  function compactMacResult() {
    const resultCard = document.getElementById('resultCard');
    const resultGrid = resultCard?.querySelector('.result-grid');
    const matchedPrefix = document.getElementById('matchedPrefix');
    const flagBadges = document.getElementById('flagBadges');

    if (!resultCard || !resultGrid || !matchedPrefix || !flagBadges) return;

    const heading = resultCard.querySelector(':scope > h3');
    if (heading) heading.remove();

    const databaseKey = Array.from(resultGrid.querySelectorAll('.key'))
      .find((key) => key.textContent.trim().toLowerCase() === 'oui database');
    if (databaseKey) {
      const databaseValue = databaseKey.nextElementSibling;
      databaseKey.remove();
      databaseValue?.remove();
    }

    if (!matchedPrefix.parentElement.classList.contains('matched-prefix-line')) {
      const line = document.createElement('div');
      line.className = 'matched-prefix-line value';
      resultGrid.insertBefore(line, matchedPrefix);
      line.append(matchedPrefix, flagBadges);
    }
  }

  function buildFormatsTable() {
    const formatsList = document.getElementById('formatsList');
    if (!formatsList) return;

    const sourceRows = Array.from(formatsList.querySelectorAll(':scope > .format-row'));
    if (!sourceRows.length) return;

    const table = document.createElement('table');
    table.className = 'formats-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Format', 'Value', ''].forEach((text) => {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const tbody = document.createElement('tbody');
    sourceRows.forEach((sourceRow) => {
      const row = document.createElement('tr');
      const labelCell = document.createElement('td');
      const valueCell = document.createElement('td');
      const actionCell = document.createElement('td');

      labelCell.className = 'format-label';
      valueCell.className = 'format-value';
      actionCell.className = 'format-copy-cell';

      const label = sourceRow.querySelector('.format-label');
      const value = sourceRow.querySelector('.format-value');
      const button = sourceRow.querySelector('.copy-button');

      if (label) labelCell.textContent = label.textContent;
      if (value) valueCell.textContent = value.textContent;
      if (button) actionCell.appendChild(button);

      row.append(labelCell, valueCell, actionCell);
      tbody.appendChild(row);
    });

    table.append(thead, tbody);
    formatsList.replaceChildren(table);
  }

  function compactFormatsCard() {
    const formatsCard = document.getElementById('formatsCard');
    const formatsList = document.getElementById('formatsList');
    if (!formatsCard || !formatsList) return;

    formatsCard.querySelector(':scope > h3')?.remove();
    formatsCard.classList.add('formats-table-card');

    const observer = new MutationObserver(() => buildFormatsTable());
    observer.observe(formatsList, { childList: true });
    buildFormatsTable();
  }

  addCopyActions('rangeResults', 'rangeTable');
  addCopyActions('subnetResults', 'subnetTable');
  compactMacResult();
  compactFormatsCard();
})();