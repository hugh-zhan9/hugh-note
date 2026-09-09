import { mkdtemp, mkdir, rename, rm, readFile, writeFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}

export async function buildSite({ root = siteRoot, run = runCommand } = {}) {
  const lock = path.join(root, '.site-build.lock');
  await mkdir(lock); // A second build must not replace the first build's output.
  let stage;
  try {
    stage = await mkdtemp(path.join(root, '.site-build-'));
    const output = path.join(stage, 'public');
    const args = ['--minify', '--destination', output];
    if (process.env.SITE_BASE_URL) args.push('--baseURL', process.env.SITE_BASE_URL);
    await run(process.env.HUGO_BIN || 'hugo', args, root);
    await run(process.env.PNPM_BIN || 'pnpm', ['exec', 'vite', 'build', '--outDir', path.join(output, 'running')], path.join(root, 'apps/running'));
    const activities = JSON.parse(await readFile(path.join(output, 'running/data/activities.json'), 'utf8'));
    if (!Array.isArray(activities)) throw new Error('Missing valid running data export');
    const index = await readFile(path.join(output, 'running/index.html'), 'utf8');
    const years = new Set(activities.map(activity => activity.start_date_local.slice(0, 4)));
    for (const route of ['summary', ...[...years].filter(year => /^\d{4}$/.test(year)).map(year => `summary/${year}`)]) {
      await mkdir(path.join(output, 'running', route), { recursive: true });
      await writeFile(path.join(output, 'running', route, 'index.html'), index);
    }
    // The Hugo root owns 404 routing for both applications.
    await rm(path.join(output, 'running/404.html'), { force: true });
    await writeFile(path.join(output, '.nojekyll'), '');
    const current = path.join(root, 'dist/site');
    await mkdir(path.dirname(current), { recursive: true });
    const previous = path.join(stage, 'previous');
    let exists = false;
    try { await access(current); exists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (exists) await rename(current, previous);
    try { await rename(output, current); }
    catch (error) { if (exists) await rename(previous, current); throw error; }
    console.log(`Combined site: ${current}`);
  } finally {
    if (stage) await rm(stage, { recursive: true, force: true });
    await rm(lock, { recursive: true, force: true });
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildSite().catch(error => { console.error(error.message); process.exitCode = 1; });
}
