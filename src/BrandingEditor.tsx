import { useRef, type CSSProperties } from "react";
import {
  Check,
  Download,
  ImagePlus,
  Plus,
  Sticker,
  Trash2,
  X,
} from "lucide-react";
import { navigationHref, readBrandImage, type Branding } from "./library";
import { DEFAULT_THEME, themes, themeStyle } from "./theme";

type Props = {
  value: Branding;
  onChange: (value: Branding) => void;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onError: (message: string) => void;
};
export default function BrandingEditor({
  value,
  onChange,
  busy,
  onBusy,
  onError,
}: Props) {
  const logoInput = useRef<HTMLInputElement>(null);
  async function select(file: File | undefined) {
    if (!file) return;
    onBusy(true);
    onError("");
    try {
      onChange({ ...value, logo: await readBrandImage(file) });
    } catch (error) {
      onError(error instanceof Error ? error.message : "图片读取失败");
    } finally {
      onBusy(false);
    }
  }
  return (
    <div className="branding-editor">
      <label className="branding-title">
        站点标题
        <input
          value={value.title}
          maxLength={40}
          disabled={busy}
          onChange={(e) => onChange({ ...value, title: e.currentTarget.value })}
          placeholder="给贴纸小站起个名字"
        />
      </label>
      <fieldset className="navigation-editor" disabled={busy}>
        <legend>导航链接</legend>
        {(value.links || []).map((link, index) => (
          <div className="navigation-link-fields" key={index}>
            <label>
              标题
              <input
                aria-label={`链接 ${index + 1} 标题`}
                value={link.title}
                maxLength={80}
                onChange={(event) =>
                  onChange({
                    ...value,
                    links: value.links!.map((item, i) =>
                      i === index
                        ? { ...item, title: event.currentTarget.value }
                        : item,
                    ),
                  })
                }
              />
            </label>
            <label>
              网址
              <input
                type="url"
                inputMode="url"
                autoCapitalize="none"
                spellcheck={false}
                aria-label={`链接 ${index + 1} 网址`}
                aria-invalid={!!link.url.trim() && !navigationHref(link.url)}
                aria-describedby={
                  link.url.trim() && !navigationHref(link.url)
                    ? `link-error-${index}`
                    : undefined
                }
                value={link.url}
                maxLength={2048}
                placeholder="https://"
                onChange={(event) =>
                  onChange({
                    ...value,
                    links: value.links!.map((item, i) =>
                      i === index
                        ? { ...item, url: event.currentTarget.value }
                        : item,
                    ),
                  })
                }
              />
            </label>
            <button
              className="icon-button"
              aria-label={`删除链接 ${index + 1}`}
              onClick={() =>
                onChange({
                  ...value,
                  links: value.links!.filter((_, i) => i !== index),
                })
              }
            >
              <Trash2 size={16} />
            </button>
            {!!link.url.trim() && !navigationHref(link.url) && (
              <p className="error" id={`link-error-${index}`}>
                请输入完整的 http:// 或 https:// 网址
              </p>
            )}
          </div>
        ))}
        <button
          className="small-button"
          onClick={() =>
            onChange({
              ...value,
              links: [...(value.links || []), { title: "", url: "" }],
            })
          }
        >
          <Plus size={14} /> 添加链接
        </button>
      </fieldset>
      <div className="brand-asset">
        <span>
          Logo<span className="optional">可选</span>
        </span>
        <button
          className="asset-upload"
          disabled={busy}
          aria-label="选择 Logo"
          onClick={() => logoInput.current?.click()}
        >
          {value.logo ? (
            <img src={value.logo} alt="Logo 预览" />
          ) : (
            <ImagePlus size={22} />
          )}
          <span>{value.logo ? "更换图片" : "选择图片"}</span>
        </button>
        {value.logo && (
          <button
            className="remove-asset"
            disabled={busy}
            aria-label="移除 Logo"
            onClick={() => onChange({ ...value, logo: undefined })}
          >
            <X size={12} />
            移除
          </button>
        )}
      </div>
      <p className="asset-hint">
        同时用作浏览器图标 · PNG、JPG、WebP、SVG、ICO · 最大 5 MB
      </p>
      <fieldset className="theme-picker" disabled={busy}>
        <legend>主题色</legend>
        <div className="theme-options">
          {themes.map((theme) => (
            <button
              key={theme.color}
              type="button"
              aria-label={`${theme.name}主题`}
              aria-pressed={(value.themeColor || DEFAULT_THEME) === theme.color}
              style={{
                backgroundColor: theme.color,
                color: themeStyle(theme.color)["--accent-ink"],
              }}
              onClick={() =>
                onChange({
                  ...value,
                  themeColor: theme.color,
                  themeText: undefined,
                })
              }
            >
              {(value.themeColor || DEFAULT_THEME) === theme.color && (
                <Check size={16} />
              )}
            </button>
          ))}
          <label className="custom-theme">
            自定义
            <input
              type="color"
              aria-label="自定义主题色"
              value={value.themeColor || DEFAULT_THEME}
              onChange={(event) =>
                onChange({ ...value, themeColor: event.currentTarget.value })
              }
            />
          </label>
        </div>
        <div
          className="theme-text-options"
          role="group"
          aria-label="主题色上的文字"
        >
          <span>文字</span>
          {(["light", "dark"] as const).map((tone) => (
            <button
              key={tone}
              type="button"
              aria-pressed={
                themeStyle(value.themeColor, value.themeText)[
                  "--accent-ink"
                ] === (tone === "light" ? "#ffffff" : "#17151b")
              }
              onClick={() => onChange({ ...value, themeText: tone })}
            >
              {tone === "light" ? "亮色文字" : "暗色文字"}
            </button>
          ))}
        </div>
      </fieldset>
      <div
        className="brand-preview"
        aria-label="站点预览"
        style={themeStyle(value.themeColor, value.themeText) as CSSProperties}
      >
        <div className="browser-tab">
          {value.logo ? (
            <img src={value.logo} alt="浏览器图标预览" />
          ) : (
            <Sticker size={14} />
          )}
          <span>{value.title.trim() || "贴贴"}</span>
          <X size={12} />
        </div>
        <div className="brand-preview-header">
          {value.logo ? (
            <img src={value.logo} alt="站点 Logo 预览" />
          ) : (
            <span className="brand-icon">
              <Sticker size={23} />
            </span>
          )}
          <strong>{value.title.trim() || "贴贴"}</strong>
        </div>
        <div className="theme-preview-actions">
          <span>贴纸库</span>
          <span>
            <Download size={13} />
            下载图片
          </span>
        </div>
      </div>
      <input
        hidden
        ref={logoInput}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.svg,.ico"
        aria-label="导入 Logo 图片"
        onChange={(e) => {
          void select(e.currentTarget.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
