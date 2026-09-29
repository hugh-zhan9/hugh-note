import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { defaults, identify, type Picture } from "./github";
import { ImagePool } from "./pool";

const token = "github_pat_POOL_TEST_ONLY";
const settings = ["photos-a", "photos-b", "photos-c"].map((repo) => ({
  ...defaults,
  repo,
}));
const image = (size: number, byte = 1) =>
  identify(new Uint8Array(size).fill(byte), "png");
function fixture(count = 3) {
  const files = Array.from({ length: count }, () => new Map<string, Picture>());
  const calls: { repo: number; method: string; path: string }[] = [];
  let treeFailure = -1;
  let truncated = -1;
  let readFailure = -1;
  let connectFailure = -1;
  let failWrite = false;
  let commitThenFail = false;
  let conflict = false;
  const api = new ImagePool(settings.slice(0, count), token, (async (
    url,
    init,
  ) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.origin, "https://api.github.com");
    assert.equal(
      new Headers(init!.headers).get("Authorization"),
      `Bearer ${token}`,
    );
    assert.equal(init!.redirect, "error");
    const repo = settings.findIndex(
      (s) =>
        parsed.pathname.startsWith(`/repos/${s.owner}/${s.repo}/`) ||
        parsed.pathname === `/repos/${s.owner}/${s.repo}`,
    );
    assert.ok(repo >= 0 && repo < count);
    const method = init!.method!;
    const path = decodeURIComponent(
      parsed.pathname.split("/contents/")[1] || "",
    );
    calls.push({ repo, method, path });
    const reply = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status });
    if (method === "PUT") {
      const body = JSON.parse(String(init!.body));
      assert.deepEqual(Object.keys(body).sort(), [
        "branch",
        "content",
        "message",
      ]);
      assert.equal(body.branch, "main");
      assert.ok(!String(init!.body).includes(token));
      if (failWrite) throw new Error(token);
      const bytes = Buffer.from(body.content, "base64");
      const sha = createHash("sha1")
        .update(`blob ${bytes.length}\0`)
        .update(bytes)
        .digest("hex");
      files[repo].set(path, { path, sha, size: bytes.length });
      if (commitThenFail) throw new Error(token);
      return reply(conflict ? 422 : 201, { content: { sha } });
    }
    assert.equal(method, "GET");
    if (parsed.pathname.includes("/contents/")) {
      if (repo === readFailure) return reply(403, { message: token });
      const file = files[repo].get(path);
      return file ? reply(200, { ...file, type: "file" }) : reply(404, {});
    }
    if (parsed.pathname.includes("/git/trees/")) {
      if (repo === treeFailure) return reply(500, {});
      return reply(200, {
        truncated: repo === truncated,
        tree: [...files[repo].values()].map((p) => ({
          ...p,
          type: "blob",
          mode: "100644",
        })),
      });
    }
    return repo === connectFailure
      ? reply(403, {})
      : reply(200, { private: false });
  }) as typeof fetch);
  return {
    api,
    files,
    calls,
    writes: () => calls.filter((c) => c.method === "PUT"),
    seed: (repo: number, size: number, path = "images/legacy.png") =>
      files[repo].set(path, { path, sha: "legacy-sha", size }),
    failTree: (repo: number) => {
      treeFailure = repo;
    },
    truncate: (repo: number) => {
      truncated = repo;
    },
    failRead: (repo: number) => {
      readFailure = repo;
    },
    failConnect: (repo: number) => {
      connectFailure = repo;
    },
    failWrite: (value: boolean) => {
      failWrite = value;
    },
    commitThenFail: (value: boolean) => {
      commitThenFail = value;
    },
    conflict: (value: boolean) => {
      conflict = value;
    },
  };
}

test("pool rejects empty, duplicate and article repositories before requests", () => {
  assert.throws(() => new ImagePool([], token), /尚未配置/);
  assert.throws(
    () =>
      new ImagePool(
        [
          defaults,
          { ...defaults, repo: defaults.repo.toUpperCase(), branch: "other" },
        ],
        token,
      ),
    /重复/,
  );
  assert.throws(
    () => new ImagePool([{ ...defaults, repo: "hugh-note" }], token),
    /文章仓库/,
  );
});
test("connect checks every public repository and branch without writes; any failure rejects", async () => {
  const f = fixture();
  await f.api.connect();
  assert.deepEqual(
    f.calls.map((c) => c.repo),
    [0, 0, 1, 1, 2, 2],
  );
  assert.equal(f.writes().length, 0);
  f.failConnect(1);
  await assert.rejects(f.api.connect(), /拒绝访问/);
});
test("empty and single-repository pools retain upload and list behavior", async () => {
  const f = fixture(1);
  assert.deepEqual(await f.api.list(), []);
  await f.api.prepareBatch();
  const result = await f.api.upload(await image(10));
  assert.equal(result.status, "created");
  assert.match(result.url, /photos-a\/refs\/heads\/main/);
  assert.equal((await f.api.list()).length, 1);
});
test("unequal byte occupancy determines targets and updates after each image, preserving old files", async () => {
  const f = fixture();
  f.seed(0, 800);
  f.seed(1, 300);
  f.seed(2, 310);
  const old = f.files.map((files) => JSON.stringify([...files]));
  await f.api.prepareBatch();
  await f.api.upload(await image(20));
  await f.api.upload(await image(5));
  await f.api.upload(await image(10, 2));
  assert.deepEqual(
    f.writes().map((c) => c.repo),
    [1, 2, 2],
  );
  f.files.forEach((files, index) =>
    assert.equal(JSON.stringify([...files].slice(0, 1)), old[index]),
  );
});
test("ties are stable; empty added repositories receive new files before a full old repository", async () => {
  const f = fixture();
  f.seed(0, 1000);
  await f.api.upload(await image(20));
  await f.api.upload(await image(30));
  await f.api.upload(await image(5));
  assert.deepEqual(
    f.writes().map((c) => c.repo),
    [1, 2, 1],
  );
});
test("cross-repository duplicates reuse the original URL without writes even after balance changes", async () => {
  const f = fixture();
  const input = await image(20);
  f.files[0].set(input.path, { path: input.path, sha: input.sha, size: 20 });
  f.seed(0, 900);
  const result = await f.api.upload(input);
  assert.equal(result.status, "existing");
  assert.match(result.url, /photos-a/);
  assert.equal(f.writes().length, 0);
});
test("a collision in another repository rejects even when a valid duplicate was found", async () => {
  const f = fixture();
  const input = await image(20);
  f.files[0].set(input.path, { path: input.path, sha: input.sha, size: 20 });
  f.files[2].set(input.path, { path: input.path, sha: "different", size: 20 });
  await assert.rejects(f.api.upload(input), /拒绝覆盖/);
  assert.equal(f.writes().length, 0);
});
test("failed or truncated trees never return a partial library or enable uploads from stale counts", async () => {
  for (const mode of ["error", "truncated"] as const) {
    const f = fixture();
    f.seed(0, 10);
    await f.api.prepareBatch();
    if (mode === "error") f.failTree(2);
    else f.truncate(2);
    await assert.rejects(f.api.list(), mode === "error" ? /500/ : /截断/);
    await assert.rejects(f.api.upload(await image(20)));
    assert.equal(f.writes().length, 0);
  }
});
test("invalid picture sizes fail statistics instead of silently counting them as zero", async () => {
  for (const size of [-1, 1.2, Number.MAX_SAFE_INTEGER + 1, NaN]) {
    const f = fixture();
    f.seed(0, size);
    await assert.rejects(f.api.prepareBatch(), /格式/);
    assert.equal(f.writes().length, 0);
  }
});
test("metadata permission failures cannot cause a duplicate write elsewhere", async () => {
  const f = fixture();
  f.failRead(2);
  await assert.rejects(f.api.upload(await image(20)), /拒绝访问/);
  assert.equal(f.writes().length, 0);
});
test("a failed write preserves earlier successes and later images refresh occupancy", async () => {
  const f = fixture();
  await f.api.upload(await image(20));
  f.failWrite(true);
  await assert.rejects(f.api.upload(await image(30)), /未确认/);
  assert.equal(f.writes().length, 2);
  f.failWrite(false);
  f.seed(1, 100);
  await f.api.upload(await image(40));
  assert.deepEqual(
    f.writes().map((c) => c.repo),
    [0, 1, 2],
  );
  assert.equal(f.files[0].size, 1);
});
test("unknown results keep manual retries on the original target even if occupancy changes", async () => {
  const f = fixture();
  const input = await image(20);
  f.failWrite(true);
  await assert.rejects(f.api.upload(input), /未确认/);
  assert.equal(f.writes().length, 1);
  f.seed(0, 900);
  f.failWrite(false);
  await f.api.prepareBatch();
  await f.api.upload(input);
  assert.deepEqual(
    f.writes().map((c) => c.repo),
    [0, 0],
  );
});
test("a committed but failed response is reused on manual retry without another PUT", async () => {
  const f = fixture();
  const input = await image(20);
  f.commitThenFail(true);
  await assert.rejects(f.api.upload(input), /未确认/);
  f.commitThenFail(false);
  assert.equal((await f.api.upload(input)).status, "existing");
  assert.equal(f.writes().length, 1);
});
test("concurrent creation is counted even when upload returns existing", async () => {
  const f = fixture();
  f.conflict(true);
  assert.equal((await f.api.upload(await image(100))).status, "existing");
  f.conflict(false);
  await f.api.upload(await image(20));
  assert.deepEqual(
    f.writes().map((c) => c.repo),
    [0, 1],
  );
});
test("same paths in different repositories have distinct keys and source-correct URLs", async () => {
  const f = fixture();
  f.seed(0, 10);
  f.seed(1, 20);
  const pictures = await f.api.list();
  assert.equal(pictures.length, 2);
  assert.equal(new Set(pictures.map((p) => p.key)).size, 2);
  assert.match(
    pictures[0].url,
    /photos-a\/refs\/heads\/main\/images\/legacy.png$/,
  );
  assert.match(
    pictures[1].url,
    /photos-b\/refs\/heads\/main\/images\/legacy.png$/,
  );
});
test("dispose aborts an in-flight read and prevents subsequent operations", async () => {
  let calls = 0;
  const api = new ImagePool(settings, token, ((_url, init) => {
    calls++;
    return new Promise((_resolve, reject) =>
      init!.signal!.addEventListener("abort", () => reject(new Error(token))),
    );
  }) as typeof fetch);
  const pending = assert.rejects(api.prepareBatch(), /无法读取/);
  api.dispose();
  await pending;
  await assert.rejects(api.list(), /Token 已清除/);
  await assert.rejects(api.upload(await image(1)), /Token 已清除/);
  assert.equal(calls, 1);
});
