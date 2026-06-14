'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LanguageProvider } from '@/lib/i18n/context'
import { useState, type ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient())
  return (
    <LanguageProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </LanguageProvider>
  )
}
