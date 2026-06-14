/** Core domain types shared across extraction, Excel, UI and API. */

export type DataType = 'text' | 'date' | 'number' | 'money' | 'percentage'
export type CopyMode = 'exact' | 'normalize'

/**
 * Optional semantic role. Presets set this so the reconciliation engine knows
 * which columns are amounts/VAT/total/date. When absent the engine infers the
 * role from the column name, keywords and data type.
 */
export type FieldRole =
  | 'date'
  | 'invoice_no'
  | 'receipt_no'
  | 'vendor'
  | 'tax_id'
  | 'head_office'
  | 'branch'
  | 'description'
  | 'before_vat'
  | 'vat'
  | 'vat_rate'
  | 'total'
  | 'other'

/** A single user-defined column in an extraction template. */
export interface TemplateColumn {
  id: string
  name: string
  /** Thai/English keywords or phrases that locate this field on the document. */
  keywords: string[]
  dataType: DataType
  /** Free-text guidance passed to the extraction engine. */
  instructions: string
  required: boolean
  example: string
  /** exact = copy verbatim (e.g. Thai vendor names); normalize = clean/format. */
  copyMode: CopyMode
  /**
   * Where this column lands in the Excel output. Either a header label to match
   * in the template, or a column letter (e.g. "C"). Empty = match by name.
   */
  excelMapping: string
  /** Optional semantic role for reconciliation/date handling. */
  role?: FieldRole
}

export interface FormattingPrefs {
  /** Output date format token, e.g. "dd/MM/yyyy". Buddhist year kept if true. */
  dateFormat: string
  keepBuddhistYear: boolean
  /** Decimal places for money/number columns. */
  decimalPlaces: number
  thousandsSeparator: boolean
}

export interface ExtractionTemplate {
  id: string
  name: string
  /** Preset family, informational only. */
  type: string
  columns: TemplateColumn[]
  formatting: FormattingPrefs
  createdAt: string
  updatedAt: string
}

export type FieldSource = 'extracted' | 'calculated' | 'needs_review'

/** One extracted field value with provenance. */
export interface FieldValue {
  value: string
  confidence: number // 0..1
  source: FieldSource
  warnings: string[]
}

/** A single extracted row, keyed by column id. */
export interface ExtractedRow {
  id: string
  sourceFile: string
  pageNumber: number
  /** column.id -> FieldValue */
  fields: Record<string, FieldValue>
  overallConfidence: number
  /** Row-level warnings (e.g. VAT reconciliation failure, duplicate). */
  warnings: string[]
  edited: boolean
}

export const DEFAULT_FORMATTING: FormattingPrefs = {
  dateFormat: 'dd/MM/yyyy',
  keepBuddhistYear: false,
  decimalPlaces: 2,
  thousandsSeparator: true,
}
