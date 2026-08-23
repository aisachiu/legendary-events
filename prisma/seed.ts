import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const host = await prisma.user.upsert({
    where: { email: "host@legendary.events" },
    update: {},
    create: {
      email: "host@legendary.events",
      name: "Amina Gold",
      role: "ORGANIZER",
    },
  });

  await prisma.user.upsert({
    where: { email: "guest@legendary.events" },
    update: {},
    create: {
      email: "guest@legendary.events",
      name: "Jordan Vale",
      role: "ATTENDEE",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@legendary.events" },
    update: { role: "SUPERADMIN" },
    create: {
      email: "admin@legendary.events",
      name: "Legendary Admin",
      role: "SUPERADMIN",
    },
  });

  const mixerStarts = new Date();
  mixerStarts.setDate(mixerStarts.getDate() + 14);
  mixerStarts.setHours(18, 30, 0, 0);
  const mixerEnds = new Date(mixerStarts);
  mixerEnds.setHours(21, 30, 0, 0);

  const houseStarts = new Date();
  houseStarts.setDate(houseStarts.getDate() + 7);
  houseStarts.setHours(11, 0, 0, 0);
  const houseEnds = new Date(houseStarts);
  houseEnds.setHours(13, 0, 0, 0);

  const dinnerStarts = new Date();
  dinnerStarts.setDate(dinnerStarts.getDate() + 21);
  dinnerStarts.setHours(19, 0, 0, 0);
  const dinnerEnds = new Date(dinnerStarts);
  dinnerEnds.setHours(22, 0, 0, 0);

  await prisma.event.upsert({
    where: { slug: "gold-circle-mixer" },
    update: {},
    create: {
      slug: "gold-circle-mixer",
      title: "Gold Circle Mixer",
      summary: "A night for founders, operators, and people who actually ship.",
      description:
        "Small-room networking with introductions, not badge-scanning. After you sign up and your place is confirmed, you can read every attendee bio and share yours.\n\nDress: dark and easy. Phones down after the first toast.",
      venue: "The Annex, 18 Pearl Street",
      startsAt: mixerStarts,
      endsAt: mixerEnds,
      isNetworking: true,
      isPaid: true,
      priceCents: 4500,
      currency: "hkd",
      allowOfflinePayment: true,
      paymentInstructions:
        "Transfer $45 to the host and put your name in the memo. Then upload a screenshot here.",
      organizerId: host.id,
    },
  });

  await prisma.event.upsert({
    where: { slug: "saturday-open-house" },
    update: {},
    create: {
      slug: "saturday-open-house",
      title: "Saturday Open House",
      summary: "Walk through the space, meet the hosts, stay for coffee.",
      description:
        "Free and open. No bios, no tickets — just show up and say hello. Good if you want to see Legendary Events before buying into a ticketed night.",
      venue: "The Annex courtyard",
      startsAt: houseStarts,
      endsAt: houseEnds,
      isNetworking: false,
      isPaid: false,
      priceCents: 0,
      allowOfflinePayment: false,
      organizerId: host.id,
    },
  });

  await prisma.event.upsert({
    where: { slug: "founders-table" },
    update: {},
    create: {
      slug: "founders-table",
      title: "Founders Table",
      summary: "Twelve seats. One long dinner. Pay by card or bank transfer.",
      description:
        "A seated dinner for people running companies. Pay off-platform (transfer, cash, invoice) and upload a receipt here. The host marks you paid once they can see it.\n\nConfirmed guests unlock the table bios.",
      venue: "Private dining room, Harbour House",
      startsAt: dinnerStarts,
      endsAt: dinnerEnds,
      isNetworking: true,
      isPaid: true,
      priceCents: 12000,
      currency: "hkd",
      capacity: 12,
      allowOfflinePayment: true,
      organizerId: host.id,
    },
  });

  console.log(
    "Seeded host@ / guest@ / admin@legendary.events. They sign in with Descope (Google or magic link to those emails).",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
