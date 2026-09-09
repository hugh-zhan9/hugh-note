const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const today = new Date();
    const activity = (month, distance) => ({
      type: 'Run', distance,
      start_date_local: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`,
      summary_polyline: '??_ibE_ibE',
    });
    const activities = [activity(today, 5000), activity(new Date(today.getFullYear(), today.getMonth() - 1, 1), 10000)];
    await page.route('**/running/data/activities.json', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(activities),
    }));
    const base = process.env.SKIN_TEST_URL || 'http://localhost:1313';
    const screenshots = require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'hugh-note-skins-'));
    const appearance = async () => page.evaluate(() => ({
      skin: document.documentElement.dataset.skin,
      background: getComputedStyle(document.body).backgroundImage,
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      color: getComputedStyle(document.body).color,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    await page.goto(base);
    await page.getByLabel('外观设置', {exact: true}).click();
    assert.equal((await appearance()).skin, 'light');
    const defaultBackground = (await appearance()).background;
    const defaultColor = (await appearance()).backgroundColor;
    assert.equal(defaultColor, 'rgb(250, 249, 246)');
    assert.equal(await page.locator('.homepage-columns').count(), 1);
    assert.equal(await page.getByRole('heading', {name: '那年今日'}).count(), 1);
    assert.equal(await page.locator('.homepage-hero').count(), 0);
    for (const preset of ['paper', 'sage', 'dark', 'light']) {
      await page.getByLabel('预设主题').selectOption(preset);
      const home = await appearance();
      await page.goto(base + '/blog/');
      assert.equal((await appearance()).skin, preset);
      assert.equal((await appearance()).background, home.background);
      assert.equal((await appearance()).backgroundColor, home.backgroundColor);
      assert.equal((await appearance()).color, home.color);
      assert.equal(await page.locator('#skin-settings').count(), 0);
      await page.screenshot({path: `${screenshots}/${preset}-blog.png`});
      await page.goto(base);
      await page.getByLabel('外观设置', {exact: true}).click();
    }
    await page.getByLabel('背景色十六进制色值').fill('#123abc');
    await page.getByLabel('背景色十六进制色值').fill('#bad');
    assert.equal(await page.getByLabel('背景色十六进制色值').getAttribute('aria-invalid'), 'true');
    assert.equal((await appearance()).skin, 'custom');
    await page.getByLabel('背景色十六进制色值').fill('#ffffff');
    assert.equal((await appearance()).color, 'rgb(0, 0, 0)');
    assert.equal((await appearance()).backgroundColor, 'rgb(255, 255, 255)');
    await page.getByLabel('背景色十六进制色值').fill('#000000');
    assert.equal((await appearance()).color, 'rgb(255, 255, 255)');
    assert.equal((await appearance()).backgroundColor, 'rgb(0, 0, 0)');
    await page.goto(base + '/blog/');
    assert.equal((await appearance()).skin, 'custom');
    assert.equal((await appearance()).background, 'none');
    await Promise.all([page.waitForURL('**/posts/**'), page.locator('.readmore').first().click()]);
    await page.waitForLoadState();
    assert.equal((await appearance()).skin, 'custom');
    assert.equal(await page.locator('#skin-settings').count(), 0);
    await page.screenshot({path: `${screenshots}/article.png`, fullPage: false});
    await page.goto(base);
    await page.getByLabel('外观设置', {exact: true}).click();
    await page.getByRole('button', {name: '恢复默认'}).click();
    assert.equal((await appearance()).background, defaultBackground);
    assert.equal((await appearance()).backgroundColor, defaultColor);
    await page.getByLabel('预设主题').press('Escape');
    assert.equal(await page.locator('.skin-settings').getAttribute('open'), null);
    const peer = await context.newPage();
    await peer.goto(base + '/blog/');
    await page.getByLabel('外观设置', {exact: true}).click();
    await page.getByLabel('预设主题').selectOption('sage');
    await peer.waitForFunction(() => document.documentElement.dataset.skin === 'sage');
    await peer.close();
    for (const width of [320, 375, 768, 920, 1024, 1440]) {
      await page.setViewportSize({width, height: 900});
      for (const path of ['/', '/blog/']) {
        await page.goto(base + path);
        if (path === '/') {
          const trigger = page.getByLabel('外观设置', {exact: true});
          assert.equal(await trigger.locator('svg').count(), 1);
          const target = await trigger.boundingBox();
          assert.ok(target.width >= 44 && target.height >= 44);
          await trigger.press('Enter');
          const panel = await page.locator('.skin-panel').boundingBox();
          assert.ok(panel.x >= 0 && panel.x + panel.width <= width, `panel clipped at ${width}`);
          await page.getByLabel('预设主题').press('Escape');
          assert.ok(await trigger.evaluate(e => e === document.activeElement));
        } else {
          assert.equal(await page.locator('#skin-settings').count(), 0);
        }
        assert.equal((await appearance()).overflow, false, `${path} overflow at ${width}`);
        await page.screenshot({path: `${screenshots}/${width}-${path === '/' ? 'home' : 'blog'}.png`});
      }
    }
    await page.goto(base);
    await page.getByLabel('上个月', {exact: true}).click();
    assert.equal(await page.locator('#homepage-running-value').textContent(), '10.0 / 150 km');
    assert.ok((await page.locator('#homepage-running-route-map').boundingBox()).height > 15);
    await page.getByRole('tab', {name: '单次路线'}).click();
    assert.equal(await page.getByRole('tab', {name: '单次路线'}).getAttribute('aria-selected'), 'true');
    await page.getByLabel('下个月', {exact: true}).click();
    assert.equal(await page.locator('#homepage-running-value').textContent(), '5.0 / 150 km');
    await page.screenshot({path: `${screenshots}/current-home.png`, fullPage: true});
    assert.deepEqual(errors, []);
    console.log(`Screenshots: ${screenshots}`);
    console.log('Browser checks passed: four presets, homepage/blog/article, custom black/white, invalid input, reset, Escape, cross-tab sync, 320/375/768/920/1024/1440 layouts.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
