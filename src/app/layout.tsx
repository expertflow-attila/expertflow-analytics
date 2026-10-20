import type { Metadata } from "next";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const sans = Geist({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-sans",
});
const mono = Geist_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Business Native · Analitika",
    template: "%s · Business Native",
  },
  description:
    "Ügyfélutak, értékesítési tölcsérek és bevételek elemzése egy helyen.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="hu"
      className={`${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans">{children}</body>
    </html>
  );
}
