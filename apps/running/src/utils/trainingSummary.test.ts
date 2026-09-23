import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Activity } from '../core/types';
import {
  buildTrainingSummary,
  shiftTrainingDate,
  trainingDate,
} from './trainingSummary';

export const run = (
  date: string,
  overrides: Partial<Activity> = {}
): Activity => ({
  run_id: 1,
  name: 'sensitive activity name',
  type: 'Run',
  start_date: `${date} 08:00:00`,
  start_date_local: `${date} 16:00:00`,
  distance: 5000,
  moving_time: '0:30:00',
  average_speed: 2.7,
  average_heartrate: null,
  elevation_gain: null,
  streak: 1,
  location_country: 'sensitive location',
  summary_polyline: 'sensitive GPS',
  source: 'test',
  ...overrides,
});

test('training dates use Shanghai and real calendar windows across year and leap boundaries', () => {
  assert.equal(trainingDate(new Date('2026-09-22T16:30:00Z')), '2026-09-23');
  assert.equal(shiftTrainingDate('2024-03-01', -1), '2024-02-29');
  assert.equal(shiftTrainingDate('2026-01-01', -1), '2025-12-31');
  assert.throws(() => shiftTrainingDate('2026-02-30', 0));
});
test('training windows isolate running, boundary dates and identity fields', () => {
  const activities = [
    run('2026-09-23'),
    run('2026-08-27', { type: 'VirtualRun' }),
    run('2026-08-26'),
    run('2026-07-30'),
    run('2026-07-29'),
    run('2026-09-24'),
    run('2026-09-22', { type: 'Walk', distance: 50000 }),
    run('2026-09-22', { type: 'Ride' }),
  ];
  const original = JSON.stringify(activities);
  const summary = buildTrainingSummary(activities, '2026-09-23');
  assert.equal(summary.current.runs, 2);
  assert.equal(summary.previous.runs, 2);
  assert.equal(summary.current.distanceKm, 10);
  assert.equal(
    summary.weeks.reduce((total, week) => total + week.runs, 0),
    4
  );
  assert.equal(summary.recentRuns.length, 4);
  assert.equal(summary.latestRunDate, '2026-09-23');
  assert.equal(summary.distanceChangePercent, 0);
  assert.doesNotMatch(
    JSON.stringify(summary),
    /sensitive|run_id|polyline|source|location/
  );
  assert.equal(JSON.stringify(activities), original);
});
test('pace and heart rate use duration/distance weights, missing heart rate stays missing', () => {
  const summary = buildTrainingSummary(
    [
      run('2026-09-22', {
        distance: 10000,
        moving_time: '1:00:00',
        average_heartrate: 150,
      }),
      run('2026-09-22', {
        distance: 2000,
        moving_time: '0:10:00',
        average_heartrate: 120,
      }),
      run('2026-09-23', { average_heartrate: 0 }),
    ],
    '2026-09-23'
  );
  assert.equal(summary.current.runningDays, 2);
  assert.equal(summary.current.paceSecondsPerKm, 353);
  assert.equal(summary.current.averageHeartRate, 146);
  assert.equal(summary.current.heartRateRuns, 2);
  assert.equal(summary.current.longestRunKm, 10);
  assert.equal(summary.distanceChangePercent, null);
});
test('empty, single and zero-duration/distance data do not produce nonfinite metrics', () => {
  const empty = buildTrainingSummary([], '2026-09-23');
  assert.equal(empty.current.paceSecondsPerKm, null);
  assert.equal(empty.current.averageHeartRate, null);
  assert.equal(empty.latestRunDate, null);
  assert.equal(empty.weeks.length, 8);
  const summary = buildTrainingSummary(
    [
      run('2026-09-23'),
      run('2026-09-23', { distance: 0 }),
      run('2026-09-23', { moving_time: '0:00:00' }),
    ],
    '2026-09-23'
  );
  assert.equal(summary.current.runs, 1);
  assert.equal(summary.excludedRuns, 2);
  assert.equal(summary.current.paceSecondsPerKm, 360);
  assert.equal(summary.current.averageHeartRate, null);
});
