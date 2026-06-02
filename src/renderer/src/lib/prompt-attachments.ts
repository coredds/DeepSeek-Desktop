import type { AttachmentItem } from '../agent/types'

export type ImageDescription = { name: string; text: string }

const VISION_MAX_DIMENSION = 1024
const VISION_JPEG_QUALITY = 0.8

export function compressImageForVision(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const { naturalWidth, naturalHeight } = img
      const scale = Math.min(1, VISION_MAX_DIMENSION / Math.max(naturalWidth, naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(naturalWidth * scale)
      canvas.height = Math.round(naturalHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', VISION_JPEG_QUALITY))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export function buildPromptWithAttachments(
  text: string,
  attachments?: AttachmentItem[],
  imageDescriptions?: ImageDescription[]
): string {
  if (!attachments || attachments.length === 0) return text
  const parts: string[] = []
  const imageAtts = attachments.filter((a) => a.mimeType.startsWith('image/'))
  const otherAtts = attachments.filter((a) => !a.mimeType.startsWith('image/'))

  if (imageDescriptions !== undefined) {
    for (const desc of imageDescriptions) {
      parts.push(`[Image: ${desc.name}]\n${desc.text}`)
    }
  } else {
    for (const att of imageAtts) {
      parts.push(`![${att.name}](${att.dataUrl})`)
    }
  }
  for (const att of otherAtts) {
    parts.push(`[Attached file: ${att.name}]`)
  }
  if (parts.length === 0) return text
  return `${parts.join('\n')}\n\n${text}`
}
