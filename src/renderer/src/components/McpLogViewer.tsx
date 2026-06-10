import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, RefreshCw, Search, XCircle } from 'lucide-react'

type Props = {
  serverNames: string[]
  onClose: () => void
}

export function McpLogViewer({ serverNames, onClose }: Props): ReactElement {
  const { t } = useTranslation('common')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [serverFilter, setServerFilter] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    try {
      if (typeof window.dsGui?.getMcpRuntimeOutput === 'function') {
        const result = await window.dsGui.getMcpRuntimeOutput()
        setOutput(result.output)
      }
    } catch {
      /* polling is best-effort */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = setInterval(refresh, 3_000)
    return () => clearInterval(interval)
  }, [refresh])

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [output, autoScroll])

  const filteredLines = useMemo(() => {
    const lines = output.split(/\r?\n/)
    return lines.filter((line) => {
      if (serverFilter && !line.toLowerCase().includes(serverFilter.toLowerCase())) return false
      if (filter && !line.toLowerCase().includes(filter.toLowerCase())) return false
      return true
    })
  }, [output, filter, serverFilter])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40)
  }, [])

  return (
    <div className="rounded-2xl border border-ds-border bg-ds-card/95 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-ds-ink">
          {t('pluginMcpLogTitle')}
        </h3>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-ds-faint" />}
          <button
            type="button"
            onClick={() => { setLoading(true); void refresh() }}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ds-faint transition hover:bg-ds-hover hover:text-ds-ink"
            title={t('pluginRefresh')}
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ds-faint transition hover:bg-ds-hover hover:text-ds-ink"
            title={t('pluginClose')}
          >
            <XCircle className="h-3.5 w-3.5" strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 md:flex-row">
        {serverNames.length > 1 ? (
          <select
            value={serverFilter}
            onChange={(e) => setServerFilter(e.target.value)}
            className="h-9 w-full rounded-lg border border-ds-border bg-ds-elevated px-2.5 text-[13px] text-ds-ink outline-none md:w-44"
          >
            <option value="">{t('pluginMcpAllServers')}</option>
            {serverNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        ) : null}
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ds-faint" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 w-full rounded-lg border border-ds-border bg-ds-elevated pl-8 pr-3 text-[13px] text-ds-ink outline-none placeholder:text-ds-faint"
            placeholder={t('pluginMcpLogSearch')}
          />
        </label>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="mt-3 h-64 overflow-y-auto rounded-xl border border-ds-border bg-ds-main/80 p-3 font-mono text-[11px] leading-5 text-ds-ink"
      >
        {!output && !loading ? (
          <div className="flex h-full items-center justify-center text-ds-faint">
            {t('pluginMcpLogEmpty')}
          </div>
        ) : filteredLines.length === 0 ? (
          <div className="flex h-full items-center justify-center text-ds-faint">
            {t('pluginMcpLogNoMatch')}
          </div>
        ) : (
          filteredLines.map((line, i) => {
            const trimmed = line.trim()
            if (!trimmed) return <div key={i} className="h-5" />
            const isError = /error|fail|panic|fatal/i.test(trimmed)
            const isWarn = /warn/i.test(trimmed)
            return (
              <div
                key={i}
                className={`whitespace-pre-wrap break-all ${
                  isError ? 'text-red-600 dark:text-red-400' : isWarn ? 'text-amber-600 dark:text-amber-400' : ''
                }`}
              >
                {line}
              </div>
            )
          })
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-ds-faint">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="h-3.5 w-3.5 accent-accent"
          />
          {t('pluginMcpLogAutoScroll')}
        </label>
        <span>{filteredLines.length} {t('pluginMcpLogLines')}</span>
      </div>
    </div>
  )
}
