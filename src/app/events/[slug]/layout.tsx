import type { ReactNode } from "react";
import { getChannelBySlug } from "@/lib/channels";
import { getEventThemeId } from "@/lib/site-settings";

export default async function EventSlugLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const channel = await getChannelBySlug(slug);
  const themeId = await getEventThemeId(channel?.themeId ?? null);

  return (
    <div data-theme={themeId} className="event-theme-scope min-h-full">
      {children}
    </div>
  );
}
