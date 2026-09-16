import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  CheckCheck,
  Copy,
  Download,
  FlipHorizontal2,
  FlipVertical2,
  ImagePlus,
  Layers2,
  LoaderCircle,
  Maximize,
  Minus,
  Package,
  Palette,
  Plus,
  Redo2,
  RotateCw,
  Search,
  Settings2,
  Sparkles,
  Sticker as StickerIcon,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  readZip,
  saveBlob,
  readLocalImage,
  type Pack,
  type Sticker,
  type Branding,
} from "./library";
import BrandingEditor from "./BrandingEditor";
import CategoryTabs from "./CategoryTabs";
import { exportStandalone, readStandalone } from "./config";
import { DEFAULT_THEME, themeStyle } from "./theme";
import { useEditor } from "./useEditor";
import { useDeviceSize } from "./useDeviceSize";
import { useAutoSave } from "./storage";
const defaultBranding: Branding = {
  title: "贴贴",
  themeColor: DEFAULT_THEME,
  allowUploads: false,
  allowZipUploads: false,
};
const defaultFavicon =
  document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href || "";
const presets = [
  { name: "手机 · 1170 × 2532", width: 1170, height: 2532 },
  { name: "手机 · 1290 × 2796", width: 1290, height: 2796 },
  { name: "平板 · 1640 × 2360", width: 1640, height: 2360 },
  { name: "电脑 · 1920 × 1080", width: 1920, height: 1080 },
  { name: "电脑 · 2560 × 1440", width: 2560, height: 1440 },
  { name: "正方形 · 1080 × 1080", width: 1080, height: 1080 },
];
const colors = [
  "#fffdf7",
  "#ffffff",
  "#eadff1",
  "#dce8df",
  "#f3dce0",
  "#dce8f5",
  "#f8e6c9",
  "#33383c",
  "transparent",
];
function IconButton({
  label,
  children,
  onClick,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="icon-button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  drawer = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  drawer?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className={`dialog ${drawer ? "drawer" : ""}`}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div className="dialog-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label="关闭">
                <X size={19} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="dialog-description">
            {description}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export default function App({
  initialPack,
  storageKey,
  persistent,
}: {
  initialPack: Pack;
  storageKey: string;
  persistent: boolean;
}) {
  const [imagePreview, setImagePreview] = useState<{
    url: string;
    blob: Blob;
    filename: string;
  } | null>(null);
  const [renderingImage, setRenderingImage] = useState(false);
  const renderingImageRef = useRef(false);
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview.url);
    };
  }, [imagePreview]);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function report(message: string) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 6000);
  }
  const [pack, setPack] = useState<Pack>(initialPack);
  const [tab, setTab] = useState("all");
  const [deletingStickers, setDeletingStickers] = useState(false);
  const [uploads, setUploads] = useState<Sticker[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [drawer, setDrawer] = useState<"stickers" | "settings" | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<Pack | "reset" | null>(
    null,
  );
  const [exporting, setExporting] = useState(false);
  const [configError, setConfigError] = useState("");
  const [branding, setBranding] = useState<Branding>(
    () => pack.branding || { ...defaultBranding },
  );
  const siteBranding = branding;
  const allowImageUploads = !__STANDALONE__ || !!siteBranding?.allowUploads;
  const allowZipUploads = !__STANDALONE__ || !!siteBranding?.allowZipUploads;
  const editor = useEditor(
    report,
    themeStyle(siteBranding?.themeColor)["--accent-text"],
    initialPack.canvas,
  );
  const deviceSize = useDeviceSize();
  const autosave = useAutoSave(storageKey, persistent);
  useEffect(() => {
    document.title = siteBranding.title || "贴贴";
    for (const [property, value] of Object.entries(
      themeStyle(siteBranding.themeColor, siteBranding.themeText),
    )) {
      document.documentElement.style.setProperty(property, value);
    }
    {
      const icon =
        document.querySelector<HTMLLinkElement>('link[rel="icon"]') ||
        document.createElement("link");
      icon.rel = "icon";
      icon.href = siteBranding.logo || defaultFavicon;
      document.head.appendChild(icon);
    }
  }, [siteBranding]);
  const [custom, setCustom] = useState(false);
  const [clearCanvasOpen, setClearCanvasOpen] = useState(false);
  const [width, setWidth] = useState("1170");
  const [height, setHeight] = useState("2532");
  const [sizeError, setSizeError] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const configBusy =
    exporting ||
    renderingImage ||
    importing ||
    uploadingImages ||
    uploadingBackground ||
    editor.busy;
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const uploadSequence = useRef(0);
  const backgroundUploadRef = useRef<HTMLInputElement>(null);
  const categories = [
    { id: "all", name: "全部" },
    ...(allowImageUploads ? [{ id: "uploads", name: "我的上传" }] : []),
    ...[...new Set(pack.stickers.map((s) => s.category))]
      .filter((name) => !allowImageUploads || name !== "我的上传")
      .map((name) => ({
        id: `category:${name}`,
        name,
      })),
  ];
  const allStickers = [...pack.stickers, ...uploads];
  const shown = (
    tab === "uploads"
      ? allStickers.filter((sticker) => sticker.category === "我的上传")
      : allStickers
  ).filter(
    (s) =>
      (tab === "all" ||
        tab === "uploads" ||
        `category:${s.category}` === tab) &&
      s.name.toLowerCase().includes(query.toLowerCase()),
  );
  function removeSticker(sticker: Sticker) {
    if (configBusy) return;
    setPack((current) => ({
      ...current,
      stickers: current.stickers.filter((item) => item.id !== sticker.id),
    }));
    setUploads((current) => current.filter((item) => item.id !== sticker.id));
    if (
      tab === `category:${sticker.category}` &&
      !allStickers.some(
        (item) => item.id !== sticker.id && item.category === sticker.category,
      )
    ) {
      setTab("all");
    }
  }
  function currentConfig(): Pack {
    return {
      schemaVersion: 1,
      name: pack.name,
      stickers: allStickers.map((sticker, index) => ({
        ...sticker,
        id: `embedded:${index}`,
      })),
      branding: { ...branding, title: branding.title.trim() || "贴贴" },
      canvas: editor.snapshot(),
    };
  }
  useEffect(() => {
    if (!editor.ready || configBusy) return;
    void autosave.save(currentConfig()).catch(() => {});
  }, [
    pack,
    uploads,
    branding,
    editor.historyState,
    editor.ready,
    configBusy,
    autosave.save,
  ]);
  useEffect(() => {
    if (autosave.status === "error")
      report("本地保存失败，请释放浏览器空间后重试，或导出独立版备份");
  }, [autosave.status]);
  async function upload(file?: File) {
    if (!file) return;
    setImporting(true);
    try {
      setPack(await readZip(file));
      setDeletingStickers(false);
      setTab("all");
      setQuery("");
    } catch (error) {
      report(error instanceof Error ? error.message : "导入失败，请重试");
    } finally {
      setImporting(false);
    }
  }
  async function downloadImage() {
    if (renderingImageRef.current || configBusy) return;
    renderingImageRef.current = true;
    setRenderingImage(true);
    try {
      const result = await editor.renderImage();
      if (!result) return;
      const mobile =
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
        (/Macintosh/i.test(navigator.userAgent) &&
          navigator.maxTouchPoints > 1);
      if (mobile) {
        setImagePreview({ ...result, url: URL.createObjectURL(result.blob) });
      } else {
        saveBlob(result.blob, result.filename);
      }
    } finally {
      renderingImageRef.current = false;
      setRenderingImage(false);
    }
  }
  async function exportCurrent() {
    if (configBusy) return;
    setExporting(true);
    setConfigError("");
    try {
      await exportStandalone(currentConfig());
      report("独立版已生成");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "导出失败，请重试";
      setConfigError(message);
      report(message);
    } finally {
      setExporting(false);
    }
  }
  async function readConfig(file?: File) {
    if (!file || configBusy) return;
    setExporting(true);
    setConfigError("");
    try {
      setPendingConfig(await readStandalone(file));
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : "配置读取失败");
    } finally {
      setExporting(false);
    }
  }
  async function applyConfig() {
    if (!pendingConfig || configBusy) return;
    setExporting(true);
    setConfigError("");
    try {
      const next =
        pendingConfig === "reset"
          ? { name: "贴纸库", stickers: [], branding: { ...defaultBranding } }
          : pendingConfig;
      const previous = currentConfig();
      const device = { width: deviceSize.width, height: deviceSize.height };
      const saved = {
        ...next,
        schemaVersion: 1 as const,
        canvas: next.canvas || {
          ...device,
          scene: { objects: [], background: "#fffdf7" },
        },
      };
      await autosave.save(saved);
      try {
        await editor.restore(saved.canvas);
      } catch (error) {
        await autosave.save(previous);
        throw error;
      }
      setPack(next);
      setUploads([]);
      setBranding(next.branding || { ...defaultBranding });
      uploadSequence.current = 0;
      setDeletingStickers(false);
      setTab("all");
      setQuery("");
      setDrawer(null);
      setPendingConfig(null);
    } catch (error) {
      setConfigError(
        error instanceof Error ? error.message : "配置恢复失败，请重试",
      );
    } finally {
      setExporting(false);
    }
  }
  async function add(sticker: Sticker) {
    await editor.add(sticker);
    setDrawer(null);
  }
  async function uploadImages(files: File[]) {
    if (!files.length) return;
    setUploadingImages(true);
    try {
      if (files.reduce((sum, file) => sum + file.size, 0) > 100 * 1024 * 1024)
        throw new Error("一次上传不能超过 100 MB，请分批选择");
      const additions: Sticker[] = [];
      for (const file of files)
        additions.push({
          id: `upload:${++uploadSequence.current}`,
          name: file.name.replace(/\.[^.]+$/, ""),
          category: "我的上传",
          src: await readLocalImage(file),
        });
      setUploads((previous) => [...previous, ...additions]);
      setTab("uploads");
      setQuery("");
    } catch (error) {
      report(error instanceof Error ? error.message : "图片上传失败，请重试");
    } finally {
      setUploadingImages(false);
    }
  }
  async function uploadBackground(file?: File) {
    if (!file) return;
    setUploadingBackground(true);
    try {
      await editor.imageBackground(await readLocalImage(file));
    } catch (error) {
      report(
        error instanceof Error ? error.message : "背景图片加载失败，请重试",
      );
    } finally {
      setUploadingBackground(false);
    }
  }
  function openCustom() {
    setWidth(String(editor.size.width));
    setHeight(String(editor.size.height));
    setSizeError("");
    setCustom(true);
  }
  const selectedPreset = presets.findIndex(
    (p) => p.width === editor.size.width && p.height === editor.size.height,
  );
  const matchesDevice =
    editor.size.width === deviceSize.width &&
    editor.size.height === deviceSize.height;
  const settings = (
    <div className="settings-content">
      <div className="field-heading">
        <span>画布尺寸</span>
        <span className="muted">PX</span>
      </div>
      <select
        aria-label="画布尺寸"
        value={
          matchesDevice
            ? "device"
            : selectedPreset < 0
              ? "custom"
              : selectedPreset
        }
        onChange={(e) => {
          if (e.target.value === "custom") openCustom();
          else if (e.target.value === "device")
            editor.resize(deviceSize.width, deviceSize.height);
          else {
            const p = presets[Number(e.target.value)];
            editor.resize(p.width, p.height);
          }
        }}
      >
        <option value="device">
          当前设备 · {deviceSize.width} × {deviceSize.height}
          {deviceSize.limited ? "（按比例缩小）" : ""}
        </option>
        <option value="custom">自定义尺寸</option>
        {presets.map((p, i) => (
          <option key={p.name} value={i}>
            {p.name}
          </option>
        ))}
      </select>
      {matchesDevice && (
        <p className="device-size-note">
          {deviceSize.limited
            ? `屏幕约 ${deviceSize.rawWidth} × ${deviceSize.rawHeight}，已适配至最长边 4096 px`
            : "按屏幕尺寸 × 像素比估算"}
        </p>
      )}
      <button className="text-button custom-link" onClick={openCustom}>
        <Settings2 size={14} /> 自定义尺寸
      </button>
      <div className="field-heading background-heading">
        <span>画布背景</span>
        <Palette size={15} />
      </div>
      <div className="swatches">
        {colors.map((color) => (
          <button
            key={color}
            aria-label={color === "transparent" ? "透明背景" : `背景 ${color}`}
            disabled={uploadingBackground || editor.busy}
            aria-pressed={
              !editor.backgroundImage && editor.background === color
            }
            className={`swatch ${color === "transparent" ? "checker" : ""} ${!editor.backgroundImage && editor.background === color ? "chosen" : ""}`}
            style={{ backgroundColor: color }}
            onClick={() => editor.color(color)}
          >
            {!editor.backgroundImage && editor.background === color && (
              <Check
                size={14}
                color={color === "#33383c" ? "#fff" : "#554c65"}
              />
            )}
          </button>
        ))}
        <label className="swatch color-picker" title="自定义背景颜色">
          <Plus size={15} />
          <input
            type="color"
            disabled={uploadingBackground || editor.busy}
            aria-label="自定义背景颜色"
            value={
              editor.background === "transparent"
                ? "#ffffff"
                : editor.background
            }
            onChange={(e) => editor.color(e.target.value)}
          />
        </label>
      </div>
      {allowImageUploads && (
        <div className="background-upload">
          <button
            className="background-upload-button"
            disabled={uploadingBackground || editor.busy}
            onClick={() => backgroundUploadRef.current?.click()}
          >
            {uploadingBackground ? (
              <LoaderCircle size={16} className="spin" />
            ) : editor.backgroundImage ? (
              <img src={editor.backgroundImage} alt="当前背景" />
            ) : (
              <ImagePlus size={16} />
            )}
            {uploadingBackground
              ? "正在载入…"
              : editor.backgroundImage
                ? "更换背景图片"
                : "上传背景图片"}
          </button>
          {editor.backgroundImage && (
            <IconButton
              label="移除背景图片"
              disabled={uploadingBackground || editor.busy}
              onClick={() => editor.color(editor.background)}
            >
              <X size={15} />
            </IconButton>
          )}
          {editor.backgroundImage && <span>居中铺满</span>}
        </div>
      )}
    </div>
  );
  const library = (
    <div className="library">
      <div className="library-heading">
        <div>
          <h2>
            贴纸库 <span>{allStickers.length}</span>
          </h2>
        </div>
        <div className="library-actions">
          <button
            className="small-button"
            aria-label="删除模式"
            aria-pressed={deletingStickers}
            disabled={configBusy || (!allStickers.length && !deletingStickers)}
            onClick={() => setDeletingStickers((current) => !current)}
          >
            {deletingStickers ? <Check size={15} /> : <Trash2 size={15} />}
            {deletingStickers ? "完成" : "删除"}
          </button>
          {allowZipUploads && (
            <button
              className="small-button"
              disabled={importing}
              onClick={() => uploadRef.current?.click()}
            >
              {importing ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Plus size={15} />
              )}
              导入 ZIP
            </button>
          )}
        </div>
      </div>
      <div className="search">
        <Search size={16} />
        <input
          aria-label="搜索贴纸"
          placeholder="找一张贴纸…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button aria-label="清除搜索" onClick={() => setQuery("")}>
            <X size={14} />
          </button>
        )}
      </div>
      <CategoryTabs categories={categories} value={tab} onChange={setTab} />
      {tab === "uploads" && allowImageUploads && (
        <button
          className="upload-personal"
          disabled={uploadingImages}
          onClick={() => imageUploadRef.current?.click()}
        >
          {uploadingImages ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <ImagePlus size={16} />
          )}
          {uploadingImages ? "正在载入…" : "上传图片"}
          <span>可多选</span>
        </button>
      )}
      <div className="sticker-scroll">
        <div className="sticker-grid">
          {shown.map((s) => (
            <div className="sticker-item" key={s.id}>
              <button
                className="sticker-card"
                aria-label={`添加${s.name}`}
                disabled={editor.busy || deletingStickers}
                onClick={() => void add(s)}
              >
                <img src={s.src} alt="" loading="lazy" />
                <span>{s.name}</span>
                {!deletingStickers && (
                  <span className="add-indicator">
                    <Plus size={13} />
                  </span>
                )}
              </button>
              {deletingStickers && (
                <button
                  className="delete-library-sticker"
                  aria-label={`从贴纸库删除${s.name}`}
                  disabled={configBusy}
                  onClick={() => removeSticker(s)}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!shown.length && (
          <div className="no-results">
            <Search size={24} />
            <p>{query ? "没有找到这张贴纸" : "暂无贴纸"}</p>
            {query && (
              <button className="text-button" onClick={() => setQuery("")}>
                清除搜索
              </button>
            )}
          </div>
        )}
      </div>
      <div className="library-foot">
        <span>
          {deletingStickers ? (
            "仅删除素材库中的贴纸"
          ) : (
            <>
              <Plus size={13} /> 点击贴纸，添加到画布
            </>
          )}
        </span>
        <span>{shown.length} 张</span>
      </div>
    </div>
  );
  const operations: [string, string, ReactNode][] = [
    ["smaller", "缩小贴纸", <Minus />],
    ["larger", "放大贴纸", <Plus />],
    ["rotate", "旋转 15°", <RotateCw />],
    ["flipX", "水平翻转", <FlipHorizontal2 />],
    ["flipY", "垂直翻转", <FlipVertical2 />],
    ["duplicate", "复制贴纸", <Copy />],
    ["front", "上移一层", <Layers2 />],
    ["back", "下移一层", <ArrowDownToLine />],
    ["delete", "删除贴纸", <Trash2 />],
  ];
  return (
    <div
      className="app"
      onPointerDown={(event) => {
        if (event.button !== 0 || !(event.target instanceof Element)) return;
        // Keep editor controls usable while a sticker is selected.
        if (
          event.target.closest(
            '.canvas-wrap, .object-tools, button, a, input, select, textarea, label, [role="dialog"], .overlay',
          )
        )
          return;
        editor.deselect();
      }}
    >
      <header className="header">
        <a
          className="brand"
          href="./"
          aria-label={siteBranding?.title || "贴贴首页"}
          onClick={(e) => e.preventDefault()}
        >
          {siteBranding?.logo ? (
            <img
              className="custom-logo"
              src={siteBranding.logo}
              alt="站点 Logo"
            />
          ) : (
            <span className="brand-icon">
              <StickerIcon size={23} />
            </span>
          )}
          <span className="brand-text">
            <span className="site-title" title={siteBranding?.title}>
              {siteBranding?.title || "贴贴"}
            </span>
            {branding.title === "贴贴" && !branding.logo && (
              <span className="brand-en">sticker studio</span>
            )}
          </span>
        </a>
        <div className="header-actions">
          {!__STANDALONE__ && (
            <>
              <button
                className="export-button"
                onClick={() => setConfigOpen(true)}
                aria-label="设置"
                title="设置"
              >
                <Settings2 size={17} />
                <span>设置</span>
              </button>
              <button
                className="export-button"
                onClick={() => setExportOpen(true)}
                disabled={configBusy}
                aria-label="导出独立版"
                title="导出当前设置和贴纸库"
              >
                {exporting ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <Package size={17} />
                )}
                <span>导出独立版</span>
              </button>
            </>
          )}
          <button
            className="primary"
            onClick={() => void downloadImage()}
            disabled={configBusy}
          >
            {renderingImage ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Download size={16} />
            )}
            <span>{renderingImage ? "正在生成…" : "下载图片"}</span>
          </button>
        </div>
      </header>
      <main className="workspace">
        <section className="editor">
          <div className="editor-top">
            <div className="document-name">
              <span>我的画布</span>
              <span className="dimension-pill">
                {editor.size.width} × {editor.size.height}
              </span>
            </div>
            <div className="history">
              <button
                className="selection-toggle"
                aria-label="多选模式"
                aria-pressed={editor.multiSelect}
                title="多选模式：逐张点选，完成后整体拖动"
                disabled={editor.busy}
                onClick={editor.toggleMultiSelect}
              >
                {editor.multiSelect ? "完成" : "多选"}
              </button>
              <IconButton
                label="清空画布"
                disabled={!editor.count || configBusy}
                onClick={() => setClearCanvasOpen(true)}
              >
                <Trash2 size={18} />
              </IconButton>
              <IconButton
                label="全选贴纸"
                disabled={!editor.count || editor.busy}
                onClick={editor.selectAll}
              >
                <CheckCheck size={18} />
              </IconButton>
              <IconButton
                label="撤销"
                disabled={editor.historyState.index === 0 || editor.busy}
                onClick={() => void editor.travel(-1)}
              >
                <Undo2 size={18} />
              </IconButton>
              <IconButton
                label="重做"
                disabled={
                  editor.historyState.index >= editor.historyState.length - 1 ||
                  editor.busy
                }
                onClick={() => void editor.travel(1)}
              >
                <Redo2 size={18} />
              </IconButton>
            </div>
          </div>
          <div className="canvas-stage" ref={editor.stage}>
            <div className="canvas-wrap checker">
              <canvas ref={editor.element} />
              {editor.count === 0 && (
                <div className="canvas-empty">
                  <span className="empty-icon">
                    <Sparkles size={27} />
                  </span>
                  <p>选择贴纸添加到画布</p>
                  <button
                    className="mobile-only text-button"
                    onClick={() => setDrawer("stickers")}
                  >
                    打开贴纸库 <ArrowUpRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
          {editor.selected && (
            <div className="object-tools has-selection">
              {operations.map(([kind, label, icon]) => (
                <IconButton
                  key={kind}
                  label={label}
                  disabled={editor.busy}
                  onClick={() => void editor.action(kind)}
                >
                  {icon}
                </IconButton>
              ))}
            </div>
          )}
          <footer className="canvas-footer">
            <span>
              <span className="status-dot" />
              {editor.count} 张贴纸
              {editor.selectedCount > 0 && ` · 已选 ${editor.selectedCount} 张`}
            </span>
            <span className="desktop-hint">
              {editor.multiSelect
                ? "点选贴纸 · 完成后整体拖动"
                : editor.selectedCount > 1
                  ? "整体拖动 · 缩放 · 旋转"
                  : "拖框多选 · Shift 点选"}
            </span>
            <span>
              {autosave.status === "saving" && <span>保存中…</span>}
              {autosave.status === "error" && (
                <button
                  className="save-error"
                  onClick={() => void autosave.retry().catch(() => {})}
                >
                  未保存 · 重试
                </button>
              )}
              {autosave.status === "temporary" && <span>临时模式</span>}
              <Maximize size={13} />
              {Math.round(editor.zoom * 100)}%{" "}
              <span className="fit-label">适应画布</span>
            </span>
          </footer>
        </section>
        <aside className="sidebar">
          {library}
          {settings}
        </aside>
      </main>
      <nav className="mobile-nav">
        <button onClick={() => setDrawer("stickers")}>
          <StickerIcon size={20} />
          贴纸库 <Plus size={15} />
        </button>
        <button onClick={() => setDrawer("settings")}>
          <Settings2 size={20} />
          画布设置
        </button>
      </nav>
      <Modal
        open={drawer !== null}
        onOpenChange={(open) => {
          if (!open) setDrawer(null);
        }}
        title={drawer === "stickers" ? "选择贴纸" : "画布设置"}
        description={
          drawer === "stickers" ? "点击即可添加到画布" : "选择尺寸与背景"
        }
        drawer
      >
        {drawer === "stickers" ? library : settings}
      </Modal>
      <Modal
        open={imagePreview !== null}
        onOpenChange={(open) => {
          if (!open) setImagePreview(null);
        }}
        title="保存图片"
        description="长按图片，选择保存到相册。也可以点击下方下载。"
      >
        {imagePreview && (
          <>
            <div className="export-image-preview checker">
              <img src={imagePreview.url} alt="画布成品预览，长按保存" />
            </div>
            <button
              className="primary wide"
              onClick={() => saveBlob(imagePreview.blob, imagePreview.filename)}
            >
              <Download size={16} />
              下载图片
            </button>
          </>
        )}
      </Modal>
      <Modal
        open={clearCanvasOpen}
        onOpenChange={setClearCanvasOpen}
        title="清空画布？"
        description={`将移除画布上的 ${editor.count} 张贴纸，保留背景、尺寸和贴纸库。清空后可以撤销。`}
      >
        <div className="confirm-actions">
          <button
            className="small-button"
            onClick={() => setClearCanvasOpen(false)}
          >
            取消
          </button>
          <button
            className="primary"
            disabled={!editor.count || configBusy}
            onClick={() => {
              if (editor.clearStickers()) setClearCanvasOpen(false);
            }}
          >
            确认清空
          </button>
        </div>
      </Modal>
      <Modal
        open={custom}
        onOpenChange={setCustom}
        title="自定义尺寸"
        description="每边 64–4096 像素"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const w = Number(width),
              h = Number(height);
            if (
              !Number.isInteger(w) ||
              !Number.isInteger(h) ||
              w < 64 ||
              h < 64 ||
              w > 4096 ||
              h > 4096
            ) {
              setSizeError("请输入 64–4096 之间的整数");
              return;
            }
            editor.resize(w, h);
            setCustom(false);
          }}
        >
          <div className="size-fields">
            <label>
              宽度
              <input
                type="number"
                min="64"
                max="4096"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                required
              />
            </label>
            <span>×</span>
            <label>
              高度
              <input
                type="number"
                min="64"
                max="4096"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                required
              />
            </label>
          </div>
          {sizeError && <p className="error">{sizeError}</p>}
          <button className="primary wide" type="submit">
            应用尺寸
          </button>
        </form>
      </Modal>
      {!__STANDALONE__ && (
        <>
          <Modal
            open={configOpen}
            onOpenChange={(open) => {
              if (!configBusy) setConfigOpen(open);
            }}
            title="设置"
            description="设置实时应用于当前页面。"
          >
            <BrandingEditor
              value={branding}
              onChange={setBranding}
              busy={configBusy}
              onBusy={setExporting}
              onError={setConfigError}
            />
            <div className="config-summary">
              {allStickers.length} 张贴纸 · {editor.size.width} ×{" "}
              {editor.size.height} px
            </div>
            <p className="save-status" role="status">
              {autosave.status === "saving"
                ? "正在保存到本机…"
                : autosave.status === "saved"
                  ? "已保存在本机"
                  : autosave.status === "temporary"
                    ? "临时模式：关闭后不会保存"
                    : "本地保存失败"}
              {autosave.status === "error" && (
                <button onClick={() => void autosave.retry().catch(() => {})}>
                  重试保存
                </button>
              )}
            </p>
            {configError && (
              <p className="error" role="alert">
                {configError}
              </p>
            )}
            <div className="config-actions">
              <button
                disabled={configBusy}
                onClick={() => restoreRef.current?.click()}
              >
                恢复配置
              </button>
              <button
                className="reset-config"
                disabled={configBusy}
                onClick={() => {
                  setConfigError("");
                  setPendingConfig("reset");
                }}
              >
                重置所有设置
              </button>
            </div>
            <p className="export-note">可从导出的 ZIP 或 index.html 恢复。</p>
          </Modal>
          <Modal
            open={pendingConfig !== null}
            onOpenChange={(open) => {
              if (!open && !exporting) setPendingConfig(null);
            }}
            title={pendingConfig === "reset" ? "重置所有设置" : "恢复配置"}
            description={
              pendingConfig === "reset"
                ? "将清空全部贴纸库（含示例）、画布和历史，恢复默认外观。此操作不可撤销。"
                : "将替换当前设置、贴纸库和画布，清空编辑历史。"
            }
          >
            {pendingConfig && pendingConfig !== "reset" && (
              <p className="config-summary">
                {pendingConfig.branding?.title} ·{" "}
                {pendingConfig.stickers.length} 张贴纸
              </p>
            )}
            {configError && (
              <p className="error" role="alert">
                {configError}
              </p>
            )}
            <div className="confirm-actions">
              <button
                className="small-button"
                disabled={exporting}
                onClick={() => setPendingConfig(null)}
              >
                取消
              </button>
              <button
                className="primary"
                disabled={configBusy}
                onClick={() => void applyConfig()}
              >
                {exporting
                  ? "正在处理…"
                  : pendingConfig === "reset"
                    ? "清空并重置"
                    : "替换并恢复"}
              </button>
            </div>
          </Modal>
          <input
            hidden
            type="file"
            accept=".zip,.html,.htm"
            ref={restoreRef}
            aria-label="恢复独立版配置文件"
            onChange={(event) => {
              void readConfig(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </>
      )}
      {allowZipUploads && (
        <input
          hidden
          type="file"
          accept=".zip"
          ref={uploadRef}
          aria-label="导入贴纸 ZIP"
          onChange={(event) => {
            void upload(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      )}
      {!__STANDALONE__ && (
        <Modal
          open={exportOpen}
          onOpenChange={(open) => {
            if (!exporting) setExportOpen(open);
          }}
          title="导出独立版"
          description="导出当前设置、贴纸库和画布。"
        >
          <label className="upload-permission">
            <span>
              <strong>允许用户上传图片</strong>
              <small>贴纸与背景图片</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-label="允许用户上传图片"
              checked={!!branding.allowUploads}
              disabled={configBusy}
              onChange={(event) =>
                setBranding({ ...branding, allowUploads: event.target.checked })
              }
            />
          </label>
          <label className="upload-permission">
            <span>
              <strong>允许用户上传 ZIP</strong>
              <small>按文件夹分类导入贴纸</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-label="允许用户上传 ZIP"
              checked={!!branding.allowZipUploads}
              disabled={configBusy}
              onChange={(event) =>
                setBranding({
                  ...branding,
                  allowZipUploads: event.target.checked,
                })
              }
            />
          </label>
          <p className="config-summary">
            {allStickers.length} 张贴纸 · {editor.size.width} ×{" "}
            {editor.size.height} px
          </p>
          {configError && (
            <p className="error" role="alert">
              {configError}
            </p>
          )}
          <button
            className="primary wide"
            disabled={configBusy}
            onClick={() => void exportCurrent()}
          >
            {exporting ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Download size={16} />
            )}{" "}
            {exporting ? "正在导出…" : "下载独立版 ZIP"}
          </button>
        </Modal>
      )}
      {allowImageUploads && (
        <>
          <input
            hidden
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.avif"
            ref={imageUploadRef}
            aria-label="上传贴纸图片"
            onChange={(event) => {
              void uploadImages(Array.from(event.target.files || []));
              event.target.value = "";
            }}
          />
          <input
            hidden
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.avif"
            ref={backgroundUploadRef}
            aria-label="上传背景图片文件"
            onChange={(event) => {
              void uploadBackground(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button aria-label="关闭提示" onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
