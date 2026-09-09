import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSite } from '../scripts/build.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'site-build-test-'));
  await mkdir(path.join(root, 'dist/site'), {recursive: true});
  await writeFile(path.join(root, 'dist/site/index.html'), 'previous valid site');
  return root;
}
const buildCommand = (failure) => async (_command, args) => {
  const isHugo = args.includes('--destination');
  const out = args[args.indexOf(isHugo ? '--destination' : '--outDir') + 1];
  await mkdir(out, {recursive: true});
  await writeFile(path.join(out, 'index.html'), isHugo ? 'blog' : 'running app');
  if (failure === (isHugo ? 'hugo' : 'vite')) throw new Error('injected build failure');
  if (!isHugo) {
    await mkdir(path.join(out, 'data'));
    await writeFile(path.join(out, 'data/activities.json'), JSON.stringify([{start_date_local: '2025-12-31'}, {start_date_local: '2026-01-01'}]));
    await writeFile(path.join(out, '404.html'), 'old running redirect');
  }
};
for (const failure of ['hugo', 'vite']) test(`${failure} failure leaves the published site intact`, async () => {
  const root = await fixture();
  try {
    await assert.rejects(buildSite({root, run: buildCommand(failure)}), /injected/);
    assert.equal(await readFile(path.join(root, 'dist/site/index.html'), 'utf8'), 'previous valid site');
    assert.deepEqual(await readdir(root), ['dist']);
  } finally { await rm(root, {recursive: true, force: true}); }
});
test('successful composition publishes both apps and direct summary entries together', async () => {
  const root = await fixture();
  try {
    await buildSite({root, run: buildCommand()});
    assert.equal(await readFile(path.join(root, 'dist/site/index.html'), 'utf8'), 'blog');
    for (const route of ['index.html', 'summary/index.html', 'summary/2025/index.html', 'summary/2026/index.html']) {
      assert.equal(await readFile(path.join(root, 'dist/site/running', route), 'utf8'), 'running app');
    }
    await assert.rejects(readFile(path.join(root, 'dist/site/running/404.html')), {code:'ENOENT'});
    assert.deepEqual(await readdir(root), ['dist']);
  } finally { await rm(root, {recursive: true, force: true}); }
});
