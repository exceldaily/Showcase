import type { PageImage } from '../extraction/provider'

/** Handle JPEG/PNG uploads: convert to PageImage format for extraction. */
export async function handleImageFile(file: File): Promise<PageImage[]> {
  const data = await file.arrayBuffer()
  const base64 = Buffer.from(data).toString('base64')

  // Determine media type from file extension or MIME type
  const ext = file.name.split('.').pop()?.toLowerCase()
  const mimeType = file.type
  let mediaType: 'image/png' | 'image/jpeg' = 'image/jpeg'

  if (
    ext === 'png' ||
    mimeType === 'image/png' ||
    file.name.toLowerCase().endsWith('.png')
  ) {
    mediaType = 'image/png'
  }

  // For images, we treat each file as a single page
  // Dimensions are unknown at this point but set to reasonable defaults
  // Claude will handle variable image sizes gracefully
  return [
    {
      sourceFile: file.name,
      pageNumber: 1,
      imageBase64: base64,
      mediaType,
      width: 0, // Unknown, Claude doesn't require this
      height: 0,
      rotation: 0,
    },
  ]
}
