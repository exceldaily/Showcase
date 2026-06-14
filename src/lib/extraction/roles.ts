import type { FieldRole, TemplateColumn } from '../types'

const ROLE_HINTS: Array<{ role: FieldRole; patterns: RegExp[] }> = [
  {
    role: 'before_vat',
    patterns: [/before\s*vat/i, /sub\s*total/i, /ก่อน\s*vat/i, /ก่อนรวม/i, /ก่อนภาษี/, /มูลค่าก่อน/],
  },
  {
    role: 'vat_rate',
    patterns: [/vat\s*rate/i, /tax\s*rate/i, /อัตรา\s*ภาษี/, /อัตรา/],
  },
  {
    role: 'vat',
    patterns: [/vat/i, /tax\s*amount/i, /ภาษีมูลค่าเพิ่ม/, /ภาษี\s*7/, /^ภาษี$/],
  },
  {
    role: 'total',
    patterns: [/grand\s*total/i, /\btotal\b/i, /รวมทั้งสิ้น/, /ยอดรวม/, /มูลค่ารวม/, /จำนวนเงินรวม/, /amount/i],
  },
  { role: 'date', patterns: [/date/i, /วันที่/] },
  { role: 'invoice_no', patterns: [/invoice/i, /ใบกำกับภาษี/, /เลขที่/] },
  { role: 'receipt_no', patterns: [/receipt/i, /ใบเสร็จ/] },
  {
    role: 'tax_id',
    patterns: [/tax\s*id/i, /vat\s*id/i, /เลขประจำตัวผู้เสียภาษี/, /เลขผู้เสียภาษี/, /เลขภาษี/],
  },
  { role: 'head_office', patterns: [/head\s*office/i, /สำนักงานใหญ่/] },
  { role: 'branch', patterns: [/branch/i, /สาขา/] },
  {
    role: 'vendor',
    patterns: [/vendor/i, /seller/i, /supplier/i, /ชื่อร้าน/, /ร้านค้า/, /ผู้ขาย/, /ผู้ประกอบการ/, /บริษัท/, /ห้างหุ้นส่วน/],
  },
  {
    role: 'description',
    patterns: [/description/i, /รายละเอียด/, /รายการ/, /สินค้า/, /บริการ/, /item/i],
  },
]

export function resolveRole(col: TemplateColumn): FieldRole {
  if (col.role) return col.role
  const haystack = [col.name, ...col.keywords].join(' ')
  for (const { role, patterns } of ROLE_HINTS) {
    if (
      (role === 'before_vat' || role === 'vat' || role === 'total') &&
      col.dataType !== 'money' &&
      col.dataType !== 'number'
    ) {
      continue
    }
    if (patterns.some((pattern) => pattern.test(haystack))) return role
  }
  return 'other'
}

export function columnByRole(columns: TemplateColumn[], role: FieldRole): TemplateColumn | undefined {
  return columns.find((column) => resolveRole(column) === role)
}
