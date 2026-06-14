import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { PasswordGate } from '@/components/password-gate'

export const metadata: Metadata = {
  title: 'Invoice Extractor — Thai/English receipts → Excel',
  description:
    'Extract Thai and English invoice/receipt data from PDFs into your Excel template with a review-and-edit workflow.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PasswordGate>
          <Providers>{children}</Providers>
        </PasswordGate>
      </body>
    </html>
  )
}
