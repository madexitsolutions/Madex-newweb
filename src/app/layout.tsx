import type { Metadata, Viewport } from "next";
import "@fontsource-variable/schibsted-grotesk";
import "./globals.css";
import { site } from "@/content/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "Madex IT Solutions – Webdesign, Google Ads, SEO & Social Media für Schweizer KMU",
    template: "%s | Madex IT Solutions",
  },
  description: site.description,
  applicationName: site.name,
  openGraph: {
    type: "website",
    locale: "de_CH",
    siteName: site.name,
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Madex IT Solutions" }],
  },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#01363b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de-CH" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
