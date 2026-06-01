import type { ReactElement } from 'react'
import { Bot, Code2, MessageSquare, PencilLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type Props = {
  activeView: 'chat-pure' | 'chat' | 'write' | 'claw'
  onPureChatOpen: () => void
  onCodeOpen: () => void
  onWriteOpen: () => void
  onClawOpen: () => void
}

export function WorkspaceModeTabs({
  activeView,
  onPureChatOpen,
  onCodeOpen,
  onWriteOpen,
  onClawOpen
}: Props): ReactElement {
  const { t } = useTranslation('common')

  const tabClass = (active: boolean): string =>
    `inline-flex min-w-0 items-center justify-center gap-1.5 rounded-[9px] px-2.5 text-[13px] font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-accent/35 ${
      active
        ? 'bg-white text-ds-ink shadow-[0_2px_8px_rgba(15,23,42,0.10)] ring-1 ring-ds-border-muted dark:bg-white/[0.13] dark:text-white dark:ring-white/10'
        : 'text-ds-faint hover:bg-white/45 hover:text-ds-muted dark:hover:bg-white/[0.07]'
    }`

  const chatActive = activeView === 'chat-pure'

  return (
    <div className="mb-4 flex flex-col gap-3">
      <button
        type="button"
        onClick={onPureChatOpen}
        className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14px] font-medium transition ${
          chatActive
            ? 'bg-accent/10 text-accent shadow-sm ring-1 ring-accent/15'
            : 'text-ds-ink hover:bg-ds-hover/45'
        }`}
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] ${
          chatActive ? 'bg-accent/15 text-accent' : 'bg-ds-hover/70 text-ds-muted'
        }`}>
          <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.9} />
        </span>
        <span className="flex-1 truncate text-left">{t('chat')}</span>
      </button>

      <div className="flex items-center gap-1.5">
        <span className="h-px flex-1 bg-ds-border-muted/40" />
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ds-faint">{t('workspaceModesLabel')}</span>
        <span className="h-px flex-1 bg-ds-border-muted/40" />
      </div>

      <div
        role="tablist"
        aria-label={`${t('code')} / ${t('write')} / ${t('claw')}`}
        className="rounded-[12px] border border-ds-border-muted/45 bg-ds-subtle/72 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.52)] backdrop-blur dark:bg-white/[0.045] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
      >
        <div className="grid h-[34px] grid-cols-3 gap-0.5">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'chat'}
            onClick={onCodeOpen}
            className={tabClass(activeView === 'chat')}
          >
            <Code2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
            <span className="truncate">{t('code')}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'write'}
            onClick={onWriteOpen}
            className={tabClass(activeView === 'write')}
          >
            <PencilLine className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
            <span className="truncate">{t('write')}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'claw'}
            onClick={onClawOpen}
            className={tabClass(activeView === 'claw')}
          >
            <Bot className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
            <span className="truncate">{t('claw')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
