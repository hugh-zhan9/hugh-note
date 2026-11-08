import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectActivities } from './activity-data';
const activity = {
  run_id: 1,
  name: 'Morning',
  type: 'Walk',
  subtype: null,
  start_date: '2026-03-13T00:13:15Z',
  start_date_local: '2026-03-13 08:13:15',
  distance: 1000,
  average_speed: 2,
  moving_time: '00:08:20',
  elevation_gain: null,
  streak: 1,
  summary_polyline: '',
  location_country: null,
};
test('export reuses presentation and normalization without mutating historical data', () => {
  const input = [structuredClone(activity)];
  const snapshot = JSON.stringify(input);
  const projected = projectActivities(input);
  assert.equal(projected[0].type, 'running');
  assert.equal(projected[0].summary_polyline, '');
  assert.equal(JSON.stringify(input), snapshot);
});
test('empty, one record and virtual running exports keep their boundaries', () => {
  assert.deepEqual(projectActivities([]), []);
  assert.equal(
    projectActivities([
      { ...activity, start_date_local: '2026-09-01', type: 'VirtualRun' },
    ])[0].type,
    'running'
  );
  assert.equal(
    projectActivities([{ ...activity, start_date_local: '2026-09-01' }])[0]
      .type,
    'walking'
  );
});
test('invalid input fails instead of publishing empty or ambiguous activity data', () => {
  for (const input of [
    null,
    {},
    [null],
    [{ ...activity, moving_time: 'not-a-duration' }],
    [{ ...activity, moving_time: '00:60:00' }],
    [activity, activity],
    [{ ...activity, distance: -1 }],
    [{ ...activity, average_speed: Infinity }],
    [{ ...activity, start_date_local: 'invalid' }],
    [{ ...activity, summary_polyline: {} }],
  ]) {
    assert.throws(() => projectActivities(input));
  }
});

test('progressive export separates routes by year without changing the legacy interface', async () => {
  const { splitActivityData } = await import('./activity-data');
  const input = [
    { ...activity, summary_polyline: 'route-one' },
    {
      ...activity,
      run_id: 2,
      start_date_local: '2025-05-01',
      summary_polyline: 'route-two',
    },
    { ...activity, run_id: 3, summary_polyline: null },
  ];
  const before = JSON.stringify(input);
  const result = splitActivityData(input);
  assert.deepEqual(JSON.parse(result.full), projectActivities(input));
  const index = JSON.parse(result.index.source);
  assert.deepEqual(
    index.map((a: { has_route: boolean }) => a.has_route),
    [true, true, false]
  );
  assert.ok(
    index.every((a: { summary_polyline: null }) => a.summary_polyline === null)
  );
  assert.deepEqual(JSON.parse(result.routes['2026'].source), {
    1: 'route-one',
  });
  assert.deepEqual(JSON.parse(result.routes['2025'].source), {
    2: 'route-two',
  });
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(splitActivityData(input), result);
  const changed = splitActivityData(
    input.map((a) =>
      a.run_id === 1 ? { ...a, summary_polyline: 'changed' } : a
    )
  );
  assert.equal(changed.index.fileName, result.index.fileName);
  assert.notEqual(
    changed.routes['2026'].fileName,
    result.routes['2026'].fileName
  );
  assert.equal(changed.routes['2025'].fileName, result.routes['2025'].fileName);
  assert.notEqual(
    splitActivityData([{ ...activity, distance: 2000 }]).index.fileName,
    splitActivityData([activity]).index.fileName
  );
});

test('empty progressive data has no routes and invalid source still fails', async () => {
  const { splitActivityData } = await import('./activity-data');
  assert.deepEqual(JSON.parse(splitActivityData([]).index.source), []);
  assert.deepEqual(splitActivityData([]).routes, {});
  assert.throws(() => splitActivityData([{ ...activity, distance: -1 }]));
});
