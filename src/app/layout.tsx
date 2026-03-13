import React from "react"
import type { Metadata } from 'next'
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from "@/components/theme-provider"
import './globals.css'

const instrumentSans = Instrument_Sans({ subsets: ["latin", "latin-ext"], variable: '--font-instrument' });
const instrumentSerif = Instrument_Serif({ subsets: ["latin", "latin-ext"], weight: "400", variable: '--font-instrument-serif' });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: 'Expert Flow — Analytics',
  description: 'Landing page teljesitmeny es latogatoi viselkedes valos idoben.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" suppressHydrationWarning>
      <body className={`${instrumentSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
