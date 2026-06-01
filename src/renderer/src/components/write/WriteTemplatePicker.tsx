import type { ReactElement } from 'react'
import { useCallback, useEffect, useState } from 'react'
import {
  FileText,
  Loader2,
  type LucideIcon
} from 'lucide-react'
import type { WriteTemplate } from '@shared/write-template'

export type { WriteTemplate }

type Props = {
  onSelect: (template: WriteTemplate) => void
  icon?: LucideIcon
}

export function WriteTemplatePicker({
  onSelect,
  icon: Icon = FileText
}: Props): ReactElement {
  const [templates, setTemplates] = useState<WriteTemplate[]>([])
  const [loading, setLoading] = useState(false)

  const loadTemplates = useCallback(async () => {
    if (typeof window.dsGui === 'undefined') return
    setLoading(true)
    setTemplates([])
    try {
      const loaded = await window.dsGui.listTemplates()
      setTemplates(loaded)
    } catch {
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-1 text-[12px] text-ds-faint">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading templates...
      </div>
    )
  }

  if (templates.length === 0) return <></>

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
