import { assetPrefix, resolveAssets } from "./assetStream";
import JSZip from "jszip";
import deploymentGuide from "../docs/github-pages.txt?raw";
import {
  normalizeBranding,
  announcementMaxLength,
  saveBlob,
  type Pack,
  type CanvasSnapshot,
} from "./library";

const maxFileSize = 400 * 1024 * 1024;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("配置内容不完整");
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number) {
  if (typeof value !== "string" || value.length > limit)
    throw new Error("配置中的文字字段无效");
  return value;
}
function imageSource(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml|avif|x-icon|vnd.microsoft.icon)(?:;[^,]*)?,/i.test(
      value,
    )
  )
    throw new Error("配置中的图片必须内置在文件中");
  return value;
}
function canvasImage(value: unknown, sources: Set<string>) {
  const input = record(value);
  if (typeof input.type !== "string" || input.type.toLowerCase() !== "image")
    throw new Error("画布包含不支持的对象");
  const src = imageSource(input.src);
  sources.add(src);
  const output: Record<string, unknown> = { type: "Image", src };
  for (const key of [
    "left",
    "top",
    "width",
    "height",
    "scaleX",
    "scaleY",
    "angle",
    "skewX",
    "skewY",
    "opacity",
    "cropX",
    "cropY",
  ]) {
    const v = input[key];
    if (typeof v !== "number" || !Number.isFinite(v))
      throw new Error("画布变换数据无效");
    output[key] = v;
  }
  if (
    (output.width as number) <= 0 ||
    (output.height as number) <= 0 ||
    (output.scaleX as number) <= 0 ||
    (output.scaleY as number) <= 0
  )
    throw new Error("画布图片尺寸无效");
  if (input.initialScale !== undefined) {
    if (
      typeof input.initialScale !== "number" ||
      !Number.isFinite(input.initialScale) ||
      input.initialScale <= 0
    )
      throw new Error("初始贴纸尺寸无效");
    output.initialScale = input.initialScale;
  }
  for (const key of ["flipX", "flipY", "visible"]) {
    if (typeof input[key] !== "boolean") throw new Error("画布图片状态无效");
    output[key] = input[key];
  }
  for (const key of ["originX", "originY"]) {
    const v = input[key];
    if (
      !(typeof v === "number" && Number.isFinite(v)) &&
      !["left", "center", "right", "top", "bottom"].includes(String(v))
    )
      throw new Error("画布定位数据无效");
    output[key] = v;
  }
  return output;
}
async function validateConfig(value: unknown): Promise<Pack> {
  const input = record(value);
  if (input.schemaVersion !== undefined && input.schemaVersion !== 1)
    throw new Error("此配置版本暂不支持，请更新应用");
  if (!Array.isArray(input.stickers)) throw new Error("文件中没有贴纸库配置");
  const sources = new Set<string>();
  const stickers = input.stickers.map((value, index) => {
    const sticker = record(value);
    const src = imageSource(sticker.src);
    sources.add(src);
    return {
      id: `embedded:${index}`,
      name: text(sticker.name, 1000),
      category: text(sticker.category, 4000),
      src,
    };
  });
  const brand =
    input.branding === undefined ? { title: "贴贴" } : record(input.branding);
  const title = text(brand.title, 40).trim();
  if (!title) throw new Error("配置缺少站点标题");
  if (
    brand.themeText !== undefined &&
    brand.themeText !== "light" &&
    brand.themeText !== "dark"
  )
    throw new Error("文字颜色设置无效");
  if (
    brand.themeColor !== undefined &&
    (typeof brand.themeColor !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(brand.themeColor))
  )
    throw new Error("配置主题色无效");
  for (const key of [
    "allowUploads",
    "allowStickerUploads",
    "allowBackgroundUploads",
  ]) {
    if (brand[key] !== undefined && typeof brand[key] !== "boolean")
      throw new Error("图片导入设置无效");
  }
  if (
    brand.allowZipUploads !== undefined &&
    typeof brand.allowZipUploads !== "boolean"
  )
    throw new Error("ZIP 导入设置无效");
  const logo = brand.logo === undefined ? undefined : imageSource(brand.logo);
  if (
    brand.announcementEnabled !== undefined &&
    typeof brand.announcementEnabled !== "boolean"
  )
    throw new Error("公告设置无效");
  const announcement =
    brand.announcement === undefined
      ? ""
      : text(brand.announcement, announcementMaxLength);
  if (brand.links !== undefined && !Array.isArray(brand.links))
    throw new Error("导航链接设置无效");
  const links = (brand.links as unknown[] | undefined)?.map((value) => {
    const link = record(value);
    return { title: text(link.title, 80), url: text(link.url, 2048) };
  });
  if (brand.categoryOrder !== undefined && !Array.isArray(brand.categoryOrder))
    throw new Error("分类排序设置无效");
  const categoryOrder =
    brand.categoryOrder === undefined
      ? undefined
      : [
          ...new Set(
            (brand.categoryOrder as unknown[]).map((value) => text(value, 4000)),
          ),
        ];
  if (logo) sources.add(logo);
  let canvas: CanvasSnapshot | undefined;
  if (input.canvas !== undefined) {
    const snapshot = record(input.canvas);
    const { width, height } = snapshot;
    if (
      typeof width !== "number" ||
      typeof height !== "number" ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 64 ||
      height < 64 ||
      width > 4096 ||
      height > 4096
    )
      throw new Error("画布尺寸超出 64–4096 px");
    const scene = record(snapshot.scene);
    if (
      !Array.isArray(scene.objects) ||
      typeof scene.background !== "string" ||
      !/^(?:#[0-9a-f]{6}|transparent)$/i.test(scene.background)
    )
      throw new Error("画布配置无效");
    canvas = {
      width,
      height,
      scene: {
        objects: scene.objects.map((object) => canvasImage(object, sources)),
        background: scene.background,
        ...(scene.backgroundImage
          ? { backgroundImage: canvasImage(scene.backgroundImage, sources) }
          : {}),
      },
    };
  }
  for (const src of sources) {
    const image = new Image();
    image.src = src;
    try {
      await image.decode();
    } catch {
      throw new Error("配置中有损坏的图片，请重新选择文件");
    }
    if (image.naturalWidth * image.naturalHeight > 32_000_000)
      throw new Error("配置中有图片超过 3200 万像素");
  }
  return {
    schemaVersion: 1,
    name: text(input.name, 1000),
    stickers,
    branding: normalizeBranding({
      title,
      logo,
      themeColor: brand.themeColor as string | undefined,
      themeText: brand.themeText as "light" | "dark" | undefined,
      allowUploads: brand.allowUploads as boolean | undefined,
      allowStickerUploads: brand.allowStickerUploads as boolean | undefined,
      allowBackgroundUploads: brand.allowBackgroundUploads as
        | boolean
        | undefined,
      allowZipUploads: brand.allowZipUploads === true,
      announcementEnabled: brand.announcementEnabled === true,
      announcement,
      links,
      categoryOrder,
    }),
    canvas,
  };
}
export async function readStandalone(file: File): Promise<Pack> {
  if (file.size > maxFileSize) throw new Error("配置文件不能超过 400 MB");
  let html: string;
  if (/\.zip$/i.test(file.name)) {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(file);
    } catch {
      throw new Error("无法读取独立版 ZIP");
    }
    const entry = zip.file("index.html");
    if (!entry) throw new Error("ZIP 中没有独立版 index.html");
    html = await entry.async("string");
  } else if (/\.html?$/i.test(file.name)) html = await file.text();
  else throw new Error("请选择导出的 ZIP 或 index.html");
  if (html.length > maxFileSize) throw new Error("独立版内容超过 400 MB");
  // Parse the manifest and literal asset arguments only; never execute imported scripts.
  const match =
    /<script\b(?=[^>]*\bid\s*=\s*["']sticker-pack["'])[^>]*>([\s\S]*?)<\/script>/i.exec(
      html,
    );
  if (!match) throw new Error("文件中没有可恢复的贴纸配置");
  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    throw new Error("配置数据损坏，无法恢复");
  }
  const assets: Record<string, string> = Object.create(null);
  for (const match of html.matchAll(
    /<script data-sticker-asset="(a\d+)">window\.__stickerAsset\(([^<]*?)\);<\/script>/g,
  )) {
    const [id, src] = JSON.parse(`[${match[2]}]`);
    if (id !== match[1] || typeof src !== "string" || assets[id])
      throw new Error("独立版图片资源无效");
    assets[id] = src;
  }
  return validateConfig(resolveAssets(data, assets, true));
}
export async function exportStandalone(pack: Pack) {
  const response = await fetch(`${import.meta.env.BASE_URL}standalone.html`);
  if (!response.ok) throw new Error("独立版模板无法读取，请重新构建应用后重试");
  const template = await response.text();
  const marker =
    /<script id="sticker-pack" type="application\/json">\s*null\s*<\/script>/;
  if (
    !marker.test(template) ||
    !template.includes('id="boot-screen"') ||
    !template.includes("window.__stickerAsset")
  )
    throw new Error("独立版模板不完整，请重新构建应用");
  const assets = new Map<string, string>();
  const manifest = JSON.parse(
    JSON.stringify(
      {
        canvas: pack.canvas,
        branding: pack.branding,
        ...pack,
        schemaVersion: 1,
        buildId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      },
      (key, value) => {
        if (
          (key === "src" || key === "logo") &&
          typeof value === "string" &&
          /^data:image\//i.test(value)
        ) {
          if (!assets.has(value)) assets.set(value, `a${assets.size}`);
          return `${assetPrefix}${assets.get(value)}`;
        }
        return value;
      },
    ),
  );
  manifest.assetCount = assets.size;
  const safeJson = (value: unknown) =>
    JSON.stringify(value).replace(/</g, "\\u003c");
  const assetScripts = [...assets]
    .map(
      ([src, id]) =>
        `<script data-sticker-asset="${id}">window.__stickerAsset(${safeJson(id)},${safeJson(src)});</script>`,
    )
    .join("\n");
  const html = template
    .replace(
      marker,
      () =>
        `<script id="sticker-pack" type="application/json">${safeJson(manifest)}</script>`,
    )
    .replace(
      /<title>[\s\S]*?<\/title>/,
      () =>
        `<title>${(pack.branding?.title || "贴贴").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</title>`,
    );
  const zip = new JSZip();
  zip.file(
    "index.html",
    html.replace(
      /<\/body>(\s*<\/html>\s*)$/i,
      (_, ending: string) =>
        `${assetScripts}\n<script>window.__stickerAssetsDone();</script>\n</body>${ending}`,
    ),
  );
  zip.file("使用说明.txt", deploymentGuide);
  const filename = (pack.branding?.title || pack.name || "贴贴").replace(
    /[\\/:*?"<>|]/g,
    "_",
  );
  saveBlob(
    await zip.generateAsync({ type: "blob", compression: "DEFLATE" }),
    `${filename}-独立版.zip`,
  );
}
