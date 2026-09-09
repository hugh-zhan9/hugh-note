import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dashboardActivities } from '../themes/dashboard/utils/activities';
import { projectActivities } from '../../plugins/activity-data';
import type { Activity } from '../core/types';
const activity = {
  run_id: 1,
  name: 'Morning',
  type: 'VirtualRun',
  start_date: '2026-03-01',
  start_date_local: '2026-03-01',
  distance: 5000,
  moving_time: '00:25:00',
  average_speed: 3,
  elevation_gain: null,
  streak: 1,
  summary_polyline: 'a'.repeat(25),
} as Activity;
test('canonical export retains Dashboard run filters and personal best eligibility', () => {
  const projected = projectActivities([
    activity,
    { ...activity, run_id: 2, type: 'Ride' },
  ]);
  const snapshot = JSON.stringify(projected);
  const dashboard = dashboardActivities(projected);
  assert.equal(dashboard.filter((a) => a.type === 'Run').length, 1);
  assert.equal(
    dashboard.filter(
      (a) =>
        a.type === 'Run' && a.summary_polyline && a.summary_polyline.length > 20
    ).length,
    1
  );
  assert.equal(dashboard[1].type, 'Ride');
  assert.equal(JSON.stringify(projected), snapshot);
});
