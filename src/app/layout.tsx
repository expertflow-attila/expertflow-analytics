import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Expert Flow Analytics",
  description: "Landing page analytics dashboard",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu">
      <body>{children}</body>
    </html>
  );
}
