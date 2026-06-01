import { type ReactElement, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useChatStore } from '../store/chat-store'
import { GitBranch } from 'lucide-react'

type Props = {
  compact?: boolean
}

export function ConnectionStatusBar({ compact = false }: Props): ReactElement {
  const { t } = useTranslation('common')
  const runtimeConnection = useChatStore((s) => s.runtimeConnection)
  const activeThreadId = useChatStore((s) => s.activeThreadId)
  const workspaceRoot = useChatStore((s) => s.workspaceRoot)
  const probeRuntime = useChatStore((s) => s.probeRuntime)
  const [dirtyCount, setDirtyCount] = useState<number | null>(null)

  useEffect(() => {
    if (!workspaceRoot || typeof window.dsGui === 'undefined') return
    let cancelled = false
    const fetchGit = async () => {
      try {
        const result = await window.dsGui.getGitBranches(workspaceRoot)
        if (!cancelled && result.ok) {
          setDirtyCount(result.dirtyCount)
        }
      } catch {
        if (!cancelled) setDirtyCount(null)
      }
    }
    fetchGit()
    const interval = setInterval(fetchGit, 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [workspaceRoot])

  const label =
    runtimeConnection === 'checking'
      ? t('runtimeChecking')
      : runtimeConnection === 'ready'
        ? t('runtimeReady')
        : runtimeConnection === 'offline'
          ? t('runtimeOfflineShort')
          : t('runtimeIdle')

  const barTone = compact
    ? runtimeConnection === 'ready'
      ? 'text-emerald-700/90 dark:text-emerald-200/80'
      : runtimeConnection === 'checking'
        ? 'text-amber-700/90 dark:text-amber-100/80'
        : 'text-ds-faint'
    : runtimeConnection === 'ready'
      ? 'bg-emerald-500/12 text-emerald-900 dark:text-emerald-100/90'
      : runtimeConnection === 'checking'
        ? 'bg-amber-500/12 text-amber-950 dark:text-amber-100/90'
        : 'bg-ds-subtle text-ds-muted'

  const dotClass =
    runtimeConnection === 'ready'
      ? 'bg-emerald-500'
      : runtimeConnection === 'checking'
        ? 'animate-pulse bg-amber-500'
        : 'bg-ds-faint'

  const showRetry =
    (runtimeConnection === 'offline' || runtimeConnection === 'idle') && activeThreadId !== null

  if (compact) {
    return (
      <div
        className={`chat-connection-status ds-no-drag inline-flex max-w-[min(400px,50vw)] shrink-0 items-center gap-1.5 ${barTone}`}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />
        <span className="truncate text-[11.5px] font-medium tabular-nums">{label}</span>
        {showRetry ? (
          <button
            type="button"
            className="shrink-0 rounded-md px-1 py-0.5 text-[11.5px] font-semibold text-ds-muted underline decoration-ds-border underline-offset-2 transition hover:text-ds-ink"
            onClick={() => void probeRuntime('user')}
          >
            {t('retryConnection')}
          </button>
        ) : null}
        {dirtyCount !== null && dirtyCount > 0 && (
          <span
            title={dirtyCount === 1 ? t('workspaceHealthDirtyFiles_one') : t('workspaceHealthDirtyFiles', { count: dirtyCount })}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/[0.08] px-1.5 py-0.5 text-[10.5px] font-medium text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/[0.1] dark:text-amber-300"
          >
            <GitBranch className="h-2.5 w-2.5" strokeWidth={2.5} />
            {dirtyCount}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      className={`ds-no-drag inline-flex h-11 shrink-0 items-center gap-3 rounded-full border border-ds-border px-4 text-[13px] shadow-sm ${barTone}`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
        <span className="truncate font-medium">{label}</span>
      </span>
      {showRetry ? (
        <button
          type="button"
          className="shrink-0 rounded-full bg-ds-elevated px-3 py-1.5 text-[12px] font-medium text-ds-ink ring-1 ring-ds-border transition hover:bg-ds-hover"
          onClick={() => void probeRuntime('user')}
        >
          {t('retryConnection')}
        </button>
      ) : null}
    </div>
  )
}
