/**
 * Runtime configuration helpers.
 *
 * The app is designed to run end-to-end with no real keys:
 *  - When Supabase is NOT configured, the app runs in "local mode": no login,
 *    templates persist to localStorage, extraction/export work statelessly.
 *  - When Supabase IS configured, email auth + cloud persistence turn on.
 */

const PLACEHOLDER_MARKERS = ['placeholder', 'your-project', 'your-anon', 'example']

function looksReal(value: string | undefined): boolean {
  if (!value) return false
  const v = value.toLowerCase()
  if (PLACEHOLDER_MARKERS.some((m) => v.includes(m))) return false
  return v.startsWith('http') || v.length > 20
}

/** True when a real Supabase project is wired up (URL + anon key present). */
export function isSupabaseConfigured(): boolean {
  return (
    looksReal(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    looksReal(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  )
}

export type ExtractionProviderName = 'mock' | 'tesseract' | 'claude'

export function activeProvider(): ExtractionProviderName {
  const p = (process.env.EXTRACTION_PROVIDER || 'mock').toLowerCase()
  if (p === 'tesseract' || p === 'claude') return p
  return 'mock'
}
