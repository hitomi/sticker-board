import { useEffect, useRef, useState } from "react";
import {
  ActiveSelection,
  Canvas,
  FabricImage,
  type FabricObject,
} from "fabric";
import type { Sticker, CanvasSnapshot } from "./library";
import { saveBlob } from "./library";
import { getDeviceSize } from "./useDeviceSize";
export function useEditor(
  report: (message: string) => void,
  accent = "#786394",
  initialSnapshot?: CanvasSnapshot,
) {
  const element = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<Canvas | null>(null);
  const device = getDeviceSize();
  const dimensions = useRef({
    width: initialSnapshot?.width || device.width,
    height: initialSnapshot?.height || device.height,
  });
  const [size, setSize] = useState(dimensions.current);
  const [background, setBackground] = useState("#fffdf7");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [multiSelect, setMultiSelect] = useState(false);
  const multiSelectRef = useRef(false);
  const [count, setCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [historyState, setHistoryState] = useState({ index: 0, length: 1 });
  const history = useRef<CanvasSnapshot[]>([]);
  const index = useRef(-1);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const locked = useRef(false);
  function fit() {
    const c = canvas.current;
    const host = stage.current;
    if (!c || !host) return;
    const { width, height } = dimensions.current;
    const padding = getComputedStyle(host);
    const ratio = Math.min(
      (host.clientWidth -
        parseFloat(padding.paddingLeft) -
        parseFloat(padding.paddingRight)) /
        width,
      (host.clientHeight -
        parseFloat(padding.paddingTop) -
        parseFloat(padding.paddingBottom)) /
        height,
      1,
    );
    const scale = Math.max(0.02, ratio);
    const displayWidth = Math.round(width * scale);
    const displayHeight = Math.round(height * scale);
    const resized = c.width !== displayWidth || c.height !== displayHeight;
    if (resized)
      c.setDimensions({ width: displayWidth, height: displayHeight });
    if (c.getZoom() !== scale) c.setZoom(scale);
    c.calcOffset();
    // Resizing clears the bitmap. Paint before ResizeObserver yields to the browser.
    if (resized) c.renderAll();
    else c.requestRenderAll();
    setZoom(scale);
  }
  function commit() {
    const c = canvas.current;
    if (!c || locked.current) return;
    const snapshot = { scene: c.toJSON(), ...dimensions.current };
    history.current = [
      ...history.current.slice(0, index.current + 1),
      snapshot,
    ].slice(-35);
    index.current = history.current.length - 1;
    setHistoryState({ index: index.current, length: history.current.length });
    setCount(c.getObjects().length);
    setReady(true);
  }
  function selectObjects(objects: FabricObject[]) {
    const c = canvas.current;
    if (!c) return;
    c.discardActiveObject();
    if (objects.length === 1) c.setActiveObject(objects[0]);
    else if (objects.length > 1)
      c.setActiveObject(new ActiveSelection(objects, { canvas: c }));
    c.requestRenderAll();
  }
  function toggleMultiSelect() {
    multiSelectRef.current = !multiSelectRef.current;
    setMultiSelect(multiSelectRef.current);
  }
  function selectAll() {
    const c = canvas.current;
    if (c && !locked.current) selectObjects(c.getObjects());
  }
  function updateAccent() {
    const style = {
      cornerColor: "#fff",
      cornerStrokeColor: accent,
      borderColor: accent,
      cornerStyle: "circle" as const,
      cornerSize: 11,
      touchCornerSize: 28,
      transparentCorners: false,
      padding: 5,
    };
    FabricImage.ownDefaults = { ...FabricImage.ownDefaults, ...style };
    ActiveSelection.ownDefaults = { ...ActiveSelection.ownDefaults, ...style };
    const c = canvas.current;
    if (c) {
      c.selectionBorderColor = accent;
      c.getObjects().forEach((object) => object.set(style));
      c.getActiveObject()?.set(style);
      c.requestRenderAll();
    }
  }
  useEffect(() => {
    updateAccent();
    const c = new Canvas(element.current!, {
      backgroundColor: "#fffdf7",
      preserveObjectStacking: true,
      selection: true,
      selectionKey: "shiftKey",
      selectionColor: "rgba(128, 128, 128, 0.1)",
      selectionBorderColor: accent,
      enablePointerEvents: true,
    });
    canvas.current = c;
    const updateSelection = () => setSelectedCount(c.getActiveObjects().length);
    c.on("selection:created", updateSelection);
    c.on("selection:updated", updateSelection);
    c.on("selection:cleared", updateSelection);
    c.on("object:modified", commit);
    // Tap-to-toggle is separate from Fabric's normal drag/Shift/box selection.
    const toggleByPointer = (event: PointerEvent) => {
      if (
        !multiSelectRef.current ||
        locked.current ||
        event.button !== 0 ||
        !event.isPrimary
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const { target } = c.searchPossibleTargets(
        c.getObjects(),
        c.getScenePoint(event),
      );
      const objects = c.getActiveObjects();
      const next = target
        ? objects.includes(target)
          ? objects.filter((object) => object !== target)
          : [...objects, target]
        : [];
      selectObjects(c.getObjects().filter((object) => next.includes(object)));
    };
    c.upperCanvasEl.addEventListener("pointerdown", toggleByPointer, {
      capture: true,
    });
    const observer = new ResizeObserver(fit);
    observer.observe(stage.current!);
    fit();
    if (initialSnapshot)
      void restore(initialSnapshot).catch(() => report("初始画布加载失败"));
    else commit();
    return () => {
      c.upperCanvasEl.removeEventListener("pointerdown", toggleByPointer, {
        capture: true,
      });
      observer.disconnect();
      canvas.current = null;
      void c.dispose();
    };
  }, []);
  useEffect(updateAccent, [accent]);
  function snapshot(): CanvasSnapshot {
    const c = canvas.current;
    if (!c || locked.current) throw new Error("画布正在处理，请稍后重试");
    return { ...dimensions.current, scene: c.toJSON() };
  }
  async function restore(saved?: CanvasSnapshot) {
    const c = canvas.current;
    if (!c || locked.current) throw new Error("画布正在处理，请稍后重试");
    const currentDevice = getDeviceSize();
    const next = saved || {
      width: currentDevice.width,
      height: currentDevice.height,
      scene: { objects: [], background: "#fffdf7" },
    };
    locked.current = true;
    setBusy(true);
    const previousRendering = c.renderOnAddRemove;
    c.selection = false;
    c.skipTargetFind = true;
    try {
      await c.loadFromJSON(next.scene);
      dimensions.current = { width: next.width, height: next.height };
      setSize(dimensions.current);
      setBackground(String(c.backgroundColor));
      setBackgroundImage(
        c.backgroundImage instanceof FabricImage
          ? c.backgroundImage.getSrc()
          : null,
      );
      setSelectedCount(0);
      setMultiSelect(false);
      multiSelectRef.current = false;
      history.current = [];
      index.current = -1;
      updateAccent();
      fit();
    } finally {
      locked.current = false;
      setBusy(false);
      c.renderOnAddRemove = previousRendering;
      c.selection = true;
      c.skipTargetFind = false;
    }
    commit();
  }
  async function add(sticker: Sticker) {
    const c = canvas.current;
    if (!c || locked.current) return;
    try {
      const img = await FabricImage.fromURL(sticker.src);
      if (locked.current || canvas.current !== c) return;
      const { width, height } = dimensions.current;
      img.scale(
        (Math.min(width, height) * 0.36) / Math.max(img.width, img.height),
      );
      const offset =
        ((c.getObjects().length % 5) - 2) * Math.min(width, height) * 0.035;
      img.set({
        left: width / 2 + offset,
        top: height / 2 + offset,
        originX: "center",
        originY: "center",
      });
      c.add(img);
      c.setActiveObject(img);
      c.requestRenderAll();
      commit();
    } catch {
      report("贴纸加载失败，请尝试其他图片");
    }
  }
  function resize(width: number, height: number) {
    if (locked.current) return;
    dimensions.current = { width, height };
    setSize({ width, height });
    fitBackground();
    fit();
    commit();
  }
  function deselect() {
    const c = canvas.current;
    if (!c || !c.getActiveObject() || locked.current) return;
    c.discardActiveObject();
    c.requestRenderAll();
  }
  function color(value: string) {
    const c = canvas.current;
    if (!c || locked.current) return;
    c.backgroundColor = value;
    c.backgroundImage = undefined;
    setBackgroundImage(null);
    setBackground(value);
    c.requestRenderAll();
    commit();
  }
  function fitBackground() {
    const image = canvas.current?.backgroundImage;
    if (!image) return;
    const { width, height } = dimensions.current;
    image.scale(Math.max(width / image.width, height / image.height));
    image.set({
      left: width / 2,
      top: height / 2,
      originX: "center",
      originY: "center",
    });
    image.setCoords();
  }
  async function imageBackground(source: string) {
    const c = canvas.current;
    if (!c || locked.current) return;
    const image = await FabricImage.fromURL(source);
    if (canvas.current !== c || locked.current) return;
    image.set({ selectable: false, evented: false });
    c.backgroundImage = image;
    setBackgroundImage(source);
    fitBackground();
    c.requestRenderAll();
    commit();
  }
  async function travel(direction: number) {
    const next = index.current + direction;
    const snapshot = history.current[next];
    const c = canvas.current;
    if (!snapshot || !c || locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await c.loadFromJSON(snapshot.scene);
      dimensions.current = { width: snapshot.width, height: snapshot.height };
      setSize(dimensions.current);
      setBackground(String(c.backgroundColor));
      setBackgroundImage(
        c.backgroundImage instanceof FabricImage
          ? c.backgroundImage.getSrc()
          : null,
      );
      index.current = next;
      setHistoryState({ index: next, length: history.current.length });
      setCount(c.getObjects().length);
      setSelectedCount(0);
      updateAccent();
      fit();
    } catch {
      report("无法恢复这一步，请重试");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function action(kind: string) {
    const c = canvas.current;
    const obj = c?.getActiveObject();
    if (!c || !obj || locked.current) return;
    const objects = c
      .getObjects()
      .filter((object) => c.getActiveObjects().includes(object));
    if (kind === "delete") {
      c.discardActiveObject();
      c.remove(...objects);
    }
    if (kind === "flipX") obj.set("flipX", !obj.flipX);
    if (kind === "flipY") obj.set("flipY", !obj.flipY);
    if (kind === "rotate") obj.rotate((obj.angle + 15) % 360);
    if (kind === "larger" || kind === "smaller")
      obj.set({
        scaleX: Math.max(
          0.001,
          obj.scaleX * (kind === "larger" ? 1.1 : 1 / 1.1),
        ),
        scaleY: Math.max(
          0.001,
          obj.scaleY * (kind === "larger" ? 1.1 : 1 / 1.1),
        ),
      });
    if (kind === "front" || kind === "back") {
      c.discardActiveObject();
      const ordered = kind === "front" ? [...objects].reverse() : objects;
      for (const object of ordered) {
        const stack = c.getObjects();
        const neighbor =
          stack[stack.indexOf(object) + (kind === "front" ? 1 : -1)];
        if (neighbor && !objects.includes(neighbor)) {
          if (kind === "front") c.bringObjectForward(object);
          else c.sendObjectBackwards(object);
        }
      }
      selectObjects(objects);
    }
    if (kind === "duplicate") {
      locked.current = true;
      setBusy(true);
      c.discardActiveObject();
      c.selection = false;
      c.skipTargetFind = true;
      try {
        // Deselect first so each clone keeps its world transform, not group coordinates.
        const clones = await Promise.all(
          objects.map((object) => object.clone()),
        );
        clones.forEach((clone) =>
          clone.set({ left: clone.left + 30, top: clone.top + 30 }),
        );
        c.add(...clones);
        selectObjects(clones);
      } catch {
        selectObjects(objects);
        report("复制失败，请重试");
        return;
      } finally {
        locked.current = false;
        setBusy(false);
        c.selection = true;
        c.skipTargetFind = false;
      }
    }
    obj.setCoords();
    c.requestRenderAll();
    commit();
  }
  async function download() {
    const c = canvas.current;
    if (!c || locked.current) return;
    try {
      const viewport = c.viewportTransform;
      let output: HTMLCanvasElement;
      try {
        c.viewportTransform = [1, 0, 0, 1, 0, 0];
        output = c.toCanvasElement(1, {
          width: size.width,
          height: size.height,
        });
      } finally {
        c.viewportTransform = viewport;
        c.calcViewportBoundaries();
      }
      const blob = await new Promise<Blob | null>((resolve) =>
        output.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error();
      saveBlob(blob, `贴贴-${size.width}×${size.height}.png`);
    } catch {
      report("图片导出失败，请减小画布尺寸后重试");
    }
  }
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (
        (event.target as HTMLElement).closest(
          'input, textarea, select, [role="dialog"]',
        )
      )
        return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        void action("delete");
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectAll();
      }
      if (event.key === "Escape") {
        deselect();
        multiSelectRef.current = false;
        setMultiSelect(false);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        void travel(event.shiftKey ? 1 : -1);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        void action("duplicate");
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  return {
    element,
    stage,
    size,
    resize,
    deselect,
    background,
    backgroundImage,
    imageBackground,
    color,
    selected: selectedCount > 0,
    selectedCount,
    multiSelect,
    toggleMultiSelect,
    selectAll,
    count,
    zoom,
    busy,
    add,
    action,
    download,
    travel,
    historyState,
    snapshot,
    restore,
    ready,
  };
}
