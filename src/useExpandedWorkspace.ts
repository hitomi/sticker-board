import { useLayoutEffect, useState } from "react";

export function useExpandedWorkspace() {
  const [enabled, setEnabled] = useState(false);
  const [guiding, setGuiding] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const standalone = (navigator as Navigator & { standalone?: boolean })
    .standalone;
  const supported =
    !standalone &&
    !matchMedia("(display-mode: standalone)").matches &&
    (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

  useLayoutEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.classList.add("workspace-expanded");
    return () => {
      root.classList.remove("workspace-expanded");
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    };
  }, [enabled]);

  useLayoutEffect(() => {
    if (!enabled || !guiding) return;
    let width = window.innerWidth;
    let initialHeight = window.visualViewport?.height || window.innerHeight;
    let touching = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const inspect = () => {
      clearTimeout(timer);
      const height = window.visualViewport?.height || window.innerHeight;
      // Rotation is a new baseline, not evidence that the toolbar collapsed.
      if (Math.abs(window.innerWidth - width) > 24) {
        width = window.innerWidth;
        initialHeight = height;
        return;
      }
      if (window.scrollY > 8) setScrolled(true);
      if (!touching && window.scrollY > 8 && height > initialHeight + 24) {
        timer = setTimeout(() => setGuiding(false), 250);
      }
    };
    const start = () => {
      touching = true;
      clearTimeout(timer);
    };
    const end = () => {
      touching = false;
      inspect();
    };
    window.addEventListener("scroll", inspect, { passive: true });
    window.addEventListener("resize", inspect);
    window.visualViewport?.addEventListener("resize", inspect);
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchend", end, { passive: true });
    window.addEventListener("touchcancel", end, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", inspect);
      window.removeEventListener("resize", inspect);
      window.visualViewport?.removeEventListener("resize", inspect);
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
    };
  }, [enabled, guiding]);

  return {
    supported,
    enabled,
    guiding,
    scrolled,
    toggle: () => {
      setEnabled(!enabled);
      setGuiding(!enabled);
      setScrolled(false);
    },
    continueEditing: () => setGuiding(false),
    exit: () => {
      setGuiding(false);
      setEnabled(false);
    },
  };
}
