import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import {
  ApiError,
  defaults,
  GitHubImages,
  identify,
  isImagePath,
  markdown,
  pictureUrl,
  toBase64,
  validateSettings,
  type Settings,
} from "./github";
import { detectFormat, fileError, MAX_SIZE } from "./image";

const config: Settings = { ...defaults, repo: "photo-test" };
const token = "github_pat_TEST_ONLY";
function fixture(
  replies: Array<[number, unknown]>,
  options: Partial<Settings> = {},
) {
  const calls: { url: string; init: RequestInit }[] = [];
  const api = new GitHubImages({ ...config, ...options }, token, (async (
    url,
    init,
  ) => {
    calls.push({ url: String(url), init: init! });
    assert.equal(new URL(String(url)).origin, "https://api.github.com");
    const reply = replies.shift();
    assert.ok(reply, `Unexpected request ${url}`);
    return new Response(JSON.stringify(reply[1]), { status: reply[0] });
  }) as typeof fetch);
  return { api, calls };
}
const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const fileMeta = (image: Awaited<ReturnType<typeof identify>>) => ({
  type: "file",
  sha: image.sha,
  size: image.bytes.length,
});

test("configuration rejects article repository, invalid refs and credential-bearing URLs", () => {
  for (const value of [
    { repo: "hugh-note" },
    { owner: "../user" },
    { repo: ".." },
    { repo: "repo/path" },
    { branch: "../main" },
    { branch: "main.lock" },
    { branch: "main//x" },
    { branch: "a@{b" },
    { publicBaseUrl: "http://example.com" },
    { publicBaseUrl: "https://user:secret@example.com" },
    { publicBaseUrl: "https://example.com?q=token" },
  ]) {
    assert.throws(() => validateSettings({ ...config, ...value }));
  }
  assert.equal(
    validateSettings({
      ...config,
      branch: "photos/main",
      publicBaseUrl: " https://img.example.com/base/ ",
    }).publicBaseUrl,
    "https://img.example.com/base",
  );
});
test("links encode paths and markdown prevents filename injection", () => {
  assert.equal(
    pictureUrl(config, "images/a #).png"),
    "https://raw.githubusercontent.com/hugh-zhan9/photo-test/refs/heads/main/images/a%20%23).png",
  );
  assert.equal(
    pictureUrl(
      { ...config, publicBaseUrl: "https://img.example.com" },
      "images/a.png",
    ),
    "https://img.example.com/images/a.png",
  );
  assert.equal(
    markdown("a]\n[x", "https://e.com/a(b)"),
    "![a\\] \\[x](https://e.com/a%28b%29)",
  );
  assert.equal(isImagePath("images/../secret.png"), false);
  assert.equal(isImagePath("images/a.svg"), false);
});
test("content paths and Git blob checksums use final bytes", async () => {
  const image = await identify(bytes, "png");
  const hash = createHash("sha256").update(bytes).digest("hex");
  assert.equal(image.path, `images/${hash.slice(0, 2)}/${hash}.png`);
  assert.equal(
    image.sha,
    createHash("sha1")
      .update(`blob ${bytes.length}\0`)
      .update(bytes)
      .digest("hex"),
  );
  assert.equal(
    toBase64(new Uint8Array(20000).fill(255)),
    Buffer.alloc(20000, 255).toString("base64"),
  );
});
test("connection requires a public repository and existing selected branch, without writes", async () => {
  const { api, calls } = fixture(
    [
      [200, { private: false }],
      [200, {}],
    ],
    { branch: "photos/main" },
  );
  await api.connect();
  assert.ok(calls[1].url.endsWith("/branches/photos%2Fmain"));
  assert.ok(calls.every((c) => c.init.method === "GET"));
  await assert.rejects(
    fixture([[200, { private: true }]]).api.connect(),
    /公开/,
  );
  await assert.rejects(
    fixture([
      [200, { private: false }],
      [404, {}],
    ]).api.connect(),
    /分支/,
  );
});
test("missing branch gives initialization guidance without writing or hiding other errors", async () => {
  const missing = fixture([
    [200, { private: false }],
    [404, { message: token }],
  ]);
  await assert.rejects(missing.api.connect(), (error: Error) => {
    assert.match(error.message, /photo-test 的 main 分支/);
    assert.match(error.message, /添加 README 并提交到 main/);
    assert.match(error.message, /Token 的仓库授权/);
    assert.ok(!error.message.includes(token));
    return true;
  });
  assert.equal(missing.calls.length, 2);
  assert.ok(missing.calls.every((call) => call.init.method === "GET"));
  for (const status of [401, 403, 500]) {
    await assert.rejects(
      fixture([
        [200, { private: false }],
        [status, {}],
      ]).api.connect(),
      (error: Error) => error instanceof ApiError && error.status === status,
    );
  }
});
test("new upload creates exactly one file and cannot supply overwrite sha", async () => {
  const image = await identify(bytes, "png");
  const { api, calls } = fixture([
    [404, {}],
    [201, { content: { sha: image.sha } }],
  ]);
  assert.equal(await api.upload(image), "created");
  const write = calls[1];
  assert.equal(write.init.method, "PUT");
  assert.deepEqual(JSON.parse(String(write.init.body)), {
    message: `Add image ${image.path.split("/").at(-1)}`,
    content: Buffer.from(bytes).toString("base64"),
    branch: "main",
  });
  assert.equal(write.init.redirect, "error");
  assert.equal(write.init.credentials, "omit");
  assert.equal(
    new Headers(write.init.headers).get("Authorization"),
    `Bearer ${token}`,
  );
  assert.ok(
    calls.every(
      (c) => !c.url.includes(token) && !String(c.init.body).includes(token),
    ),
  );
});
test("same content is reused without writing, mismatch refuses overwrite", async () => {
  const image = await identify(bytes, "png");
  const { api, calls } = fixture([[200, fileMeta(image)]]);
  assert.equal(await api.upload(image), "existing");
  assert.equal(calls.length, 1);
  for (const changed of [{ sha: "different" }, { size: 0 }, { type: "dir" }]) {
    const f = fixture([[200, { ...fileMeta(image), ...changed }]]);
    await assert.rejects(f.api.upload(image), /拒绝覆盖/);
    assert.equal(f.calls.length, 1);
  }
});
for (const status of [409, 422])
  test(`concurrent ${status} rechecks same bytes without retrying a write`, async () => {
    const image = await identify(bytes, "png");
    const { api, calls } = fixture([
      [404, {}],
      [status, {}],
      [200, fileMeta(image)],
    ]);
    assert.equal(await api.upload(image), "existing");
    assert.deepEqual(
      calls.map((c) => c.init.method),
      ["GET", "PUT", "GET"],
    );
    const missing = fixture([
      [404, {}],
      [status, {}],
      [404, {}],
    ]);
    await assert.rejects(missing.api.upload(image), ApiError);
    assert.equal(missing.calls.length, 3);
  });
for (const status of [401, 403, 404, 429, 500])
  test(`HTTP ${status} is an error, not an empty library, and never echoes upstream secrets`, async () => {
    const { api, calls } = fixture([[status, { message: token }]]);
    await assert.rejects(
      api.list(),
      (error) =>
        error instanceof ApiError &&
        error.status === status &&
        !error.message.includes(token),
    );
    assert.equal(calls.length, 1);
  });
test("empty, single and truncated tree results remain distinct", async () => {
  assert.deepEqual(await fixture([[200, { tree: [] }]]).api.list(), []);
  const image = { path: "images/a.png", sha: "abc", size: 12 };
  const f = fixture([
    [
      200,
      {
        tree: [
          { ...image, type: "blob", mode: "100644" },
          { ...image, path: "images/x.svg", type: "blob", mode: "100644" },
          { ...image, path: "images/link.png", type: "blob", mode: "120000" },
        ],
      },
    ],
  ]);
  assert.deepEqual(await f.api.list(), [image]);
  await assert.rejects(
    fixture([[200, { tree: [], truncated: true }]]).api.list(),
    /截断/,
  );
  await assert.rejects(fixture([[200, {}]]).api.list(), /格式/);
});
test("timeouts and network errors redact details and never automatically retry", async () => {
  let calls = 0;
  const api = new GitHubImages(
    config,
    token,
    ((_url, init) => {
      calls++;
      return new Promise((_resolve, reject) =>
        init!.signal!.addEventListener("abort", () => reject(new Error(token))),
      );
    }) as typeof fetch,
    5,
  );
  await assert.rejects(api.list(), /无法读取/);
  assert.equal(calls, 1);
  const image = await identify(bytes, "png");
  let writes = 0;
  const failed = new GitHubImages(config, token, (async (_url, init) => {
    if (init?.method === "PUT") {
      writes++;
      throw new Error(token);
    }
    return new Response("{}", { status: 404 });
  }) as typeof fetch);
  await assert.rejects(
    failed.upload(image),
    (error) =>
      error instanceof Error &&
      /未确认/.test(error.message) &&
      !error.message.includes(token),
  );
  assert.equal(writes, 1);
});
test("invalid upload path is rejected before any network operation", async () => {
  const image = await identify(bytes, "png");
  const f = fixture([]);
  await assert.rejects(
    f.api.upload({ ...image, path: "../README.md" }),
    /路径/,
  );
  assert.equal(f.calls.length, 0);
  assert.throws(() => new GitHubImages(config, ""));
});
test("clearing a session aborts pending requests and prevents any further request", async () => {
  let calls = 0;
  const api = new GitHubImages(config, token, ((_url, init) => {
    calls++;
    return new Promise((_resolve, reject) =>
      init!.signal!.addEventListener("abort", () =>
        reject(new Error("aborted")),
      ),
    );
  }) as typeof fetch);
  const pending = assert.rejects(api.list(), /无法读取/);
  api.dispose();
  await pending;
  await assert.rejects(api.list(), /Token 已清除/);
  assert.equal(calls, 1);
});
test("image input boundaries and magic bytes reject empty, large, SVG and corrupt content", () => {
  assert.match(
    fileError(new File([], "empty.png", { type: "image/png" })),
    /空/,
  );
  assert.match(
    fileError(
      new File([new Uint8Array(MAX_SIZE + 1)], "large.png", {
        type: "image/png",
      }),
    ),
    /10 MB/,
  );
  assert.match(
    fileError(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" })),
    /只支持/,
  );
  assert.equal(
    fileError(new File([bytes], "x.png", { type: "image/png" })),
    "",
  );
  assert.equal(detectFormat(bytes).ext, "png");
  assert.equal(detectFormat(new TextEncoder().encode("GIF89a123")).ext, "gif");
  assert.throws(
    () => detectFormat(new TextEncoder().encode("<svg></svg>")),
    /文件内容/,
  );
});
