import type { ReactElement } from 'react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bot,
  Loader2,
  MessageSquare,
  Search,
  User,
  Wrench,
  X
} from 'lucide-react'
import type { MessageSearchResult } from '../../store/chat-store-types'
import { useChatStore } from '../../store/chat-store'

const BLOCK_ICONS: Record<string, ReactElement> = {
  user: <User className="h-3 w-3" strokeWidth={2} />,
  assistant: <Bot className="h-3 w-3" strokeWidth={1.9} />,
  reasoning: <MessageSquare className="h-3 w-3" strokeWidth={1.9} />,
  tool: <Wrench className="h-3 w-3" strokeWidth={1.9} />,
  system: <MessageSquare className="h-3 w-3" strokeWidth={1.9} />
}

type Props = {
  onClose: () => void
  onNavigate: (threadId: string) => void
}

export function MessageSearchPanel({ onClose, onNavigate }: Props): ReactElement {
  const { t } = useTranslation('common')
  const inputRef = useRef<HTMLInputElement>(null)
  const searchMessages = useChatStore((s) => s.searchMessages)
  const setMessageSearchQuery = useChatStore((s) => s.setMessageSearchQuery)
  const clearMessageSearch = useChatStore((s) => s.clearMessageSearch)
  const query = useChatStore((s) => s.messageSearchQuery)
  const results = useChatStore((s) => s.messageSearchResults)
  const isSearching = useChatStore((s) => s.isSearchingMessages)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleChange = (value: string): void => {
    setMessageSearchQuery(value)
    void searchMessages(value)
  }

  const handleSelect = (result: MessageSearchResult): void => {
    clearMessageSearch()
    onNavigate(result.threadId)
  }

  const handleClose = (): void => {
    clearMessageSearch()
    onClose()
  }

  const hasQuery = query.trim().length > 0
  const showResults = hasQuery && !isSearching && results.length > 0
  const showEmpty = hasQuery && !isSearching && results.length === 0 && query.trim().length >= 2
  const showHint = !hasQuery

  return (
    <div className="flex min-h-0 flex-1 flex-col px-1">
      <div className="mb-2 flex items-center gap-1">
        <label className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ds-faint"
            strokeWidth={1.8}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={t('messageSearchPlaceholder')}
            className="h-8 w-full rounded-lg border border-transparent bg-white/35 pl-7 pr-7 text-[13px] text-ds-ink outline-none transition placeholder:text-ds-faint focus:border-accent/30 focus:bg-white/60 dark:bg-white/5 dark:focus:bg-white/8"
          />
          {query.trim() ? (
            <button
              type="button"
              onClick={() => handleChange('')}
              className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ds-faint transition hover:bg-ds-hover hover:text-ds-ink"
              title={t('clear')}
              aria-label={t('clear')}
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.9} />
            </button>
          ) : null}
        </label>
        <button
          type="button"
          onClick={handleClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent bg-white/35 text-ds-faint transition hover:border-ds-border-muted hover:bg-white/60 hover:text-ds-ink dark:bg-white/5 dark:hover:bg-white/8"
          title={t('close')}
          aria-label={t('close')}
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.9} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isSearching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-ds-faint" strokeWidth={2} />
          </div>
        ) : showHint ? (
          <div className="px-2 py-4 text-center text-[13px] text-ds-faint">
            {t('messageSearchHint')}
          </div>
        ) : showEmpty ? (
          <div className="px-2 py-4 text-center">
            <p className="text-[13px] text-ds-faint">{t('messageSearchEmpty')}</p>
          </div>
        ) : showResults ? (
          <div className="space-y-0.5 pb-2">
            {results.map((result) => (
              <MessageSearchResultRow
                key={`${result.threadId}\0${result.blockId}`}
                result={result}
                onSelect={handleSelect}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MessageSearchResultRow({
  result,
  onSelect
}: {
  result: MessageSearchResult
  onSelect: (result: MessageSearchResult) => void
}): ReactElement {
  const icon = BLOCK_ICONS[result.blockKind] ?? BLOCK_ICONS.system

  return (
    <button
      type="button"
      onClick={() => onSelect(result)}
      className="flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-ds-hover/50"
    >
      <div className="flex items-center gap-1.5">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-ds-faint">
          {icon}
        </span>
        <span className="min-w-0 truncate text-[13px] font-medium text-ds-ink">
          {result.threadTitle}
        </span>
      </div>
      <p className="pl-5.5 text-[12.5px] leading-5 text-ds-muted line-clamp-2">
        {result.text}
      </p>
    </button>
  )
}
