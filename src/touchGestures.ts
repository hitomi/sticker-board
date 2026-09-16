import { Canvas, Point, type FabricObject } from "fabric";

type Options = {
  blocked: () => boolean;
  multiSelect: () => boolean;
  select: (objects: FabricObject[]) => void;
  begin: () => void;
  finish: (changed: boolean) => void;
  viewChanged: (scale: number) => void;
};
type Pose = { center: Point; scaleX: number; scaleY: number; angle: number };
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const angle = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x);
const midpoint = (a: Point, b: Point) => a.add(b).scalarDivide(2);
const rotate = (p: Point, radians: number) =>
  new Point(
    p.x * Math.cos(radians) - p.y * Math.sin(radians),
    p.x * Math.sin(radians) + p.y * Math.cos(radians),
  );

// Own all touch gestures, including touches on handles. Fabric keeps mouse/pen controls.
export function attachTouchGestures(
  canvas: Canvas,
  stage: HTMLElement,
  options: Options,
) {
  const wrapper = canvas.upperCanvasEl.closest<HTMLElement>(".canvas-wrap")!;
  const pointers = new Map<number, PointerEvent>();
  let view = { scale: 1, x: 0, y: 0 };
  let changed = false;
  let active = false;
  let touchingControl = false;
  let target: FabricObject | undefined;
  let tapTarget: FabricObject | undefined;
  let tapSelection: FabricObject | undefined;
  let canDragTarget = false;
  let pose: Pose | undefined;
  let start: Point[] = [];
  let startView = { ...view };
  let baseCenter = new Point();
  let moved = false;
  let paired = false;
  let waitingForRelease = false;
  const client = (e: PointerEvent) => new Point(e.clientX, e.clientY);
  const scene = (point: Point) =>
    canvas.getScenePoint(
      new PointerEvent("pointermove", { clientX: point.x, clientY: point.y }),
    );
  const applyView = (next: typeof view) => {
    const xLimit = Math.max(
      0,
      (canvas.width * next.scale + stage.clientWidth) / 2 - 48,
    );
    const yLimit = Math.max(
      0,
      (canvas.height * next.scale + stage.clientHeight) / 2 - 48,
    );
    view = {
      scale: next.scale,
      x: Math.max(-xLimit, Math.min(xLimit, next.x)),
      y: Math.max(-yLimit, Math.min(yLimit, next.y)),
    };
    wrapper.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    canvas.calcOffset();
    options.viewChanged(view.scale);
  };
  const capturePose = () => {
    pose = target
      ? {
          center: target.getCenterPoint(),
          scaleX: target.scaleX,
          scaleY: target.scaleY,
          angle: target.angle,
        }
      : undefined;
  };
  const stop = (event: PointerEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const finish = () => {
    if (!active) return;
    active = false;
    for (const id of pointers.keys())
      if (stage.hasPointerCapture(id)) stage.releasePointerCapture(id);
    pointers.clear();
    target?.setCoords();
    canvas.requestRenderAll();
    options.finish(changed);
    target = undefined;
    waitingForRelease = false;
  };
  const down = (event: PointerEvent) => {
    if (
      event.pointerType !== "touch" ||
      !(event.target instanceof Element) ||
      event.target.closest("button")
    )
      return;
    if (!active && options.blocked()) {
      stop(event);
      return;
    }
    if (!active) {
      const selected = canvas.getActiveObject();
      const onCanvas = event.target === canvas.upperCanvasEl;
      touchingControl = !!(
        onCanvas && selected?.findControl(canvas.getViewportPoint(event), true)
      );
      const point = canvas.getScenePoint(event);
      tapTarget = onCanvas
        ? canvas.searchPossibleTargets(canvas.getObjects(), point).target
        : undefined;
      const hitSelection =
        touchingControl || !!(onCanvas && selected?.containsPoint(point));
      tapSelection = hitSelection ? selected : tapTarget;
      // Keep the current selection until a single tap finishes. A second finger
      // can then start anywhere without deselecting or selecting another sticker.
      target = selected || (options.multiSelect() ? undefined : tapTarget);
      canDragTarget = selected ? hitSelection : !!tapTarget;
      if (!selected && target && !options.multiSelect())
        options.select([target]);
      changed = false;
      moved = false;
      paired = false;
      waitingForRelease = false;
      active = true;
      options.begin();
      start = [client(event)];
      startView = { ...view };
      capturePose();
    }
    stop(event);
    pointers.set(event.pointerId, event);
    stage.setPointerCapture(event.pointerId);
    if (pointers.size === 2 && !waitingForRelease) {
      paired = true;
      start = [...pointers.values()].map(client);
      startView = { ...view };
      const rect = wrapper.getBoundingClientRect();
      baseCenter = new Point(
        rect.left + rect.width / 2 - view.x,
        rect.top + rect.height / 2 - view.y,
      );
      capturePose();
    }
  };
  const move = (event: PointerEvent) => {
    if (!active || !pointers.has(event.pointerId)) return;
    stop(event);
    pointers.set(event.pointerId, event);
    if (waitingForRelease || pointers.size > 2) return;
    const points = [...pointers.values()].map(client);
    if (pointers.size === 1) {
      if (distance(points[0], start[0]) < 3 && !moved) return;
      moved = true;
      if (target && pose && canDragTarget && !options.multiSelect()) {
        target.setPositionByOrigin(
          pose.center.add(scene(points[0]).subtract(scene(start[0]))),
          "center",
          "center",
        );
        changed = true;
      } else if (!target && view.scale > 1 && !options.multiSelect()) {
        const delta = points[0].subtract(start[0]);
        applyView({
          ...startView,
          x: startView.x + delta.x,
          y: startView.y + delta.y,
        });
      }
    } else {
      if (distance(start[0], start[1]) < 8) {
        start = points;
        capturePose();
        return;
      }
      const factor =
        distance(points[0], points[1]) / distance(start[0], start[1]);
      const from = midpoint(start[0], start[1]);
      const to = midpoint(points[0], points[1]);
      const radians = angle(points[0], points[1]) - angle(start[0], start[1]);
      if (
        !moved &&
        Math.abs(factor - 1) < 0.01 &&
        Math.abs(radians) < 0.02 &&
        distance(from, to) < 3
      )
        return;
      moved = true;
      if (target && pose) {
        const scale = Math.max(
          0.001 / Math.min(pose.scaleX, pose.scaleY),
          factor,
        );
        const center = scene(to).add(
          rotate(
            pose.center.subtract(scene(from)).scalarMultiply(scale),
            radians,
          ),
        );
        target.set({
          scaleX: pose.scaleX * scale,
          scaleY: pose.scaleY * scale,
          angle: pose.angle + (radians * 180) / Math.PI,
        });
        target.setPositionByOrigin(center, "center", "center");
        changed = true;
      } else {
        const scale = Math.max(1, Math.min(5, startView.scale * factor));
        const offset = to.subtract(baseCenter).subtract(
          from
            .subtract(baseCenter)
            .subtract(new Point(startView.x, startView.y))
            .scalarMultiply(scale / startView.scale),
        );
        applyView({ scale, x: offset.x, y: offset.y });
      }
    }
    target?.setCoords();
    canvas.requestRenderAll();
  };
  const up = (event: PointerEvent) => {
    if (!active || !pointers.has(event.pointerId)) return;
    stop(event);
    pointers.delete(event.pointerId);
    if (stage.hasPointerCapture(event.pointerId))
      stage.releasePointerCapture(event.pointerId);
    if (!paired && !moved && event.type === "pointerup") {
      if (options.multiSelect() && !touchingControl) {
        const selected = canvas.getActiveObjects();
        options.select(
          tapTarget
            ? selected.includes(tapTarget)
              ? selected.filter((item) => item !== tapTarget)
              : [...selected, tapTarget]
            : [],
        );
      } else if (
        !options.multiSelect() &&
        canvas.getActiveObject() !== tapSelection
      ) {
        options.select(tapSelection ? [tapSelection] : []);
      }
    }
    // Wait for all fingers to lift: the remaining finger must not jump or start dragging.
    waitingForRelease = pointers.size > 0;
    if (!pointers.size) finish();
  };
  const blur = () => finish();
  const visibility = () => {
    if (document.hidden) blur();
  };
  stage.addEventListener("pointerdown", down, { capture: true });
  window.addEventListener("pointermove", move, {
    capture: true,
    passive: false,
  });
  window.addEventListener("pointerup", up, { capture: true });
  window.addEventListener("pointercancel", up, { capture: true });
  stage.addEventListener("lostpointercapture", up, { capture: true });
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", visibility);
  return {
    resetView: () => {
      finish();
      applyView({ scale: 1, x: 0, y: 0 });
    },
    dispose: () => {
      finish();
      stage.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      stage.removeEventListener("lostpointercapture", up, true);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
      wrapper.style.transform = "";
    },
  };
}
