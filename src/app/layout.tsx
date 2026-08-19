import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from "@/components/theme-provider"
import './globals.css'

// A businessnative.hu élő oldala Geist Variable-t (törzs+cím) és Geist Mono
// Variable-t (kicker/mono szövegek) használ — ld. a Webflow-tükör
// megosztott CSS-jét (--_🔠-typography---font--body / --font--heading-serif
// mindkettő Geist Variable-re mutat, nincs valódi szerif a márkában).
const geistSans = Geist({ subsets: ["latin", "latin-ext"], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ["latin", "latin-ext"], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: 'Business Native — Analitikai rutin',
  description: 'Minta-nézet arról, hogyan nézne ki a businessnative.hu forgalma egy dashboardon — illusztratív adatokkal.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
