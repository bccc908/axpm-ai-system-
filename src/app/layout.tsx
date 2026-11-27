import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-inter-tight",
});

export const metadata: Metadata = {
  title: {
    default: "KD · Operations",
    template: "%s · KD",
  },
  description: "KD — CRM、财务、收件箱与 AI 助手",
  applicationName: "KD",
  icons: {
    icon: [
      { url: "/brand/favicon-kd.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-kd-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-kd-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/brand/favicon-kd-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KD",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#111521",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${interTight.variable}`}>
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
