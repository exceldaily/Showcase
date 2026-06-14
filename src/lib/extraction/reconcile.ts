import type { FieldValue, FormattingPrefs, TemplateColumn } from '../types'
import { columnByRole } from './roles'
import { formatAmount, parseAmount, parsePercent } from './normalize'

const DEFAULT_VAT_RATE = 7

/** Tolerance for reconciliation: absolute floor, scaled for larger totals. */
function tolerance(total: number): number {
  return Math.max(0.05, Math.abs(total) * 0.005)
}

export interface ReconcileResult {
  warnings: string[]
}

/**
 * Verify and, where possible, complete the VAT math for a row.
 *
 * Rules (per spec):
 *  - If before_vat + vat are present, they must equal grand_total (±tolerance).
 *  - If only grand_total is present and the rate is 7%, compute
 *    before_vat = total / 1.07 and vat = total - before_vat; mark `calculated`.
 *  - If before + total present but vat missing, vat = total - before (calculated).
 *  - If before + vat present but total missing, total = before + vat (calculated).
 *  - Rows that do not reconcile are flagged with a warning.
 *
 * Mutates `fields` in place and returns row-level warnings.
 */
export function reconcileVat(
  fields: Record<string, FieldValue>,
  columns: TemplateColumn[],
  prefs: FormattingPrefs
): ReconcileResult {
  const warnings: string[] = []

  const beforeCol = columnByRole(columns, 'before_vat')
  const vatCol = columnByRole(columns, 'vat')
  const totalCol = columnByRole(columns, 'total')
  const rateCol = columnByRole(columns, 'vat_rate')

  // Nothing to reconcile if the template has no money roles.
  if (!beforeCol && !vatCol && !totalCol) return { warnings }

  const num = (col?: TemplateColumn): number | null =>
    col && fields[col.id] ? parseAmount(fields[col.id].value) : null

  let before = num(beforeCol)
  let vat = num(vatCol)
  let total = num(totalCol)
  const rate = rateCol && fields[rateCol.id] ? parsePercent(fields[rateCol.id].value) : null
  const effectiveRate = rate ?? DEFAULT_VAT_RATE

  const setCalc = (col: TemplateColumn | undefined, value: number) => {
    if (!col) return
    fields[col.id] = {
      value: formatAmount(value, prefs),
      confidence: 0.6,
      source: 'calculated',
      warnings: ['Calculated from other amounts'],
    }
  }

  // Complete missing values where exactly enough information exists.
  if (total != null && before == null && vat == null) {
    // Only grand total visible -> derive both using the VAT rate.
    const computedBefore = total / (1 + effectiveRate / 100)
    const computedVat = total - computedBefore
    setCalc(beforeCol, computedBefore)
    setCalc(vatCol, computedVat)
    before = computedBefore
    vat = computedVat
  } else if (before != null && total != null && vat == null) {
    vat = total - before
    setCalc(vatCol, vat)
  } else if (before != null && vat != null && total == null) {
    total = before + vat
    setCalc(totalCol, total)
  } else if (total != null && vat != null && before == null) {
    before = total - vat
    setCalc(beforeCol, before)
  }

  // Verify the identity if we now have all three.
  if (before != null && vat != null && total != null) {
    const tol = tolerance(total)
    if (Math.abs(before + vat - total) > tol) {
      warnings.push(
        `VAT does not reconcile: before (${before.toFixed(2)}) + VAT (${vat.toFixed(
          2
        )}) ≠ total (${total.toFixed(2)})`
      )
    }
    // Sanity-check the VAT rate when both rate and amounts are known.
    if (rate != null && before > 0) {
      const impliedRate = (vat / before) * 100
      if (Math.abs(impliedRate - rate) > 0.6) {
        warnings.push(
          `VAT rate mismatch: stated ${rate}% but amounts imply ${impliedRate.toFixed(2)}%`
        )
      }
    }
  } else {
    // Missing money fields that the template marked required is handled by validation,
    // but note partial VAT data here too.
    if ((beforeCol || vatCol || totalCol) && total == null && before == null) {
      warnings.push('No monetary total could be determined')
    }
  }

  return { warnings }
}
