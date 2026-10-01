// Only APIs used by the shared editor and its dependencies are filled in here.
window.addEventListener("sticker-ready", () => document.getElementById("boot-screen")?.remove(), { once: true });
if (!Object.fromEntries) Object.fromEntries = (entries: Iterable<readonly [PropertyKey, unknown]>) => {
  const output: Record<PropertyKey, unknown> = {};
  for (const [key, value] of entries) Object.defineProperty(output, key, { value, enumerable: true, writable: true, configurable: true });
  return output;
};
if (!Array.prototype.at) Object.defineProperty(Array.prototype, "at", { value: function(index: number) {
  const position = Math.trunc(Number(index)) || 0;
  return this[position < 0 ? this.length + position : position];
}, configurable: true, writable: true });
if (!Array.prototype.flat) Object.defineProperty(Array.prototype, "flat", { value: function(depth = 1) {
  return depth > 0 ? this.reduce((result: unknown[], item: unknown) => result.concat(Array.isArray(item) ? item.flat(depth - 1) : item), []) : this.slice();
}, configurable: true, writable: true });
if (!Array.prototype.flatMap) Object.defineProperty(Array.prototype, "flatMap", { value: function(callback: (value: unknown, index: number, array: unknown[]) => unknown, receiver?: unknown) {
  return this.map(callback, receiver).flat();
}, configurable: true, writable: true });
if (!Promise.prototype.finally) Object.defineProperty(Promise.prototype, "finally", { value: function(callback: () => unknown) {
  return this.then((value: unknown) => Promise.resolve(callback()).then(() => value), (error: unknown) => Promise.resolve(callback()).then(() => { throw error; }));
}, configurable: true, writable: true });
if (!Promise.allSettled) Promise.allSettled = ((values: Iterable<unknown>) => Promise.all(Array.from(values, (value) =>
  Promise.resolve(value).then((value) => ({ status: "fulfilled", value }), (reason) => ({ status: "rejected", reason })),
))) as typeof Promise.allSettled;
if (!String.prototype.matchAll) Object.defineProperty(String.prototype, "matchAll", { value: function(pattern: RegExp) {
  const expression = new RegExp(pattern.source, pattern.flags);
  expression.lastIndex = pattern.lastIndex;
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = expression.exec(String(this)))) {
    matches.push(match);
    if (!expression.global) break;
    if (!match[0]) expression.lastIndex++;
  }
  return matches[Symbol.iterator]();
}, configurable: true, writable: true });
if (!HTMLImageElement.prototype.decode) HTMLImageElement.prototype.decode = function() {
  return new Promise<void>((resolve, reject) => {
    const clean = () => { this.removeEventListener("load", loaded); this.removeEventListener("error", failed); };
    const loaded = () => { clean(); resolve(); };
    const failed = () => { clean(); reject(new Error("图片无法打开")); };
    if (this.complete) { this.naturalWidth ? resolve() : reject(new Error("图片无法打开")); return; }
    this.addEventListener("load", loaded); this.addEventListener("error", failed);
  });
};
if (!window.ResizeObserver) {
  // Shared DOM/viewport observation avoids polling while idle on older WebViews.
  const observers = new Set<SizeObserver>();
  let scheduled = false;
  const measure = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; observers.forEach((observer) => observer.measure()); });
  };
  class SizeObserver {
    targets = new Map<Element, string>();
    constructor(private callback: ResizeObserverCallback) { observers.add(this); }
    observe(target: Element) { this.targets.set(target, ""); observers.add(this); measure(); }
    unobserve(target: Element) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); observers.delete(this); }
    measure() {
      const entries: ResizeObserverEntry[] = [];
      this.targets.forEach((previous, target) => {
        const rect = target.getBoundingClientRect();
        const size = `${rect.width}:${rect.height}`;
        if (size === previous) return;
        this.targets.set(target, size);
        entries.push({ target, contentRect: rect, borderBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }], contentBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }], devicePixelContentBoxSize: [] });
      });
      if (entries.length) this.callback(entries, this as unknown as ResizeObserver);
    }
  }
  window.ResizeObserver = SizeObserver as unknown as typeof ResizeObserver;
  new MutationObserver(measure).observe(document.body, { subtree: true, childList: true, attributes: true });
  window.addEventListener("resize", measure);
  document.addEventListener("load", measure, true);
}
const height = () => document.documentElement.style.setProperty("--app-height", `${window.visualViewport?.height || window.innerHeight}px`);
height();
window.addEventListener("resize", height);
window.visualViewport?.addEventListener("resize", height);

const flex = document.createElement("div");
flex.style.cssText = "position:absolute;visibility:hidden;display:flex;flex-direction:column;row-gap:1px";
flex.appendChild(document.createElement("div"));
flex.appendChild(document.createElement("div"));
document.body.appendChild(flex);
const gapSupported = flex.scrollHeight === 1;
flex.remove();
if (!gapSupported) document.documentElement.classList.add("no-flex-gap");
