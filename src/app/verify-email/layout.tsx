import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "E-mail-cím megerősítése",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default function VerificationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
