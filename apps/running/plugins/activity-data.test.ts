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
