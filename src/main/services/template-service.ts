import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { WriteTemplate } from '../../shared/write-template'

const TEMPLATES_DIR = join(homedir(), '.deepseekdesktop', 'templates')

function parseFrontmatter(content: string): {
  title?: string
  description?: string
  filename?: string
  body: string
} {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith('---')) return { body: content }

  const endIndex = trimmed.indexOf('---', 3)
  if (endIndex < 0) return { body: content }

  const frontmatterText = trimmed.slice(3, endIndex).trim()
  const body = trimmed.slice(endIndex + 3).trimStart()
  const result: ReturnType<typeof parseFrontmatter> = { body: body || content }

  for (const line of frontmatterText.split('\n')) {
    const match = line.match(/^(\w[\w\s]*?):\s*(.+)$/)
    if (!match) continue
    const key = match[1].trim().toLowerCase()
    const value = match[2].trim()
    if (key === 'title') result.title = value
    if (key === 'description') result.description = value
    if (key === 'filename') result.filename = value
  }

  return result
}

export function listTemplates(): WriteTemplate[] {
  try {
    const entries = readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    const mdFiles = entries.filter(
      (e) => e.isFile() && /\.md$/i.test(e.name)
    )
    const templates: WriteTemplate[] = []
    for (const file of mdFiles.slice(0, 12)) {
      try {
        const content = readFileSync(join(TEMPLATES_DIR, file.name), 'utf8')
        const fm = parseFrontmatter(content)
        templates.push({
          name: fm.title || file.name.replace(/\.md$/i, ''),
          filename: fm.filename || file.name,
          content: fm.body || content,
          description: fm.description
        })
      } catch {
        // skip unreadable templates
      }
    }
    return templates
  } catch {
    return []
  }
}
