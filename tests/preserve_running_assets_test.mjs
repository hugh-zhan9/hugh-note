import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { preserveRunningAssets } from '../scripts/preserve-running-assets.mjs';

test('retain exactly the previous build assets, leaving current files and HTML intact', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'running-retain-'));
  const current = path.join(root, 'new'), previous = path.join(root, 'old');
  const put = async (base, file, value) => { await mkdir(path.dirname(path.join(base, file)), { recursive: true }); await writeFile(path.join(base, file), value); };
  try {
    await put(current, '.vite/manifest.json', JSON.stringify({ main: { file: 'assets/current.js', css: ['assets/shared.css'] } }));
    await put(current, 'assets/current.js', 'new');
    await put(current, 'assets/shared.css', 'new-css');
    await put(current, 'data/activity-index.abc.json', 'new-data');
    await put(current, 'index.html', 'new-html');
    await put(previous, 'build-assets.json', JSON.stringify(['assets/previous.js', 'assets/shared.css', 'data/routes-2026.def.json']));
    await put(previous, 'assets/previous.js', 'previous');
    await put(previous, 'assets/ancient.js', 'ancient');
    await put(previous, 'assets/shared.css', 'old-css');
    await put(previous, 'data/routes-2026.def.json', 'previous-routes');
    await preserveRunningAssets(current, previous);
    assert.equal(await readFile(path.join(current, 'assets/previous.js'), 'utf8'), 'previous');
    assert.equal(await readFile(path.join(current, 'data/routes-2026.def.json'), 'utf8'), 'previous-routes');
    assert.equal(await readFile(path.join(current, 'assets/shared.css'), 'utf8'), 'new-css');
    assert.equal(await readFile(path.join(current, 'index.html'), 'utf8'), 'new-html');
    assert.deepEqual(JSON.parse(await readFile(path.join(current, 'build-assets.json'), 'utf8')), ['assets/current.js', 'assets/shared.css', 'data/activity-index.abc.json']);
    await assert.rejects(readFile(path.join(current, 'assets/ancient.js')), { code: 'ENOENT' });
    await put(previous, 'build-assets.json', JSON.stringify(['../index.html']));
    await assert.rejects(preserveRunningAssets(current, previous), /Invalid previous/);
    await rm(path.join(previous, 'build-assets.json'));
    await put(previous, '.vite/manifest.json', JSON.stringify({ main: { file: 'assets/previous.js' } }));
    await preserveRunningAssets(current, previous);
    await put(previous, 'build-assets.json', JSON.stringify(['assets/missing.js']));
    await assert.rejects(preserveRunningAssets(current, previous), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
