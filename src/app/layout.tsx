import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "JYS | Barber essentials, chosen well",
    template: "%s | JYS",
  },
  description: "Professional barber and men's grooming products across Palestine.",
  applicationName: "JYS",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "JYS",
    images: [{ url: "/images/jys-hero.png", width: 2048, height: 887 }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#f4f0e8",
  colorScheme: "light",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const locale = requestHeaders.get("x-jys-locale") === "ar" ? "ar" : "en";

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
