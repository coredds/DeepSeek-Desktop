import type { AttachmentItem } from '../agent/types'

export function buildPromptWithAttachments(
  text: string,
  attachments?: AttachmentItem[]
): string {
  if (!attachments || attachments.length === 0) return text
  const parts: string[] = []
  const imageAtts = attachments.filter((a) => a.mimeType.startsWith('image/'))
  const otherAtts = attachments.filter((a) => !a.mimeType.startsWith('image/'))
  for (const att of imageAtts) {
    parts.push(`![${att.name}](${att.dataUrl})`)
  }
  for (const att of otherAtts) {
    parts.push(`[Attached file: ${att.name}]`)
  }
  if (parts.length === 0) return text
  return `${parts.join('\n')}\n\n${text}`
}
