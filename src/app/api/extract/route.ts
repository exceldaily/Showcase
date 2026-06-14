import { NextResponse } from 'next/server'
import type { ExtractionTemplate } from '@/lib/types'
import { getProvider } from '@/lib/extraction/provider'
import type { ExtractionProviderName } from '@/lib/config'
import { rowsFromRaw } from '@/lib/extraction/pipeline'
import { renderPdfToImages } from '@/lib/pdf/render'
import { handleImageFile } from '@/lib/image/handle'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const templateRaw = form.get('template')
    if (typeof templateRaw !== 'string') {
      return NextResponse.json({ error: 'Missing extraction template' }, { status: 400 })
    }

    const template = JSON.parse(templateRaw) as ExtractionTemplate
    const providerName = form.get('provider')
    const provider = await getProvider(
      typeof providerName === 'string' ? (providerName as ExtractionProviderName) : undefined
    )
    const files = form.getAll('pdfs').filter((value): value is File => value instanceof File)

    if (!files.length) {
      return NextResponse.json({ error: 'Upload at least one PDF or image' }, { status: 400 })
    }

    const rendered = (
      await Promise.all(
        files.map(async (file) => {
          const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
          return isPdf
            ? renderPdfToImages(file, { maxPages: 20 })
            : handleImageFile(file)
        })
      )
    ).flat()
    const rawRows = await provider.extract(rendered, {
      columns: template.columns,
      formatting: template.formatting,
    })

    return NextResponse.json({
      provider: provider.name,
      pages: rendered.length,
      rows: rowsFromRaw(rawRows, template),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Extraction failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
