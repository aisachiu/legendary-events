export type ThemeId = "wisdom-bamboo" | "classic-paper";

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  description: string;
  cssVars: Record<string, string>;
};

export const DEFAULT_SITE_THEME: ThemeId = "wisdom-bamboo";

export const themes: Record<ThemeId, ThemeDefinition> = {
  "wisdom-bamboo": {
    id: "wisdom-bamboo",
    name: "Wisdom & Bamboo",
    description: "Forest green, bamboo beige, ink black, and jade accents.",
    cssVars: {
      "--paper": "#ebe6d6",
      "--ink": "#141810",
      "--mute": "#5c6358",
      "--line": "#d4cfc0",
      "--accent": "#4a8f6a",
      "--accent-deep": "#2a4a38",
      "--accent-ink": "#1e3d2c",
      "--accent-soft": "#d8ebe0",
      "--gold": "#4a8f6a",
      "--gold-ink": "#1e3d2c",
      "--gold-soft": "#d8ebe0",
    },
  },
  "classic-paper": {
    id: "classic-paper",
    name: "Classic Paper",
    description: "Warm paper tones with gold accents.",
    cssVars: {
      "--paper": "#f6f1e6",
      "--ink": "#1c1710",
      "--mute": "#6b6256",
      "--line": "#e2d8c6",
      "--accent": "#b8892d",
      "--accent-deep": "#6d4e12",
      "--accent-ink": "#6d4e12",
      "--accent-soft": "#f3e4c0",
      "--gold": "#b8892d",
      "--gold-ink": "#6d4e12",
      "--gold-soft": "#f3e4c0",
    },
  },
};

export const themeList = Object.values(themes);

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return value === "wisdom-bamboo" || value === "classic-paper";
}

export function resolveThemeId(value: string | null | undefined): ThemeId {
  return isThemeId(value) ? value : DEFAULT_SITE_THEME;
}

export function themeCssBlock(themeId: ThemeId): string {
  const vars = themes[themeId].cssVars;
  return Object.entries(vars)
    .map(([key, val]) => `${key}: ${val};`)
    .join("\n  ");
}
