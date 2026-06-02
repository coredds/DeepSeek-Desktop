import type { AttachmentItem } from '../agent/types'

export type ImageDescription = { name: string; text: string }

export function buildPromptWithAttachments(
  text: string,
  attachments?: AttachmentItem[],
  imageDescriptions?: ImageDescription[]
): string {
  if (!attachments || attachments.length === 0) return text
  const parts: string[] = []
  const imageAtts = attachments.filter((a) => a.mimeType.startsWith('image/'))
  const otherAtts = attachments.filter((a) => !a.mimeType.startsWith('image/'))

  if (imageDescriptions && imageDescriptions.length > 0) {
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
