import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const socialImage = `${origin}/og.png`;

  return {
    metadataBase: new URL(origin),
    title: {
      default: "Doodh Khata",
      template: "%s | Doodh Khata",
    },
    description: "A modern dairy sales, purchase, inventory, and ledger app for Pakistan's dairy community.",
    applicationName: "Doodh Khata",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: "/icon-192.png", type: "image/png", sizes: "192x192" }],
      apple: [{ url: "/icon-192.png", type: "image/png", sizes: "192x192" }],
    },
    appleWebApp: { capable: true, title: "Doodh Khata", statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
    keywords: ["dairy management", "milk ledger", "Firebase", "Pakistan", "AI business advisor"],
    authors: [{ name: "Doodh Khata" }],
    openGraph: {
      title: "Doodh Khata - Har litre ka saaf hisaab",
      description: "Sales, purchases, stock, udhaar, and AI mashwara in one dairy business app.",
      type: "website",
      locale: "en_PK",
      url: origin,
      images: [{ url: socialImage, width: 1536, height: 1024, alt: "Doodh Khata dairy business app" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Doodh Khata",
      description: "Har litre ka saaf hisaab.",
      images: [socialImage],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d4b3a",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

