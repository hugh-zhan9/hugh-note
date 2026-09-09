import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../static/js/homepage.js', import.meta.url), 'utf8');

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this.events = {};
    this.style = {};
    this.dataset = {};
    this.hidden = true;
    this.disabled = true;
    this.text = '';
  }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(value) { this.text = value; this.children = []; }
  appendChild(child) { this.children.push(child); }
  replaceChildren(...children) { this.text = ''; this.children = children; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, callback) { this.events[name] = callback; }
  querySelectorAll() { return this.children; }
  focus() { this.focused = true; }
}

async function mount({ activities = [], memories = [], fail = false, storageBlocked = false, theme = 'light', now = '2026-09-08T12:00:00+08:00' } = {}) {
  const ids = new Map();
  for (const name of ['running-root', 'running-month', 'running-value', 'running-status', 'running-progress', 'running-percent', 'running-grid', 'running-meter', 'running-previous', 'running-next', 'running-routes', 'running-route-map', 'running-routes-status', 'route-overview', 'route-individual', 'route-overview-tab', 'route-individual-tab', 'crazy-talk-data', 'crazy-talk', 'crazy-talk-link', 'crazy-talk-next', 'memories-data', 'memories-list', 'memories-date']) {
    ids.set(`homepage-${name}`, new Element());
  }
  ids.set('dark-mode-toggle', new Element());
  ids.set('homepage-route-region', new Element('select'));
  const get = name => ids.get(`homepage-${name}`);
  get('running-root').dataset = { targetKm: '150', runningBase: '/running/' };
  const notes = ['最新的一条', '另一条记录', '再一条记录'];
  for (const [rank, text] of notes.entries()) {
    const item = new Element();
    item.attributes = { 'data-text': text, 'data-title': `2026-09-0${3 - rank}`, 'data-url': `/crazy-talk/${rank}/`, 'data-source-rank': String(rank) };
    get('crazy-talk-data').children.push(item);
  }
  get('crazy-talk').textContent = notes[0];
  get('crazy-talk-link').href = '/crazy-talk/0/';
  memories.forEach(record => {
    const item = new Element();
    item.attributes = Object.fromEntries(Object.entries(record).map(([key, value]) => [`data-${key}`, value]));
    get('memories-data').children.push(item);
  });
  const body = new Element();
  const calls = [];
  let timers = 0;
  let tick;
  let delay;
  class TestDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
  }
  vm.runInNewContext(source, {
    document: {
      body,
      readyState: 'complete',
      querySelector: selector => selector === '[data-running-root]' ? get('running-root') : new Element(),
      getElementById: id => ids.get(id),
      createElement: tagName => new Element(tagName),
      createElementNS: (_namespace, tagName) => new Element(tagName),
      addEventListener() {},
    },
    window: {
      location: { origin: 'https://example.com' },
      addEventListener() {},
      setTimeout(callback) { callback(); },
      setInterval(callback, interval) { timers++; tick = callback; delay = interval; },
      clearInterval() {},
    },
    localStorage: { getItem() { if (storageBlocked) throw new Error('unavailable'); return theme; } },
    console: { error() {} },
    URL,
    Date: TestDate,
    fetch: async url => {
      calls.push(url);
      if (fail) throw new Error('offline');
      assert.equal(url, '/running/data/activities.json');
      return { ok: true, json: async () => activities };
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  return { get, ids, body, calls, timers, tick, delay };
}

test('only current-month running contributes to the target and daily map', async () => {
  const app = await mount({ activities: [
    { type: 'Run', start_date_local: '2026-09-01T08:00:00', distance: 5000 },
    { type: 'VirtualRun', start_date_local: '2026-09-01T18:00:00', distance: 1000 },
    { type: 'running', start_date_local: '2026-09-08T08:00:00', distance: 4500 },
    { type: 'Ride', start_date_local: '2026-09-02T08:00:00', distance: 20000 },
    { type: 'Run', start_date_local: '2026-08-31T08:00:00', distance: 10000 },
  ] });
  assert.equal(app.get('running-value').textContent, '10.5 / 150 km');
  assert.equal(app.get('running-percent').textContent, '7%');
  assert.ok(Math.abs(parseFloat(app.get('running-progress').style.width) - 7) < 0.001);
  assert.equal(app.get('running-meter').getAttribute('aria-valuenow'), '10.5');
  assert.equal(app.get('running-grid').children.length, 30);
  assert.match(app.get('running-grid').children[0].title, /6.0 km/);
  assert.match(app.get('running-status').textContent, /139.5 km/);
});

test('completed target retains actual distance but caps the progress bar', async () => {
  const app = await mount({ activities: [{ type: 'Run', start_date_local: '2026-09-01', distance: 160000 }] });
  assert.equal(app.get('running-value').textContent, '160.0 / 150 km');
  assert.equal(app.get('running-progress').style.width, '100%');
  assert.equal(app.get('running-meter').getAttribute('aria-valuenow'), '150');
});

test('empty records and failed requests are different states', async () => {
  const empty = await mount();
  assert.equal(empty.get('running-value').textContent, '0.0 / 150 km');
  assert.match(empty.get('running-status').textContent, /暂无跑步记录/);
  const offline = await mount({ fail: true });
  assert.equal(offline.get('running-value').textContent, '—');
  assert.equal(offline.get('running-percent').textContent, '—');
  assert.match(offline.get('running-status').textContent, /暂不可用/);
  assert.equal(offline.get('running-meter').getAttribute('aria-valuenow'), null);
  assert.equal(offline.get('running-grid').children.length, 0);
});

test('invalid activity responses are reported as unavailable', async () => {
  const app = await mount({ activities: { error: 'bad response' } });
  assert.equal(app.get('running-value').textContent, '—');
  assert.match(app.get('running-status').textContent, /暂不可用/);
});

test('notes start with the latest, rotate every ten seconds, and support manual changes', async () => {
  const app = await mount();
  assert.equal(app.get('crazy-talk').textContent, '最新的一条');
  assert.equal(app.timers, 1);
  assert.equal(app.delay, 10000);
  assert.equal(app.get('crazy-talk-next').hidden, false);
  app.get('crazy-talk-next').events.click();
  const text = app.get('crazy-talk').textContent;
  assert.notEqual(text, '最新的一条');
  const rank = ['最新的一条', '另一条记录', '再一条记录'].indexOf(text);
  assert.equal(app.get('crazy-talk-link').href, `/crazy-talk/${rank}/`);
  app.get('crazy-talk').scrollTop = 80;
  app.tick();
  assert.notEqual(app.get('crazy-talk').textContent, text);
  assert.equal(app.get('crazy-talk').scrollTop, 0);
});

test('anniversary mixes prior-year note text and linked blog titles, newest year first', async () => {
  const app = await mount({ memories: [
    { date: '2023-09-08', kind: 'blog', text: '一篇旧文章', url: '/posts/old/' },
    { date: '2025-09-08', kind: 'note', text: '那一天的碎念正文', url: '/crazy-talk/2025-09-08/' },
    { date: '2026-09-08', kind: 'blog', text: '今年不算往年', url: '/posts/current/' },
    { date: '2024-09-09', kind: 'note', text: '不是今天', url: '/crazy-talk/2024-09-09/' },
    { date: '2027-09-08', kind: 'blog', text: '未来', url: '/posts/future/' },
  ] });
  assert.equal(app.get('memories-date').textContent, '09.08');
  const records = app.get('memories-list').children;
  assert.equal(records.length, 2);
  assert.equal(records[0].children[0].textContent, '2025 · 疯言疯语');
  assert.equal(records[0].children[1].textContent, '那一天的碎念正文');
  assert.equal(records[1].children[1].children[0].href, '/posts/old/');
  assert.equal(records[1].children[1].children[0].textContent, '一篇旧文章 ↗');
});

test('anniversary uses the visit date and has an honest empty state, including leap days', async () => {
  const memories = [{ date: '2024-02-29', kind: 'note', text: '闰日', url: '/crazy-talk/leap/' }];
  const leap = await mount({ memories, now: '2028-02-29T12:00:00+08:00' });
  assert.equal(leap.get('memories-list').children[0].children[1].textContent, '闰日');
  assert.equal(leap.get('memories-date').getAttribute('datetime'), '2028-02-29');
  const ordinary = await mount({ memories, now: '2027-02-28T12:00:00+08:00' });
  assert.match(ordinary.get('memories-list').textContent, /还没有往年的记录/);
});

test('blocked storage does not stop homepage initialization', async () => {
  const blocked = await mount({ storageBlocked: true });
  assert.equal(blocked.get('crazy-talk-next').hidden, false);
  assert.equal(blocked.get('running-value').textContent, '0.0 / 150 km');
});

test('month navigation handles year boundaries, updates the data, and reuses the response', async () => {
  const app = await mount({ now: '2026-01-31T12:00:00+08:00', activities: [
    { type: 'Run', start_date_local: '2026-01-10', distance: 5000 },
    { type: 'Run', start_date_local: '2025-12-10', distance: 12000 },
  ] });
  assert.equal(app.get('running-next').disabled, true);
  assert.equal(app.get('running-previous').disabled, false);
  app.get('running-previous').events.click();
  assert.equal(app.get('running-month').textContent, '2025 年 12 月');
  assert.equal(app.get('running-value').textContent, '12.0 / 150 km');
  assert.equal(app.get('running-meter').getAttribute('aria-label'), '2025 年 12 月跑量目标');
  assert.equal(app.get('running-previous').disabled, true);
  assert.equal(app.get('running-next').disabled, false);
  app.get('running-next').events.click();
  assert.equal(app.get('running-value').textContent, '5.0 / 150 km');
  app.get('running-next').events.click();
  assert.equal(app.get('running-month').textContent, '2026 年 1 月');
  assert.equal(app.calls.length, 1);
});

test('month navigation handles leap February, empty months and unavailable data', async () => {
  const leap = await mount({ now: '2024-03-31T12:00:00+08:00', activities: [
    { type: 'Run', start_date_local: '2024-02-29', distance: 5000 },
  ] });
  leap.get('running-previous').events.click();
  assert.equal(leap.get('running-grid').children.length, 29);
  assert.match(leap.get('running-grid').children[28].title, /5.0 km/);
  const app = await mount({ activities: [{ type: 'Run', start_date_local: '2026-07-01', distance: 1000 }] });
  app.get('running-previous').events.click();
  assert.equal(app.get('running-month').textContent, '2026 年 8 月');
  assert.equal(app.get('running-value').textContent, '0.0 / 150 km');
  assert.equal(app.get('running-status').textContent, '该月暂无跑步记录');
  assert.equal(app.get('running-routes').hidden, true);
  const unavailable = await mount({ fail: true });
  assert.equal(unavailable.get('running-previous').disabled, true);
  assert.equal(unavailable.get('running-next').disabled, true);
});

const samplePolyline = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

test('route overview and individual cards use only selected-month runs and tolerate missing GPS', async () => {
  const app = await mount({ activities: [
    { type: 'Run', start_date_local: '2026-09-08 18:00:00', distance: 6000, summary_polyline: samplePolyline },
    { type: 'Run', start_date_local: '2026-09-05', distance: 4000, map: { summary_polyline: samplePolyline } },
    { type: 'Run', start_date_local: '2026-09-04', distance: 3000, summary_polyline: 'invalid!' },
    { type: 'Run', start_date_local: '2026-08-01', distance: 5000, summary_polyline: samplePolyline },
    { type: 'Ride', start_date_local: '2026-09-02', distance: 12000, summary_polyline: samplePolyline },
  ] });
  assert.equal(app.get('running-routes-status').textContent, '2 条路线 · 1 次无轨迹');
  const paths = app.get('running-route-map').children;
  assert.equal(paths.length, 2);
  for (const path of paths) {
    const d = path.getAttribute('d');
    assert.doesNotMatch(d, /NaN|Infinity/);
    for (const point of d.split(' ')) {
      const [x, y] = point.slice(1).split(',').map(Number);
      assert.ok(x >= 17.99 && x <= 302.01 && y >= 17.99 && y <= 182.01);
    }
  }
  const cards = app.get('route-individual').children;
  assert.equal(cards.length, 3);
  assert.equal(cards[0].children[0].children[0].textContent, '09.08');
  assert.equal(cards[0].children[1].tagName, 'svg');
  assert.equal(cards[0].children[1].children.length, 1);
  assert.equal(cards[2].children[1].textContent, '暂无 GPS 轨迹');
  app.get('route-individual-tab').events.click();
  assert.equal(app.get('route-overview').hidden, true);
  assert.equal(app.get('route-individual').hidden, false);
  app.get('running-previous').events.click();
  assert.equal(app.get('running-route-map').children.length, 1);
  assert.equal(app.get('route-individual').children.length, 1);
  assert.equal(app.get('route-individual').hidden, false);
  assert.equal(app.get('route-individual-tab').getAttribute('aria-selected'), 'true');
});

test('route tabs support keyboard navigation and announce the active panel', async () => {
  const app = await mount();
  let prevented = false;
  app.get('route-overview-tab').events.keydown({ key: 'ArrowRight', preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.equal(app.get('route-individual-tab').focused, true);
  assert.equal(app.get('route-individual-tab').getAttribute('aria-selected'), 'true');
  assert.equal(app.get('route-overview-tab').tabIndex, -1);
  app.get('route-individual-tab').events.keydown({ key: 'Home', preventDefault() {} });
  assert.equal(app.get('route-overview-tab').getAttribute('aria-selected'), 'true');
  assert.equal(app.get('route-overview').hidden, false);
});

test('overview fits each geographic area separately and excludes duplicate-coordinate placeholders', async () => {
  const app = await mount({ activities: [
    { type: 'Run', start_date_local: '2026-09-08', distance: 5000, summary_polyline: samplePolyline, location_country: "{'city': '地区甲'}" },
    { type: 'Run', start_date_local: '2026-09-07', distance: 4000, summary_polyline: samplePolyline, location_country: "{'city': '地区甲'}" },
    { type: 'Run', start_date_local: '2026-09-06', distance: 3000, summary_polyline: '??_ibE_ibE', location_country: { city: '地区乙' } },
    { type: 'Run', start_date_local: '2026-09-05', distance: 2000, summary_polyline: '????' },
  ] });
  assert.equal(app.get('running-value').textContent, '14.0 / 150 km');
  assert.equal(app.get('running-routes-status').textContent, '3 条路线 · 1 次无轨迹');
  const region = app.get('route-region');
  assert.equal(region.hidden, false);
  assert.equal(region.children.length, 2);
  assert.equal(region.children[0].textContent, '地区甲 · 2 条路线');
  assert.equal(app.get('running-route-map').children.length, 2);
  function assertReadableScale() {
    const path = app.get('running-route-map').children[0].getAttribute('d');
    const points = path.split(' ').map(point => point.slice(1).split(',').map(Number));
    const width = Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0]));
    const height = Math.max(...points.map(p => p[1])) - Math.min(...points.map(p => p[1]));
    assert.ok(Math.max(width, height) >= 160);
  }
  assertReadableScale();
  region.value = '1';
  region.onchange();
  assert.equal(app.get('running-route-map').children.length, 1);
  assert.match(app.get('running-route-map').getAttribute('aria-label'), /地区乙/);
  assertReadableScale();
  assert.equal(app.get('route-individual').children.length, 4);
  assert.equal(app.get('route-individual').children[3].children[1].textContent, '暂无 GPS 轨迹');
});
