/**
 * Thai Buddhist-year aware date handling.
 *
 * Thai documents commonly use the Buddhist Era (BE), which is CE + 543.
 * e.g. 06/05/2569 (BE) == 06/05/2026 (CE).
 *
 * We never *silently* rewrite the value the user sees on the document. Instead
 * we parse it, optionally convert the year, and re-emit using the requested
 * output format. The original text is always available as a fallback.
 */

const MONTHS_TH: Record<string, number> = {
  'ม.ค.': 1, มกราคม: 1,
  'ก.พ.': 2, กุมภาพันธ์: 2,
  'มี.ค.': 3, มีนาคม: 3,
  'เม.ย.': 4, เมษายน: 4,
  'พ.ค.': 5, พฤษภาคม: 5,
  'มิ.ย.': 6, มิถุนายน: 6,
  'ก.ค.': 7, กรกฎาคม: 7,
  'ส.ค.': 8, สิงหาคม: 8,
  'ก.ย.': 9, กันยายน: 9,
  'ต.ค.': 10, ตุลาคม: 10,
  'พ.ย.': 11, พฤศจิกายน: 11,
  'ธ.ค.': 12, ธันวาคม: 12,
}

const MONTHS_EN: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
}

export interface ParsedDate {
  day: number
  month: number
  /** Year as printed (may be Buddhist). */
  yearRaw: number
  /** Year in CE. */
  yearCE: number
  wasBuddhist: boolean
}

/** Convert a (possibly Buddhist) year to CE. Years > 2200 are treated as BE. */
function toCE(year: number): { yearCE: number; wasBuddhist: boolean } {
  if (year >= 2200) return { yearCE: year - 543, wasBuddhist: true }
  // Two-digit years: assume 20xx.
  if (year < 100) return { yearCE: 2000 + year, wasBuddhist: false }
  return { yearCE: year, wasBuddhist: false }
}

const SEP = /[\/\-.\s]+/

/** Parse a date string in common Thai/English forms. Returns null if unparseable. */
export function parseFlexibleDate(input: string): ParsedDate | null {
  if (!input) return null
  const normalized = thaiDigitsToArabic(input.trim())

  // Numeric: d/m/y or y/m/d
  const numParts = normalized.split(SEP).filter(Boolean)
  if (numParts.length === 3 && numParts.every((p) => /^\d+$/.test(p))) {
    let [a, b, c] = numParts.map(Number)
    // Detect ISO yyyy-mm-dd
    if (a > 31) {
      const { yearCE, wasBuddhist } = toCE(a)
      return { day: c, month: b, yearRaw: a, yearCE, wasBuddhist }
    }
    const { yearCE, wasBuddhist } = toCE(c)
    return { day: a, month: b, yearRaw: c, yearCE, wasBuddhist }
  }

  // Textual month (Thai or English)
  const tokens = normalized.split(SEP).filter(Boolean)
  if (tokens.length >= 3) {
    const day = parseInt(tokens[0], 10) || parseInt(tokens[1], 10)
    let month = 0
    for (const t of tokens) {
      const tl = t.toLowerCase()
      if (MONTHS_TH[t] !== undefined) month = MONTHS_TH[t]
      else if (MONTHS_EN[tl] !== undefined) month = MONTHS_EN[tl]
    }
    const yearTok = tokens.find((t) => /^\d{2,4}$/.test(t) && parseInt(t, 10) > 31)
    if (day && month && yearTok) {
      const { yearCE, wasBuddhist } = toCE(parseInt(yearTok, 10))
      return { day, month, yearRaw: parseInt(yearTok, 10), yearCE, wasBuddhist }
    }
  }
  return null
}

export function thaiDigitsToArabic(s: string): string {
  const map: Record<string, string> = {
    '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4',
    '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9',
  }
  return s.replace(/[๐-๙]/g, (d) => map[d] ?? d)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Format a parsed date using a simple token format (dd, MM, yyyy, yy).
 * If keepBuddhistYear is true, the printed year stays in BE.
 */
export function formatDate(parsed: ParsedDate, format: string, keepBuddhistYear: boolean): string {
  const year = keepBuddhistYear ? parsed.yearCE + 543 : parsed.yearCE
  return format
    .replace(/yyyy/g, String(year))
    .replace(/yy/g, pad(year % 100))
    .replace(/dd/g, pad(parsed.day))
    .replace(/MM/g, pad(parsed.month))
}

/**
 * Normalize a raw date string to the requested format. Returns the original
 * string and a flag when parsing fails (so the caller can mark needs_review).
 */
export function normalizeDate(
  raw: string,
  format: string,
  keepBuddhistYear: boolean
): { value: string; ok: boolean } {
  const parsed = parseFlexibleDate(raw)
  if (!parsed) return { value: raw, ok: false }
  return { value: formatDate(parsed, format, keepBuddhistYear), ok: true }
}
