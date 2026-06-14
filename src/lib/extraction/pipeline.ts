import type { ExtractedRow, ExtractionTemplate, FieldValue } from '../types'
import type { RawRow } from './provider'
import { normalizeDate } from './dates'
import { formatAmount, parseAmount, tidyText } from './normalize'
import { reconcileVat } from './reconcile'

function blankField(required: boolean): FieldValue {
  return {
    value: '',
    confidence: 0,
    source: 'needs_review',
    warnings: required ? ['Required field needs review'] : ['Needs review'],
  }
}

function normalizeField(
  value: FieldValue,
  column: ExtractionTemplate['columns'][number],
  template: ExtractionTemplate
): FieldValue {
  const warnings = [...value.warnings]
  let normalized = value.value
  let source = value.source

  if (!normalized.trim()) {
    return {
      ...value,
      confidence: 0,
      source: column.required ? 'needs_review' : value.source,
      warnings: column.required
        ? Array.from(new Set([...warnings, 'Required field needs review']))
        : warnings,
    }
  }

  if (column.copyMode === 'normalize') {
    if (column.dataType === 'date') {
      const result = normalizeDate(
        normalized,
        template.formatting.dateFormat,
        template.formatting.keepBuddhistYear
      )
      normalized = result.value
      if (!result.ok) {
        source = 'needs_review'
        warnings.push('Date could not be normalized')
      }
    } else if (column.dataType === 'money' || column.dataType === 'number') {
      const amount = parseAmount(normalized)
      if (amount == null) {
        source = 'needs_review'
        warnings.push('Number could not be normalized')
      } else {
        normalized =
          column.dataType === 'money'
            ? formatAmount(amount, template.formatting)
            : String(amount)
      }
    } else {
      normalized = tidyText(normalized)
    }
  }

  if (value.confidence < 0.72) {
    warnings.push('Low confidence')
  }

  return {
    value: normalized,
    confidence: value.confidence,
    source,
    warnings: Array.from(new Set(warnings)),
  }
}

export function rowsFromRaw(rawRows: RawRow[], template: ExtractionTemplate): ExtractedRow[] {
  return rawRows
    .filter((row) => !row.notInvoice)
    .map((raw, index) => {
      const fields: Record<string, FieldValue> = {}

      for (const column of template.columns) {
        const rawField = raw.fields[column.id]
        const field: FieldValue = rawField
          ? {
              value: rawField.value ?? '',
              confidence: rawField.confidence ?? 0,
              source: rawField.source ?? (rawField.value ? 'extracted' : 'needs_review'),
              warnings: [],
            }
          : blankField(column.required)

        fields[column.id] = normalizeField(field, column, template)
      }

      const vatResult = reconcileVat(fields, template.columns, template.formatting)
      const fieldValues = Object.values(fields)
      const confidence =
        fieldValues.length === 0
          ? 0
          : fieldValues.reduce((sum, field) => sum + field.confidence, 0) / fieldValues.length
      const fieldWarnings = fieldValues.flatMap((field) => field.warnings)

      return {
        id: `${raw.sourceFile}-${raw.pageNumber}-${index}`,
        sourceFile: raw.sourceFile,
        pageNumber: raw.pageNumber,
        fields,
        overallConfidence: confidence,
        warnings: Array.from(new Set([...vatResult.warnings, ...fieldWarnings])),
        edited: false,
      }
    })
}
