import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import App from "./App";
import { demo } from "./demo";
import { loadWorkspace } from "./storage";
import type { Pack } from "./library";
import { finishStartup, paintStartup, startupMessage } from "./startup";
import { resolveAssets } from "./assetStream";

let embedded: Pack;
let storageKey: string;
export default function Bootstrap() {
  const [initial, setInitial] = useState<Pack | null>(null);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [error, setError] = useState("");
  const [temporary, setTemporary] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    setError("");
    setReloadRequired(false);
    const openEmbedded = () => {
      const stream = window.__stickerStream;
      const resolved = resolveAssets(embedded, stream?.assets || {});
      try {
        // Saved artwork and logo arrive first; the rest of the library streams in later.
        resolveAssets(
          { canvas: embedded.canvas, branding: embedded.branding },
          stream?.assets || {},
          true,
        );
      } catch {
        if (stream?.error) {
          setReloadRequired(true);
          setError("素材未完整载入，请检查网络后重新打开。");
          finishStartup();
        }
        return;
      }
      if (active) {
        unsubscribe();
        startupMessage("正在准备画布…");
        setInitial(resolved);
      }
    };
    void (async () => {
      startupMessage("正在读取配置…");
      await paintStartup();
      if (!active) return;
      try {
        embedded ||= __STANDALONE__
          ? JSON.parse(
              document.getElementById("sticker-pack")?.textContent || "null",
            ) || { name: "贴纸库", stickers: [] }
          : demo;
        const stream = window.__stickerStream;
        if (stream) {
          stream.total =
            (embedded as Pack & { assetCount?: number }).assetCount || 0;
          stream.error =
            (stream.done || document.readyState === "complete") &&
            stream.received < stream.total;
        }
        storageKey = __STANDALONE__
          ? `standalone:${embedded.buildId || location.pathname}`
          : `studio:${import.meta.env.BASE_URL}`;
      } catch {
        setReloadRequired(true);
        setError("无法读取贴纸配置，请重新打开完整的独立版文件。");
        finishStartup();
        return;
      }
      startupMessage("正在读取本地数据…");
      try {
        const saved = temporary ? null : await loadWorkspace(storageKey);
        if (!active) return;
        if (saved) {
          startupMessage("正在准备画布…");
          setInitial(saved);
        } else {
          startupMessage("正在加载画布素材…");
          window.addEventListener("sticker-assets", openEmbedded);
          unsubscribe = () =>
            window.removeEventListener("sticker-assets", openEmbedded);
          openEmbedded();
        }
      } catch {
        if (active) {
          setError("无法读取本地数据，原数据未被修改。");
          finishStartup();
        }
      }
    })();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [attempt, temporary]);
  if (initial)
    return (
      <App
        initialPack={initial}
        storageKey={storageKey}
        persistent={!temporary}
      />
    );
  return (
    <div className="startup">
      {error ? (
        <>
          <p>{error}</p>
          <div>
            <button
              className="primary"
              onClick={() =>
                reloadRequired
                  ? location.reload()
                  : setAttempt((value) => value + 1)
              }
            >
              {reloadRequired ? "重新打开" : "重试"}
            </button>
            {embedded && !temporary && !reloadRequired && (
              <button
                className="small-button"
                onClick={() => setTemporary(true)}
              >
                临时打开
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <LoaderCircle className="spin" size={22} />
          <span>正在恢复…</span>
        </>
      )}
    </div>
  );
}
