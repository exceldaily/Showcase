import type { FormattingPrefs } from '../types'
import { thaiDigitsToArabic } from './dates'

/** Parse a money/number string into a float. Handles commas, spaces, ฿, Thai digits. */
export function parseAmount(raw: string): number | null {
  if (raw == null) return null
  let s = thaiDigitsToArabic(String(raw)).trim()
  // Strip currency symbols / words.
  s = s.replace(/฿|บาท|THB|baht/gi, '').trim()
  // Remove thousands separators (commas and spaces between digits).
  s = s.replace(/(?<=\d)[,\s](?=\d)/g, '')
  // Keep a single leading minus and the decimal point.
  s = s.replace(/[^0-9.\-]/g, '')
  if (s === '' || s === '-' || s === '.') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Format a number with the template's separator + decimal preferences. */
export function formatAmount(value: number, prefs: FormattingPrefs): string {
  const fixed = value.toFixed(prefs.decimalPlaces)
  if (!prefs.thousandsSeparator) return fixed
  const [intPart, decPart] = fixed.split('.')
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart != null ? `${withSep}.${decPart}` : withSep
}

/** Parse a percentage like "7%", "7.00", "7 %" -> 7. */
export function parsePercent(raw: string): number | null {
  if (raw == null) return null
  const s = thaiDigitsToArabic(String(raw)).replace(/%/g, '').trim()
  const n = Number(s.replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Collapse internal whitespace without altering characters (keeps Thai intact). */
export function tidyText(raw: string): string {
  return String(raw).replace(/\s+/g, ' ').trim()
}
