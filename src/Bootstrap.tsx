import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import App from "./App";
import { demo } from "./demo";
import { loadWorkspace } from "./storage";
import type { Pack } from "./library";
const embedded: Pack = __STANDALONE__
  ? JSON.parse(
      document.getElementById("sticker-pack")?.textContent || "null",
    ) || { name: "贴纸库", stickers: [] }
  : demo;
const storageKey = __STANDALONE__
  ? `standalone:${embedded.buildId || location.pathname}`
  : `studio:${import.meta.env.BASE_URL}`;
export default function Bootstrap() {
  const [initial, setInitial] = useState<Pack | null>(null);
  const [error, setError] = useState(false);
  const [temporary, setTemporary] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    loadWorkspace(storageKey).then(
      (saved) => {
        if (active) setInitial(saved || embedded);
      },
      () => {
        if (active) setError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);
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
          <p>无法读取本地数据，原数据未被修改。</p>
          <div>
            <button
              className="primary"
              onClick={() => setAttempt((value) => value + 1)}
            >
              重试
            </button>
            <button
              className="small-button"
              onClick={() => {
                setTemporary(true);
                setInitial(embedded);
              }}
            >
              临时打开
            </button>
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
