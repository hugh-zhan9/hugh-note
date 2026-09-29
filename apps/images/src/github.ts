export interface Settings {
  owner: string;
  repo: string;
  branch: string;
  publicBaseUrl: string;
}
export interface Picture {
  path: string;
  size: number;
  sha: string;
}
export interface PreparedImage {
  bytes: Uint8Array<ArrayBuffer>;
  path: string;
  sha: string;
}
export const defaults: Settings = {
  owner: "hugh-zhan9",
  repo: "hugh-image",
  branch: "main",
  publicBaseUrl: "",
};

export function validateSettings(value: Settings): Settings {
  const s = Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, v.trim()]),
  ) as unknown as Settings;
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(s.owner))
    throw new Error("请填写有效的 GitHub 用户或组织名。");
  if (!/^[a-z\d_.-]{1,100}$/i.test(s.repo) || /^\.+$/.test(s.repo))
    throw new Error("请填写仓库名，不要填写完整 URL。");
  if (`${s.owner}/${s.repo}`.toLowerCase() === "hugh-zhan9/hugh-note")
    throw new Error("请选择独立的图片仓库，不能使用文章仓库。");
  if (
    !s.branch ||
    s.branch === "@" ||
    /[\s~^:?*\[\\\x00-\x1f\x7f]/.test(s.branch) ||
    s.branch.includes("..") ||
    s.branch.includes("@{") ||
    s.branch
      .split("/")
      .some(
        (p) =>
          !p || p.startsWith(".") || p.endsWith(".") || p.endsWith(".lock"),
      )
  )
    throw new Error("请填写有效分支名，例如 main。");
  if (s.publicBaseUrl) {
    let url: URL;
    try {
      url = new URL(s.publicBaseUrl);
    } catch {
      throw new Error("外链根地址必须是 HTTPS URL。");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        "外链根地址必须使用 HTTPS，且不能包含凭据、查询参数或片段。",
      );
    s.publicBaseUrl = url.href.replace(/\/+$/, "");
  }
  return s;
}

const encodePath = (path: string) =>
  path.split("/").map(encodeURIComponent).join("/");
export function pictureUrl(settings: Settings, path: string) {
  const base =
    settings.publicBaseUrl ||
    `https://raw.githubusercontent.com/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/refs/heads/${encodePath(settings.branch)}`;
  return `${base}/${encodePath(path)}`;
}
export function markdown(name: string, url: string) {
  return `![${name.replace(/[\r\n]/g, " ").replace(/[\\[\]]/g, "\\$&")}](${url.replace(/\(/g, "%28").replace(/\)/g, "%29")})`;
}
export function isImagePath(path: string) {
  return (
    path.startsWith("images/") &&
    /\.(jpe?g|png|webp|gif)$/i.test(path) &&
    path.split("/").every((p) => p && p !== "." && p !== "..")
  );
}

export class ApiError extends Error {
  constructor(public status: number) {
    super(
      (
        {
          401: "Token 无效或已过期，请更换。",
          403: "GitHub 拒绝访问，请检查 Token 仓库权限或 API 限额。",
          404: "找不到仓库、分支或文件，请检查配置与 Token 授权。",
          409: "仓库发生并发变更，请检查后手动重新上传。",
          422: "GitHub 未接受创建请求，请检查分支或稍后手动重试。",
          429: "GitHub 请求过于频繁，请稍后再试。",
        } as Record<number, string>
      )[status] || `GitHub 请求失败（${status}）。`,
    );
  }
}
export class GitHubImages {
  readonly settings: Settings;
  private disposed = false;
  private controllers = new Set<AbortController>();
  constructor(
    settings: Settings,
    private token: string,
    private readonly request: typeof fetch = (...args) =>
      globalThis.fetch(...args),
    private readonly timeoutMs = 30_000,
  ) {
    this.settings = validateSettings(settings);
    if (!token.trim() || /[\s\x00-\x1f\x7f]/.test(token))
      throw new Error("请填写有效的 GitHub Token。");
  }
  dispose() {
    this.disposed = true;
    this.token = "";
    this.controllers.forEach((controller) => controller.abort());
    this.controllers.clear();
  }
  private async api(suffix: string, body?: object): Promise<any> {
    if (this.disposed) throw new Error("Token 已清除，请重新连接仓库。");
    const controller = new AbortController();
    this.controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.request(
        `https://api.github.com/repos/${encodeURIComponent(this.settings.owner)}/${encodeURIComponent(this.settings.repo)}${suffix}`,
        {
          method: body ? "PUT" : "GET",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${this.token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
          credentials: "omit",
          redirect: "error",
          cache: "no-store",
        },
      );
      if (!response.ok) throw new ApiError(response.status);
      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new Error(
        body
          ? "网络中断或超时，入库结果未确认。请重新上传同图核对，已有文件不会覆盖。"
          : "无法读取 GitHub，请检查网络后重试。",
      );
    } finally {
      clearTimeout(timer);
      this.controllers.delete(controller);
    }
  }
  async connect() {
    const repo = await this.api("");
    if (repo.private !== false)
      throw new Error("请使用公开图片仓库，以提供无需 Token 的图片外链。");
    try {
      await this.api(`/branches/${encodeURIComponent(this.settings.branch)}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404)
        throw new Error(
          `无法读取 ${this.settings.owner}/${this.settings.repo} 的 ${this.settings.branch} 分支。若仓库为空，请先在 GitHub 添加 README 并提交到 ${this.settings.branch}；若分支已存在，请检查 Token 的仓库授权和 Contents 读取权限。`,
        );
      throw error;
    }
  }
  async list(): Promise<Picture[]> {
    const data = await this.api(
      `/git/trees/${encodeURIComponent(this.settings.branch)}?recursive=1`,
    );
    if (data.truncated)
      throw new Error(
        "仓库文件列表过大，GitHub 返回了截断结果，无法完整展示。",
      );
    if (!Array.isArray(data.tree))
      throw new Error("GitHub 返回的图片列表格式无效。");
    return data.tree
      .filter(
        (p: any) =>
          p.type === "blob" &&
          p.mode === "100644" &&
          typeof p.path === "string" &&
          isImagePath(p.path),
      )
      .map((p: any) => {
        if (
          !Number.isSafeInteger(p.size) ||
          p.size < 0 ||
          typeof p.sha !== "string" ||
          !p.sha
        )
          throw new Error("GitHub 返回的图片列表格式无效。");
        return { path: p.path, size: p.size, sha: p.sha };
      })
      .sort((a: Picture, b: Picture) => a.path.localeCompare(b.path));
  }
  async existing(image: PreparedImage) {
    validateImagePath(image.path);
    let file;
    try {
      file = await this.api(
        `/contents/${encodePath(image.path)}?ref=${encodeURIComponent(this.settings.branch)}`,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return false;
      throw error;
    }
    if (
      file.type !== "file" ||
      file.sha !== image.sha ||
      file.size !== image.bytes.byteLength
    )
      throw new Error("同路径已有不同内容，已拒绝覆盖。");
    return true;
  }
  async upload(image: PreparedImage): Promise<"created" | "existing"> {
    validateImagePath(image.path);
    if (await this.existing(image)) return "existing";
    // A missing sha is deliberate: GitHub cannot replace an existing file.
    try {
      const result = await this.api(`/contents/${encodePath(image.path)}`, {
        message: `Add image ${image.path.split("/").at(-1)}`,
        content: toBase64(image.bytes),
        branch: this.settings.branch,
      });
      if (result.content?.sha !== image.sha)
        throw new Error("GitHub 返回的文件校验值不一致，请手动检查仓库。");
      return "created";
    } catch (error) {
      if (
        error instanceof ApiError &&
        [409, 422].includes(error.status) &&
        (await this.existing(image))
      )
        return "existing";
      throw error;
    }
  }
}
export function validateImagePath(path: string) {
  if (!/^images\/[a-f0-9]{2}\/[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(path))
    throw new Error("无效的图片路径。");
}
export function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
const hex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export async function identify(
  bytes: Uint8Array<ArrayBuffer>,
  extension: string,
): Promise<PreparedImage> {
  const hash = hex(await crypto.subtle.digest("SHA-256", bytes));
  const header = new TextEncoder().encode(`blob ${bytes.byteLength}\0`);
  const blob = new Uint8Array(header.length + bytes.length);
  blob.set(header);
  blob.set(bytes, header.length);
  const sha = hex(await crypto.subtle.digest("SHA-1", blob));
  return {
    bytes,
    path: `images/${hash.slice(0, 2)}/${hash}.${extension}`,
    sha,
  };
}
