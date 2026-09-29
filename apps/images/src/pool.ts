import {
  GitHubImages,
  pictureUrl,
  validateSettings,
  validateImagePath,
  type Picture,
  type PreparedImage,
  type Settings,
} from "./github";

export interface LibraryPicture extends Picture {
  key: string;
  url: string;
}
type Snapshot = { files: Map<string, Picture>; bytes: number };

export class ImagePool {
  private readonly clients: GitHubImages[];
  private snapshots: Snapshot[] | null = null;
  // A failed PUT may have committed. Keep retries on that target in this session.
  private readonly attempted = new Map<string, number>();
  private disposed = false;
  private uploading = false;

  constructor(
    settings: readonly Settings[],
    token: string,
    request: typeof fetch = (...args) => globalThis.fetch(...args),
  ) {
    if (!settings.length) throw new Error("尚未配置图片仓库。");
    const validated = settings.map(validateSettings);
    const keys = validated.map((s) => `${s.owner}/${s.repo}`.toLowerCase());
    if (new Set(keys).size !== keys.length)
      throw new Error("图片仓库配置重复。");
    this.clients = validated.map((s) => new GitHubImages(s, token, request));
  }
  private assertActive() {
    if (this.disposed) throw new Error("Token 已清除，请重新连接仓库。");
  }
  dispose() {
    this.disposed = true;
    this.clients.forEach((client) => client.dispose());
    this.snapshots = null;
    this.attempted.clear();
  }
  async connect() {
    this.assertActive();
    for (const client of this.clients) await client.connect();
    this.assertActive();
  }
  private async refresh() {
    this.assertActive();
    this.snapshots = null;
    const snapshots: Snapshot[] = [];
    for (const client of this.clients) {
      const pictures = await client.list();
      const bytes = pictures.reduce(
        (total, picture) => total + picture.size,
        0,
      );
      if (!Number.isSafeInteger(bytes)) throw new Error("图片容量统计无效。");
      snapshots.push({
        files: new Map(pictures.map((p) => [p.path, p])),
        bytes,
      });
    }
    this.assertActive();
    this.snapshots = snapshots;
  }
  async prepareBatch() {
    await this.refresh();
  }
  async list(): Promise<LibraryPicture[]> {
    await this.refresh();
    return this.snapshots!.flatMap((snapshot, index) =>
      [...snapshot.files.values()].map((picture) => ({
        ...picture,
        key: `${this.clients[index].settings.owner}/${this.clients[index].settings.repo}/${picture.path}`,
        url: pictureUrl(this.clients[index].settings, picture.path),
      })),
    ).sort(
      (a, b) => a.path.localeCompare(b.path) || a.key.localeCompare(b.key),
    );
  }
  private remember(index: number, image: PreparedImage) {
    const snapshot = this.snapshots![index];
    const old = snapshot.files.get(image.path);
    const size = image.bytes.byteLength;
    snapshot.bytes += size - (old?.size ?? 0);
    snapshot.files.set(image.path, { path: image.path, sha: image.sha, size });
  }
  async upload(image: PreparedImage): Promise<{
    status: "created" | "existing";
    url: string;
  }> {
    this.assertActive();
    validateImagePath(image.path);
    if (this.uploading) throw new Error("请等待当前图片上传完成。");
    this.uploading = true;
    try {
      if (!this.snapshots) await this.refresh();
      let existing: number | undefined;
      // Read all locations: a collision or unreadable repository must not become
      // a new file in a different repository. Never trust a stale tree for dedup.
      for (let i = 0; i < this.clients.length; i++) {
        const found = await this.clients[i].existing(image);
        this.assertActive();
        if (found) {
          this.remember(i, image);
          existing ??= i;
        }
      }
      if (existing !== undefined) {
        this.attempted.delete(image.path);
        return {
          status: "existing",
          url: pictureUrl(this.clients[existing].settings, image.path),
        };
      }
      const snapshots = this.snapshots!;
      const target =
        this.attempted.get(image.path) ??
        snapshots.reduce(
          (least, current, index) =>
            current.bytes < snapshots[least].bytes ? index : least,
          0,
        );
      this.attempted.set(image.path, target);
      const status = await this.clients[target].upload(image);
      this.assertActive();
      this.remember(target, image);
      this.attempted.delete(image.path);
      return {
        status,
        url: pictureUrl(this.clients[target].settings, image.path),
      };
    } catch (error) {
      this.snapshots = null;
      throw error;
    } finally {
      this.uploading = false;
    }
  }
}
