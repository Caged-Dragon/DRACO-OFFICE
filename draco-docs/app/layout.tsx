import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterServiceWorker from "./register-sw";

export const metadata: Metadata = {
  title: "DocWrite",
  description: "A cross-platform, offline-first document editor.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DocWrite",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1e293b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
