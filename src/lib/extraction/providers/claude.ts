import Anthropic from '@anthropic-ai/sdk'
import type {
  ExtractionContext,
  ExtractionProvider,
  PageImage,
  RawRow,
} from '../provider'
import type { FieldSource } from '../../types'
import { resolveRole } from '../roles'

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const MAX_CONCURRENCY = 3

function buildColumnSpec(ctx: ExtractionContext): string {
  return ctx.columns
    .map((c) => {
      const parts = [
        `- id: "${c.id}"`,
        `name: "${c.name}"`,
        `type: ${c.dataType}`,
        `role: ${resolveRole(c)}`,
        c.required ? 'required: yes' : 'required: no',
        `copy: ${c.copyMode}`,
      ]
      if (c.keywords.length) {
        const kw = c.keywords.map((k) => `"${k}"`).join(', ')
        parts.push(`keywords: [${kw}]`)
      }
      if (c.instructions) parts.push(`instructions: "${c.instructions}"`)
      if (c.example) parts.push(`example: "${c.example}"`)
      return parts.join(' | ')
    })
    .join('\n')
}

const SYSTEM = `You are a meticulous Thai/English tax-invoice and receipt data extractor.
Rules:
- Read BOTH Thai and English text. EXTRACT Thai text exactly as printed. Never translate or romanize Thai words.
- For Thai text fields (vendor, description, branch, etc): preserve the exact Thai script. Example: extract "บริษัท ไทยอูด" as "บริษัท ไทยอูด", not as romanized text.
- User column names may be Thai, English, or mixed. Extract the value matching the semantic role.
- Common Thai document labels: วันที่=date, ชื่อร้านค้า/ผู้ขาย/ชื่อผู้ขาย=vendor name, เลขประจำตัวผู้เสียภาษี/เลขผู้เสียภาษี=vendor tax ID, เลขที่ใบกำกับภาษี=tax invoice number, มูลค่าก่อน VAT/ก่อนรวม VAT=amount before VAT, ภาษีมูลค่าเพิ่ม/ภาษี=VAT amount, ยอดรวม/รวมทั้งสิ้น=grand total, สำนักงานใหญ่=head office, สาขา=branch.
- Thai Buddhist-era years (e.g. 2569) are valid; return the digits exactly as printed.
- Extract the SELLER/vendor tax ID, never the buyer/customer one.
- NEVER guess. If a field is unclear, missing, or illegible, set its value to "" and source to "needs_review". Confidence should reflect actual legibility, not presence.
- Provide a confidence in [0,1] per field reflecting how clearly you can read/extract it.
- If the page is not an invoice/receipt/tax document, set not_invoice = true.
- Keep numbers with their original digits; do not invent decimals.
- Output STRICT JSON only, matching the requested schema. No prose, no markdown fences.`

interface ClaudePageResult {
  not_invoice?: boolean
  rows?: Array<{ fields?: Record<string, { value?: string; confidence?: number; source?: string }> }>
}

/** Claude vision extraction provider — highest accuracy for scanned Thai/English docs. */
export class ClaudeProvider implements ExtractionProvider {
  name = 'claude' as const
  private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  private model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL

  async extract(pages: PageImage[], ctx: ExtractionContext): Promise<RawRow[]> {
    const columnSpec = buildColumnSpec(ctx)
    const results: RawRow[] = []

    // Bounded concurrency to stay within rate limits while keeping accuracy.
    for (let i = 0; i < pages.length; i += MAX_CONCURRENCY) {
      const batch = pages.slice(i, i + MAX_CONCURRENCY)
      const settled = await Promise.all(
        batch.map((page) => this.extractPage(page, columnSpec, ctx))
      )
      for (const rows of settled) results.push(...rows)
    }
    return results
  }

  private async extractPage(
    page: PageImage,
    columnSpec: string,
    ctx: ExtractionContext
  ): Promise<RawRow[]> {
    const prompt = `Extract data for these columns from the document image.

COLUMNS (use the exact id as the JSON key):
${columnSpec}

Return JSON of shape:
{"not_invoice": boolean, "rows": [{"fields": {"<column id>": {"value": string, "confidence": number}}}]}
One object in "rows" per distinct invoice/receipt on the page (usually one).`

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: page.mediaType, data: page.imageBase64 },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      })

      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')

      const parsed = safeParse(text)
      if (!parsed || parsed.not_invoice || !parsed.rows?.length) {
        return parsed?.not_invoice ? [{ sourceFile: page.sourceFile, pageNumber: page.pageNumber, fields: {}, notInvoice: true }] : []
      }

      return parsed.rows.map((row) => {
        const fields: RawRow['fields'] = {}
        for (const col of ctx.columns) {
          const f = row.fields?.[col.id]
          const rawValue = f?.value ?? ''
          // Preserve the exact extracted value (no trim on the final value to keep Thai spacing)
          // but check if it's empty for confidence calculation
          const valueForCheck = String(rawValue).trim()
          const value = String(rawValue) // Preserve original spacing
          const rawConfidence =
            typeof f?.confidence === 'number' ? Math.max(0, Math.min(1, f.confidence)) : valueForCheck ? 0.8 : 0
          const confidence = valueForCheck ? rawConfidence : 0
          const source: FieldSource =
            (f?.source === 'extracted' || f?.source === 'calculated' || f?.source === 'needs_review')
              ? f.source
              : (valueForCheck ? 'extracted' : 'needs_review')
          fields[col.id] = {
            value,
            confidence,
            source,
          }
        }
        return { sourceFile: page.sourceFile, pageNumber: page.pageNumber, fields }
      })
    } catch (err) {
      // Surface as a needs_review row rather than failing the whole job.
      const fields: RawRow['fields'] = {}
      for (const col of ctx.columns) {
        fields[col.id] = { value: '', confidence: 0, source: 'needs_review' }
      }
      const msg = err instanceof Error ? err.message : 'extraction error'
      return [
        {
          sourceFile: page.sourceFile,
          pageNumber: page.pageNumber,
          fields,
          notInvoice: false,
          // The pipeline will attach this as a row warning via empty fields.
          ...(msg ? {} : {}),
        },
      ]
    }
  }
}

function safeParse(text: string): ClaudePageResult | null {
  if (!text) return null
  // Strip accidental code fences.
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    // Try to locate the first JSON object.
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}
