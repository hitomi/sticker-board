import JSZip from "jszip";
import { saveBlob, type Pack } from "./library";

export const miniToolMaxBytes = 10 * 1024 * 1024;
function imageBlob(source: string) {
  const match = /^data:(image\/[^;,]+)((?:;[^,]*)?),([\s\S]*)$/i.exec(source);
  if (!match) throw new Error("存在未载入的图片，请等待素材加载完成后重试");
  const base64 = /;base64(?:;|$)/i.test(match[2]);
  const text = base64 ? atob(match[3]) : decodeURIComponent(match[3]);
  return new Blob([base64 ? Uint8Array.from(text, (char) => char.charCodeAt(0)) : text], { type: match[1] });
}
async function packagedImage(source: string) {
  const blob = imageBlob(source);
  const extensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" };
  if (extensions[blob.type]) return { blob, extension: extensions[blob.type] };
  // AVIF and ICO are accepted by the studio, but are not allowed in mini tool ZIPs.
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("图片转换失败，请更换素材后重试");
  context.drawImage(image, 0, 0);
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!png) throw new Error("图片转换失败，请更换素材后重试");
  return { blob: png, extension: "png" };
}
export async function buildMiniTool(pack: Pack) {
  const response = await fetch(`${import.meta.env.BASE_URL}minitool-runtime.zip`);
  if (!response.ok) throw new Error("小红书模板无法读取，请重新构建应用后重试");
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const entry = zip.file("index.html");
  if (!entry || !zip.file("app.js")) throw new Error("小红书模板不完整，请重新构建应用");
  const assets = new Map<string, string>();
  const manifest = JSON.parse(JSON.stringify({ ...pack, schemaVersion: 1, buildId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}` }, (key, value) => {
    if ((key === "src" || key === "logo") && typeof value === "string") {
      if (!assets.has(value)) assets.set(value, `a${assets.size}`);
      return `sticker-asset:${assets.get(value)}`;
    }
    return value;
  }));
  const backup = { ...manifest };
  manifest.branding = { ...manifest.branding, allowZipUploads: false, links: [] };
  const paths: Record<string, string> = {};
  for (const [source, id] of assets) {
    const { blob, extension } = await packagedImage(source);
    const path = `assets/${id}.${extension}`;
    paths[id] = `./${path}`;
    zip.file(path, blob);
  }
  const config = { format: "sticker-minitool", pack: backup, assets: paths };
  // No fetch/XHR or inline executable scripts are needed in the offline runtime.
  const resolved = JSON.stringify(manifest, (key, value) =>
    (key === "src" || key === "logo") && typeof value === "string" && value.startsWith("sticker-asset:")
      ? paths[value.slice("sticker-asset:".length)] : value,
  ).replace(/</g, "\\u003c");
  if (new Blob([resolved]).size > 2 * 1024 * 1024) throw new Error("贴纸配置过大，请减少贴纸或公告内容后重试");
  zip.file("pack.js", `window.__stickerPack=${resolved};`);
  zip.file("sticker-config.json", JSON.stringify(config));
  const html = await entry.async("string");
  zip.file("index.html", html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${(pack.branding?.title || "贴贴").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</title>`));
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  if (blob.size > miniToolMaxBytes) throw new Error(`小红书小工具 ZIP 为 ${(blob.size / 1024 / 1024).toFixed(1)} MB，超过 10 MB 上限，请减少或压缩素材后重试`);
  return blob;
}
export async function exportMiniTool(pack: Pack) {
  const blob = await buildMiniTool(pack);
  const name = (pack.branding?.title || pack.name || "贴贴").replace(/[\\/:*?"<>|]/g, "_");
  saveBlob(blob, `${name}-小红书小工具.zip`);
}
