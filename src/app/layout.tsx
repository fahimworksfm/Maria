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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ede7da" },
    { media: "(prefers-color-scheme: dark)", color: "#14130f" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light" suppressHydrationWarning>
      <head>
        {/* Resolve the palette before first paint. Without this, a dark-mode
            viewer gets a full flash of paper on every navigation. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('tether:mode')||'system';var d=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-mode',d?'dark':'light')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen">
        <div className="grain" aria-hidden />
        {children}
      </body>
    </html>
  );
}
