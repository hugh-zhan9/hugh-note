import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createActivityRouteLoader } from './activityRoutes';
const a = {
  run_id: 1,
  start_date_local: '2026-01-01',
  has_route: true,
  summary_polyline: null,
};
const b = { ...a, run_id: 2, start_date_local: '2025-01-01' };
test('load only requested route years, deduplicate callers, keep source data unchanged', async () => {
  const calls: unknown[] = [];
  const loader = createActivityRouteLoader(
    { '2026': '/2026.hash', '2025': '/2025.hash' },
    async (url) => {
      calls.push(url);
      return Response.json(
        url === '/2026.hash' ? { 1: 'line1' } : { 2: 'line2' }
      );
    }
  );
  assert.deepEqual(await loader.load([]), []);
  assert.equal(calls.length, 0);
  const [first, same] = await Promise.all([loader.load([a]), loader.load([a])]);
  assert.equal(first[0].summary_polyline, 'line1');
  assert.deepEqual(first, same);
  assert.deepEqual(calls, ['/2026.hash']);
  const all = await loader.load([a, b, { ...a, run_id: 3, has_route: false }]);
  assert.deepEqual(
    all.map((v) => v.summary_polyline),
    ['line1', 'line2', null]
  );
  assert.deepEqual(calls, ['/2026.hash', '/2025.hash']);
  assert.equal(a.summary_polyline, null);
});
test('missing years, corrupt data and failed downloads never masquerade as empty routes', async () => {
  await assert.rejects(createActivityRouteLoader({}).load([a]), /缺少/);
  for (const data of [[], null, { 1: 123 }, {}]) {
    const loader = createActivityRouteLoader({ '2026': '/2026' }, async () =>
      Response.json(data)
    );
    await assert.rejects(loader.load([a]));
  }
  let fail = true;
  const loader = createActivityRouteLoader({ '2026': '/2026' }, async () =>
    fail
      ? Response.json({ 1: 'line1' }, { status: 503 })
      : Response.json({ 1: 'line1' })
  );
  await assert.rejects(loader.load([a]));
  fail = false;
  loader.reset();
  assert.equal((await loader.load([a]))[0].summary_polyline, 'line1');
});
