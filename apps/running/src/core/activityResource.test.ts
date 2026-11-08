import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJsonResource } from './activityResource';

test('concurrent reads share one request and successful data stays cached', async () => {
  let resolve!: (response: Response) => void;
  let calls = 0;
  const resource = createJsonResource(
    '/data/index.hash.json',
    (v) => v,
    async (_url, init) => {
      calls++;
      assert.equal(init, undefined);
      return new Promise<Response>((done) => {
        resolve = done;
      });
    }
  );
  const pending = resource.load();
  assert.equal(resource.load(), pending);
  try {
    resource.read();
    assert.fail('must suspend');
  } catch (value) {
    assert.equal(value, pending);
  }
  resolve(Response.json([1, 2]));
  assert.deepEqual(await pending, [1, 2]);
  assert.deepEqual(resource.read(), [1, 2]);
  assert.equal(calls, 1);
});

test('HTTP, parsing and network errors stay visible until a manual retry', async () => {
  for (const failure of ['http', 'parse', 'network']) {
    let calls = 0;
    const resource = createJsonResource(
      '/data/test',
      (v) => {
        if (v === 'bad') throw new Error('invalid data');
        return v;
      },
      async () => {
        if (++calls > 1) return Response.json([]);
        if (failure === 'network') throw new Error('offline');
        return failure === 'http'
          ? Response.json([], { status: 503 })
          : Response.json('bad');
      }
    );
    await assert.rejects(resource.load());
    assert.throws(() => resource.read());
    assert.equal(calls, 1);
    resource.reset();
    assert.deepEqual(await resource.load(), []);
    assert.deepEqual(resource.read(), []);
    assert.equal(calls, 2);
  }
});
