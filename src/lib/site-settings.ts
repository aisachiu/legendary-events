import { prisma } from "@/lib/prisma";
import { DEFAULT_SITE_THEME, resolveThemeId, type ThemeId } from "@/lib/themes";

export async function getSiteThemeId(): Promise<ThemeId> {
  const row = await prisma.siteSettings.findUnique({ where: { id: "default" } });
  return resolveThemeId(row?.siteThemeId);
}

export async function getEventThemeId(eventThemeId: string | null): Promise<ThemeId> {
  if (eventThemeId) return resolveThemeId(eventThemeId);
  return getSiteThemeId();
}
