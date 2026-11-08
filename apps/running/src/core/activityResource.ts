// Each URL identifies an immutable build output. Sharing the promise deduplicates
// concurrent components without making an error permanent across explicit retries.
export function createJsonResource<T>(
  url: string,
  parse: (value: unknown) => T,
  request: typeof fetch = (...args) => fetch(...args)
) {
  let value: T;
  let ready = false;
  let pending: Promise<T> | undefined;
  let error: unknown;
  return {
    load() {
      pending ??= request(url)
        .then((response) => {
          if (!response.ok) throw new Error(`数据加载失败：${response.status}`);
          return response.json();
        })
        .then((data) => {
          value = parse(data);
          ready = true;
          return value;
        })
        .catch((reason: unknown) => {
          error = reason;
          throw reason;
        });
      return pending;
    },
    read(): T {
      if (error) throw error;
      if (ready) return value;
      throw this.load();
    },
    reset() {
      pending = undefined;
      error = undefined;
      ready = false;
    },
  };
}
