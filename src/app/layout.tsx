import "@fontsource-variable/figtree";
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
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#111318" },
  ],
  // No maximumScale / userScalable: pinch-zoom stays available for anyone who
  // needs larger text.
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light" suppressHydrationWarning>
      <head>
        {/* Resolve the palette before first paint. Without this, a dark-mode
            viewer gets a full flash of the light ground on every navigation. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('tether:mode')||'system';var d=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-mode',d?'dark':'light')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
