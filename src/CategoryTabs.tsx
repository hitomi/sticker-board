import { useLayoutEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";

type Category = { id: string; name: string };
export default function CategoryTabs({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [open, setOpen] = useState(false);
  const categoryKey = JSON.stringify(categories);
  useLayoutEffect(() => {
    const container = row.current!;
    const strip = tabs.current!;
    const measure = () => {
      // Compare the full row width so showing the trigger cannot keep itself visible.
      const buttons = [...strip.children] as HTMLElement[];
      const width =
        buttons.reduce((sum, button) => sum + button.offsetWidth, 0) +
        Math.max(0, buttons.length - 1) *
          parseFloat(getComputedStyle(strip).gap || "0");
      const needed =
        container.clientWidth > 0 && width > container.clientWidth + 1;
      setOverflow(needed);
      if (!needed) setOpen(false);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    for (const child of strip.children) observer.observe(child);
    measure();
    const wheel = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY) ||
        strip.scrollWidth <= strip.clientWidth
      )
        return;
      const delta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? strip.clientWidth
            : 1);
      const before = strip.scrollLeft;
      strip.scrollLeft += delta;
      if (strip.scrollLeft !== before) event.preventDefault();
    };
    strip.addEventListener("wheel", wheel, { passive: false });
    return () => {
      observer.disconnect();
      strip.removeEventListener("wheel", wheel);
    };
  }, [categoryKey]);
  useLayoutEffect(() => {
    const strip = tabs.current!;
    const active = strip.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!active) return;
    const left =
      active.getBoundingClientRect().left - strip.getBoundingClientRect().left;
    if (left < 0) strip.scrollLeft += left;
    else if (left + active.offsetWidth > strip.clientWidth)
      strip.scrollLeft += left + active.offsetWidth - strip.clientWidth;
  }, [value, overflow, categoryKey]);
  return (
    <div className="category-row" ref={row}>
      <div
        className="tabs"
        ref={tabs}
        role="tablist"
        aria-label="贴纸分类"
        onKeyDown={(event) => {
          const current = categories.findIndex(
            (category) => category.id === value,
          );
          let index: number;
          if (event.key === "ArrowRight")
            index = (current + 1) % categories.length;
          else if (event.key === "ArrowLeft")
            index = (current - 1 + categories.length) % categories.length;
          else if (event.key === "Home") index = 0;
          else if (event.key === "End") index = categories.length - 1;
          else return;
          event.preventDefault();
          onChange(categories[index].id);
          (tabs.current?.children[index] as HTMLElement)?.focus();
        }}
      >
        {categories.map((category) => (
          <button
            key={category.id}
            role="tab"
            aria-selected={value === category.id}
            tabIndex={value === category.id ? 0 : -1}
            onClick={() => onChange(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>
      {overflow && (
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              className="category-more"
              aria-label="更多分类"
              title="更多分类"
            >
              <ChevronDown size={18} />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="category-popover"
              side="bottom"
              align="end"
              sideOffset={6}
              collisionPadding={16}
              aria-label="全部分类"
              onOpenAutoFocus={(event) => {
                const selected =
                  popup.current?.querySelector<HTMLButtonElement>(
                    '[aria-pressed="true"]',
                  );
                if (selected) {
                  event.preventDefault();
                  selected.focus();
                }
              }}
              ref={popup}
            >
              <div className="category-options">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    aria-pressed={value === category.id}
                    onClick={() => {
                      onChange(category.id);
                      setOpen(false);
                    }}
                  >
                    <span>{category.name}</span>
                    {value === category.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  );
}
