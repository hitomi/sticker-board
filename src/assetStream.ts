export const assetPrefix = "sticker-asset:";
export type AssetStream = {
  assets: Record<string, string>;
  received: number;
  total: number;
  done: boolean;
  error: boolean;
};
declare global {
  interface Window {
    __stickerStream?: AssetStream;
  }
}
export function isPendingAsset(source: string) {
  return source.startsWith(assetPrefix);
}
// Only image fields contain references; names and other user text stay literal.
export function resolveAssets<T>(
  value: T,
  assets: Record<string, string>,
  strict = false,
): T {
  const visit = (input: unknown, key = ""): unknown => {
    if (
      (key === "src" || key === "logo") &&
      typeof input === "string" &&
      isPendingAsset(input)
    ) {
      const source = assets[input.slice(assetPrefix.length)];
      if (!source && strict)
        throw new Error("独立版图片资源不完整，请重新选择完整文件");
      return source || input;
    }
    if (Array.isArray(input)) return input.map((item) => visit(item));
    if (input && typeof input === "object")
      return Object.fromEntries(
        Object.entries(input).map(([name, item]) => [name, visit(item, name)]),
      );
    return input;
  };
  return visit(value) as T;
}
