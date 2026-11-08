const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const base = process.env.SITE_TEST_URL || 'http://127.0.0.1:1328';
const gate = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return {promise, release}; };
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--enable-unsafe-swiftshader']});
  const screenshots = fs.mkdtempSync(path.join(os.tmpdir(), 'running-loading-'));
  try {
    const staticContext = await browser.newContext({javaScriptEnabled:false});
    const staticPage = await staticContext.newPage();
    await staticPage.goto(base + '/running/');
    await staticPage.getByRole('link',{name:'文章',exact:true}).waitFor();
    await staticPage.getByRole('heading',{name:'跑步记录',exact:true}).waitFor();
    await staticContext.close();

    const context = await browser.newContext({viewport:{width:1280,height:900}});
    const page = await context.newPage();
    const errors = [], requested = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => requested.push(new URL(r.url()).pathname));
    const metadata = gate(), metadataStarted = gate(), routes = gate(), routesStarted = gate();
    await page.route('**/data/activity-index.*.json', async route => { metadataStarted.release(); await metadata.promise; await route.continue(); });
    await page.route('**/data/routes-*.json', async route => { routesStarted.release(); await routes.promise; await route.continue(); });
    await page.goto(base + '/running/', {waitUntil:'domcontentloaded'});
    await metadataStarted.promise;
    await page.getByRole('link',{name:'文章',exact:true}).waitFor();
    await page.getByRole('heading',{name:'活动统计',exact:true}).waitFor();
    for (const width of [320,1280]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({path:path.join(screenshots,`metadata-wait-${width}.png`)});
    }
    fs.writeFileSync(path.join(screenshots,'waiting.html'), await page.content());
    assert.equal(await page.locator('.site-header').count(),1,'one navigation while data waits');
    metadata.release();
    await routesStarted.promise;
    await page.getByRole('checkbox',{name:'步行',exact:true}).waitFor();
    await page.locator('table').last().waitFor();
    await page.getByText('路线加载中，活动记录已可查看。',{exact:true}).waitFor();
    await page.screenshot({path:path.join(screenshots,'routes-wait.png')});
    assert.ok(!requested.includes('/running/data/activities.json'), 'Classic must not fetch full legacy data');
    const initialYears = new Set(requested.filter(p=>/\/routes-/.test(p)).map(p=>p.match(/routes-(\d{4})/)[1]));
    assert.equal(initialYears.size,1,'first screen fetches routes for one year');
    const latestYear = [...initialYears][0];
    routes.release();
    await page.getByText('路线加载中，活动记录已可查看。',{exact:true}).waitFor({state:'hidden'});
    // Rapid year switches must not let a slow older response replace the latest selection.
    const oldYear = String(Number(latestYear)-1), older = gate(), olderStarted = gate();
    await page.unroute('**/data/routes-*.json');
    await page.route(`**/data/routes-${oldYear}.*.json`,async route=>{olderStarted.release();await older.promise;await route.continue();});
    await page.getByText(oldYear,{exact:true}).last().click();
    await olderStarted.promise;
    await page.getByText(latestYear,{exact:true}).last().click();
    await page.getByText('路线加载中，活动记录已可查看。',{exact:true}).waitFor({state:'hidden'});
    const oldResponse = page.waitForResponse(r=>r.url().includes(`/data/routes-${oldYear}.`));
    older.release();
    await oldResponse;
    assert.ok((await page.locator('table tbody').last().textContent()).includes(latestYear));
    assert.ok(!(await page.locator('table tbody').last().textContent()).includes(oldYear+'-'));
    await context.close();

    // Failed metadata keeps navigation usable and can be explicitly retried.
    const failed = await browser.newContext();
    const errorPage = await failed.newPage();
    let failIndex = true;
    await errorPage.route('**/data/activity-index.*.json',route=>failIndex?route.fulfill({status:503,body:'unavailable'}):route.continue());
    await errorPage.goto(base+'/running/');
    await errorPage.getByText('Failed to load activities',{exact:true}).waitFor();
    await errorPage.getByRole('link',{name:'文章',exact:true}).waitFor();
    failIndex=false;
    await errorPage.getByRole('button',{name:'Retry',exact:true}).click();
    await errorPage.getByRole('checkbox',{name:'步行',exact:true}).waitFor();
    await failed.close();

    const brokenRoutes = await browser.newContext();
    const routePage = await brokenRoutes.newPage();
    let failRoutes = true;
    await routePage.route('**/data/routes-*.json',route=>failRoutes?route.fulfill({status:503,body:'unavailable'}):route.continue());
    await routePage.goto(base+'/running/');
    await routePage.getByRole('button',{name:'重试路线',exact:true}).waitFor();
    await routePage.locator('table').last().waitFor();
    failRoutes=false;
    await routePage.getByRole('button',{name:'重试路线',exact:true}).click();
    await routePage.getByRole('button',{name:'重试路线',exact:true}).waitFor({state:'hidden'});
    await brokenRoutes.close();

    const annual = await browser.newContext();
    const annualPage = await annual.newPage();
    const annualRequests=[];annualPage.on('request',r=>annualRequests.push(r.url()));
    await annualPage.goto(base+'/running/summary/2025/');
    await annualPage.getByRole('heading',{name:'2025，步履不停。',exact:true}).waitFor();
    assert.equal(await annualPage.locator('.site-header').count(),0);
    assert.ok(!annualRequests.some(url=>/\/data\/routes-|\/data\/activities\.json/.test(url)));
    await annual.close();
    assert.deepEqual(errors,[]);
    console.log('HTML shell, delayed metadata/routes, local failures/retry, year races and annual summary passed. Screenshots:',screenshots);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
