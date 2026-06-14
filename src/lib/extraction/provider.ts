import type { FieldSource, FormattingPrefs, TemplateColumn } from '../types'
import { activeProvider, type ExtractionProviderName } from '../config'

/** A rendered PDF page handed to a vision/OCR provider. */
export interface PageImage {
  sourceFile: string
  pageNumber: number
  /** PNG bytes, base64-encoded (no data: prefix). */
  pngBase64: string
  width: number
  height: number
  /** Rotation already applied during render, in degrees. */
  rotation: number
}

/** A raw field value as returned by a provider, before normalization. */
export interface RawField {
  value: string
  confidence?: number
  source?: FieldSource
}

/** A raw extracted row keyed by column id. */
export interface RawRow {
  sourceFile: string
  pageNumber: number
  fields: Record<string, RawField>
  /** Provider's note that this page is not an invoice/receipt. */
  notInvoice?: boolean
}

export interface ExtractionContext {
  columns: TemplateColumn[]
  formatting: FormattingPrefs
}

export interface ExtractionProvider {
  name: ExtractionProviderName
  extract(pages: PageImage[], ctx: ExtractionContext): Promise<RawRow[]>
}

/** Resolve the configured provider, with safe fallback to mock. */
export async function getProvider(
  override?: ExtractionProviderName
): Promise<ExtractionProvider> {
  const name = override ?? activeProvider()
  switch (name) {
    case 'claude': {
      // Fall back to mock if no key is configured so the app never hard-fails.
      if (!process.env.ANTHROPIC_API_KEY) {
        const { MockProvider } = await import('./providers/mock')
        return new MockProvider()
      }
      const { ClaudeProvider } = await import('./providers/claude')
      return new ClaudeProvider()
    }
    case 'tesseract': {
      const { TesseractProvider } = await import('./providers/tesseract')
      return new TesseractProvider()
    }
    default: {
      const { MockProvider } = await import('./providers/mock')
      return new MockProvider()
    }
  }
}
