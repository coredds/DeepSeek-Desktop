import { type ReactElement, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

type Shortcut = {
  keys: string[]
  label: string
}

type ShortcutGroup = {
  title: string
  items: Shortcut[]
}

export type KeyboardShortcutPanelProps = {
  open: boolean
  onClose: () => void
}

export function KeyboardShortcutPanel({ open, onClose }: KeyboardShortcutPanelProps): ReactElement | null {
  const { t } = useTranslation('common')

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      e.preventDefault()
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (!open) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  if (!open) return null

  const isMac = window.dsGui?.platform === 'darwin'
  const mod = isMac ? '⌘' : 'Ctrl'

  const groups: ShortcutGroup[] = [
    {
      title: t('keyboardGlobal'),
      items: [
        { keys: [mod, '1'], label: t('shortcutTabCode') },
        { keys: [mod, '2'], label: t('shortcutTabWrite') },
        { keys: [mod, '3'], label: t('shortcutTabClaw') },
        { keys: [mod, 'B'], label: t('shortcutToggleSidebar') },
        { keys: [mod, 'J'], label: t('shortcutToggleTerminal') },
        { keys: [mod, '\\'], label: t('shortcutToggleRightPanel') },
        { keys: ['?'], label: t('shortcutShowShortcuts') }
      ]
    },
    {
      title: t('keyboardComposer'),
      items: [
        { keys: ['Enter'], label: t('shortcutSend') },
        { keys: ['Shift', 'Enter'], label: t('shortcutNewline') },
        { keys: [mod, 'Enter'], label: t('shortcutSendAlt') }
      ]
    },
    {
      title: t('keyboardPanel'),
      items: [
        { keys: ['Esc'], label: t('shortcutClose') }
      ]
    }
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm dark:bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[480px] overflow-hidden rounded-[22px] border border-white/75 bg-[rgba(255,255,255,0.96)] shadow-[0_38px_96px_rgba(119,135,172,0.22)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(18,21,28,0.96)] dark:shadow-[0_34px_110px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4 dark:border-white/10">
          <h2 className="text-[17px] font-semibold text-slate-900 dark:text-white">
            {t('keyboardShortcuts')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300/80 bg-white/70 text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-white/18 dark:hover:text-slate-200"
          >
            <X className="h-[15px] w-[15px]" strokeWidth={1.8} />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-400 dark:text-slate-500">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-[14px] text-slate-700 dark:text-slate-300">
                      {item.label}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {item.keys.map((key, i) => (
                        <span key={i}>
                          <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-[5px] border border-slate-300/80 bg-slate-50 px-1.5 text-[11px] font-medium text-slate-600 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)] dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-300 dark:shadow-none">
                            {key}
                          </kbd>
                          {i < item.keys.length - 1 && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">+</span>
                          )}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200/80 px-6 py-3 dark:border-white/10">
          <p className="text-center text-[11.5px] text-slate-400 dark:text-slate-500">
            Press <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-[4px] border border-slate-300/80 bg-slate-50 px-1 text-[10px] font-medium text-slate-500 dark:border-white/12 dark:bg-white/[0.05] dark:text-slate-400">?</kbd> again or <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-[4px] border border-slate-300/80 bg-slate-50 px-1 text-[10px] font-medium text-slate-500 dark:border-white/12 dark:bg-white/[0.05] dark:text-slate-400">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  )
}
