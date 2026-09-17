import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Layers,
  RotateCw,
  ArrowUp,
  ArrowDown,
  ArrowUpToLine,
  ArrowDownToLine,
  FlipHorizontal2,
  FlipVertical2,
  RotateCcw,
} from "lucide-react";
import type { useEditor } from "./useEditor";

type Props = { editor: ReturnType<typeof useEditor> };
export default function SelectionMenus({ editor }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const menus = [
    {
      id: "layers",
      label: "图层",
      icon: Layers,
      actions: [
        { kind: "front", label: "上移一层", icon: ArrowUp },
        { kind: "back", label: "下移一层", icon: ArrowDown },
        { kind: "top", label: "移到最上", icon: ArrowUpToLine },
        { kind: "bottom", label: "移到最下", icon: ArrowDownToLine },
      ],
    },
    {
      id: "transform",
      label: "旋转与翻转",
      icon: RotateCw,
      actions: [
        { kind: "rotate45", label: "旋转 45°", icon: RotateCw },
        { kind: "rotate90", label: "旋转 90°", icon: RotateCw },
        { kind: "flipX", label: "水平翻转", icon: FlipHorizontal2 },
        { kind: "flipY", label: "垂直翻转", icon: FlipVertical2 },
        { kind: "reset", label: "重置变换", icon: RotateCcw },
      ],
    },
  ];
  return menus.map((menu) => (
    <Popover.Root
      key={menu.id}
      open={open === menu.id}
      onOpenChange={(value) => {
        editor.finishOpacity();
        setOpen(value ? menu.id : null);
      }}
    >
      <Popover.Trigger asChild>
        <button
          className="icon-button"
          aria-label={menu.label}
          title={menu.label}
          disabled={editor.busy}
        >
          <menu.icon size={18} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="selection-menu"
          side="top"
          sideOffset={10}
          collisionPadding={12}
          aria-label={menu.label}
        >
          {menu.actions.map((action) => (
            <button
              key={action.kind}
              disabled={editor.busy}
              onClick={() => {
                editor.finishOpacity();
                void editor.action(action.kind);
                setOpen(null);
              }}
            >
              <action.icon size={16} />
              {action.label}
            </button>
          ))}
          {menu.id === "layers" && (
            <label className="opacity-control">
              <span>
                透明度{" "}
                <output>
                  {editor.opacity === null ? "混合" : `${editor.opacity}%`}
                </output>
              </span>
              <input
                type="range"
                aria-label="透明度"
                min={0}
                max={100}
                step={1}
                value={editor.opacity ?? 100}
                disabled={editor.busy}
                onChange={(event) =>
                  editor.setOpacity(Number(event.currentTarget.value))
                }
                onPointerUp={editor.finishOpacity}
                onPointerCancel={editor.finishOpacity}
                onKeyUp={editor.finishOpacity}
                onBlur={editor.finishOpacity}
              />
            </label>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  ));
}
