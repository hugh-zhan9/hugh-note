const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');

(async () => {
  const root = path.resolve(__dirname, '..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hugh-note-toc-'));
  const content = path.join(temp, 'content');
  const output = path.join(temp, 'site');
  fs.mkdirSync(path.join(content, 'posts'), { recursive: true });
  fs.copyFileSync(path.join(root, 'content/posts/pi-docs/01-agent-concepts.md'), path.join(content, 'posts/agent.md'));
  fs.copyFileSync(path.join(root, 'content/posts/Golang框架选型.md'), path.join(content, 'posts/wide.md'));
  const fixture = (name, body, frontmatter = '') => fs.writeFileSync(path.join(content, 'posts', `${name}.md`),
    `---\ntitle: ${name}\ndate: 2020-01-01\n${frontmatter}---\n${body}`);
  fixture('empty', '只有正文，没有小标题。');
  fixture('single', '## 唯一章节\n正文。');
  fixture('disabled', '## 隐藏的目录\n正文。', 'toc: false\n');
  fixture('long', Array.from({ length: 60 }, (_, index) =>
    `## 第 ${index + 1} 节：很长的中文标题和重复锚点检查\n\n${'段落内容。'.repeat(100)}\n\n### 重复标题\n正文。`).join('\n\n'));

  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.join(output, pathname.endsWith('/') ? pathname + 'index.html' : pathname);
    try {
      const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
      response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      response.end(fs.readFileSync(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    execFileSync(process.env.HUGO_BIN || 'hugo', ['--contentDir', content, '--destination', output, '--baseURL', base + '/', '--buildFuture'], { cwd: root, stdio: 'pipe' });
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const go = async slug => {
      const response = await page.goto(`${base}/posts/${slug}/`);
      assert.equal(response.status(), 200);
    };
    const toc = page.locator('.article-toc');
    const panel = page.locator('.article-toc-panel');
    const rail = page.locator('.article-toc-rail');
    const shortcuts = rail.locator('a');
    const marks = rail.locator('.article-toc-mark');
    const links = panel.locator('a');
    const current = panel.locator('[aria-current="location"]');

    await go('agent');
    assert.ok(await panel.isVisible());
    assert.equal(await rail.isVisible(), false);
    assert.equal(await links.count(), await page.locator('article .body h2, article .body h3').count());
    assert.equal(await marks.count(), await links.count());
    assert.ok(await links.evaluateAll(items => items.every(item => document.getElementById(decodeURIComponent(item.hash.slice(1))))));
    const body = await page.locator('article .body').boundingBox();
    const directory = await toc.boundingBox();
    assert.equal(body.width, 800);
    assert.ok(directory.x + directory.width + 16 <= body.x);
    const target = links.nth(3);
    const hash = await target.getAttribute('href');
    await target.click();
    await page.waitForFunction(hash => document.querySelector('.article-toc [aria-current]')?.getAttribute('href') === hash, hash);
    assert.equal(decodeURIComponent(new URL(page.url()).hash), decodeURIComponent(hash));
    await page.reload();
    await page.waitForFunction(hash => document.querySelector('.article-toc [aria-current]')?.getAttribute('href') === hash, hash);
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForFunction(() => document.querySelector('.article-toc a')?.hasAttribute('aria-current'));

    for (const skin of ['paper', 'dark', '#ffffff', '#000000']) {
      await page.evaluate(value => window.siteAppearance.choose(value), skin);
      assert.equal(await panel.evaluate(e => getComputedStyle(e).backgroundColor), await page.locator('body').evaluate(e => getComputedStyle(e).backgroundColor));
      await page.screenshot({ path: path.join(temp, `desktop-${skin.replace('#', '')}.png`) });
    }
    await page.evaluate(() => window.siteAppearance.choose('paper'));
    for (const width of [1000, 1024, 1280, 1399]) {
      await page.setViewportSize({ width, height: 900 });
      await page.mouse.move(width - 10, 10);
      await go('agent');
      assert.equal(await panel.isVisible(), false);
      assert.ok(await rail.isVisible());
      const mapping = await page.evaluate(() => {
        const items = [...document.querySelectorAll('.article-toc-panel a')];
        const bars = [...document.querySelectorAll('.article-toc-mark')];
        return items.map((item, index) => ({
          length: Array.from(item.textContent.trim()).length,
          width: bars[index].getBoundingClientRect().width,
          active: bars[index].classList.contains('is-current'),
          current: item.hasAttribute('aria-current'),
        }));
      });
      assert.ok(mapping.every(item => item.active === item.current));
      const shortest = mapping.reduce((a, b) => a.length < b.length ? a : b);
      const longest = mapping.reduce((a, b) => a.length > b.length ? a : b);
      assert.ok(shortest.width < longest.width, 'short titles need shorter bars');
      assert.ok(mapping.every(item => Math.abs(item.width / longest.width - Math.max(.2, item.length / longest.length)) < .01));
      const bounds = await rail.boundingBox();
      assert.ok(bounds.width >= 44 && bounds.height >= 44);
      const shortcutBounds = await shortcuts.first().boundingBox();
      assert.ok(shortcutBounds.width >= 44 && shortcutBounds.height >= 24);
      const readingPosition = await page.evaluate(() => ({ y: scrollY, hash: location.hash }));
      const currentHash = await current.getAttribute('href');
      const currentBackground = await current.evaluate(e => getComputedStyle(e).backgroundColor);
      await rail.hover();
      assert.ok(await panel.isVisible());
      for (const index of [10, 6]) {
        await shortcuts.nth(index).hover();
        assert.equal(await links.nth(index).evaluate(e => getComputedStyle(e).backgroundColor), currentBackground,
          'hovering a bar must highlight its matching panel title');
        assert.equal(await current.evaluate(e => getComputedStyle(e).backgroundColor), 'rgba(0, 0, 0, 0)',
          'the reading location must not compete with the hovered title');
        assert.equal(await current.getAttribute('href'), currentHash, 'hover must preserve the reading location');
        assert.deepEqual(await page.evaluate(() => ({ y: scrollY, hash: location.hash })), readingPosition);
      }
      if (width === 1024) await page.screenshot({ path: path.join(temp, 'compact-hover-matched.png') });
      await page.mouse.move(width - 10, 10);
      await rail.hover();
      await links.first().hover();
      assert.ok(await panel.isVisible(), 'moving from bars to panel must keep it open');
      assert.equal(await current.evaluate(e => getComputedStyle(e).backgroundColor), currentBackground,
        'interacting with panel links must clear the shortcut preview');
      if (width === 1024) await page.screenshot({ path: path.join(temp, 'compact-expanded.png') });
      await page.mouse.move(width - 10, 10);
      assert.equal(await panel.isVisible(), false);
      await shortcuts.nth(3).focus();
      assert.ok(await panel.isVisible());
      assert.equal(await links.nth(3).evaluate(e => getComputedStyle(e).backgroundColor), currentBackground,
        'keyboard focus must reveal the matching title');
      await links.first().focus();
      await page.keyboard.press('Escape');
      assert.equal(await panel.isVisible(), false);
      assert.ok(await shortcuts.first().evaluate(e => e === document.activeElement));
      assert.equal(await current.evaluate(e => getComputedStyle(e).backgroundColor), currentBackground,
        'closing the panel must restore the reading location highlight');
      const shortcutHash = await shortcuts.nth(3).getAttribute('href');
      assert.equal(shortcutHash, await links.nth(3).getAttribute('href'));
      await shortcuts.nth(3).click();
      await page.waitForFunction(() => document.querySelectorAll('.article-toc-mark')[3].classList.contains('is-current'));
      assert.equal(decodeURIComponent(new URL(page.url()).hash), decodeURIComponent(shortcutHash));
      assert.equal(await panel.isVisible(), false);
      assert.equal(await rail.locator('.is-current').count(), 1);
      await shortcuts.first().focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('.article-toc-mark').classList.contains('is-current'));
      assert.equal(await panel.isVisible(), false);
      await rail.hover();
      await page.locator('article h1.title').click();
      assert.equal(await panel.isVisible(), false);
      await page.screenshot({ path: path.join(temp, `compact-${width}.png`) });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }

    for (const width of [320, 375, 768, 999]) {
      await page.setViewportSize({ width, height: 900 });
      await go('single');
      assert.equal(await toc.isVisible(), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(temp, `mobile-${width}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const slug of ['empty', 'disabled']) {
      await go(slug);
      assert.equal(await toc.count(), 0);
    }
    await go('single');
    assert.equal(await links.count(), 1);
    assert.equal(await current.count(), 1);
    assert.equal(await marks.count(), 1);
    await go('long');
    assert.equal(await links.count(), 120);
    assert.equal(await links.evaluateAll(items => new Set(items.map(item => item.hash)).size), 120);
    const finalHash = await links.last().getAttribute('href');
    await page.evaluate(hash => document.getElementById(decodeURIComponent(hash.slice(1))).scrollIntoView(), finalHash);
    await page.waitForFunction(hash => document.querySelector('.article-toc [aria-current]')?.getAttribute('href') === hash, finalHash);
    assert.ok(await panel.evaluate(e => e.scrollTop > 0));
    const activeBounds = await current.boundingBox();
    const panelBounds = await panel.boundingBox();
    assert.ok(activeBounds.y >= panelBounds.y && activeBounds.y + activeBounds.height <= panelBounds.y + panelBounds.height);
    await page.setViewportSize({ width: 1024, height: 700 });
    await page.waitForFunction(() => document.querySelector('.article-toc').dataset.compact === 'true');
    await page.evaluate(hash => document.getElementById(decodeURIComponent(hash.slice(1))).scrollIntoView(), finalHash);
    await page.waitForFunction(() => document.querySelector('.article-toc-rail a:last-child .article-toc-mark').classList.contains('is-current'));
    assert.equal(await marks.count(), 120);
    assert.ok(await marks.last().evaluate(e => e.classList.contains('is-current')));
    const barBounds = await marks.last().boundingBox();
    const railBounds = await rail.boundingBox();
    assert.ok(railBounds.y + railBounds.height <= 700);
    assert.ok(barBounds.y >= railBounds.y && barBounds.y + barBounds.height <= railBounds.y + railBounds.height);
    await page.screenshot({ path: path.join(temp, 'long-collapsed.png') });
    await shortcuts.nth(100).hover();
    const hoveredBounds = await links.nth(100).boundingBox();
    const expandedBounds = await panel.boundingBox();
    assert.ok(hoveredBounds.y >= expandedBounds.y && hoveredBounds.y + hoveredBounds.height <= expandedBounds.y + expandedBounds.height,
      'a hovered title in a long directory must scroll into the panel viewport');
    assert.equal(await current.getAttribute('href'), finalHash);
    const hoveredBarBounds = await shortcuts.nth(100).boundingBox();
    assert.ok(hoveredBarBounds.y >= railBounds.y && hoveredBarBounds.y + hoveredBarBounds.height <= railBounds.y + railBounds.height,
      'previewing a title must not scroll the bar away from the pointer');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => document.querySelector('.article-toc').dataset.compact === 'false');
    assert.equal(await links.nth(100).evaluate(e => getComputedStyle(e).backgroundColor), 'rgba(0, 0, 0, 0)',
      'expanding to the desktop directory must clear the shortcut preview');

    await go('wide');
    await page.locator('.article-table-wide').first().evaluate(e => e.scrollIntoView());
    await page.waitForFunction(() => document.querySelector('.article-toc').dataset.obscured === 'true');
    assert.equal(await panel.isVisible(), false);
    assert.equal(await rail.isVisible(), false);
    assert.equal(await page.locator('.article-table-wide').first().evaluate(e => e.getBoundingClientRect().width), 1395);
    await page.screenshot({ path: path.join(temp, 'wide-table.png') });
    await page.locator('article .body h2').last().evaluate(e => e.scrollIntoView());
    await page.waitForFunction(() => document.querySelector('.article-toc').dataset.obscured === 'false');
    assert.ok(await panel.isVisible());
    await page.emulateMedia({ media: 'print' });
    assert.equal(await toc.isVisible(), false);
    await page.emulateMedia({ media: 'screen' });
    await page.goto(base + '/');
    assert.equal(await toc.count(), 0);
    assert.deepEqual(errors, []);
    const noJS = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    await noJS.goto(base + '/posts/agent/');
    assert.ok(await noJS.locator('.article-toc-panel').isVisible());
    console.log('Article TOC checks passed: headings/anchors, direct bar navigation, matching bar counts/lengths/highlights, scroll/refresh, hover/click/keyboard, responsive layout, skins, wide tables, empty/single/120 headings, opt-out, print and no-JS.');
    console.log('Screenshots:', temp);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
