import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { getEventThemeId } from "@/lib/site-settings";

export default async function EventSlugLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await prisma.event.findUnique({
    where: { slug },
    select: { themeId: true },
  });
  const themeId = await getEventThemeId(event?.themeId ?? null);

  return (
    <div data-theme={themeId} className="event-theme-scope min-h-full">
      {children}
    </div>
  );
}
