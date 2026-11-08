import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const allowed = (name) => typeof name === 'string' && !name.includes('..') && !name.includes('\\') &&
  /^(assets\/[^/]+|data\/(?:activity-index|routes-\d{4})\.[a-f0-9]+\.json)$/.test(name);

export async function preserveRunningAssets(current, previous) {
  const manifest = JSON.parse(await readFile(path.join(current, '.vite/manifest.json'), 'utf8'));
  const currentFiles = [...new Set(Object.values(manifest).flatMap((item) => [item.file, ...(item.css || []), ...(item.assets || [])]).filter(allowed))];
  // Hashed data is emitted by our plugin rather than referenced as Vite imports.
  const { readdir } = await import('node:fs/promises');
  for (const name of await readdir(path.join(current, 'data'))) {
    if (allowed('data/' + name)) currentFiles.push('data/' + name);
  }
  let previousFiles;
  try {
    previousFiles = JSON.parse(await readFile(path.join(previous, 'build-assets.json'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // First rollout: existing deployments have a Vite manifest, but no inventory.
    const old = JSON.parse(await readFile(path.join(previous, '.vite/manifest.json'), 'utf8'));
    previousFiles = Object.values(old).flatMap((item) => [item.file, ...(item.css || []), ...(item.assets || [])]).filter(allowed);
  }
  if (!Array.isArray(previousFiles) || !previousFiles.every(allowed)) throw new Error('Invalid previous running assets');
  for (const name of new Set(previousFiles)) {
    const destination = path.join(current, name);
    try { await access(destination); continue; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(previous, name), destination);
  }
  // Only this build's own files enter the inventory: retention is bounded to one generation.
  await writeFile(path.join(current, 'build-assets.json'), JSON.stringify([...new Set(currentFiles)].sort()));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  preserveRunningAssets(...process.argv.slice(2)).catch((error) => { console.error(error); process.exitCode = 1; });
}
