import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Expert Flow Analytics",
  description: "Premium landing page performance dashboard",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" className="dark">
      <body className="relative">
        <div className="noise-overlay" />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
