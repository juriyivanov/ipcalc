const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener, options) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push({ listener, once: Boolean(options && options.once) });
    },
    dispatchEvent(event) {
      const current = [...(listeners.get(event.type) || [])];
      for (const entry of current) {
        entry.listener.call(this, event);
        if (entry.once) {
          const bucket = listeners.get(event.type) || [];
          const index = bucket.indexOf(entry);
          if (index >= 0) bucket.splice(index, 1);
        }
      }
      return true;
    }
  };
}

test('compact loader wakes app-core when DOMContentLoaded happened before core finished loading', () => {
  const documentTarget = eventTarget();
  const document = Object.assign(documentTarget, {
    readyState: 'loading',
    head: {
      appendChild(node) {
        document.coreScript = node;
      }
    },
    createElement(name) {
      assert.equal(name, 'script');
      return Object.assign(eventTarget(), { src: '', async: true });
    }
  });

  const fetch = async () => { throw new Error('network fetch should not run in this test'); };
  const window = { fetch };
  window.window = window;

  class Event {
    constructor(type) { this.type = type; }
  }

  const context = vm.createContext({
    window,
    document,
    location: { href: 'https://example.test/ipcalc/' },
    URL,
    Event,
    TextDecoder,
    Uint8Array,
    DataView,
    ArrayBuffer,
    Map,
    Proxy,
    Object,
    Number,
    Math,
    console
  });

  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'app.js' });

  assert.ok(document.coreScript, 'app-core script should be injected');

  // The page finishes parsing while app-core.js is still in flight.
  document.dispatchEvent(new Event('DOMContentLoaded'));

  // Mimic app-core.js registering its once-only initializer after the real
  // DOMContentLoaded event has already happened.
  let initCount = 0;
  document.addEventListener('DOMContentLoaded', () => { initCount += 1; }, { once: true });
  assert.equal(initCount, 0);

  // When the dynamically loaded core finishes, app.js must wake that late
  // listener exactly once.
  document.coreScript.dispatchEvent(new Event('load'));
  assert.equal(initCount, 1);
});
