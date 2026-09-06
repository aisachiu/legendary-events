import { prisma } from "@/lib/prisma";

export async function getChannelBySlug(slug: string) {
  return prisma.channel.findUnique({
    where: { slug },
    include: {
      event: {
        include: { organizer: true },
      },
    },
  });
}

export type ChannelWithEvent = NonNullable<Awaited<ReturnType<typeof getChannelBySlug>>>;
