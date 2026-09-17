import { useState } from "react";
import BrandingEditor from "./BrandingEditor";
import NavigationEditor from "./NavigationEditor";
import CategoryOrder, { type SortableCategory } from "./CategoryOrder";
import type { Branding } from "./library";

const tabs = [
  { id: "appearance", label: "外观" },
  { id: "navigation", label: "导航" },
  { id: "categories", label: "分类" },
] as const;

export default function SettingsEditor({
  value,
  onChange,
  busy,
  onBusy,
  onError,
  categories,
}: {
  value: Branding;
  onChange: (value: Branding) => void;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onError: (message: string) => void;
  categories: SortableCategory[];
}) {
  const [active, setActive] =
    useState<(typeof tabs)[number]["id"]>("appearance");
  return (
    <>
      <div className="settings-tabs" role="tablist" aria-label="设置分类">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            id={`settings-tab-${tab.id}`}
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={`settings-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % tabs.length
                  : event.key === "ArrowLeft"
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tabs.length - 1
                        : undefined;
              if (next === undefined) return;
              event.preventDefault();
              setActive(tabs[next].id);
              document.getElementById(`settings-tab-${tabs[next].id}`)?.focus();
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`settings-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${tab.id}`}
          hidden={active !== tab.id}
          tabIndex={0}
        >
          {tab.id === "appearance" ? (
            <BrandingEditor
              value={value}
              onChange={onChange}
              busy={busy}
              onBusy={onBusy}
              onError={onError}
            />
          ) : tab.id === "navigation" ? (
            <NavigationEditor value={value} onChange={onChange} busy={busy} />
          ) : (
            <CategoryOrder
              categories={categories}
              disabled={busy}
              onChange={(categoryOrder) =>
                onChange({ ...value, categoryOrder })
              }
            />
          )}
        </div>
      ))}
    </>
  );
}
