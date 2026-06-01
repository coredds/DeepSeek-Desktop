import type { ReactElement } from 'react'
import { useCallback, useEffect, useState } from 'react'
import {
  FileText,
  Loader2,
  type LucideIcon
} from 'lucide-react'

export type WriteTemplate = {
  name: string
  filename: string
  content: string
  description?: string
}

type Props = {
  workspaceRoot: string
  onSelect: (template: WriteTemplate) => void
  icon?: LucideIcon
}

const TEMPLATES_DIR = 'templates'

export function WriteTemplatePicker({
  workspaceRoot,
  onSelect,
  icon: Icon = FileText
}: Props): ReactElement {
  const [templates, setTemplates] = useState<WriteTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTemplates = useCallback(async () => {
    if (!workspaceRoot || typeof window.dsGui === 'undefined') return
    setLoading(true)
    setError(null)
    try {
      const list = await window.dsGui.listWorkspaceDirectory({
        workspaceRoot,
        path: TEMPLATES_DIR
      })
      if (!list.ok) {
        setTemplates([])
        return
      }
      const mdFiles = list.entries.filter(
        (e) => e.type === 'file' && /\.md$/i.test(e.name)
      )
      const loaded: WriteTemplate[] = []
      for (const file of mdFiles.slice(0, 12)) {
        try {
          const result = await window.dsGui.readWorkspaceFile({
            workspaceRoot,
            path: file.path
          })
          if (result.ok && result.content) {
            const content = result.content
            const frontmatter = parseTemplateFrontmatter(content)
            loaded.push({
              name: frontmatter.title || file.name.replace(/\.md$/i, ''),
              filename: frontmatter.suggestedFilename || file.name,
              content: frontmatter.body || content,
              description: frontmatter.description
            })
          }
        } catch {
          // skip unreadable templates
        }
      }
      setTemplates(loaded)
    } catch {
      setError('Could not load templates')
    } finally {
      setLoading(false)
    }
  }, [workspaceRoot])

  useEffect(() => {
    if (workspaceRoot) void loadTemplates()
  }, [workspaceRoot, loadTemplates])

  if (!workspaceRoot) return <></>

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-1 text-[12px] text-ds-faint">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading templates...
      </div>
    )
  }

  if (error || templates.length === 0) return <></>

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-ds-faint">
        From template
      </p>
      <div className="flex flex-wrap gap-1.5">
        {templates.map((tmpl) => (
          <button
            key={tmpl.name}
            type="button"
            onClick={() => onSelect(tmpl)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ds-border bg-ds-card px-2.5 py-1.5 text-[12px] font-medium text-ds-ink transition hover:bg-ds-hover hover:border-accent/30"
            title={tmpl.description || tmpl.name}
          >
            <Icon className="h-3 w-3 shrink-0 text-ds-muted" strokeWidth={1.75} />
            <span className="truncate max-w-[140px]">{tmpl.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function parseTemplateFrontmatter(content: string): {
  title?: string
  description?: string
  suggestedFilename?: string
  body: string
} {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith('---')) return { body: content }

  const endIndex = trimmed.indexOf('---', 3)
  if (endIndex < 0) return { body: content }

  const frontmatterText = trimmed.slice(3, endIndex).trim()
  const body = trimmed.slice(endIndex + 3).trimStart()
  const result: ReturnType<typeof parseTemplateFrontmatter> = { body: body || content }

  for (const line of frontmatterText.split('\n')) {
    const match = line.match(/^(\w[\w\s]*?):\s*(.+)$/)
    if (!match) continue
    const key = match[1].trim().toLowerCase()
    const value = match[2].trim()
    if (key === 'title') result.title = value
    if (key === 'description') result.description = value
    if (key === 'filename') result.suggestedFilename = value
  }

  return result
}
