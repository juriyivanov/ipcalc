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
        await navigator