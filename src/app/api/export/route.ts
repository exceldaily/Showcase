import ExcelJS from 'exceljs'
import { NextResponse } from 'next/server'
import type { ExtractedRow, ExtractionTemplate } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

function columnLetterToNumber(value: string): number | null {
  const cleaned = value.trim().toUpperCase()
  if (!/^[A-Z]{1,3}$/.test(cleaned)) return null
  const columnNumber = cleaned
    .split('')
    .reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0)
  return columnNumber >= 1 && columnNumber <= 16384 ? columnNumber : null
}

function normalizeHeader(value: unknown): string {
  if (value && typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part: { text?: string }) => part.text ?? '')
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
        .toLocaleLowerCase()
    }
    if ('text' in value) return normalizeHeader(value.text)
    if ('result' in value) return normalizeHeader(value.result)
  }
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

function findHeaderRow(sheet: ExcelJS.Worksheet, labels: string[]): number {
  const normalized = labels.map(normalizeHeader).filter(Boolean)
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount || 1, 30); rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const values = Array.isArray(row.values) ? row.values.slice(1) : []
    const hits = values.filter((cell) => normalized.includes(normalizeHeader(cell))).length
    if (hits >= Math.min(2, normalized.length)) return rowNumber
  }
  return sheet.rowCount > 0 ? 1 : 0
}

function findColumn(sheet: ExcelJS.Worksheet, headerRow: number, labels: string[]): number | null {
  const normalized = labels.map(normalizeHeader).filter(Boolean)
  const row = sheet.getRow(headerRow)
  for (let index = 1; index <= Math.max(row.cellCount, 1); index += 1) {
    if (normalized.includes(normalizeHeader(row.getCell(index).value))) return index
  }
  return null
}

async function workbookFromTemplate(file: File | null, template: ExtractionTemplate) {
  const workbook = new ExcelJS.Workbook()
  if (file) {
    await workbook.xlsx.load(await file.arrayBuffer())
  } else {
    const sheet = workbook.addWorksheet(template.name)
    sheet.addRow(['Source file', 'Page number', ...template.columns.map((column) => column.name), 'Warnings'])
    sheet.getRow(1).font = { bold: true }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
  }
  return workbook
}

function prepareGeneratedSheet(sheet: ExcelJS.Worksheet, template: ExtractionTemplate) {
  sheet.getRow(1).getCell(1).value = 'Source file'
  sheet.getRow(1).getCell(2).value = 'Page number'
  template.columns.forEach((column, index) => {
    sheet.getRow(1).getCell(index + 3).value = column.name
  })
  sheet.getRow(1).getCell(template.columns.length + 3).value = 'Warnings'
  sheet.getRow(1).font = { bold: true }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const templateRaw = form.get('template')
    const rowsRaw = form.get('rows')

    if (typeof templateRaw !== 'string' || typeof rowsRaw !== 'string') {
      return NextResponse.json({ error: 'Missing template or reviewed rows' }, { status: 400 })
    }

    const template = JSON.parse(templateRaw) as ExtractionTemplate
    const rows = JSON.parse(rowsRaw) as ExtractedRow[]
    const templateFile = form.get('workbook')
    const workbook = await workbookFromTemplate(
      templateFile instanceof File && templateFile.size > 0 ? templateFile : null,
      template
    )
    const sheet = workbook.worksheets[0] ?? workbook.addWorksheet(template.name)

    if (sheet.rowCount === 0) {
      prepareGeneratedSheet(sheet, template)
    }

    const headerLabels = template.columns.flatMap((column) => [
      column.name,
      column.excelMapping,
    ])
    const hasUploadedTemplate = templateFile instanceof File && templateFile.size > 0
    const headerRow = hasUploadedTemplate ? findHeaderRow(sheet, headerLabels) : 1
    const columnMap = new Map<string, number>()
    const usedColumns = new Set<number>()

    for (const column of template.columns) {
      const explicitMapping = column.excelMapping
        ? columnLetterToNumber(column.excelMapping)
        : null
      const found =
        explicitMapping ??
        (hasUploadedTemplate
          ? findColumn(sheet, headerRow || 1, [
              column.excelMapping,
              column.name,
              ...column.keywords,
            ])
          : null)
      const fallback = usedColumns.size + 3
      const target = found ?? fallback
      columnMap.set(column.id, target)
      usedColumns.add(target)
      if (!found && headerRow > 0) sheet.getRow(headerRow).getCell(target).value = column.name
    }

    const sourceColumn =
      (hasUploadedTemplate ? findColumn(sheet, headerRow || 1, ['Source file']) : null) ?? 1
    const pageColumn =
      (hasUploadedTemplate ? findColumn(sheet, headerRow || 1, ['Page number', 'Page']) : null) ?? 2
    const warningColumn =
      (hasUploadedTemplate ? findColumn(sheet, headerRow || 1, ['Warnings', 'Warning flags']) : null) ??
      Math.max(...Array.from(columnMap.values()), 2) + 1
    const firstDataRow = Math.max((headerRow || 1) + 1, sheet.rowCount + 1)

    rows.forEach((row, index) => {
      const excelRow = sheet.getRow(firstDataRow + index)
      excelRow.getCell(sourceColumn).value = row.sourceFile
      excelRow.getCell(pageColumn).value = row.pageNumber
      for (const column of template.columns) {
        excelRow.getCell(columnMap.get(column.id) ?? 1).value = row.fields[column.id]?.value ?? ''
      }
      excelRow.getCell(warningColumn).value = row.warnings.join('; ')
      excelRow.commit()
    })

    sheet.columns?.forEach((column) => {
      if (!column.width || column.width < 12) column.width = 14
    })

    const buffer = await workbook.xlsx.writeBuffer()
    return new Response(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="invoice-export-${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
