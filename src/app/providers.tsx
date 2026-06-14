'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LanguageProvider } from '@/lib/i18n/context'
import { CurrencyProvider } from '@/lib/i18n/currency'
import { useState, type ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient())
  return (
    <LanguageProvider>
      <CurrencyProvider>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </CurrencyProvider>
    </LanguageProvider>
  )
}
