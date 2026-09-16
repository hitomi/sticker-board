export const DEFAULT_THEME = "#786394";
export const themes = [
  { name: "雾紫", color: DEFAULT_THEME },
  { name: "海蓝", color: "#426fa6" },
  { name: "苔绿", color: "#47785f" },
  { name: "玫瑰", color: "#b45e79" },
  { name: "暖橘", color: "#ad693c" },
  { name: "石墨", color: "#525b66" },
];
export function themeStyle(value = DEFAULT_THEME, text?: "light" | "dark") {
  const color = /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_THEME;
  const rgb = [1, 3, 5].map((start) =>
    parseInt(color.slice(start, start + 2), 16),
  );
  const luminance = rgb
    .map((channel) => {
      const c = channel / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce(
      (sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i],
      0,
    );
  const blend = (target: number, amount: number) =>
    `rgb(${rgb.map((channel) => Math.round(channel * (1 - amount) + target * amount)).join(", ")})`;
  return {
    "--accent": color,
    "--accent-ink":
      text === "light"
        ? "#ffffff"
        : text === "dark"
          ? "#17151b"
          : luminance > 0.179
            ? "#17151b"
            : "#ffffff",
    "--accent-hover": blend(0, 0.1),
    "--accent-soft": blend(255, 0.9),
    "--accent-border": blend(255, 0.65),
    "--accent-text": blend(0, luminance > 0.179 ? 0.55 : 0.05),
  };
}
