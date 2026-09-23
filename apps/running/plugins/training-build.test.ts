import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { build, loadConfigFromFile } from 'vite';
import { trainingReportPlugin } from './training-report';
import { decryptTrainingReport } from '../src/utils/trainingCrypto';
import { trainingDate } from '../src/utils/trainingSummary';

test('production bundles contain ciphertext but no API key, password, private context or plaintext', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'training-build-'));
  const secrets = {
    RUNNING_AI_ENABLED: 'true',
    RUNNING_AI_BASE_URL: 'https://training-build.example/v1',
    RUNNING_AI_MODEL: 'test-build-model',
    RUNNING_AI_API_KEY: 'BUILD-API-SECRET-MARKER',
    RUNNING_REPORT_PASSWORD: 'BUILD-PASSWORD-MARKER-9^kh',
    RUNNING_AI_PRIVATE_CONTEXT: 'BUILD-PRIVATE-CONTEXT-MARKER',
  };
  const previous = Object.fromEntries(
    Object.keys(secrets).map((key) => [key, process.env[key]])
  );
  const originalFetch = globalThis.fetch;
  const privateMarker = 'BUILD-PRIVATE-PLAINTEXT-MARKER';
  let calls = 0;
  try {
    Object.assign(process.env, secrets);
    globalThis.fetch = async (url) => {
      assert.equal(
        String(url),
        'https://training-build.example/v1/chat/completions'
      );
      const content =
        ++calls === 1
          ? {
              overview: '测试公开分析',
              observations: ['最近跑步5公里。'],
              days: Array.from({ length: 7 }, (_, i) => ({
                day: i + 1,
                kind: i % 2 ? 'rest' : 'run',
                title: '训练安排',
                minutes: i % 2 ? 0 : 20,
                intensity: '轻松',
                purpose: '有氧基础',
              })),
              adjustments: ['按体感调整。'],
              limitations: ['缺少心率记录。'],
            }
          : { sections: [{ heading: '私人观察', body: privateMarker }] };
      return Response.json({
        choices: [
          {
            finish_reason: 'stop',
            message: { content: JSON.stringify(content) },
          },
        ],
      });
    };
    const source = path.join(temp, 'activities.json');
    await writeFile(
      source,
      JSON.stringify([
        {
          run_id: 1,
          name: 'test',
          type: 'Run',
          start_date: `${trainingDate()} 00:00:00`,
          start_date_local: `${trainingDate()} 08:00:00`,
          moving_time: '0:30:00',
          distance: 5000,
          average_speed: 2.7,
          elevation_gain: null,
          streak: 1,
        },
      ])
    );
    const outDir = path.join(temp, 'site');
    const loaded = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      path.resolve(import.meta.dirname, '../vite.config.ts')
    );
    assert.ok(loaded);
    const config = loaded.config;
    await build({
      ...config,
      configFile: false,
      root: path.resolve(import.meta.dirname, '..'),
      logLevel: 'silent',
      plugins: config.plugins!.map((plugin) =>
        plugin &&
        typeof plugin === 'object' &&
        'name' in plugin &&
        plugin.name === 'running-training-report'
          ? trainingReportPlugin(source)
          : plugin
      ),
      build: { ...config.build, outDir },
    });
    assert.equal(calls, 2);
    const report = JSON.parse(
      await readFile(path.join(outDir, 'data/training.json'), 'utf8')
    );
    assert.equal(report.status, 'ready');
    const plaintext = await decryptTrainingReport(
      report.privateReport,
      secrets.RUNNING_REPORT_PASSWORD,
      report.reportId
    );
    assert.match(plaintext, new RegExp(privateMarker));
    const files = await readdir(outDir, {
      recursive: true,
      withFileTypes: true,
    });
    const markers = [
      secrets.RUNNING_AI_API_KEY,
      secrets.RUNNING_REPORT_PASSWORD,
      secrets.RUNNING_AI_PRIVATE_CONTEXT,
      privateMarker,
    ];
    for (const file of files.filter((file) => file.isFile())) {
      const bytes = await readFile(path.join(file.parentPath, file.name));
      for (const marker of markers)
        assert.equal(
          bytes.includes(Buffer.from(marker)),
          false,
          `Secret leaked in ${file.name}`
        );
    }
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(temp, { recursive: true, force: true });
  }
});
