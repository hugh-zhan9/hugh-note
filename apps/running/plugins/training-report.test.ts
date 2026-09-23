import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateTrainingReport, readTrainingConfig } from './training-report';
import { decryptTrainingReport } from '../src/utils/trainingCrypto';
import {
  parseTrainingAdvice,
  parsePrivateAdvice,
  parseTrainingReport,
} from '../src/utils/trainingReport';
import { projectActivities } from './activity-data';

const env = {
  RUNNING_AI_ENABLED: 'true',
  RUNNING_AI_BASE_URL: 'https://example.com/v1',
  RUNNING_AI_MODEL: 'test-model',
  RUNNING_AI_API_KEY: 'API-SECRET-MARKER',
  RUNNING_REPORT_PASSWORD: 'test-only-password-64^Ge',
  RUNNING_AI_PRIVATE_CONTEXT: 'PRIVATE-CONTEXT-MARKER',
};
const advice = {
  overview: '根据近期训练保持轻松有氧。',
  observations: ['最近有一次5公里跑步，先保持连续性。'],
  days: Array.from({ length: 7 }, (_, index) => ({
    day: index + 1,
    kind: index % 2 ? 'rest' : 'run',
    title: index % 2 ? '休息' : '轻松跑',
    minutes: index % 2 ? 0 : 20,
    intensity: '能够轻松交谈',
    purpose: '逐步建立训练习惯',
  })),
  adjustments: ['明显疲劳时休息。'],
  limitations: ['没有主观体感记录。'],
};
const privateAdvice = {
  sections: [{ heading: '私人目标', body: 'PRIVATE-RESPONSE-MARKER' }],
};
const activities = projectActivities([
  {
    run_id: 1,
    name: 'GPS-NAME-MARKER',
    type: 'Run',
    distance: 5000,
    moving_time: '0:30:00',
    average_speed: 2.7,
    start_date: '2026-09-22 08:00:00',
    start_date_local: '2026-09-22 16:00:00',
    elevation_gain: null,
    streak: 1,
    summary_polyline: 'GPS-MARKER',
    location_country: 'LOCATION-MARKER',
    average_heartrate: null,
  },
]);
const now = new Date('2026-09-23T01:00:00Z');
const response = (content: unknown, finish_reason = 'stop') =>
  Response.json({
    choices: [{ finish_reason, message: { content: JSON.stringify(content) } }],
  });

test('configured generation separates private requests and publishes only ciphertext', async () => {
  const requests: {
    url: string;
    init: NonNullable<Parameters<typeof fetch>[1]>;
  }[] = [];
  const report = await generateTrainingReport(activities, env, {
    now,
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init: init! });
      return response(requests.length === 1 ? advice : privateAdvice);
    },
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, 'https://example.com/v1/chat/completions');
  assert.equal(requests[0].init.redirect, 'error');
  assert.ok(requests[0].init.signal instanceof AbortSignal);
  const body = JSON.parse(String(requests[0].init.body));
  assert.equal(body.model, 'test-model');
  assert.equal(body.response_format.type, 'json_object');
  assert.equal(body.store, false);
  assert.equal(body.max_completion_tokens, 8000);
  assert.doesNotMatch(
    String(requests[0].init.body),
    /PRIVATE-|API-SECRET|GPS-|LOCATION-|test-only-password/
  );
  assert.match(String(requests[1].init.body), /PRIVATE-CONTEXT-MARKER/);
  assert.doesNotMatch(
    String(requests[1].init.body),
    /API-SECRET|GPS-|LOCATION-|test-only-password/
  );
  assert.equal(report.status, 'ready');
  if (report.status !== 'ready') throw new Error('Expected ready');
  assert.equal(report.planFrom, '2026-09-24');
  assert.equal(report.planThrough, '2026-09-30');
  assert.doesNotMatch(
    JSON.stringify(report),
    /PRIVATE-|API-SECRET|test-only-password|GPS-|LOCATION-/
  );
  assert.deepEqual(parseTrainingReport(report), report);
  assert.deepEqual(
    JSON.parse(
      await decryptTrainingReport(
        report.privateReport,
        env.RUNNING_REPORT_PASSWORD,
        report.reportId
      )
    ),
    privateAdvice
  );
});
test('disabled and no-recent-run states make no provider calls', async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error('Unexpected network call');
  };
  assert.equal(
    (await generateTrainingReport(activities, {}, { now, fetchImpl })).status,
    'disabled'
  );
  assert.equal(
    (await generateTrainingReport([], env, { now, fetchImpl })).status,
    'insufficient-data'
  );
});
test('enabled configuration fails closed before network without exposing values', () => {
  for (const key of Object.keys(env).filter(
    (name) => name !== 'RUNNING_AI_ENABLED'
  )) {
    assert.throws(() => readTrainingConfig({ ...env, [key]: '' }));
  }
  for (const base of [
    'http://example.com/v1',
    'https://user:password@example.com/v1',
    'https://example.com/v1?secret=value',
    'broken',
  ])
    assert.throws(
      () => readTrainingConfig({ ...env, RUNNING_AI_BASE_URL: base }),
      /RUNNING_AI_BASE_URL/
    );
  assert.throws(() =>
    readTrainingConfig({ ...env, RUNNING_REPORT_PASSWORD: '1234' })
  );
});
test('provider errors, truncation, refusal, invalid JSON and excessive output fail without secret logging or retry', async () => {
  const cases: (() => Response | Promise<Response>)[] = [
    () => new Response('PRIVATE-ERROR-DETAIL', { status: 401 }),
    () => new Response('PRIVATE-ERROR-DETAIL', { status: 429 }),
    () => response(advice, 'length'),
    () =>
      Response.json({
        choices: [
          {
            finish_reason: 'stop',
            message: { refusal: 'PRIVATE-REFUSAL', content: '{}' },
          },
        ],
      }),
    () =>
      Response.json({
        choices: [
          {
            finish_reason: 'stop',
            message: { content: 'PRIVATE-INVALID-JSON' },
          },
        ],
      }),
    () => new Response('x'.repeat(128001)),
    () => {
      throw new DOMException('PRIVATE-NETWORK-DETAIL', 'TimeoutError');
    },
  ];
  for (const makeResponse of cases) {
    let calls = 0;
    await assert.rejects(
      generateTrainingReport(activities, env, {
        now,
        fetchImpl: async () => {
          calls++;
          return makeResponse();
        },
      }),
      (error: Error) => {
        assert.match(error.message, /Training public generation failed/);
        assert.doesNotMatch(
          error.message,
          /PRIVATE-|API-SECRET|test-only-password/
        );
        return true;
      }
    );
    assert.equal(calls, 1);
  }
});
test('private failure never returns a partial public report', async () => {
  let calls = 0;
  await assert.rejects(
    generateTrainingReport(activities, env, {
      now,
      fetchImpl: async () =>
        ++calls === 1
          ? response(advice)
          : response({ extra: 'PRIVATE-CONTENT' }),
    }),
    /Training private response has invalid structure/
  );
  assert.equal(calls, 2);
});
test('model contracts reject unexpected fields, broken days and excessive training frequency', () => {
  assert.throws(() =>
    parseTrainingAdvice({
      ...advice,
      days: advice.days.map((day) => ({ ...day, kind: ['run'], minutes: 30 })),
    })
  );
  for (const value of [
    { ...advice, extra: 'data' },
    { ...advice, days: advice.days.slice(1) },
    { ...advice, days: advice.days.map((day) => ({ ...day, day: 1 })) },
    {
      ...advice,
      days: advice.days.map((day) => ({ ...day, kind: 'run', minutes: 30 })),
    },
    { ...advice, days: advice.days.map((day) => ({ ...day, minutes: 500 })) },
    { ...advice, overview: '' },
  ])
    assert.throws(() => parseTrainingAdvice(value));
  assert.throws(() =>
    parsePrivateAdvice({
      sections: [{ heading: 'h', body: 'b', script: 'alert(1)' }],
    })
  );
  assert.throws(() => parsePrivateAdvice({ sections: [] }));
});
