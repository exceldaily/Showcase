'use client'

import { useMemo, useState, type ChangeEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react'
import { DEFAULT_FORMATTING, type DataType, type ExtractedRow, type ExtractionTemplate, type FieldRole, type FieldSource, type TemplateColumn } from '@/lib/types'

const MAX_DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024

const startingTitles = [
  'Date',
  'Tax invoice number',
  'Vendor name',
  'Vendor tax ID',
  'Amount before VAT',
  'VAT amount',
  'Grand total',
]

function confidenceLabel(value: number) {
  return `${Math.round(value * 100)}%`
}

function roleForTitle(title: string): FieldRole {
  const lower = title.toLowerCase()
  if (
    lower.includes('before') ||
    lower.includes('subtotal') ||
    title.includes('ก่อน') ||
    title.includes('ก่อนรวม') ||
    title.includes('ก่อน VAT') ||
    title.includes('ก่อนภาษี')
  ) return 'before_vat'
  if (lower.includes('vat rate') || lower.includes('tax rate')) return 'vat_rate'
  if (
    lower.includes('vat') ||
    lower.includes('tax amount') ||
    title.includes('ภาษีมูลค่าเพิ่ม') ||
    title === 'ภาษี' ||
    title.includes('ภาษี 7')
  ) return 'vat'
  if (
    lower.includes('total') ||
    lower.includes('amount') ||
    title.includes('ยอดรวม') ||
    title.includes('รวมทั้งสิ้น') ||
    title.includes('จำนวนเงินรวม') ||
    title.includes('มูลค่ารวม')
  ) return 'total'
  if (lower.includes('date') || title.includes('วันที่')) return 'date'
  if (lower.includes('receipt') || title.includes('ใบเสร็จ')) return 'receipt_no'
  if (lower.includes('invoice') || title.includes('ใบกำกับภาษี') || title.includes('เลขที่')) return 'invoice_no'
  if (
    lower.includes('tax id') ||
    lower.includes('vat id') ||
    title.includes('เลขประจำตัวผู้เสียภาษี') ||
    title.includes('เลขผู้เสียภาษี') ||
    title.includes('เลขภาษี')
  ) return 'tax_id'
  if (lower.includes('branch') || title.includes('สาขา')) return 'branch'
  if (lower.includes('head office') || title.includes('สำนักงานใหญ่')) return 'head_office'
  if (
    lower.includes('vendor') ||
    lower.includes('supplier') ||
    lower.includes('seller') ||
    title.includes('ชื่อร้าน') ||
    title.includes('ร้านค้า') ||
    title.includes('ผู้ขาย') ||
    title.includes('ผู้ประกอบการ') ||
    title.includes('บริษัท') ||
    title.includes('ห้างหุ้นส่วน')
  ) return 'vendor'
  if (
    lower.includes('description') ||
    lower.includes('item') ||
    lower.includes('service') ||
    title.includes('รายการ') ||
    title.includes('รายละเอียด') ||
    title.includes('สินค้า') ||
    title.includes('บริการ')
  ) return 'description'
  return 'other'
}

function keywordsForTitle(title: string, role: FieldRole): string[] {
  const base = [title.trim()].filter(Boolean)
  const extra: Record<FieldRole, string[]> = {
    date: ['วันที่', 'Date', 'Invoice Date'],
    invoice_no: ['เลขที่ใบกำกับภาษี', 'เลขที่', 'Tax Invoice No', 'Invoice No'],
    receipt_no: ['เลขที่ใบเสร็จ', 'ใบเสร็จ', 'Receipt No'],
    vendor: ['ชื่อร้านค้า', 'ร้านค้า', 'ผู้ขาย', 'ผู้ประกอบการ', 'บริษัท', 'Vendor', 'Seller', 'Supplier'],
    tax_id: ['เลขประจำตัวผู้เสียภาษี', 'เลขผู้เสียภาษี', 'Tax ID', 'VAT ID'],
    head_office: ['สำนักงานใหญ่', 'Head Office'],
    branch: ['สาขา', 'Branch'],
    description: ['รายการ', 'รายละเอียด', 'สินค้า', 'บริการ', 'Description'],
    before_vat: ['มูลค่าก่อน VAT', 'ก่อนรวม VAT', 'ก่อนภาษี', 'มูลค่าก่อนภาษี', 'Amount before VAT', 'Subtotal'],
    vat: ['VAT', 'ภาษีมูลค่าเพิ่ม', 'ภาษี 7%', 'VAT amount'],
    vat_rate: ['อัตราภาษี', 'VAT rate', '7%'],
    total: ['ยอดรวม', 'รวมทั้งสิ้น', 'จำนวนเงินรวม', 'Grand total', 'Total'],
    other: [],
  }
  return Array.from(new Set([...base, ...(extra[role] ?? [])]))
}

function typeForTitle(title: string): DataType {
  const role = roleForTitle(title)
  if (role === 'date') return 'date'
  if (role === 'before_vat' || role === 'vat' || role === 'total') return 'money'
  if (role === 'vat_rate') return 'percentage'
  return 'text'
}

function columnFromTitle(title: string, index: number): TemplateColumn {
  const cleanTitle = title.trim() || `Column ${index + 1}`
  const role = roleForTitle(cleanTitle)
  const safeSlug =
    cleanTitle
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '') || `column-${index + 1}`
  return {
    id: `col-${index}-${safeSlug}`,
    name: cleanTitle,
    keywords: keywordsForTitle(cleanTitle, role),
    dataType: typeForTitle(cleanTitle),
    instructions: `Extract the document value for "${cleanTitle}". Thai labels are valid. Use the semantic role "${role}" and the keywords for this column. If unclear, leave blank for review.`,
    required: true,
    example: '',
    copyMode: role === 'vendor' || role === 'description' || role === 'tax_id' ? 'exact' : 'normalize',
    excelMapping: cleanTitle,
    role,
  }
}

function buildTemplate(titles: string[]): ExtractionTemplate {
  const now = new Date().toISOString()
  const columns = titles.map(columnFromTitle)
  return {
    id: 'simple-template',
    name: 'Custom Extract',
    type: 'custom',
    columns,
    formatting: { ...DEFAULT_FORMATTING },
    createdAt: now,
    updatedAt: now,
  }
}

async function responseError(response: Response, fallback: string) {
  const text = await response.text()
  if (!text) return fallback
  try {
    const json = JSON.parse(text) as { error?: string }
    return json.error ?? fallback
  } catch {
    if (text.startsWith('Request En')) {
      return 'That PDF is too large for direct Vercel upload. Try a smaller/compressed PDF for now.'
    }
    return text.slice(0, 220)
  }
}

export function InvoiceWorkspace() {
  const [pdfs, setPdfs] = useState<File[]>([])
  const [pdfInputKey, setPdfInputKey] = useState(0)
  const [workbook, setWorkbook] = useState<File | null>(null)
  const [columnCount, setColumnCount] = useState(startingTitles.length)
  const [titles, setTitles] = useState(startingTitles)
  const [rows, setRows] = useState<ExtractedRow[]>([])
  const [busy, setBusy] = useState<'extract' | 'export' | null>(null)
  const [error, setError] = useState('')

  const template = useMemo(() => buildTemplate(titles.slice(0, columnCount)), [columnCount, titles])
  const totalUploadSize = pdfs.reduce((sum, file) => sum + file.size, 0)
  const uploadTooLarge = totalUploadSize > MAX_DIRECT_UPLOAD_BYTES

  function setCount(value: number) {
    const safeValue = Math.min(30, Math.max(1, value || 1))
    setColumnCount(safeValue)
    setTitles((current) => {
      const next = [...current]
      while (next.length < safeValue) next.push(`Column ${next.length + 1}`)
      return next
    })
  }

  function updateTitle(index: number, value: string) {
    setTitles((current) => current.map((title, currentIndex) => (currentIndex === index ? value : title)))
    setRows([])
  }

  function onPdfChange(event: ChangeEvent<HTMLInputElement>) {
    setError('')
    const selected = Array.from(event.target.files ?? [])
    setPdfs((current) => {
      const existing = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`))
      const additions = selected.filter(
        (file) => !existing.has(`${file.name}-${file.size}-${file.lastModified}`)
      )
      return [...current, ...additions]
    })
    setPdfInputKey((current) => current + 1)
  }

  function removePdf(index: number) {
    setPdfs((current) => current.filter((_, currentIndex) => currentIndex !== index))
    setPdfInputKey((current) => current + 1)
  }

  function onWorkbookChange(event: ChangeEvent<HTMLInputElement>) {
    setWorkbook(event.target.files?.[0] ?? null)
  }

  async function runExtraction() {
    if (!pdfs.length) {
      setError('Upload at least one PDF first.')
      return
    }
    if (uploadTooLarge) {
      setError('That PDF is too large for direct Vercel upload. Try a smaller/compressed PDF for now.')
      return
    }

    setBusy('extract')
    setError('')
    try {
      const form = new FormData()
      form.append('template', JSON.stringify(template))
      form.append('provider', 'claude')
      pdfs.forEach((file) => form.append('pdfs', file))
      const response = await fetch('/api/extract', { method: 'POST', body: form })
      if (!response.ok) throw new Error(await responseError(response, 'Extraction failed'))
      const body = (await response.json()) as { rows: ExtractedRow[] }
      const batchId = crypto.randomUUID()
      const nextRows = body.rows.map((row, index) => ({
        ...row,
        id: `${batchId}-${index}-${row.id}`,
      }))
      setRows((current) => [...current, ...nextRows])
      setPdfs([])
      setPdfInputKey((current) => current + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setBusy(null)
    }
  }

  function deleteRow(rowId: string) {
    setRows((current) => current.filter((row) => row.id !== rowId))
  }

  async function exportRows() {
    setBusy('export')
    setError('')
    try {
      const form = new FormData()
      form.append('template', JSON.stringify(template))
      form.append('rows', JSON.stringify(rows))
      if (workbook) form.append('workbook', workbook)
      const response = await fetch('/api/export', { method: 'POST', body: form })
      if (!response.ok) throw new Error(await responseError(response, 'Export failed'))
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `invoice-export-${new Date().toISOString().slice(0, 10)}.xlsx`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(null)
    }
  }

  function updateCell(rowId: string, columnId: string, value: string) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row
        const field = row.fields[columnId] ?? {
          value: '',
          confidence: 0,
          source: 'needs_review' as FieldSource,
          warnings: [],
        }
        return {
          ...row,
          edited: true,
          fields: {
            ...row.fields,
            [columnId]: { ...field, value, confidence: 1, source: 'extracted', warnings: [] },
          },
        }
      })
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileSpreadsheet size={21} />
            </span>
            <div>
              <div className="text-lg font-bold">Invoice Extractor</div>
              <div className="text-xs text-muted">Upload PDF, name columns, export Excel</div>
            </div>
          </div>
          <button
            type="button"
            onClick={exportRows}
            disabled={!rows.length || busy !== null}
            className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45 sm:px-4"
          >
            {busy === 'export' ? <Loader2 className="animate-spin" size={17} /> : <Download size={17} />}
            Export
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <section className="rounded-xl border bg-card p-5">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Make a spreadsheet from PDFs.</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Upload invoices or receipts, choose the columns you want, then review the extracted rows before downloading Excel.
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <StepCard number="1" title="Upload">
            <FilePicker
              inputKey={pdfInputKey}
              label="Upload PDF"
              detail={pdfs.length ? `${pdfs.length} PDF selected` : 'Choose one or more PDF files'}
              accept="application/pdf"
              multiple
              onChange={onPdfChange}
            />
            <FilePicker
              label="Excel template"
              detail={workbook?.name ?? 'Optional'}
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={onWorkbookChange}
            />
            {pdfs.length ? (
              <div className="space-y-2">
                <p className={`text-xs ${uploadTooLarge ? 'text-danger' : 'text-muted'}`}>
                  Queued size: {(totalUploadSize / 1024 / 1024).toFixed(1)} MB
                </p>
                <div className="space-y-1">
                  {pdfs.map((file, index) => (
                    <div
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      className="flex items-center justify-between gap-2 rounded-md border bg-card px-2 py-1.5 text-xs"
                    >
                      <span className="min-w-0 truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removePdf(index)}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-background hover:text-danger"
                        aria-label={`Remove ${file.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </StepCard>

          <StepCard number="2" title="Choose columns">
            <label className="block">
              <span className="text-sm font-semibold">How many columns?</span>
              <input
                type="number"
                min={1}
                max={30}
                className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-lg font-semibold"
                value={columnCount}
                onChange={(event) => setCount(Number(event.target.value))}
              />
            </label>
            <div className="max-h-72 space-y-2 overflow-auto pr-1">
              {titles.slice(0, columnCount).map((title, index) => (
                <input
                  key={index}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                  value={title}
                  onChange={(event) => updateTitle(index, event.target.value)}
                  placeholder={`Column ${index + 1} title`}
                />
              ))}
            </div>
          </StepCard>

          <StepCard number="3" title="Extract rows">
            <div className="rounded-lg border bg-background p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Ready columns</div>
              <div className="mt-1 text-3xl font-bold">{template.columns.length}</div>
              <div className="mt-3 text-xs text-muted">
                The extractor will only return values for the column titles you entered.
              </div>
            </div>
            <button
              type="button"
              onClick={runExtraction}
              disabled={!pdfs.length || uploadTooLarge || busy !== null}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy === 'extract' ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
              Extract rows
            </button>
          </StepCard>
        </section>

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            <AlertTriangle className="mt-0.5 shrink-0" size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        <ReviewTable template={template} rows={rows} onCellChange={updateCell} onDeleteRow={deleteRow} />
      </div>
    </main>
  )
}

function StepCard({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {number}
        </span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function FilePicker({
  inputKey,
  label,
  detail,
  accept,
  multiple,
  onChange,
}: {
  inputKey?: number
  label: string
  detail: string
  accept: string
  multiple?: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <label className="block cursor-pointer rounded-lg border border-dashed bg-background p-4 transition hover:border-primary">
      <span className="flex items-center gap-2 text-sm font-semibold">
        <Upload size={16} className="text-primary" />
        {label}
      </span>
      <input key={inputKey} className="sr-only" type="file" accept={accept} multiple={multiple} onChange={onChange} />
      <span className="mt-2 block truncate text-sm text-muted">{detail}</span>
    </label>
  )
}

function ReviewTable({
  template,
  rows,
  onCellChange,
  onDeleteRow,
}: {
  template: ExtractionTemplate
  rows: ExtractedRow[]
  onCellChange: (rowId: string, columnId: string, value: string) => void
  onDeleteRow: (rowId: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Review rows</h2>
          <p className="text-sm text-muted">Edit any value before exporting.</p>
        </div>
        <div className="text-sm text-muted">{rows.length} row(s)</div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-background text-xs uppercase text-muted">
            <tr>
              <th className="sticky left-0 z-10 min-w-48 border-b bg-background px-3 py-3">Source</th>
              <th className="min-w-16 border-b px-3 py-3">Page</th>
              {template.columns.map((column) => (
                <th key={column.id} className="min-w-56 border-b px-3 py-3">
                  {column.name}
                </th>
              ))}
              <th className="min-w-64 border-b px-3 py-3">Status</th>
              <th className="w-16 border-b px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="sticky left-0 z-10 border-b bg-card px-3 py-3 text-xs text-muted">
                    {row.sourceFile}
                  </td>
                  <td className="border-b px-3 py-3 tabular">{row.pageNumber}</td>
                  {template.columns.map((column) => {
                    const field = row.fields[column.id]
                    return (
                      <td key={column.id} className="border-b px-3 py-2">
                        <input
                          className="w-full rounded-lg border bg-background px-3 py-2"
                          value={field?.value ?? ''}
                          onChange={(event) => onCellChange(row.id, column.id, event.target.value)}
                        />
                        <div className="mt-1 text-[11px] text-muted">
                          {confidenceLabel(field?.confidence ?? 0)} · {field?.source ?? 'needs_review'}
                        </div>
                      </td>
                    )
                  })}
                  <td className="border-b px-3 py-3">
                    {row.warnings.length ? (
                      <div className="space-y-1">
                        {row.warnings.map((warning) => (
                          <div key={warning} className="flex items-center gap-1 text-xs text-warning">
                            <AlertTriangle size={13} />
                            {warning}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-success">
                        <CheckCircle2 size={13} />
                        Ready
                      </div>
                    )}
                  </td>
                  <td className="border-b px-3 py-3">
                    <button
                      type="button"
                      onClick={() => onDeleteRow(row.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-background text-muted hover:text-danger"
                      aria-label={`Delete row from ${row.sourceFile}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={template.columns.length + 4} className="px-5 py-12 text-center text-muted">
                  Extracted rows will appear here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
