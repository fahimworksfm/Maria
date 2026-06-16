import "@fontsource-variable/fraunces";
import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Tether",
  description: "A private space for two.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Tether",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0a09",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="grain" aria-hidden />
        {children}
      </body>
    </html>
  );
}
