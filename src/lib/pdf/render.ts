import { createCanvas } from '@napi-rs/canvas'
import type { PageImage } from '../extraction/provider'

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height)
    const context = canvas.getContext('2d')
    return { canvas, context }
  }

  reset(
    canvasAndContext: ReturnType<NodeCanvasFactory['create']>,
    width: number,
    height: number
  ) {
    canvasAndContext.canvas.width = width
    canvasAndContext.canvas.height = height
  }

  destroy(canvasAndContext: ReturnType<NodeCanvasFactory['create']>) {
    canvasAndContext.canvas.width = 0
    canvasAndContext.canvas.height = 0
  }
}

async function loadPdfJs(): Promise<PdfJs> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs'
  return pdfjs
}

export async function renderPdfToImages(
  file: File,
  options: { maxPages?: number; scale?: number } = {}
): Promise<PageImage[]> {
  const pdfjs = await loadPdfJs()
  const data = new Uint8Array(await file.arrayBuffer())
  const loadingTask = pdfjs.getDocument({
    data,
    disableFontFace: false,
    isEvalSupported: false,
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/cmaps/',
    cMapPacked: true,
  })
  const document = await loadingTask.promise
  const pageCount = Math.min(document.numPages, options.maxPages ?? 25)
  const pages: PageImage[] = []
  const canvasFactory = new NodeCanvasFactory()

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const viewport = page.getViewport({ scale: options.scale ?? 2.2 })
    const canvasAndContext = canvasFactory.create(viewport.width, viewport.height)

    await page.render({
      canvasContext: canvasAndContext.context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise

    const png = canvasAndContext.canvas.toBuffer('image/png')
    pages.push({
      sourceFile: file.name,
      pageNumber,
      pngBase64: png.toString('base64'),
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      rotation: page.rotate ?? 0,
    })
    canvasFactory.destroy(canvasAndContext)
  }

  await document.destroy()
  return pages
}
