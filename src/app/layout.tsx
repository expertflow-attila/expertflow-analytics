import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Funnel Intelligence OS",
    template: "%s · Funnel Intelligence OS",
  },
  description:
    "Open-source customer journey, funnel analytics and revenue intelligence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
