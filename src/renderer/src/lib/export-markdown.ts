import type { ChatBlock } from '../agent/types'

function sanitizeFilename(text: string): string {
  return text
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'conversation'
}

export function blocksToMarkdown(blocks: ChatBlock[], title: string): string {
  const lines: string[] = []

  if (title) {
    lines.push(`# ${title}`)
    lines.push('')
  }

  for (const block of blocks) {
    switch (block.kind) {
      case 'user': {
        lines.push(`**You:** ${block.text}`)
        lines.push('')
        break
      }
      case 'assistant': {
        lines.push(block.text)
        lines.push('')
        break
      }
      case 'reasoning': {
        lines.push('<details>')
        lines.push('<summary>Thinking...</summary>')
        lines.push('')
        lines.push(block.text)
        lines.push('')
        lines.push('</details>')
        lines.push('')
        break
      }
      case 'tool': {
        const summary = block.summary || block.toolKind || 'Tool'
        lines.push(`> **Tool:** ${summary}`)
        if (block.status) {
          lines.push(`> Status: ${block.status}`)
        }
        if (block.detail?.trim()) {
          lines.push('')
          lines.push('```')
          lines.push(block.detail.trim())
          lines.push('```')
        }
        lines.push('')
        break
      }
      case 'system': {
        lines.push(`*${block.text}*`)
        lines.push('')
        break
      }
      case 'compaction': {
        lines.push(`> Context compacted: ${block.summary || ''}`)
        lines.push('')
        break
      }
      case 'approval': {
        lines.push(`> **Approval** (${block.status}): ${block.summary}`)
        if (block.errorMessage) {
          lines.push(`> Error: ${block.errorMessage}`)
        }
        lines.push('')
        break
      }
      case 'user_input': {
        lines.push(`> **Question:** ${block.questions?.map((q) => q.question).join(' | ') || ''}`)
        lines.push('')
        break
      }
    }
  }

  return lines.join('\n')
}

export function defaultExportFilename(title: string): string {
  return `${sanitizeFilename(title)}.md`
}
