import { useEffect, useState } from "react";

export function getDeviceSize() {
  const ratio = window.devicePixelRatio || 1;
  const rawWidth = Math.max(
    64,
    Math.round((window.screen.width || window.innerWidth) * ratio),
  );
  const rawHeight = Math.max(
    64,
    Math.round((window.screen.height || window.innerHeight) * ratio),
  );
  const scale = Math.min(1, 4096 / Math.max(rawWidth, rawHeight));
  return {
    width: Math.max(64, Math.round(rawWidth * scale)),
    height: Math.max(64, Math.round(rawHeight * scale)),
    rawWidth,
    rawHeight,
    limited: scale < 1,
  };
}

export function useDeviceSize() {
  const [size, setSize] = useState(getDeviceSize);
  useEffect(() => {
    const update = () => setSize(getDeviceSize());
    window.addEventListener("resize", update);
    window.screen.orientation?.addEventListener("change", update);
    return () => {
      window.removeEventListener("resize", update);
      window.screen.orientation?.removeEventListener("change", update);
    };
  }, []);
  return size;
}
