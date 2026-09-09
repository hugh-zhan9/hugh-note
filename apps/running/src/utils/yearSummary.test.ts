import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildYearSummary,
  getDefaultYearSummaryYear,
  getLatestSummaryYear,
  getSummaryYears,
  type SummaryActivity,
} from './yearSummary';

const createActivity = (
  overrides: Partial<SummaryActivity>
): SummaryActivity => ({
  run_id: overrides.run_id ?? Math.floor(Math.random() * 100000),
  name: overrides.name ?? 'Run',
  type: overrides.type ?? 'Run',
  subtype: overrides.subtype ?? 'Run',
  start_date: overrides.start_date ?? '2025-01-01 00:00:00',
  start_date_local: overrides.start_date_local ?? '2025-01-01 08:00:00',
  distance: overrides.distance ?? 5000,
  moving_time: overrides.moving_time ?? '0:30:00',
  average_speed: overrides.average_speed ?? 2.7777777778,
  elevation_gain: overrides.elevation_gain ?? 0,
  streak: overrides.streak ?? 1,
});

test('getSummaryYears returns sorted years with running activities only', () => {
  const years = getSummaryYears([
    createActivity({ run_id: 1, start_date_local: '2024-04-01 08:00:00' }),
    createActivity({
      run_id: 2,
      type: 'Walk',
      subtype: 'Walk',
      start_date_local: '2026-04-01 08:00:00',
    }),
    createActivity({ run_id: 3, start_date_local: '2025-04-01 08:00:00' }),
    createActivity({
      run_id: 4,
      type: 'VirtualRun',
      subtype: 'VirtualRun',
      start_date_local: '2026-04-01 08:00:00',
    }),
  ]);

  assert.deepEqual(years, ['2024', '2025', '2026']);
  assert.equal(getLatestSummaryYear(years), '2026');
  assert.equal(
    getDefaultYearSummaryYear(years, new Date('2026-04-07T00:00:00')),
    '2025'
  );
  assert.equal(
    getDefaultYearSummaryYear(
      ['2022', '2024'],
      new Date('2026-04-07T00:00:00')
    ),
    '2024'
  );
});

test('buildYearSummary aggregates yearly metrics and day totals', () => {
  const summary = buildYearSummary('2025', [
    createActivity({
      run_id: 1,
      start_date_local: '2025-01-01 06:30:00',
      distance: 5000,
      moving_time: '0:30:00',
      average_speed: 2.7777777778,
    }),
    createActivity({
      run_id: 2,
      start_date_local: '2025-01-02 19:15:00',
      distance: 10000,
      moving_time: '1:00:00',
      average_speed: 2.7777777778,
    }),
    createActivity({
      run_id: 3,
      start_date_local: '2025-01-02 21:00:00',
      distance: 3000,
      moving_time: '0:18:00',
      average_speed: 2.7777777778,
    }),
    createActivity({
      run_id: 4,
      start_date_local: '2025-01-04 08:00:00',
      distance: 5000,
      moving_time: '0:31:00',
      average_speed: 2.688172043,
    }),
    createActivity({
      run_id: 5,
      type: 'Walk',
      subtype: 'Walk',
      start_date_local: '2025-01-05 08:00:00',
      distance: 8000,
      moving_time: '1:20:00',
      average_speed: 1.6666666667,
    }),
  ]);

  assert.ok(summary);
  assert.equal(summary.year, '2025');
  assert.equal(summary.totalRuns, 4);
  assert.equal(summary.totalDistanceKm, 23);
  assert.equal(summary.runningDays, 3);
  assert.equal(summary.totalMovingTimeSeconds, 8340);
  assert.equal(summary.averageDistanceKm, 5.8);
  assert.equal(summary.averagePaceSeconds, 363);
  assert.equal(summary.longestRun.distanceKm, 10);
  assert.equal(summary.longestRun.dateLabel, '1月2日');
  assert.equal(summary.longestDuration.durationSeconds, 3600);
  assert.equal(summary.longestStreakDays, 2);
  assert.equal(summary.mostFrequentDistanceBucket.label, '5K');
  assert.equal(summary.mostFrequentDistanceBucket.count, 2);
  assert.equal(summary.dailyTotals.get('2025-01-02')?.distanceKm, 13);
  assert.equal(summary.startTimePoints.length, 4);
});

test('buildYearSummary creates weekly and monthly grids with zero-fill', () => {
  const summary = buildYearSummary('2025', [
    createActivity({
      run_id: 1,
      start_date_local: '2025-01-01 06:30:00',
      distance: 5000,
      moving_time: '0:30:00',
    }),
    createActivity({
      run_id: 2,
      start_date_local: '2025-02-01 08:00:00',
      distance: 7000,
      moving_time: '0:40:00',
    }),
    createActivity({
      run_id: 3,
      start_date_local: '2025-12-31 21:00:00',
      distance: 10000,
      moving_time: '1:10:00',
    }),
  ]);

  assert.ok(summary);
  assert.equal(summary.weeklyTotals.length, 53);
  assert.equal(summary.monthlyDayColumns.length, 12);
  assert.equal(summary.monthlyDayColumns[0].days.length, 31);
  assert.equal(summary.monthlyDayColumns[1].days.length, 28);
  assert.equal(summary.monthlyDayColumns[0].days[0].distanceKm, 5);
  assert.equal(summary.monthlyDayColumns[0].days[1].distanceKm, 0);
  assert.equal(summary.monthlyDayColumns[1].days[0].distanceKm, 7);
  assert.equal(summary.monthlyDayColumns[11].days[30].distanceKm, 10);
});

test('buildYearSummary returns null for years without running data', () => {
  const summary = buildYearSummary('2025', [
    createActivity({
      run_id: 1,
      type: 'Walk',
      subtype: 'Walk',
      start_date_local: '2025-01-01 08:00:00',
    }),
  ]);

  assert.equal(summary, null);
});

test('annual summary navigation prefers the last completed year', () => {
  const now = new Date('2026-09-09T00:00:00Z');
  assert.equal(
    getDefaultYearSummaryYear(['2024', '2025', '2026'], now),
    '2025'
  );
  assert.equal(
    getDefaultYearSummaryYear(['2023', '2024', '2026'], now),
    '2024'
  );
  assert.equal(getDefaultYearSummaryYear(['2026'], now), '2026');
  assert.equal(getDefaultYearSummaryYear([], now), null);
});
