const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const base = process.env.SITE_TEST_URL || 'http://127.0.0.1:1313';
const password = 'browser-test-only-password-F4!z';
const marker = 'PRIVATE-BROWSER-TEST-CONTENT';
// Exercise the actual generator/encryptor, then decrypt with the real browser implementation.
const fixture = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
import {generateTrainingReport} from './plugins/training-report.ts';
import {projectActivities} from './plugins/activity-data.ts';
import {trainingDate,shiftTrainingDate} from './src/utils/trainingSummary.ts';
const advice = {overview:'训练以轻松有氧为主，逐步建立半马基础。',observations:['近28天跑步5公里。'],days:Array.from({length:7},(_,i)=>({day:i+1,kind:i%2?'rest':'run',title:i%2?'休息':'轻松跑',minutes:i%2?0:20,intensity:'能够轻松交谈',purpose:'保持训练连续性'})),adjustments:['明显疲劳时休息。'],limitations:['缺少主观体感和完整心率记录。']};
const env={RUNNING_AI_ENABLED:'true',RUNNING_AI_BASE_URL:'https://example.com/v1',RUNNING_AI_MODEL:'test-model',RUNNING_AI_API_KEY:'test-api-secret',RUNNING_REPORT_PASSWORD:${JSON.stringify(password)},RUNNING_AI_PRIVATE_CONTEXT:'PRIVATE-BROWSER-CONTEXT'};
const activities=projectActivities([{run_id:1,name:'test',type:'Run',distance:5000,moving_time:'0:30:00',average_speed:2.7,start_date:trainingDate()+' 00:00:00',start_date_local:trainingDate()+' 08:00:00',elevation_gain:null,streak:1,average_heartrate:null}]);
async function generate(now) {
 let count=0;
 return generateTrainingReport(activities,env,{now,fetchImpl:async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(++count===1?advice:{sections:[{heading:'私人观察',body:${JSON.stringify(marker + ' <img src=x onerror=alert(1)>')}}]})}}]})});
}
const ready=await generate(new Date());
const expired=structuredClone(ready);
expired.summary.asOf=shiftTrainingDate(trainingDate(),-10);
expired.planFrom=shiftTrainingDate(expired.summary.asOf,1);
expired.planThrough=shiftTrainingDate(expired.summary.asOf,7);
const disabled=await generateTrainingReport(activities,{});
const empty=await generateTrainingReport([],env);
console.log(JSON.stringify({ready,expired,disabled,empty}));
`], { cwd: path.resolve(__dirname, '../apps/running'), encoding: 'utf8' }));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, args: ['--enable-unsafe-swiftshader'] });
  const screenshots = mkdtempSync(path.join(tmpdir(), 'running-training-'));
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    let payload = fixture.ready;
    let failure = false;
    const errors = [];
    const unexpected = [];
    await context.route('**/running/data/training.json', route => failure ? route.fulfill({status:500,body:'Unavailable'}) : route.fulfill({json:payload}));
    context.on('request', request => {
      const data = JSON.stringify({url:request.url(),headers:request.headers(),body:request.postData()});
      if ([password,marker].some(value => [value,encodeURIComponent(value),Buffer.from(value).toString('base64')].some(encoded => data.includes(encoded)))) unexpected.push(request.url());
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const card = page.getByTestId('training-advice');
    const privateView = page.getByTestId('private-training');
    const navigate = async () => { await page.goto(base+'/running/'); await card.getByRole('heading',{name:'训练建议',exact:true}).waitFor(); };
    const unlock = async () => {
      await privateView.getByLabel('报告密码').fill(password);
      await privateView.getByRole('button',{name:'解锁私人解读',exact:true}).click();
      await privateView.getByText(marker,{exact:false}).waitFor();
    };
    await navigate();
    await privateView.getByLabel('报告密码').waitFor();
    assert.equal(await card.getByText(marker,{exact:false}).count(),0);
    assert.equal(await card.locator('ol > li').count(),7);
    await privateView.getByLabel('报告密码').fill('wrong password');
    await privateView.getByRole('button',{name:'解锁私人解读'}).click();
    await privateView.getByRole('alert').waitFor();
    assert.equal(await privateView.getByLabel('报告密码').inputValue(),'');
    await unlock();
    assert.equal(await privateView.locator('img').count(),0);
    const storage = await page.evaluate(() => JSON.stringify({local:{...localStorage},session:{...sessionStorage},cookies:document.cookie}));
    assert.ok(!storage.includes(marker) && !storage.includes(password));
    await privateView.getByRole('button',{name:'锁定',exact:true}).click();
    assert.equal(await privateView.getByText(marker,{exact:false}).count(),0);
    await unlock();
    // Deliver the lifecycle signal deterministically; Chromium headless does not always background new tabs.
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await privateView.getByLabel('报告密码').waitFor();
    assert.equal(await privateView.getByText(marker,{exact:false}).count(),0);
    await unlock();
    await page.reload();
    await privateView.getByLabel('报告密码').waitFor();
    assert.equal(await privateView.getByText(marker,{exact:false}).count(),0);
    // A pending decryption must not reopen a locked view.
    await page.evaluate(() => {
      const original=crypto.subtle.decrypt;
      let release;
      const gate=new Promise(resolve=>{ release=resolve; });
      window.trainingTestRelease=release;
      window.trainingTestOriginalDecrypt=original;
      crypto.subtle.decrypt=function(...args) {
        window.trainingTestPendingDecrypt=original.apply(this,args).then(async value=>{ await gate; return value; });
        return window.trainingTestPendingDecrypt;
      };
    });
    await privateView.getByLabel('报告密码').fill(password);
    await privateView.getByRole('button',{name:'解锁私人解读'}).click();
    await page.waitForFunction(()=>Boolean(window.trainingTestPendingDecrypt));
    await page.evaluate(async () => {
      Object.defineProperty(document,'hidden',{configurable:true,value:true});
      document.dispatchEvent(new Event('visibilitychange'));
      window.trainingTestRelease();
      await window.trainingTestPendingDecrypt;
      await new Promise(resolve=>requestAnimationFrame(resolve));
      crypto.subtle.decrypt=window.trainingTestOriginalDecrypt;
      delete document.hidden;
    });
    assert.equal(await privateView.getByText(marker,{exact:false}).count(),0);
    for (const width of [1440,375,320]) {
      await page.setViewportSize({width,height:1000});
      await card.scrollIntoViewIfNeeded();
      assert.equal(await card.evaluate(node => node.scrollWidth <= node.clientWidth + 1),true,`card overflow at ${width}`);
      await card.screenshot({path:path.join(screenshots,`training-${width}.png`)});
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-theme','dark'));
    await card.screenshot({path:path.join(screenshots,'training-dark.png')});
    payload=fixture.expired;
    await navigate();
    await card.getByText('这份建议已过期',{exact:false}).waitFor();
    payload=fixture.disabled;
    await navigate();
    await card.getByText('AI 建议尚未生成。当前展示实际跑步统计。',{exact:true}).waitFor();
    assert.equal(await privateView.count(),0);
    payload=fixture.empty;
    await navigate();
    await card.getByText('最近 28 天没有有效跑步记录',{exact:false}).waitFor();
    failure=true;
    await navigate();
    await card.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('checkbox',{name:'步行',exact:true}).count(),1);
    assert.deepEqual(unexpected,[],'private data must not be sent by the browser');
    assert.deepEqual(errors,[]);
    console.log('Training browser checks passed; screenshots: '+screenshots);
  } finally { await browser.close(); }
})().catch(error=>{ console.error(error); process.exitCode=1; });
