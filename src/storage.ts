import { useCallback, useEffect, useRef, useState } from "react";
import type { Pack } from "./library";
let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  if (!database)
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("sticker-studio", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("workspaces");
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          database = undefined;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("本地存储正在被其他页面占用"));
    }).catch((error) => {
      database = undefined;
      throw error;
    });
  return database;
}
export async function loadWorkspace(key: string): Promise<Pack | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("workspaces", "readonly");
    const request = transaction.objectStore("workspaces").get(key);
    transaction.oncomplete = () => {
      const value = request.result;
      if (value === undefined) resolve(null);
      else if (
        value?.schemaVersion === 1 &&
        Array.isArray(value.stickers) &&
        value.branding &&
        value.canvas
      )
        resolve(value);
      else reject(new Error("本地配置格式无效，无法自动恢复"));
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
async function storeWorkspace(key: string, data: Pack) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("workspaces", "readwrite");
    transaction.objectStore("workspaces").put(data, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
export function useAutoSave(key: string, enabled: boolean) {
  const [status, setStatus] = useState<
    "saved" | "saving" | "error" | "temporary"
  >(enabled ? "saved" : "temporary");
  const queue = useRef(Promise.resolve());
  const generation = useRef(0);
  const latest = useRef<Pack | null>(null);
  const save = useCallback(
    (data: Pack) => {
      if (!enabled) return Promise.resolve();
      latest.current = data;
      const version = ++generation.current;
      setStatus("saving");
      const operation = queue.current
        .catch(() => {})
        .then(() => storeWorkspace(key, data));
      queue.current = operation;
      operation.then(
        () => {
          if (version === generation.current) setStatus("saved");
        },
        () => {
          if (version === generation.current) setStatus("error");
        },
      );
      return operation;
    },
    [key, enabled],
  );
  const retry = useCallback(
    () => (latest.current ? save(latest.current) : Promise.resolve()),
    [save],
  );
  useEffect(() => {
    if (status !== "saving" && status !== "error") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);
  return { status, save, retry };
}
