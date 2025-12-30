import { TempoInit } from "@/components/tempo-init";
import { QueryProvider } from "@/components/query-provider";
import { RealtimeProvider } from "@/providers/realtime-provider";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Care Coordination Platform",
  description: "Issue tracking and care coordination for hospice agencies",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Care Coord",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FFFFFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PWA Meta Tags for iOS/iPadOS */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Care Coord" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
        <link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon.svg" />
        <link rel="apple-touch-icon" sizes="167x167" href="/apple-touch-icon.svg" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.svg" />
        
        {/* iPad Splash Screens */}
        <link
          rel="apple-touch-startup-image"
          href="/apple-touch-icon.svg"
          media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-touch-icon.svg"
          media="(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-touch-icon.svg"
          media="(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-touch-icon.svg"
          media="(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-touch-icon.svg"
          media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-touch-icon.svg"
          media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)"
        />
      </head>
      <body className={inter.className}>
        <QueryProvider>
          <RealtimeProvider>
            {children}
            <Toaster />
            <TempoInit />
          </RealtimeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
