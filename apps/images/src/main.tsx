import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  defaults,
  GitHubImages,
  markdown,
  pictureUrl,
  type Picture,
} from "./github";
import { fileError, formatSize, MAX_BATCH, prepareImage } from "./image";
import "../../../assets/css/site-tokens.css";
import "./style.css";

type Item = {
  id: string;
  file: File;
  preview: string;
  status:
    | "waiting"
    | "preparing"
    | "uploading"
    | "created"
    | "existing"
    | "error";
  message?: string;
  url?: string;
  size?: number;
};
const labels: Record<Item["status"], string> = {
  waiting: "等待上传",
  preparing: "处理图片…",
  uploading: "写入仓库…",
  created: "已入库",
  existing: "已存在，复用链接",
  error: "上传失败",
};
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "操作失败，请重试。";
function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <path d="M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5" />
    </svg>
  );
}
function App() {
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const client = useRef<GitHubImages | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [compress, setCompress] = useState(true);
  const [tab, setTab] = useState<"upload" | "library">("upload");
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [libraryState, setLibraryState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [libraryError, setLibraryError] = useState("");
  const [visible, setVisible] = useState(60);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(
    null,
  );
  const picker = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const localUrls = useRef(new Set<string>());
  useEffect(
    () => () => {
      localUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  useEffect(() => {
    if (preview) dialog.current?.showModal();
  }, [preview]);
  useEffect(() => {
    const clearOnLeave = () => flushSync(() => disconnect());
    window.addEventListener("pagehide", clearOnLeave);
    return () => window.removeEventListener("pagehide", clearOnLeave);
  }, []);
  const setWorking = (value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  };
  function disconnect() {
    client.current?.dispose();
    client.current = null;
    setConnected(false);
    setToken("");
    setPictures([]);
    setLibraryState("idle");
    setNotice("Token 已清除。");
  }
  async function connect(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    setWorking(true);
    setError("");
    setNotice("");
    client.current?.dispose();
    client.current = null;
    setConnected(false);
    try {
      const next = new GitHubImages(defaults, token.trim());
      client.current = next;
      await next.connect();
      if (client.current !== next) return;
      setConnected(true);
      setNotice("仓库已连接，可以上传图片。");
    } catch (error) {
      client.current?.dispose();
      client.current = null;
      setError(errorText(error));
    } finally {
      setWorking(false);
    }
  }
  function addFiles(files: File[]) {
    if (busyRef.current || !files.length) return;
    setError("");
    setNotice("");
    setItems((current) => {
      if (current.length + files.length > MAX_BATCH) {
        setError(`上传队列最多 ${MAX_BATCH} 张，请先清空本次队列。`);
        return current;
      }
      return [
        ...current,
        ...files.map((file) => {
          const error = fileError(file);
          const url = error ? "" : URL.createObjectURL(file);
          if (url) localUrls.current.add(url);
          return {
            id: crypto.randomUUID(),
            file,
            preview: url,
            status: error ? ("error" as const) : ("waiting" as const),
            message: error || undefined,
          };
        }),
      ];
    });
    setTab("upload");
  }
  // Ignore text fields so pasting a token never enters the image queue.
  useEffect(() => {
    function paste(event: ClipboardEvent) {
      if (
        (event.target as HTMLElement)?.closest(
          'input, textarea, [contenteditable="true"]',
        )
      )
        return;
      const files = Array.from(event.clipboardData?.files || []);
      if (files.length) {
        event.preventDefault();
        addFiles(files);
      }
    }
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  }, []);
  const updateItem = (id: string, patch: Partial<Item>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  async function upload(ids?: string[]) {
    if (busyRef.current || !client.current) return;
    const api = client.current;
    const batch = items.filter((item) =>
      ids ? ids.includes(item.id) : item.status === "waiting",
    );
    if (!batch.length) return;
    setWorking(true);
    setNotice("");
    setError("");
    let completed = 0;
    try {
      for (const item of batch) {
        try {
          updateItem(item.id, { status: "preparing", message: undefined });
          const image = await prepareImage(item.file, compress);
          updateItem(item.id, {
            status: "uploading",
            size: image.bytes.length,
          });
          const status = await api.upload(image);
          updateItem(item.id, {
            status,
            url: pictureUrl(api.settings, image.path),
          });
          completed++;
        } catch (error) {
          updateItem(item.id, { status: "error", message: errorText(error) });
        }
      }
      setNotice(
        `本次 ${batch.length} 张，${completed} 张已入库或已存在，${batch.length - completed} 张失败。`,
      );
      setLibraryState("idle");
    } finally {
      setWorking(false);
    }
  }
  async function loadLibrary() {
    if (busyRef.current || !client.current) return;
    setWorking(true);
    setLibraryState("loading");
    setLibraryError("");
    setVisible(60);
    try {
      setPictures(await client.current.list());
      setLibraryState("ready");
    } catch (error) {
      setLibraryState("error");
      setLibraryError(errorText(error));
    } finally {
      setWorking(false);
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("已复制到剪贴板。");
      setError("");
    } catch {
      setError("浏览器未允许复制，请选择链接文字后手动复制。");
    }
  }
  function clearQueue() {
    localUrls.current.forEach((url) => URL.revokeObjectURL(url));
    localUrls.current.clear();
    setItems([]);
    setNotice("本次队列已清空，仓库中的图片不受影响。");
    setError("");
  }
  const complete = items.filter((item) => item.url);
  const waiting = items.filter((item) => item.status === "waiting").length;
  return (
    <>
      <a className="skip-link" href="#main">
        跳到内容
      </a>
      <header className="site-header">
        <a className="brand" href="/">
          牧己<span> / 图床</span>
        </a>
        <nav aria-label="站点导航">
          <a href="/blog/">文章</a>
          <a href="/crazy-talk/">碎念</a>
          <a href="/running/">跑步</a>
          <a href="/images/" aria-current="page">
            图床
          </a>
        </nav>
      </header>
      <main id="main">
        <section className="intro">
          <div>
            <p className="eyebrow">A PLACE FOR YOUR IMAGES</p>
            <h1>为文字，留一幅画面。</h1>
            <p className="lead">上传、收藏、引用。</p>
            <p className="lead">让每张图片，都有一个自己的地址。</p>
          </div>
        </section>
        <div className="workspace">
          <aside className="settings-panel">
            <div className="panel-heading">
              <h2>连接图片仓库</h2>
              <span className={`badge ${connected ? "connected" : ""}`}>
                {connected ? "已连接" : "未连接"}
              </span>
            </div>
            <form onSubmit={connect}>
              <fieldset disabled={busy}>
                <label>
                  GitHub Token
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => {
                      client.current?.dispose();
                      client.current = null;
                      setConnected(false);
                      setToken(e.target.value);
                      setPictures([]);
                      setLibraryState("idle");
                    }}
                    required
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="github_pat_…"
                  />
                </label>
                <button className="primary connect" type="submit">
                  {busy && !connected
                    ? "正在连接…"
                    : connected
                      ? "重新连接"
                      : "连接仓库"}
                </button>
              </fieldset>
            </form>
          </aside>
          <section className="content-panel" aria-label="图片工作区">
            <div className="tabs" aria-label="切换工作区">
              <button
                type="button"
                aria-pressed={tab === "upload"}
                onClick={() => setTab("upload")}
              >
                上传图片 <span>{items.length.toString().padStart(2, "0")}</span>
              </button>
              <button
                type="button"
                aria-pressed={tab === "library"}
                onClick={() => {
                  setTab("library");
                  if (libraryState === "idle") void loadLibrary();
                }}
              >
                图片库
              </button>
            </div>
            <div className="feedback">
              <p role="status">{notice}</p>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
            </div>
            {tab === "upload" ? (
              <>
                <input
                  className="visually-hidden"
                  ref={picker}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  aria-label="选择图片文件"
                  disabled={busy}
                  onChange={(e) => {
                    addFiles(Array.from(e.target.files || []));
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className={`drop-zone ${dragging ? "dragging" : ""}`}
                  disabled={busy}
                  onClick={() => picker.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!busy) setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    addFiles(Array.from(e.dataTransfer.files));
                  }}
                >
                  <span className="upload-icon">
                    <UploadIcon />
                  </span>
                  <strong>把图片放在这里</strong>
                  <span>拖拽、粘贴，或点击选择图片</span>
                  <small>JPEG · PNG · WebP · GIF / 单张最大 10 MB</small>
                </button>
                <div className="upload-options">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={compress}
                      onChange={(e) => setCompress(e.target.checked)}
                      disabled={busy}
                    />
                    上传前压缩
                  </label>
                  <span>JPEG / PNG 最长边 2000px · GIF / WebP 保留原文件</span>
                </div>
                <div className="queue-toolbar">
                  <h2>
                    本次上传 <span>{items.length}</span>
                  </h2>
                  <div>
                    <button
                      disabled={busy || !items.length}
                      onClick={clearQueue}
                    >
                      清空队列
                    </button>
                    <button
                      className="primary"
                      disabled={busy || !connected || !waiting}
                      onClick={() => void upload()}
                    >
                      {busy && connected
                        ? "正在上传…"
                        : `上传${waiting ? ` ${waiting} 张` : ""}`}
                    </button>
                  </div>
                </div>
                {!items.length && (
                  <div className="empty-state">
                    <span className="empty-number">01 —</span>
                    <p>还没有待上传的图片</p>
                    <span>先挑一张喜欢的照片吧。</span>
                  </div>
                )}
                <ul className="queue">
                  {items.map((item) => (
                    <li key={item.id}>
                      {item.preview ? (
                        <button
                          className="thumbnail"
                          aria-label={`预览 ${item.file.name}`}
                          onClick={() =>
                            setPreview({
                              url: item.preview,
                              name: item.file.name,
                            })
                          }
                        >
                          <img src={item.preview} alt="" />
                        </button>
                      ) : (
                        <div className="thumbnail invalid">!</div>
                      )}
                      <div className="item-info">
                        <strong>{item.file.name}</strong>
                        <span
                          className={item.status === "error" ? "error" : ""}
                        >
                          {formatSize(item.file.size)}
                          {item.size !== undefined &&
                          item.size !== item.file.size
                            ? ` → ${formatSize(item.size)}`
                            : ""}{" "}
                          · {labels[item.status]}
                        </span>
                        {item.message && (
                          <p className="error">{item.message}</p>
                        )}
                        {item.url && (
                          <a
                            className="image-link"
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {item.url}
                          </a>
                        )}
                      </div>
                      <div className="item-actions">
                        {item.url && (
                          <>
                            <button onClick={() => void copy(item.url!)}>
                              URL
                            </button>
                            <button
                              onClick={() =>
                                void copy(markdown(item.file.name, item.url!))
                              }
                            >
                              Markdown
                            </button>
                          </>
                        )}
                        {item.status === "error" && (
                          <button
                            disabled={busy || !connected}
                            onClick={() => void upload([item.id])}
                          >
                            重试
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {complete.length > 0 && (
                  <div className="result-bar">
                    <span>{complete.length} 张图片可引用</span>
                    <button
                      onClick={() =>
                        void copy(
                          complete
                            .map((item) => markdown(item.file.name, item.url!))
                            .join("\n"),
                        )
                      }
                    >
                      复制全部 Markdown
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="queue-toolbar">
                  <div>
                    <h2>
                      图片库{" "}
                      <span>
                        {libraryState === "ready" ? pictures.length : "—"}
                      </span>
                    </h2>
                    <p className="muted">仓库 images/ 目录 · 按路径排列</p>
                  </div>
                  <button
                    disabled={busy || !connected}
                    onClick={() => void loadLibrary()}
                  >
                    刷新列表
                  </button>
                </div>
                {!connected ? (
                  <div className="empty-state">
                    <p>连接仓库后，查看已上传图片。</p>
                  </div>
                ) : libraryState === "loading" ? (
                  <p role="status">正在读取图片库…</p>
                ) : libraryState === "error" ? (
                  <p className="error" role="alert">
                    {libraryError}
                  </p>
                ) : libraryState === "ready" && !pictures.length ? (
                  <div className="empty-state">
                    <p>图片库还是空的</p>
                    <button onClick={() => setTab("upload")}>
                      上传第一张图片
                    </button>
                  </div>
                ) : libraryState === "idle" ? (
                  <p className="muted">点击刷新列表，读取仓库中的图片。</p>
                ) : null}
                {connected && libraryState === "ready" && (
                  <div className="gallery">
                    {pictures.slice(0, visible).map((picture) => {
                      const url = pictureUrl(defaults, picture.path);
                      const name = picture.path.split("/").at(-1)!;
                      return (
                        <article key={picture.path}>
                          <button
                            className="gallery-image"
                            aria-label={`预览 ${name}`}
                            onClick={() => setPreview({ url, name })}
                          >
                            <img
                              src={url}
                              alt={name}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          </button>
                          <div className="gallery-caption">
                            <span title={picture.path}>{name}</span>
                            <small>{formatSize(picture.size)}</small>
                          </div>
                          <div className="gallery-actions">
                            <a href={url} target="_blank" rel="noreferrer">
                              打开
                            </a>
                            <button onClick={() => void copy(url)}>URL</button>
                            <button
                              onClick={() => void copy(markdown(name, url))}
                            >
                              Markdown
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
                {connected &&
                  libraryState === "ready" &&
                  pictures.length > visible && (
                    <button
                      className="load-more"
                      onClick={() => setVisible((n) => n + 60)}
                    >
                      再显示 60 张
                    </button>
                  )}
              </>
            )}
          </section>
        </div>
      </main>
      <footer>
        <span>牧己 · 图片自留地</span>
        <span>每一张，都值得好好保存。</span>
      </footer>
      <dialog
        ref={dialog}
        onClose={() => setPreview(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            dialog.current?.close();
          }
        }}
      >
        <div className="preview-head">
          <span>{preview?.name}</span>
          <button
            autoFocus
            aria-label="关闭预览"
            onClick={() => dialog.current?.close()}
          >
            关闭 ×
          </button>
        </div>
        {preview && (
          <img
            src={preview.url}
            alt={preview.name}
            referrerPolicy="no-referrer"
          />
        )}
      </dialog>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
