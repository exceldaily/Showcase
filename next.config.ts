import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Server-side libs that must not be bundled by webpack/turbopack.
  serverExternalPackages: ['exceljs', 'pdfjs-dist', '@napi-rs/canvas', 'tesseract.js'],
  outputFileTracingIncludes: {
    '/api/extract': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
  },
}

export default nextConfig
