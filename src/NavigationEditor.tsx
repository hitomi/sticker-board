import { Plus, Trash2 } from "lucide-react";
import { navigationHref, type Branding } from "./library";

export default function NavigationEditor({
  value,
  onChange,
  busy,
}: {
  value: Branding;
  onChange: (value: Branding) => void;
  busy: boolean;
}) {
  return (
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
  );
}
