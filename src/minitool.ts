import type { Pack } from "./library";

type MiniTool = {
  writeTempFile?: (options: { data: string }) => Promise<{ filePath: string }>;
  saveImageToPhotosAlbum?: (options: { filePath: string }) => Promise<unknown>;
  postNote?: (options: { pageType: "photo_publish"; mediaInfo: { image_resources: { url: string }[] } }) => Promise<unknown>;
};
declare global {
  interface Window {
    __stickerPack?: Pack;
    xhs?: { miniTool?: MiniTool };
  }
}
export async function sendMiniToolImage(blob: Blob, action: "save" | "post") {
  const api = window.xhs?.miniTool;
  const method = action === "save" ? api?.saveImageToPhotosAlbum : api?.postNote;
  if (typeof method !== "function")
    throw new Error("当前环境不支持此操作，请在小红书中打开并更新客户端后重试");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("图片读取失败，请重试"));
    reader.readAsDataURL(blob);
  });
  const filePath = typeof api?.writeTempFile === "function"
    ? (await api.writeTempFile({ data })).filePath : data;
  if (!filePath) throw new Error("图片准备失败，请重试");
  if (action === "save") await api!.saveImageToPhotosAlbum!({ filePath });
  else await api!.postNote!({ pageType: "photo_publish", mediaInfo: { image_resources: [{ url: filePath }] } });
}
