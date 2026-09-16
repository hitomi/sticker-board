import JSZip from "jszip";
export type Sticker = {
  id: string;
  name: string;
  category: string;
  src: string;
};
export type Branding = {
  title: string;
  logo?: string;
  themeColor?: string;
  themeText?: "light" | "dark";
  allowUploads?: boolean;
  allowZipUploads?: boolean;
};
export type CanvasSnapshot = {
  width: number;
  height: number;
  scene: Record<string, unknown>;
};
export type Pack = {
  name: string;
  stickers: Sticker[];
  branding?: Branding;
  schemaVersion?: 1;
  buildId?: string;
  canvas?: CanvasSnapshot;
};

export async function readLocalImage(file: File): Promise<string> {
  if (!/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(file.name))
    throw new Error(`不支持的图片格式：${file.name}`);
  if (file.size > 20 * 1024 * 1024)
    throw new Error(`图片超过 20 MB：${file.name}`);
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`图片读取失败：${file.name}`));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = source;
  try {
    await image.decode();
  } catch {
    throw new Error(`图片无法打开：${file.name}`);
  }
  if (image.naturalWidth * image.naturalHeight > 32_000_000)
    throw new Error(`图片超过 3200 万像素：${file.name}`);
  return source;
}

export async function readBrandImage(file: File): Promise<string> {
  if (!/\.(png|jpe?g|webp|svg|ico)$/i.test(file.name))
    throw new Error("请选择 PNG、JPG、WebP、SVG 或 ICO 图片");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Logo 和 favicon 图片不能超过 5 MB");
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("图片读取失败，请重新选择"));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = source;
  try {
    await image.decode();
  } catch {
    throw new Error("图片无法打开，请更换文件");
  }
  if (image.naturalWidth * image.naturalHeight > 16_000_000)
    throw new Error("图片尺寸过大，请使用小于 1600 万像素的图片");
  return source;
}
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export async function readZip(file: File): Promise<Pack> {
  if (file.size > 100 * 1024 * 1024)
    throw new Error("请使用小于 100 MB 的 ZIP 文件");
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error("无法读取 ZIP，请检查文件是否损坏或加密");
  }
  const entries = Object.values(zip.files).filter(
    (f) =>
      !f.dir &&
      !f.name.split("/").some((p) => p.startsWith(".") || p === "__MACOSX") &&
      /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(f.name),
  );
  if (!entries.length)
    throw new Error("ZIP 中没有可用图片，支持 PNG、JPG、WebP、GIF、SVG、AVIF");
  const stickers: Sticker[] = [];
  let total = 0;
  for (const entry of entries) {
    const bytes = await entry.async("uint8array");
    total += bytes.length;
    if (total > 200 * 1024 * 1024)
      throw new Error("解压后图片超过 200 MB，请拆分素材包");
    const ext = entry.name.split(".").pop()!.toLowerCase();
    const mime =
      ext === "svg"
        ? "image/svg+xml"
        : ext === "jpg"
          ? "image/jpeg"
          : `image/${ext}`;
    const src = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(new Blob([new Uint8Array(bytes)], { type: mime }));
    });
    const image = new Image();
    image.src = src;
    try {
      await image.decode();
    } catch {
      throw new Error(`图片无法读取：${entry.name}`);
    }
    if (image.naturalWidth * image.naturalHeight > 32_000_000)
      throw new Error(`图片尺寸过大：${entry.name}`);
    const parts = entry.name.split("/");
    const filename = parts.pop()!;
    stickers.push({
      id: entry.name,
      name: filename.replace(/\.[^.]+$/, ""),
      category: parts.join(" / ") || "未分类",
      src,
    });
  }
  return { name: file.name.replace(/\.zip$/i, ""), stickers };
}
