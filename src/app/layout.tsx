import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Grok Trading",
  description: "Grok Trading — CRM、财务、收件箱与 AI 助手",
  applicationName: "Grok Trading",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Grok Trading",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0f15",
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
    <html lang="zh-CN" className={inter.variable}>
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
