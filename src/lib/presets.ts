import type {
  CopyMode,
  DataType,
  ExtractionTemplate,
  FieldRole,
  TemplateColumn,
} from './types'
import { DEFAULT_FORMATTING } from './types'

let counter = 0
function colId(seed: string): string {
  counter += 1
  return `${seed}-${counter}`
}

interface ColSpec {
  name: string
  keywords: string[]
  dataType: DataType
  instructions: string
  required?: boolean
  example?: string
  copyMode?: CopyMode
  role?: FieldRole
  excelMapping?: string
}

export function makeColumn(spec: ColSpec): TemplateColumn {
  return {
    id: colId(spec.role ?? 'col'),
    name: spec.name,
    keywords: spec.keywords,
    dataType: spec.dataType,
    instructions: spec.instructions,
    required: spec.required ?? false,
    example: spec.example ?? '',
    copyMode: spec.copyMode ?? 'normalize',
    role: spec.role,
    excelMapping: spec.excelMapping ?? '',
  }
}

/** The canonical Thai tax-invoice field set required by the spec. */
function thaiTaxColumns(): TemplateColumn[] {
  return [
    makeColumn({
      name: 'วันที่ / Date',
      keywords: ['วันที่', 'Date', 'ลงวันที่'],
      dataType: 'date',
      instructions:
        'Document/invoice date. Thai Buddhist years (e.g. 2569) are valid — keep the document’s digits; conversion to CE is handled by formatting.',
      required: true,
      example: '06/05/2569',
      role: 'date',
    }),
    makeColumn({
      name: 'เลขที่ใบกำกับภาษี / Tax invoice number',
      keywords: ['เลขที่ใบกำกับภาษี', 'Tax invoice no', 'Invoice No', 'เลขที่'],
      dataType: 'text',
      instructions: 'The tax invoice number. Copy exactly including any prefix.',
      required: true,
      example: 'INV-2569-00123',
      copyMode: 'exact',
      role: 'invoice_no',
    }),
    makeColumn({
      name: 'เลขที่ใบเสร็จ / Receipt number',
      keywords: ['เลขที่ใบเสร็จ', 'Receipt No', 'ใบเสร็จรับเงิน'],
      dataType: 'text',
      instructions: 'Receipt number, only if different from the tax invoice number.',
      example: 'RC-00123',
      copyMode: 'exact',
      role: 'receipt_no',
    }),
    makeColumn({
      name: 'ชื่อผู้ขายสินค้า/บริการ / Vendor name',
      keywords: ['ผู้ขาย', 'ผู้ประกอบการ', 'บริษัท', 'ห้างหุ้นส่วน', 'Vendor', 'Seller', 'Supplier'],
      dataType: 'text',
      instructions:
        'Seller/vendor name. Preserve the Thai (or English) company name EXACTLY as printed — do not translate.',
      required: true,
      example: 'บริษัท ตัวอย่าง จำกัด',
      copyMode: 'exact',
      role: 'vendor',
    }),
    makeColumn({
      name: 'เลขประจำตัวผู้เสียภาษี / Vendor tax ID',
      keywords: ['เลขประจำตัวผู้เสียภาษี', 'Tax ID', 'VAT ID', 'เลขประจำตัวผู้เสียภาษีอากร'],
      dataType: 'text',
      instructions:
        'The SELLER/vendor 13-digit tax ID — NOT the customer/buyer tax ID. If both appear, choose the one next to the vendor block.',
      required: true,
      example: '0105551234567',
      copyMode: 'exact',
      role: 'tax_id',
    }),
    makeColumn({
      name: 'สำนักงานใหญ่ / Head office',
      keywords: ['สำนักงานใหญ่', 'Head Office', 'HO'],
      dataType: 'text',
      instructions:
        'Whether the document marks the vendor as head office. Output "สำนักงานใหญ่" / "Head Office" or leave blank.',
      example: 'สำนักงานใหญ่',
      role: 'head_office',
    }),
    makeColumn({
      name: 'สาขา / Branch',
      keywords: ['สาขา', 'Branch'],
      dataType: 'text',
      instructions: 'Branch name/number if shown (e.g. "สาขา 00001"). Otherwise blank.',
      example: 'สาขา 00001',
      role: 'branch',
    }),
    makeColumn({
      name: 'รายละเอียดสินค้า/บริการ / Description',
      keywords: ['รายการ', 'รายละเอียด', 'Description', 'สินค้า', 'บริการ'],
      dataType: 'text',
      instructions:
        'Goods/services description. Preserve the document language; summarize multiple line items briefly if needed.',
      example: 'ค่าบริการซ่อมบำรุง',
      copyMode: 'exact',
      role: 'description',
    }),
    makeColumn({
      name: 'มูลค่าก่อน VAT / Amount before VAT',
      keywords: ['มูลค่าสินค้า', 'ก่อนภาษี', 'ราคาก่อนภาษี', 'Amount before VAT', 'Sub total', 'Subtotal'],
      dataType: 'money',
      instructions: 'Taxable amount before VAT.',
      required: true,
      example: '1,000.00',
      role: 'before_vat',
    }),
    makeColumn({
      name: 'ภาษีมูลค่าเพิ่ม / VAT amount',
      keywords: ['ภาษีมูลค่าเพิ่ม', 'VAT', 'ภาษี 7%', 'VAT Amount'],
      dataType: 'money',
      instructions: 'The VAT amount in currency (not the rate).',
      required: true,
      example: '70.00',
      role: 'vat',
    }),
    makeColumn({
      name: 'อัตราภาษี / VAT rate',
      keywords: ['อัตราภาษี', 'VAT rate', '7%', 'ภาษี %'],
      dataType: 'percentage',
      instructions: 'VAT rate as a percentage (usually 7).',
      example: '7%',
      role: 'vat_rate',
    }),
    makeColumn({
      name: 'ยอดรวม / Grand total',
      keywords: ['ยอดรวมทั้งสิ้น', 'จำนวนเงินรวมทั้งสิ้น', 'Grand Total', 'Total', 'รวมทั้งสิ้น'],
      dataType: 'money',
      instructions: 'Grand total including VAT.',
      required: true,
      example: '1,070.00',
      role: 'total',
    }),
  ]
}

function expenseReceiptColumns(): TemplateColumn[] {
  return [
    makeColumn({ name: 'Date / วันที่', keywords: ['วันที่', 'Date'], dataType: 'date', required: true, instructions: 'Receipt date.', role: 'date' }),
    makeColumn({ name: 'Vendor / ร้านค้า', keywords: ['ร้าน', 'Vendor', 'Merchant', 'บริษัท'], dataType: 'text', required: true, copyMode: 'exact', instructions: 'Merchant/vendor name, exactly as printed.', role: 'vendor' }),
    makeColumn({ name: 'Description / รายการ', keywords: ['รายการ', 'Description', 'Item'], dataType: 'text', copyMode: 'exact', instructions: 'What was purchased.', role: 'description' }),
    makeColumn({ name: 'Total / ยอดรวม', keywords: ['Total', 'ยอดรวม', 'รวมทั้งสิ้น'], dataType: 'money', required: true, instructions: 'Total paid.', role: 'total' }),
    makeColumn({ name: 'VAT / ภาษี', keywords: ['VAT', 'ภาษีมูลค่าเพิ่ม'], dataType: 'money', instructions: 'VAT amount if shown.', role: 'vat' }),
  ]
}

function supplierInvoiceColumns(): TemplateColumn[] {
  return [
    makeColumn({ name: 'Invoice No / เลขที่ใบแจ้งหนี้', keywords: ['Invoice No', 'เลขที่ใบกำกับภาษี', 'เลขที่'], dataType: 'text', required: true, copyMode: 'exact', instructions: 'Supplier invoice number.', role: 'invoice_no' }),
    makeColumn({ name: 'Date / วันที่', keywords: ['วันที่', 'Date'], dataType: 'date', required: true, instructions: 'Invoice date.', role: 'date' }),
    makeColumn({ name: 'Supplier / ผู้ขาย', keywords: ['Supplier', 'ผู้ขาย', 'บริษัท'], dataType: 'text', required: true, copyMode: 'exact', instructions: 'Supplier name, exactly as printed.', role: 'vendor' }),
    makeColumn({ name: 'Tax ID / เลขผู้เสียภาษี', keywords: ['Tax ID', 'เลขประจำตัวผู้เสียภาษี'], dataType: 'text', copyMode: 'exact', instructions: 'Supplier tax ID (not buyer).', role: 'tax_id' }),
    makeColumn({ name: 'Before VAT / ก่อนภาษี', keywords: ['Before VAT', 'ก่อนภาษี', 'Subtotal'], dataType: 'money', instructions: 'Amount before VAT.', role: 'before_vat' }),
    makeColumn({ name: 'VAT / ภาษี', keywords: ['VAT', 'ภาษีมูลค่าเพิ่ม'], dataType: 'money', instructions: 'VAT amount.', role: 'vat' }),
    makeColumn({ name: 'Total / ยอดรวม', keywords: ['Total', 'ยอดรวมทั้งสิ้น'], dataType: 'money', required: true, instructions: 'Grand total.', role: 'total' }),
  ]
}

function jobCostColumns(): TemplateColumn[] {
  return [
    makeColumn({ name: 'Date / วันที่', keywords: ['วันที่', 'Date'], dataType: 'date', instructions: 'Document date.', role: 'date' }),
    makeColumn({ name: 'Vendor / ผู้ขาย', keywords: ['ผู้ขาย', 'Vendor'], dataType: 'text', copyMode: 'exact', instructions: 'Vendor name.', role: 'vendor' }),
    makeColumn({ name: 'Description / รายละเอียด', keywords: ['รายละเอียด', 'Description'], dataType: 'text', copyMode: 'exact', instructions: 'Cost description.', role: 'description' }),
    makeColumn({ name: 'Job / Project', keywords: ['Job', 'Project', 'งาน', 'โครงการ'], dataType: 'text', instructions: 'Job or project reference if present.' }),
    makeColumn({ name: 'Amount / จำนวนเงิน', keywords: ['Amount', 'จำนวนเงิน', 'Total'], dataType: 'money', required: true, instructions: 'Cost amount (grand total).', role: 'total' }),
  ]
}

function template(name: string, type: string, columns: TemplateColumn[]): ExtractionTemplate {
  const now = new Date().toISOString()
  return {
    id: `preset-${type}`,
    name,
    type,
    columns,
    formatting: { ...DEFAULT_FORMATTING },
    createdAt: now,
    updatedAt: now,
  }
}

/** Built-in starting templates the user can clone and customize. */
export function presetTemplates(): ExtractionTemplate[] {
  return [
    template('Thai Purchase Tax Report', 'thai-purchase-tax', thaiTaxColumns()),
    template('Expense Receipts', 'expense-receipts', expenseReceiptColumns()),
    template('Supplier Invoice Log', 'supplier-invoice', supplierInvoiceColumns()),
    template('Custom Job Cost Report', 'job-cost', jobCostColumns()),
  ]
}

/** Roles the reconciliation engine recognizes. */
export const RECONCILE_ROLES = {
  beforeVat: 'before_vat' as const,
  vat: 'vat' as const,
  vatRate: 'vat_rate' as const,
  total: 'total' as const,
}
