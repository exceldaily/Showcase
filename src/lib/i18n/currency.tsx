'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Currency = 'usd' | 'thb'

interface CurrencyContextType {
  currency: Currency
  setCurrency: (curr: Currency) => void
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>('usd')

  useEffect(() => {
    const saved = localStorage.getItem('currency') as Currency | null
    if (saved === 'thb' || saved === 'usd') {
      setCurrencyState(saved)
    }
  }, [])

  const setCurrency = (curr: Currency) => {
    setCurrencyState(curr)
    localStorage.setItem('currency', curr)
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider')
  }
  return context
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  usd: '$',
  thb: '฿',
}

export const CURRENCY_NAMES: Record<Currency, Record<string, string>> = {
  usd: { en: 'USD', th: 'USD' },
  thb: { en: 'Thai Baht', th: 'บาท' },
}
