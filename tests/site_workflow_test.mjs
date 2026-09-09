import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,writeFile,chmod,mkdir,rm,copyFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {tmpdir} from 'node:os';
const repository = path.resolve(import.meta.dirname, '..');
async function fixture() {
  const root=await mkdtemp(path.join(tmpdir(),'site-workflow-test-'));
  await mkdir(path.join(root,'bin')); await mkdir(path.join(root,'scripts'));
  await mkdir(path.join(root,'apps/running/assets'),{recursive:true});
  for(const file of ['sync-running.sh','save-running-data.sh','check-publish-head.sh']) await copyFile(path.join(repository,'scripts',file),path.join(root,'scripts',file));
  return root;
}
async function executable(root,name,script) {
  const p=path.join(root,'bin',name);await writeFile(p,'#!/usr/bin/env bash\nset -eu\n'+script);await chmod(p,0o755);
}
function run(root,script,env={}) {
  return spawnSync('bash',[path.join(root,'scripts',script)],{cwd:root,encoding:'utf8',env:{...process.env,PATH:path.join(root,'bin')+':'+process.env.PATH,...env}});
}
test('publish gate distinguishes current, superseded and unavailable main',async()=>{
  const root=await fixture();
  try {
    await executable(root,'git','if [[ "$1" == rev-parse ]]; then echo abc; else echo "${REMOTE_HEAD} refs/heads/main"; exit "${REMOTE_STATUS:-0}"; fi\n');
    assert.match(run(root,'check-publish-head.sh',{REMOTE_HEAD:'abc'}).stdout,/current=true/);
    assert.match(run(root,'check-publish-head.sh',{REMOTE_HEAD:'def'}).stdout,/current=false/);
    const failure=run(root,'check-publish-head.sh',{REMOTE_HEAD:'abc',REMOTE_STATUS:'1'});
    assert.notEqual(failure.status,0); assert.doesNotMatch(failure.stdout,/current=true/);
  } finally {await rm(root,{recursive:true,force:true});}
});
test('failed Keep sync stops before data commit or output generation',async()=>{
  const root=await fixture();
  try {
    await executable(root,'python','echo called >> "$CALL_LOG"\nexit 1\n');
    await executable(root,'git','echo unexpected-git >> "$CALL_LOG"\nexit 0\n');
    const log=path.join(root,'calls');
    const result=run(root,'sync-running.sh',{KEEP_MOBILE:'test',KEEP_PASSWORD:'test',CALL_LOG:log});
    assert.notEqual(result.status,0);assert.equal(await readFile(log,'utf8'),'called\n');
  } finally {await rm(root,{recursive:true,force:true});}
});
test('push conflict fails and emits no commit for a dependent publisher',async()=>{
  const root=await fixture();
  try {
    await executable(root,'git',`printf '%s\\n' "$*" >> "$CALL_LOG"
case "$1" in
 branch) echo main;;
 diff) if [[ -e "$DIFF_CALLED" ]]; then exit 1; else touch "$DIFF_CALLED"; fi;;
 push) exit 1;;
 rev-parse) echo abc;;
esac
`);
    const log=path.join(root,'calls'),output=path.join(root,'output');
    await writeFile(output,'');
    const result=run(root,'save-running-data.sh',{CALL_LOG:log,DIFF_CALLED:path.join(root,'diff'),GITHUB_OUTPUT:output});
    assert.notEqual(result.status,0);
    const calls=await readFile(log,'utf8');assert.match(calls,/commit -m Update running data/);assert.match(calls,/push origin HEAD:main/);
    assert.equal(await readFile(output,'utf8'),'');assert.doesNotMatch(calls,/add \.|rev-parse/);
  } finally {await rm(root,{recursive:true,force:true});}
});
test('all publishers use the serialized workflow and its current-main gate',async()=>{
  const deploy=await readFile(path.join(repository,'.github/workflows/depoly.yml'),'utf8');
  const sync=await readFile(path.join(repository,'.github/workflows/running-sync.yml'),'utf8');
  assert.match(deploy,/group: site-publish\n  cancel-in-progress: false/);
  assert.match(deploy,/needs: python-tests/);
  assert.match(deploy,/VITE_MAPBOX_TOKEN: \$\{\{ secrets.MAPBOX_TOKEN \}\}/);
  assert.equal(deploy.match(/ref: \$\{\{ inputs.ref \|\| github.sha \}\}/g).length, 2);
  assert.match(deploy,/if: steps\.head\.outputs\.current == 'true'/);
  assert.match(deploy,/bash scripts\/check-publish-head\.sh >> "\$GITHUB_OUTPUT"/);
  assert.match(sync,/needs: sync\n    uses: \.\/\.github\/workflows\/depoly.yml/);
  assert.match(sync,/vars.RUNNING_SYNC_ENABLED == 'true'/);
  assert.doesNotMatch(sync,/continue-on-error|actions-gh-pages|actions\/deploy-pages/);
});
