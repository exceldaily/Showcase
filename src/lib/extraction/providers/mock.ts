import type {
  ExtractionContext,
  ExtractionProvider,
  PageImage,
  RawRow,
} from '../provider'
import { resolveRole } from '../roles'

const VENDORS = [
  'บริษัท สยามเทรดดิ้ง จำกัด',
  'ห้างหุ้นส่วนจำกัด รุ่งเรืองพาณิชย์',
  'บริษัท กรุงเทพ ออโต้ พาร์ท จำกัด',
  'Siam Office Supplies Co., Ltd.',
  'บริษัท ไทยเทค โซลูชั่น จำกัด',
]
const DESCRIPTIONS = [
  'ค่าบริการซ่อมบำรุงเครื่องจักร',
  'อะไหล่และวัสดุสิ้นเปลือง',
  'ค่าบริการที่ปรึกษา',
  'Office supplies and stationery',
  'ค่าน้ำมันเชื้อเพลิง',
]

/** Deterministic pseudo-random in [0,1) from a string seed. */
function seeded(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Mock extraction provider — generates self-consistent sample rows so the
 * upload → review → export workflow runs end-to-end with no API keys.
 */
export class MockProvider implements ExtractionProvider {
  name = 'mock' as const

  async extract(pages: PageImage[], ctx: ExtractionContext): Promise<RawRow[]> {
    return pages.map((page) => {
      const rnd = seeded(`${page.sourceFile}#${page.pageNumber}`)
      const vendor = VENDORS[Math.floor(rnd() * VENDORS.length)]
      const desc = DESCRIPTIONS[Math.floor(rnd() * DESCRIPTIONS.length)]
      const before = Math.round((500 + rnd() * 9500) * 100) / 100
      const vat = Math.round(before * 0.07 * 100) / 100
      const total = Math.round((before + vat) * 100) / 100
      const day = 1 + Math.floor(rnd() * 28)
      const month = 1 + Math.floor(rnd() * 12)
      const beYear = 2566 + Math.floor(rnd() * 4)
      const invNo = `INV-${beYear}-${String(1000 + Math.floor(rnd() * 8999))}`
      const branch = rnd() > 0.5 ? 'สำนักงานใหญ่' : `สาขา ${String(Math.floor(rnd() * 5)).padStart(5, '0')}`

      const fields: RawRow['fields'] = {}
      for (const col of ctx.columns) {
        const role = resolveRole(col)
        // Occasionally leave an optional field uncertain to exercise the review UI.
        const shaky = rnd() < 0.12 && !col.required
        const put = (value: string, confidence = 0.9) => {
          fields[col.id] = shaky
            ? { value: '', confidence: 0.3, source: 'needs_review' }
            : { value, confidence }
        }
        switch (role) {
          case 'date': put(`${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${beYear}`); break
          case 'invoice_no': put(invNo); break
          case 'receipt_no': put(rnd() > 0.6 ? invNo.replace('INV', 'RC') : ''); break
          case 'vendor': put(vendor); break
          case 'tax_id': put(`010${Math.floor(1000000000 + rnd() * 8999999999)}`.slice(0, 13)); break
          case 'head_office': put(branch.startsWith('สำนักงาน') ? 'สำนักงานใหญ่' : ''); break
          case 'branch': put(branch.startsWith('สาขา') ? branch : ''); break
          case 'description': put(desc); break
          case 'before_vat': put(before.toLocaleString('en-US', { minimumFractionDigits: 2 })); break
          case 'vat': put(vat.toLocaleString('en-US', { minimumFractionDigits: 2 })); break
          case 'vat_rate': put('7%'); break
          case 'total': put(total.toLocaleString('en-US', { minimumFractionDigits: 2 })); break
          default: put(col.example || '')
        }
      }
      return { sourceFile: page.sourceFile, pageNumber: page.pageNumber, fields }
    })
  }
}
