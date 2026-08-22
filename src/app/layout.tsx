import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import { DescopeProviders } from "@/components/DescopeProviders";
import { Header } from "@/components/Header";
import { getCurrentUser } from "@/lib/auth";
import { getSiteThemeId } from "@/lib/site-settings";
import "./globals.css";

const sans = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

const serif = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Legendary Events",
  description: "Create events, take signups, and open the room once people are in.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const siteTheme = await getSiteThemeId();
  return (
    <html lang="en" data-theme={siteTheme} className={`${sans.variable} ${serif.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <DescopeProviders>
          <Header user={user} />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-[var(--line)] px-5 py-8 text-center text-sm text-[var(--mute)]">
            Legendary Events — public signups, networking rooms, and receipt-based payments.
          </footer>
        </DescopeProviders>
      </body>
    </html>
  );
}
