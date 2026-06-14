import { createWorker, type Worker } from 'tesseract.js'
import type {
  ExtractionContext,
  ExtractionProvider,
  PageImage,
  RawRow,
} from '../provider'
import { resolveRole } from '../roles'
import type { FieldRole, TemplateColumn } from '../../types'

const AMOUNT_RE = /\d[\d,]*\.?\d{0,2}/g
const TAXID_RE = /\b\d[\d\s-]{11,16}\d\b/
const DATE_RE = /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/

/**
 * Free OCR provider (Thai + English). Lower accuracy than the vision model —
 * many fields will fall back to needs_review, which is intentional and honest.
 */
export class TesseractProvider implements ExtractionProvider {
  name = 'tesseract' as const

  async extract(pages: PageImage[], ctx: ExtractionContext): Promise<RawRow[]> {
    const worker: Worker = await createWorker(['tha', 'eng'])
    try {
      const rows: RawRow[] = []
      for (const page of pages) {
        const buffer = Buffer.from(page.imageBase64, 'base64')
        const { data } = await worker.recognize(buffer)
        const text = data.text || ''
        const baseConf = Math.max(0, Math.min(1, (data.confidence ?? 50) / 100)) * 0.8
        rows.push({
          sourceFile: page.sourceFile,
          pageNumber: page.pageNumber,
          fields: mapTextToColumns(text, ctx.columns, baseConf),
        })
      }
      return rows
    } finally {
      await worker.terminate()
    }
  }
}

function mapTextToColumns(
  text: string,
  columns: TemplateColumn[],
  baseConf: number
): RawRow['fields'] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const fields: RawRow['fields'] = {}

  for (const col of columns) {
    const role = resolveRole(col)
    const value = extractByRole(role, col, lines, text)
    fields[col.id] = value
      ? { value, confidence: baseConf, source: 'extracted' }
      : { value: '', confidence: 0, source: 'needs_review' }
  }
  return fields
}

/** Find the line that best matches one of the column's keywords. */
function lineForKeywords(keywords: string[], lines: string[]): string | null {
  for (const kw of keywords) {
    const hit = lines.find((l) => l.toLowerCase().includes(kw.toLowerCase()))
    if (hit) return hit
  }
  return null
}

function extractByRole(
  role: FieldRole,
  col: TemplateColumn,
  lines: string[],
  text: string
): string {
  switch (role) {
    case 'date': {
      const m = text.match(DATE_RE)
      return m ? m[0] : ''
    }
    case 'tax_id': {
      const m = text.match(TAXID_RE)
      return m ? m[0].replace(/[\s-]/g, '') : ''
    }
    case 'before_vat':
    case 'vat':
    case 'total': {
      const line = lineForKeywords(col.keywords, lines)
      if (line) {
        const nums = line.match(AMOUNT_RE)
        if (nums?.length) return nums[nums.length - 1]
      }
      return ''
    }
    case 'vat_rate': {
      const m = text.match(/(\d{1,2})\s*%/)
      return m ? `${m[1]}%` : ''
    }
    case 'vendor':
    case 'description':
    case 'head_office':
    case 'branch':
    case 'invoice_no':
    case 'receipt_no':
    default: {
      const line = lineForKeywords(col.keywords, lines)
      if (!line) return ''
      // Return the text after the matched keyword, else the whole line.
      for (const kw of col.keywords) {
        const idx = line.toLowerCase().indexOf(kw.toLowerCase())
        if (idx >= 0) {
          const after = line.slice(idx + kw.length).replace(/^[:\s.\-]+/, '').trim()
          if (after) return after
        }
      }
      return line
    }
  }
}
