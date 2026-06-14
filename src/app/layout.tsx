import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Invoice Extractor — Thai/English receipts → Excel',
  description:
    'Extract Thai and English invoice/receipt data from PDFs into your Excel template with a review-and-edit workflow.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
