const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const base = process.env.SITE_TEST_URL || 'http://127.0.0.1:1313';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, args: ['--enable-unsafe-swiftshader'] });
  const screenshots = fs.mkdtempSync(path.join(os.tmpdir(), 'hugh-note-integrated-'));
  const errors = [];
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    const page = await context.newPage();
    const data = await context.request.get(base + '/running/data/activities.json');
    assert.equal(data.status(), 200);
    const activities = await data.json();
    assert.ok(activities.length > 0);
    const latestYear = activities.filter(a => a.type === 'running').map(a => a.start_date_local.slice(0,4)).sort().at(-1);
    const years = [...new Set(activities.filter(a => a.type === 'running').map(a => a.start_date_local.slice(0,4)))].sort();
    const summaryYear = years.find(year => Number(year) === Number(latestYear) - 1) || latestYear;
    const summaryPath = `/running/summary/${summaryYear}/`;
    const snapshot = () => page.evaluate(() => ({
      skin: document.documentElement.dataset.skin,
      theme: document.documentElement.dataset.theme,
      bg: getComputedStyle(document.body).backgroundColor,
      color: getComputedStyle(document.body).color,
    }));
    const go = async pathname => {
      const response = await page.goto(base + pathname);
      assert.equal(response.status(), 200, pathname);
      if (pathname === '/') await page.locator('#skin-settings:not([hidden])').waitFor();
      else assert.equal(await page.locator('#skin-settings').count(), 0, pathname);
      if (pathname.startsWith('/running/')) await page.locator('main, .running-content, [class*="activityList"]').first().waitFor();
    };
    const choose = async value => {
      if (!await page.locator('#skin-settings').evaluate(e => e.open)) await page.getByLabel('外观设置', {exact:true}).click();
      if (value.startsWith('#')) await page.getByLabel('背景色十六进制色值').fill(value);
      else await page.getByLabel('预设主题').selectOption(value);
    };
    await go('/');
    await page.locator('#homepage-running-previous:not([hidden])').waitFor();
    let navigated = 0;
    while (!await page.getByRole('tab', {name:'月度总览'}).isVisible() && navigated++ < 72) {
      await page.getByLabel('上个月', {exact:true}).click();
    }
    assert.ok(await page.getByRole('tab', {name:'月度总览'}).isVisible());
    const month = await page.locator('#homepage-running-month').textContent();
    const parts = month.match(/(\d{4}) 年 (\d+) 月/);
    const prefix = `${parts[1]}-${parts[2].padStart(2,'0')}`;
    const expected = activities.filter(a => a.type === 'running' && a.start_date_local.startsWith(prefix)).reduce((sum,a) => sum+a.distance/1000,0);
    assert.match(await page.locator('#homepage-running-value').textContent(), new RegExp(expected.toFixed(1).replace('.', '\\.')));
    await page.getByRole('tab',{name:'单次路线'}).click();
    assert.equal(await page.getByRole('tab',{name:'单次路线'}).getAttribute('aria-selected'),'true');
    await page.getByRole('tab',{name:'月度总览'}).click();
    const regions = page.locator('#homepage-route-region');
    if (await regions.isVisible() && await regions.locator('option').count() > 1) await regions.selectOption({index:1});
    if(navigated > 0) await page.getByLabel('下个月',{exact:true}).click();
    // Follow the actual navigation link; local previews must stay on the local origin.
    await page.locator('header nav').getByRole('link',{name:'跑步',exact:true}).click();
    await page.waitForURL(base+'/running/');
    await page.getByRole('checkbox',{name:'步行'}).waitFor();
    await page.getByRole('checkbox',{name:'步行'}).check();
    assert.equal(await page.getByRole('checkbox',{name:'步行'}).isChecked(),true);
    await page.getByRole('checkbox',{name:'步行'}).uncheck();
    await page.getByRole('link', {name:'年度总结',exact:true}).click();
    await page.waitForURL(new RegExp(`/running/summary/${summaryYear}/?$`));
    await page.getByRole('heading', {name:`${summaryYear}，步履不停。`}).waitFor();
    assert.equal(await page.locator('.site-header').count(), 0);
    const summaryStyle = () => page.locator('main').evaluate(e => {
      const css = getComputedStyle(e);
      return {background:css.backgroundImage, color:css.color, font:css.fontFamily, accent:css.getPropertyValue('--summary-accent').trim(), overlay:getComputedStyle(e,'::before').content, top:e.getBoundingClientRect().top};
    });
    const originalSummary = await summaryStyle();
    assert.equal(originalSummary.color, 'rgb(244, 238, 231)');
    assert.equal(originalSummary.accent, '#ff6a00');
    assert.match(originalSummary.background, /radial-gradient/);
    assert.match(originalSummary.font, /IBM Plex Sans/);
    assert.equal(originalSummary.overlay, '""');
    assert.equal(originalSummary.top, 0);
    for (const value of ['light','paper','sage','dark','#000000','#ffffff','#123abc']) {
      await go('/');
      await choose(value);
      const running = await snapshot();
      for (const pathname of ['/', '/blog/', summaryPath]) {
        await go(pathname);
        assert.deepEqual(await snapshot(), running, `${value} ${pathname}`);
        if (pathname === summaryPath) {
          assert.deepEqual(await summaryStyle(), originalSummary, `annual story changed with ${value}`);
          assert.equal(await page.locator('.site-header').count(), 0);
        }
      }
      await go('/running/');
      assert.deepEqual(await snapshot(), running);
    }
    const peer = await context.newPage();
    await peer.goto(base + '/running/');
    await go('/');
    await choose('paper');
    await peer.waitForFunction(() => document.documentElement.dataset.skin === 'paper');
    await choose('dark');
    await peer.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await peer.screenshot({path:path.join(screenshots,'running-dark.png')});
    await choose('light');
    await peer.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await peer.screenshot({path:path.join(screenshots,'running-light.png')});
    await peer.goto(base + summaryPath);
    await peer.getByRole('heading', {name:`${summaryYear}，步履不停。`}).waitFor();
    const beforeSkinChange = await peer.locator('main').evaluate(e => getComputedStyle(e).backgroundImage);
    await choose('sage');
    await peer.waitForFunction(() => document.documentElement.dataset.skin === 'sage');
    assert.equal(await peer.locator('main').evaluate(e => getComputedStyle(e).backgroundImage), beforeSkinChange);
    await peer.close();
    await go(summaryPath+'?activity=running#recap');
    await page.reload();
    await page.getByRole('heading', {name:`${summaryYear}，步履不停。`}).waitFor();
    assert.ok(page.url().endsWith('?activity=running#recap'));
    const firstScreen = await page.locator('main').textContent();
    // Focused navigation must retain its keyboard behavior without turning a story page.
    await page.getByRole('link', {name:summaryYear,exact:true}).press('ArrowDown');
    assert.equal(await page.locator('main').textContent(), firstScreen);
    await page.locator('main').click({position:{x:20,y:100}});
    await page.keyboard.press('ArrowDown');
    assert.notEqual(await page.locator('main').textContent(), firstScreen);
    for (let step=0; step<4; step++) await page.keyboard.press('ArrowDown');
    await page.getByRole('button', {name:'重新开始',exact:true}).waitFor();
    await page.getByRole('button', {name:'重新开始',exact:true}).click();
    await page.getByRole('heading', {name:`${summaryYear}，步履不停。`}).waitFor();
    // An unmaterialized route exercises the real static-host 404 restoration.
    await page.goto(base+'/running/summary/1900?from=test#kept');
    await page.waitForURL(new RegExp(`/running/summary/${latestYear}`));
    await page.getByRole('heading', {name:`${latestYear}，步履不停。`}).waitFor();
    const missing = await page.goto(base+'/posts/does-not-exist');
    assert.equal(missing.status(),404);
    assert.ok(page.url().endsWith('/posts/does-not-exist'));
    for (const width of [320,375,768,1440]) {
      await page.setViewportSize({width,height:900});
      for (const pathname of ['/running/',summaryPath]) {
        await go(pathname);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${pathname} ${width} overflow`);
        await page.screenshot({path:path.join(screenshots,`${width}-${pathname===summaryPath?'summary':'running'}.png`)});
        if (pathname === summaryPath && width <= 375) {
          await page.getByRole('button', {name:'1 / 6',exact:true}).click();
          await page.getByRole('button', {name:'下一页',exact:true}).click();
          assert.equal(await page.getByRole('heading', {name:`${summaryYear}，步履不停。`}).count(), 0);
        }
      }
    }
    // Storage denial must not prevent homepage controls or running filters.
    const blocked = await browser.newContext();
    await blocked.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new DOMException('Blocked','SecurityError'); };
      Storage.prototype.setItem = () => { throw new DOMException('Blocked','SecurityError'); };
    });
    const denied = await blocked.newPage();
    denied.on('pageerror',e=>errors.push(e.message));
    await denied.goto(base+'/');
    await denied.getByLabel('外观设置',{exact:true}).click();
    await denied.getByLabel('预设主题').selectOption('paper');
    assert.match(await denied.locator('#skin-status').textContent(),/无法保存/);
    assert.equal(await denied.evaluate(()=>document.documentElement.dataset.skin),'paper');
    await denied.goto(base+'/running/');
    assert.equal(await denied.locator('#skin-settings').count(),0);
    await denied.getByRole('checkbox',{name:'步行'}).check();
    assert.equal(await denied.getByRole('checkbox',{name:'步行'}).isChecked(),true);
    await blocked.close();
    assert.deepEqual(errors,[]);
    console.log('Real exported data, month/routes/regions, activity filters, shared presets/custom colors, cross-tab changes, deep links, summary keys, 404 and 320–1440px checks passed.');
    console.log('Screenshots:',screenshots);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
