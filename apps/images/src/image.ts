import { identify } from "./github";
export const MAX_SIZE = 10 * 1024 * 1024;
export const MAX_BATCH = 20;
export function formatSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
}
export function fileError(file: File) {
  if (!file.size) return "图片是空文件。";
  if (file.size > MAX_SIZE) return "单张图片不能超过 10 MB。";
  if (
    !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
  )
    return "只支持 JPEG、PNG、WebP 和 GIF。";
  return "";
}
export function detectFormat(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { mime: "image/jpeg", ext: "jpg" };
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b))
    return { mime: "image/png", ext: "png" };
  const start = new TextDecoder().decode(bytes.subarray(0, 12));
  if (/^GIF8[79]a/.test(start)) return { mime: "image/gif", ext: "gif" };
  if (start.startsWith("RIFF") && start.slice(8) === "WEBP")
    return { mime: "image/webp", ext: "webp" };
  throw new Error("文件内容不是支持的图片格式。");
}
export async function prepareImage(file: File, compress: boolean) {
  const error = fileError(file);
  if (error) throw new Error(error);
  let bytes = new Uint8Array(await file.arrayBuffer());
  let format = detectFormat(bytes);
  if (file.type !== format.mime) throw new Error("图片内容与文件类型不一致。");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("图片无法解码，请选择完整的图片文件。");
  }
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 40_000_000
    )
      throw new Error("图片尺寸不能超过 4000 万像素。");
    if (compress && ["jpg", "png"].includes(format.ext)) {
      const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("浏览器无法处理图片。");
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const output = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("图片压缩失败。")),
          "image/webp",
          0.85,
        ),
      );
      if (output.type !== "image/webp")
        throw new Error("当前浏览器不支持 WebP 压缩，请关闭压缩后上传。");
      if (output.size < bytes.length) {
        bytes = new Uint8Array(await output.arrayBuffer());
        format = { mime: "image/webp", ext: "webp" };
      }
    }
  } finally {
    bitmap.close();
  }
  return identify(bytes, format.ext);
}
