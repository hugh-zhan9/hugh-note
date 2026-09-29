import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const base = process.env.SITE_TEST_URL || "http://127.0.0.1:1313";
const screenshots = await mkdtemp(path.join(tmpdir(), "hugh-images-browser-"));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
});
const token = "github_pat_browser_test_not_a_real_secret";
const errors = [];
const writes = [];
const files = new Map();
const repositories = ["hugh-image", "hugh-image-02", "hugh-image-03"];
const writeTargets = [];
const retryTargets = new Map();
let failWrite = 2;
let treeError = false;
let truncated = false;
let unauthorized = false;
let missingBranch = false;
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ["clipboard-read", "clipboard-write"],
    reducedMotion: "reduce",
  });
  await context.route("https://api.github.com/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    assert.equal(req.headers().authorization, `Bearer ${token}`);
    assert.ok(!req.url().includes(token));
    const repository = url.pathname.split("/")[3];
    assert.ok(repositories.includes(repository));
    assert.equal(url.pathname.split("/")[2], "hugh-zhan9");
    const prefix = `${repository}/`;
    const reply = (status, data) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (unauthorized) return reply(401, { message: "Unauthorized" });
    if (req.method() === "PUT") {
      const body = req.postDataJSON();
      assert.deepEqual(Object.keys(body).sort(), [
        "branch",
        "content",
        "message",
      ]);
      assert.equal(body.branch, "main");
      assert.ok(!req.postData().includes(token));
      const occupancy = repositories.map((repo) =>
        [...files]
          .filter(([key]) => key.startsWith(`${repo}/`))
          .reduce((sum, [, file]) => sum + file.buffer.length, 0),
      );
      const least = occupancy.indexOf(Math.min(...occupancy));
      assert.equal(
        repository,
        retryTargets.get(body.content) || repositories[least],
      );
      writeTargets.push(repository);
      writes.push(body);
      if (writes.length === failWrite) {
        retryTargets.set(body.content, repository);
        return reply(503, { message: token });
      }
      retryTargets.delete(body.content);
      const filePath = decodeURIComponent(url.pathname.split("/contents/")[1]);
      assert.match(
        filePath,
        /^images\/[a-f0-9]{2}\/[a-f0-9]{64}\.(png|webp|gif|jpg)$/,
      );
      if (files.has(prefix + filePath)) return reply(422, {});
      const buffer = Buffer.from(body.content, "base64");
      const sha = createHash("sha1")
        .update(`blob ${buffer.length}\0`)
        .update(buffer)
        .digest("hex");
      files.set(prefix + filePath, { buffer, sha });
      return reply(201, { content: { sha } });
    }
    assert.equal(req.method(), "GET");
    if (url.pathname.includes("/contents/")) {
      const file = files.get(
        prefix + decodeURIComponent(url.pathname.split("/contents/")[1]),
      );
      return file
        ? reply(200, { type: "file", sha: file.sha, size: file.buffer.length })
        : reply(404, {});
    }
    if (url.pathname.includes("/git/trees/")) {
      if (treeError) return reply(500, {});
      return reply(200, {
        truncated,
        tree: [...files]
          .filter(([name]) => name.startsWith(prefix))
          .map(([name, file]) => ({
            path: name.slice(prefix.length),
            sha: file.sha,
            size: file.buffer.length,
            type: "blob",
            mode: "100644",
          })),
      });
    }
    if (url.pathname.includes("/branches/"))
      return reply(missingBranch ? 404 : 200, {});
    return reply(200, { private: false });
  });
  await context.route("https://raw.githubusercontent.com/**", async (route) => {
    assert.ok(!route.request().headers().authorization);
    const pathname = new URL(route.request().url()).pathname;
    const repository = pathname.split("/")[2];
    assert.ok(repositories.includes(repository));
    assert.ok(
      pathname.startsWith(`/hugh-zhan9/${repository}/refs/heads/main/images/`),
    );
    const filePath =
      "images/" + decodeURIComponent(pathname.split("/images/")[1]);
    const file = files.get(`${repository}/${filePath}`);
    if (!file) return route.fulfill({ status: 404 });
    return route.fulfill({
      contentType: filePath.endsWith("webp") ? "image/webp" : "image/png",
      body: file.buffer,
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/.test(message.text()))
      errors.push(message.text());
  });
  // Previously saved settings must not redirect requests or public links.
  await page.addInitScript(() => {
    localStorage.setItem(
      "hugh-images-settings-v1",
      JSON.stringify({
        owner: "previous-owner",
        repo: "previous-pictures",
        branch: "old-branch",
        publicBaseUrl: "https://previous.example.com",
      }),
    );
  });
  await page.goto(`${base}/images/`);
  await page.getByRole("heading", { name: "为文字，留一幅画面。" }).waitFor();
  assert.equal(await page.locator(".settings-panel input").count(), 1);
  assert.ok(await page.getByLabel("GitHub Token", { exact: true }).isVisible());
  for (const label of [
    "GitHub 用户 / 组织",
    "图片仓库",
    "分支",
    "外链根地址",
  ]) {
    assert.equal(await page.getByLabel(label, { exact: true }).count(), 0);
  }
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");
  assert.ok(csp.includes("script-src 'self'"));
  await page.screenshot({
    path: path.join(screenshots, "desktop-empty.png"),
    fullPage: true,
  });
  await page.getByLabel("GitHub Token", { exact: true }).fill(token);
  unauthorized = true;
  await page.getByRole("button", { name: "连接仓库", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Token 无效" }).waitFor();
  unauthorized = false;
  missingBranch = true;
  await page.getByRole("button", { name: "连接仓库", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "添加 README 并提交到 main" })
    .waitFor();
  assert.equal(writes.length, 0);
  missingBranch = false;
  await page.getByRole("button", { name: "连接仓库", exact: true }).click();
  await page.getByText("仓库已连接，可以上传图片。", { exact: true }).waitFor();
  const stored = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
  assert.ok(!stored.includes(token));
  assert.ok(stored.includes("previous-pictures"));
  await page.getByRole("button", { name: "图片库", exact: true }).click();
  await page.getByText("图片库还是空的", { exact: true }).waitFor();
  await page.getByRole("button", { name: "上传第一张图片" }).click();
  const pngs = await page.evaluate(() =>
    ["#165b3c", "#be895c", "#355a92"].map((color) => {
      const canvas = document.createElement("canvas");
      canvas.width = 2400;
      canvas.height = 1200;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 2400, 1200);
      ctx.fillStyle = "#f5efe3";
      ctx.font = "120px serif";
      ctx.fillText("A moment to keep.", 120, 630);
      return canvas.toDataURL("image/png").split(",")[1];
    }),
  );
  // Existing content remains in the original repository and keeps its URL.
  const legacyBuffer = Buffer.from(pngs[0], "base64");
  const legacySha = createHash("sha1")
    .update(`blob ${legacyBuffer.length}\0`)
    .update(legacyBuffer)
    .digest("hex");
  files.set("hugh-image/images/legacy.png", {
    buffer: legacyBuffer,
    sha: legacySha,
  });
  const uploadFiles = pngs.map((content, i) => ({
    name: i === 0 ? "summer [day].png" : `photo-${i}.png`,
    mimeType: "image/png",
    buffer: Buffer.from(content, "base64"),
  }));
  await page.getByLabel("选择图片文件").setInputFiles(uploadFiles);
  treeError = true;
  await page.getByRole("button", { name: "上传 3 张", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "500" }).waitFor();
  assert.equal(writes.length, 0);
  assert.equal(await page.locator(".queue li").count(), 3);
  treeError = false;
  await page.getByRole("button", { name: "上传 3 张", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "本次 3 张，2 张已入库或已存在，1 张失败。" })
    .waitFor();
  assert.equal(files.size, 3);
  assert.equal(writes.length, 3);
  assert.ok(
    !(await page
      .getByRole("main")
      .innerText()
      .then((text) => text.includes(token))),
  );
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "本次 1 张，1 张已入库或已存在，0 张失败。" })
    .waitFor();
  assert.equal(files.size, 4);
  assert.ok(writeTargets.includes("hugh-image-02"));
  assert.ok(writeTargets.includes("hugh-image-03"));
  await page.getByRole("button", { name: "复制全部 Markdown" }).click();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clipboard.split("\n").length, 3);
  assert.ok(clipboard.includes("summer \\[day\\]"));
  assert.ok(!clipboard.includes(token));
  const links = clipboard.match(
    /https:\/\/raw\.githubusercontent\.com\/hugh-zhan9\/hugh-image(?:-0[23])?\/refs\/heads\/main\/images\/[^)]+/g,
  );
  assert.equal(links.length, 3);
  for (const link of links) {
    const url = new URL(link);
    const repo = url.pathname.split("/")[2];
    assert.ok(
      files.has(
        `${repo}/images/${decodeURIComponent(url.pathname.split("/images/")[1])}`,
      ),
    );
  }
  await page
    .getByRole("button", { name: "预览 summer [day].png", exact: true })
    .click();
  assert.ok(await page.locator("dialog").isVisible());
  await page.keyboard.press("Escape");
  assert.ok(!(await page.locator("dialog").isVisible()));
  await page.screenshot({
    path: path.join(screenshots, "desktop-uploaded.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "清空队列", exact: true }).click();
  assert.equal(files.size, 4);
  // Repeat exactly the same source bytes: deterministic in this browser, no write.
  await page.getByLabel("选择图片文件").setInputFiles(uploadFiles[0]);
  await page.getByRole("button", { name: "上传 1 张", exact: true }).click();
  await page.getByText(/已存在，复用链接/).waitFor();
  assert.equal(writes.length, 4);
  await page.getByRole("button", { name: "清空队列", exact: true }).click();
  // Invalid content fails before GitHub; no script executes from filenames.
  await page.getByLabel("选择图片文件").setInputFiles({
    name: "<img onerror=alert(1)>.png",
    mimeType: "image/png",
    buffer: Buffer.from('<svg onload="alert(1)"/>'),
  });
  await page.getByRole("button", { name: "上传 1 张", exact: true }).click();
  await page
    .getByText("文件内容不是支持的图片格式。", { exact: true })
    .waitFor();
  assert.equal(writes.length, 4);
  await page.getByRole("button", { name: "清空队列", exact: true }).click();
  await page
    .getByLabel("选择图片文件")
    .setInputFiles(Array.from({ length: 21 }, () => uploadFiles[0]));
  await page.getByRole("alert").filter({ hasText: "最多 20 张" }).waitFor();
  assert.equal(await page.locator(".queue li").count(), 0);
  await page
    .getByLabel("选择图片文件")
    .setInputFiles(Array.from({ length: 20 }, () => uploadFiles[0]));
  assert.equal(await page.locator(".queue li").count(), 20);
  await page.getByRole("button", { name: "清空队列", exact: true }).click();
  // Browser clipboard and drop use File objects and the same queue path.
  await page.evaluate((content) => {
    const binary = atob(content);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([bytes], "pasted.png", { type: "image/png" }));
    document.body.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true }),
    );
    document.querySelector(".drop-zone").dispatchEvent(
      new DragEvent("drop", {
        dataTransfer: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, pngs[0]);
  await page.waitForFunction(
    () => document.querySelectorAll(".queue li").length === 2,
  );
  await page.getByRole("button", { name: "图片库", exact: true }).click();
  await page.locator(".gallery article").first().waitFor();
  assert.equal(await page.locator(".gallery article").count(), 4);
  assert.equal(
    await page
      .locator(
        '.gallery a[href="https://raw.githubusercontent.com/hugh-zhan9/hugh-image/refs/heads/main/images/legacy.png"]',
      )
      .count(),
    1,
  );
  assert.deepEqual(files.get("hugh-image/images/legacy.png"), {
    buffer: legacyBuffer,
    sha: legacySha,
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".gallery img")].every(
      (img) => img.naturalWidth > 0,
    ),
  );
  await page.screenshot({
    path: path.join(screenshots, "desktop-library.png"),
    fullPage: true,
  });
  treeError = true;
  await page.getByRole("button", { name: "刷新列表" }).click();
  await page.getByRole("alert").filter({ hasText: "500" }).waitFor();
  assert.equal(await page.locator(".gallery article").count(), 0);
  treeError = false;
  truncated = true;
  await page.getByRole("button", { name: "刷新列表" }).click();
  await page.getByRole("alert").filter({ hasText: "截断" }).waitFor();
  truncated = false;
  await page.getByRole("button", { name: "刷新列表" }).click();
  await page.locator(".gallery article").first().waitFor();
  // Pagination spans the merged library, including the same path in two repositories.
  files.set("hugh-image-02/images/legacy.png", {
    buffer: legacyBuffer,
    sha: legacySha,
  });
  for (let i = 0; i < 60; i++) {
    files.set(`hugh-image-03/images/page-${i}.png`, {
      buffer: legacyBuffer,
      sha: legacySha,
    });
  }
  await page.getByRole("button", { name: "刷新列表" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".gallery article").length === 60,
  );
  await page.getByRole("button", { name: "再显示 60 张" }).click();
  assert.equal(await page.locator(".gallery article").count(), 65);
  assert.equal(
    await page
      .locator(
        '.gallery a[href="https://raw.githubusercontent.com/hugh-zhan9/hugh-image-02/refs/heads/main/images/legacy.png"]',
      )
      .count(),
    1,
  );
  assert.equal(
    await page.getByRole("button", { name: "再显示 60 张" }).count(),
    0,
  );
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Overflow at ${width}`,
    );
  }
  await page.screenshot({
    path: path.join(screenshots, "library-wide.png"),
    fullPage: true,
  });
  await page.getByLabel("GitHub Token", { exact: true }).fill("");
  await page
    .getByText("连接仓库后，查看已上传图片。", { exact: true })
    .waitFor();
  assert.equal(await page.locator(".gallery article").count(), 0);
  assert.equal(
    await page.getByLabel("GitHub Token", { exact: true }).inputValue(),
    "",
  );
  await page.getByLabel("GitHub Token", { exact: true }).fill(token);
  await page.getByRole("button", { name: "连接仓库", exact: true }).click();
  await page.getByText("仓库已连接，可以上传图片。", { exact: true }).waitFor();
  await page.evaluate(() => localStorage.setItem("theme-storage", "dark"));
  await page.reload();
  await page.getByRole("heading", { name: "为文字，留一幅画面。" }).waitFor();
  assert.equal(
    await page.getByLabel("GitHub Token", { exact: true }).inputValue(),
    "",
  );
  assert.equal(await page.locator(".settings-panel input").count(), 1);
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({
    path: path.join(screenshots, "mobile-dark.png"),
    fullPage: true,
  });
  await page.evaluate(() => window.siteAppearance.choose("#eaf1eb"));
  assert.equal(await page.locator("html").getAttribute("data-skin"), "custom");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  // Repository pool connection works even when browser storage is blocked.
  const blocked = await context.newPage();
  await blocked.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    });
  });
  await blocked.goto(`${base}/images/`);
  await blocked.getByLabel("GitHub Token", { exact: true }).fill(token);
  await blocked.getByRole("button", { name: "连接仓库", exact: true }).click();
  await blocked
    .getByText("仓库已连接，可以上传图片。", { exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    `Browser checks passed; ${writes.length} mocked writes, no live GitHub mutations. Screenshots: ${screenshots}`,
  );
} finally {
  await browser.close();
}
