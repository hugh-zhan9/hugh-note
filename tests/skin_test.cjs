const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const source = readFileSync(`${__dirname}/../static/js/themetoggle.js`, 'utf8');

function page(saved, blocked = false, legacy) {
  const nodes = new Map();
  const events = {};
  const storage = new Map(saved === undefined ? [] : [['theme-storage', saved]]);
  if (legacy) storage.set('theme', legacy);
  const properties = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', hidden: true, open: false, attributes: {}, listeners: {},
      addEventListener(type, listener) { this.listeners[type] = listener; },
      setAttribute(key, value) { this.attributes[key] = value; },
      removeAttribute(key) { delete this.attributes[key]; },
      querySelector(selector) { return selector.startsWith("#") ? node(selector.slice(1)) : { focus() {} }; },
      removeEventListener(type, listener) { if (this.listeners[type] === listener) delete this.listeners[type]; },
      contains(target) { return target === this; },
    });
    return nodes.get(id);
  }
  const root = { dataset: {}, classList: { toggle() {} }, style: {
    setProperty: (key, value) => properties.set(key, value),
    removeProperty: (key) => properties.delete(key),
  } };
  const runtimeWindow = { addEventListener: (type, listener) => { events[type] = listener; } };
  runInNewContext(source, {
    document: { documentElement: root, getElementById: node,
      addEventListener: (type, listener) => { events[type] = listener; },
      removeEventListener: (type, listener) => { if (events[type] === listener) delete events[type]; } },
    window: runtimeWindow,
    localStorage: {
      getItem(key) { if (blocked) throw Error('denied'); return storage.get(key) ?? null; },
      setItem(key, value) { if (blocked) throw Error('denied'); storage.set(key, value); },
    },
  });
  const initial = { ...root.dataset };
  events.DOMContentLoaded();
  return { root, initial, node, events, storage, properties, api: runtimeWindow.siteAppearance,
    input(id, value, event = 'input') { node(id).value = value; node(id).listeners[event](); } };
}

test('default and saved palettes are applied before body initialization', () => {
  assert.equal(page().initial.skin, 'light');
  for (const skin of ['light', 'paper', 'sage', 'dark']) {
    const p = page(skin);
    assert.equal(p.initial.skin, skin);
    assert.equal(p.node('skin-preset').value, skin);
    assert.equal(p.node('darkModeStyle').disabled, skin !== 'dark');
  }
  for (const invalid of ['', 'unknown', '#fff', 'constructor', 'url(test)']) {
    assert.equal(page(invalid).initial.skin, 'light');
  }
});

test('custom color survives navigation, presets remove its override, reset restores default', () => {
  const p = page();
  p.input('skin-hex', '#123ABC');
  assert.equal(p.storage.get('theme-storage'), '#123abc');
  const next = page(p.storage.get('theme-storage'));
  assert.equal(next.node('skin-hex').value, '#123abc');
  assert.equal(next.root.dataset.theme, 'dark');
  p.input('skin-preset', 'paper', 'change');
  assert.equal(p.properties.has('--site-bg'), false);
  assert.equal(p.storage.get('theme-storage'), 'paper');
  p.node('skin-reset').listeners.click();
  assert.equal(p.root.dataset.skin, 'light');
  assert.equal(p.storage.get('theme-storage'), 'light');
});

test('incomplete and invalid colors leave the active appearance intact', () => {
  const p = page('sage');
  for (const value of ['', '#', '#12345', '#gggggg', 'red']) {
    p.input('skin-hex', value);
    assert.equal(p.root.dataset.skin, 'sage');
    assert.equal(p.storage.get('theme-storage'), 'sage');
    assert.equal(p.node('skin-hex').attributes['aria-invalid'], 'true');
  }
  p.input('skin-color', '#000000');
  assert.equal(p.node('skin-hex').attributes['aria-invalid'], undefined);
});

test('custom foreground maintains at least 4.5:1 contrast across the RGB cube', () => {
  const p = page();
  for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
    const rgb = [r, g, b];
    p.input('skin-color', '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join(''));
    const linear = rgb.map(v => v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
    const lum = linear.reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const contrast = p.properties.get('--site-custom-ink') === '#ffffff' ? 1.05 / (lum + 0.05) : (lum + 0.05) / 0.05;
    assert.ok(contrast >= 4.5, `${rgb}: ${contrast}`);
  }
});

test('another tab updates the appearance, including clearing preferences', () => {
  const p = page();
  p.storage.set('theme-storage', 'dark');
  p.events.storage({ key: 'theme-storage' });
  assert.equal(p.root.dataset.theme, 'dark');
  p.storage.clear();
  p.events.storage({ key: null });
  assert.equal(p.root.dataset.skin, 'light');
});

test('unavailable storage is reported and does not break the controls', () => {
  const p = page(undefined, true);
  p.input('skin-preset', 'dark', 'change');
  assert.equal(p.root.dataset.theme, 'dark');
  assert.match(p.node('skin-status').textContent, /无法保存/);
});

test('Escape and an outside click close the appearance panel', () => {
  const p = page();
  p.node('skin-settings').open = true;
  p.node('skin-settings').listeners.keydown({ key: 'Escape' });
  assert.equal(p.node('skin-settings').open, false);
  p.node('skin-settings').open = true;
  p.events.click({ target: {} });
  assert.equal(p.node('skin-settings').open, false);
});

test('legacy running choice migrates only when there is no site preference', () => {
  assert.equal(page(undefined, false, 'dark').storage.get('theme-storage'), 'dark');
  assert.equal(page('sage', false, 'dark').initial.skin, 'sage');
  assert.equal(page(undefined, false, 'invalid').initial.skin, 'light');
});
test('React adapter subscriptions and control mounts are disposable', () => {
  const p = page();
  let changes = 0;
  const unsubscribe = p.api.subscribe(() => changes++);
  p.api.choose('paper');
  assert.ok(changes > 0);
  unsubscribe();
  const previous = changes;
  p.api.choose('sage');
  assert.equal(changes, previous);
  const cleanup = p.api.mount(p.node('skin-settings'));
  cleanup();
  assert.equal(p.node('skin-preset').listeners.change, undefined);
  const cleanupAgain = p.api.mount(p.node('skin-settings'));
  p.input('skin-preset', 'dark', 'change');
  assert.equal(p.api.getPreference(), 'dark');
  cleanupAgain();
});
