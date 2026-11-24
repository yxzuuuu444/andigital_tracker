import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TrackerProvider } from "@/lib/tracker-context";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ThemeInit } from "@/components/ThemeInit";

export const metadata: Metadata = {
  title: "Andigital Tracker",
  description: "Personal expense and monthly allowance tracker.",
  applicationName: "Andigital Tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Andigital",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#8b5cf6",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-transparent text-[#2E1065] antialiased">
        <div className="app-backdrop" aria-hidden />
        <TrackerProvider>{children}</TrackerProvider>
        <ServiceWorkerRegister />
        <ThemeInit />
      </body>
    </html>
  );
}
