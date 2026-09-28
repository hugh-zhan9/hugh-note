import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repository = path.resolve(import.meta.dirname, '..');
const metadata = '---\ntitle: "2026-09-28"\ndraft: false\ndate: 2026-09-28T00:00:00+08:00\ndescription: "疯言疯语。"\ntags: [疯言疯语]\n---\n';
const body = '### 15:46\n\n第一条内容。\n\n<br />\n\n### 14:24\n\n第二条内容。\n';
const prefixes = ['', '\n\n\n', '\n<br />\n\n<br />\n\n', '\n \t\n<br>\n<br/>\n  <br /> \n\n'];

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'crazy-talk-test-'));
  for (const directory of ['tests', 'content/crazy-talk', 'layouts/crazy-talk', 'layouts/partials/homepage']) {
    await mkdir(path.join(root, directory), { recursive: true });
  }
  for (const file of ['tests/crazy_talk_section_test.sh', 'layouts/crazy-talk/list.html', 'layouts/partials/homepage/note-items.html']) {
    await copyFile(path.join(repository, file), path.join(root, file));
  }
  await writeFile(path.join(root, 'hugo.toml'), 'baseURL = "https://example.test/"\nbuildFuture = true\n[outputs]\nhome = ["JSON"]\n[[menus.main]]\nname = "疯言疯语"\nurl = "/crazy-talk/"\n');
  await writeFile(path.join(root, 'content/crazy-talk/_index.md'), '---\ntitle: "疯言疯语"\n---\n');
  await writeFile(path.join(root, 'layouts/index.json'), '{{ partial "homepage/note-items.html" . | jsonify | safeJS }}');
  return {
    root,
    write: (content) => writeFile(path.join(root, 'content/crazy-talk/2026-09-28.md'), metadata + content),
    clean: () => rm(root, { recursive: true, force: true }),
  };
}

test('crazy-talk allows leading blank lines and breaks but retains heading and body rules', async () => {
  const f = await fixture();
  try {
    for (const prefix of prefixes) {
      await f.write(prefix + body);
      const result = spawnSync('bash', ['tests/crazy_talk_section_test.sh'], { cwd: f.root, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    for (const content of [
      '\n<br />\n\n',
      '\n前言不是空行。\n' + body,
      body.replace('### 15:46', '## 15:46'),
      body.replace('### 14:24', '## 14:24'),
      body.replace('### 14:24', '### 16:00'),
      body.replace('第一条内容。\n', '第一条内容。\n\n'),
    ]) {
      await f.write(content);
      const result = spawnSync('bash', ['tests/crazy_talk_section_test.sh'], { cwd: f.root, encoding: 'utf8' });
      assert.equal(result.status, 1, content);
    }
  } finally { await f.clean(); }
});

test('Hugo ignores leading spacing without changing note text, timestamps or order', async () => {
  const f = await fixture();
  try {
    for (const prefix of prefixes) {
      await f.write(prefix + body);
      const result = spawnSync(process.env.HUGO_BIN || 'hugo', ['--quiet'], { cwd: f.root, encoding: 'utf8' });
      assert.equal(result.status, 0, result.error?.message || result.stderr);
      const notes = JSON.parse(await readFile(path.join(f.root, 'public/index.json'), 'utf8'));
      assert.deepEqual(notes.map(({ title, text, date }) => ({ title, text, date })), [
        { title: '2026-09-28 15:46', text: '第一条内容。', date: '2026-09-28' },
        { title: '2026-09-28 14:24', text: '第二条内容。', date: '2026-09-28' },
      ]);
    }
  } finally { await f.clean(); }
});
