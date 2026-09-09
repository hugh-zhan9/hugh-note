import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyActivityPresentationRules,
  filterActivitiesByTypes,
  getAvailableActivityTypes,
  getActivityLabel,
  normalizeActivityType,
  sanitizeSelectedActivityTypes,
  shouldReplayMapAnimation,
  shouldUseRunTitles,
  toggleActivityTypeSelection,
} from './activity';

test('normalizeActivityType keeps walking distinct from running', () => {
  assert.equal(normalizeActivityType('Walk'), 'walking');
  assert.equal(normalizeActivityType('walking'), 'walking');
  assert.equal(normalizeActivityType('Run'), 'running');
  assert.equal(normalizeActivityType('Hiking'), 'hiking');
  assert.equal(normalizeActivityType('VirtualRun'), 'running');
});

test('walking activities do not use run-only titles', () => {
  assert.equal(shouldUseRunTitles('Walk'), false);
  assert.equal(getActivityLabel('Walk', '步行', '跑步'), '步行');
});

test('presentation rules convert the target walk into a morning run', () => {
  const [activity] = applyActivityPresentationRules([
    {
      run_id: 1,
      name: 'Walk from keep',
      distance: 5000,
      moving_time: '0:33:24',
      type: 'Walk',
      subtype: 'Walk',
      start_date: '2026-03-13 00:13:15',
      start_date_local: '2026-03-13 08:13:15',
      average_speed: 2.4,
      elevation_gain: 0,
      streak: 1,
    },
  ]);

  assert.equal(activity.type, 'Run');
  assert.equal(activity.subtype, 'Run');
  assert.equal(activity.name, '清晨跑步');
});

test('presentation rules keep non-target activities for later filtering', () => {
  const activities = applyActivityPresentationRules([
    {
      run_id: 1,
      name: 'Walk from keep',
      distance: 5000,
      moving_time: '0:33:24',
      type: 'Walk',
      subtype: 'Walk',
      start_date: '2026-03-13 00:13:15',
      start_date_local: '2026-03-13 08:13:15',
      average_speed: 2.4,
      elevation_gain: 0,
      streak: 1,
    },
    {
      run_id: 2,
      name: '晨间行走',
      distance: 1300,
      moving_time: '0:18:12',
      type: 'Walk',
      subtype: 'Walk',
      start_date: '2023-07-03 00:34:40',
      start_date_local: '2023-07-03 08:34:40',
      average_speed: 1.2,
      elevation_gain: 0,
      streak: 1,
    },
  ]);

  assert.equal(activities.length, 2);
  assert.equal(activities[0].name, '清晨跑步');
  assert.equal(activities[1].type, 'Walk');
});

test('filterActivitiesByTypes keeps only selected normalized activity types', () => {
  const activities = filterActivitiesByTypes(
    applyActivityPresentationRules([
      {
        run_id: 1,
        name: 'Walk from keep',
        distance: 5000,
        moving_time: '0:33:24',
        type: 'Walk',
        subtype: 'Walk',
        start_date: '2026-03-13 00:13:15',
        start_date_local: '2026-03-13 08:13:15',
        average_speed: 2.4,
        elevation_gain: 0,
        streak: 1,
      },
      {
        run_id: 2,
        name: '晚间骑行',
        distance: 8000,
        moving_time: '0:20:00',
        type: 'Ride',
        subtype: 'Ride',
        start_date: '2026-03-13 12:00:00',
        start_date_local: '2026-03-13 20:00:00',
        average_speed: 24,
        elevation_gain: 10,
        streak: 1,
      },
      {
        run_id: 3,
        name: '公园慢走',
        distance: 1000,
        moving_time: '0:15:00',
        type: 'Walk',
        subtype: 'Walk',
        start_date: '2026-03-14 01:00:00',
        start_date_local: '2026-03-14 09:00:00',
        average_speed: 1.1,
        elevation_gain: 0,
        streak: 1,
      },
    ]),
    ['running']
  );

  assert.deepEqual(
    activities.map((activity) => activity.name),
    ['清晨跑步']
  );
});

test('getAvailableActivityTypes returns normalized unique types from presented activities', () => {
  const activityTypes = getAvailableActivityTypes(
    applyActivityPresentationRules([
      {
        run_id: 1,
        name: 'Walk from keep',
        distance: 5000,
        moving_time: '0:33:24',
        type: 'Walk',
        subtype: 'Walk',
        start_date: '2026-03-13 00:13:15',
        start_date_local: '2026-03-13 08:13:15',
        average_speed: 2.4,
        elevation_gain: 0,
        streak: 1,
      },
      {
        run_id: 2,
        name: '晚间骑行',
        distance: 8000,
        moving_time: '0:20:00',
        type: 'Ride',
        subtype: 'Ride',
        start_date: '2026-03-13 12:00:00',
        start_date_local: '2026-03-13 20:00:00',
        average_speed: 24,
        elevation_gain: 10,
        streak: 1,
      },
    ])
  );

  assert.deepEqual(activityTypes, ['running', 'cycling']);
});

test('available activity types include normalized hiking and virtual running data', () => {
  const activityTypes = getAvailableActivityTypes([
    {
      run_id: 1,
      name: 'Hiking from keep',
      distance: 9700,
      moving_time: '2:10:00',
      type: 'Hiking',
      subtype: 'Hiking',
      start_date: '2023-11-25 02:50:56',
      start_date_local: '2023-11-25 10:50:56',
      average_speed: 1.2,
      elevation_gain: 100,
      streak: 1,
    },
    {
      run_id: 2,
      name: 'VirtualRun from keep',
      distance: 100,
      moving_time: '0:01:00',
      type: 'VirtualRun',
      subtype: 'VirtualRun',
      start_date: '2024-04-08 13:03:02',
      start_date_local: '2024-04-08 21:03:02',
      average_speed: 1.6,
      elevation_gain: 0,
      streak: 1,
    },
  ]);

  assert.deepEqual(activityTypes, ['running', 'hiking']);
});

test('toggleActivityTypeSelection keeps at least one type selected', () => {
  assert.deepEqual(toggleActivityTypeSelection(['running'], 'running'), [
    'running',
  ]);
  assert.deepEqual(toggleActivityTypeSelection(['running'], 'cycling'), [
    'running',
    'cycling',
  ]);
});

test('sanitizeSelectedActivityTypes always keeps running when available', () => {
  assert.deepEqual(
    sanitizeSelectedActivityTypes(['walking'], ['running', 'walking']),
    ['running', 'walking']
  );
  assert.deepEqual(
    sanitizeSelectedActivityTypes(
      ['cycling', 'running'],
      ['running', 'cycling', 'walking']
    ),
    ['running', 'cycling']
  );
});

test('shouldReplayMapAnimation skips replay when only activity types changed', () => {
  assert.equal(
    shouldReplayMapAnimation({
      previousSelectedTypesKey: 'running',
      nextSelectedTypesKey: 'running-walking',
      isSingleRunMode: false,
    }),
    false
  );
  assert.equal(
    shouldReplayMapAnimation({
      previousSelectedTypesKey: 'running',
      nextSelectedTypesKey: 'running',
      isSingleRunMode: false,
    }),
    true
  );
});
