import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, RefreshCw, Wrench, XCircle } from 'lucide-react'

type McpServerStatus = {
  name: string
  enabled?: boolean
  required?: boolean
  command?: string | null
  url?: string | null
  connected?: boolean
  enabled_tools?: string[]
  disabled_tools?: string[]
}

type McpToolStatus = {
  server?: string
  name?: string
  prefixed_name?: string
  description?: string | null
}

type Props = {
  installedIds: string[]
  onClose: () => void
}

function requestJson<T>(path: string): Promise<T> {
  if (typeof window.dsGui?.runtimeRequest !== 'function') {
    throw new Error('Runtime bridge unavailable')
  }
  return window.dsGui.runtimeRequest(path, 'GET').then((r) => {
    if (!r.ok) throw new Error(`${path} failed (${r.status || 0})`)
    if (!r.body.trim()) return undefined as T
    return JSON.parse(r.body) as T
  })
}

function readArray<T>(input: unknown, key: string): T[] {
  if (input && typeof input === 'object' && Array.isArray((input as Record<string, unknown>)[key])) {
    return (input as Record<string, unknown>)[key] as T[]
  }
  return []
}

export function McpStatusDashboard({ installedIds, onClose }: Props): ReactElement {
  const { t } = useTranslation('common')
  const [servers, setServers] = useState<McpServerStatus[]>([])
  const [tools, setTools] = useState<McpToolStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedServer, setSelectedServer] = useState<string>('')
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const refresh = useCallback(async () => {
    try {
      const [serversPayload, toolsPayload] = await Promise.all([
        requestJson<unknown>('/v1/apps/mcp/servers'),
        requestJson<unknown>(
          selectedServer
            ? `/v1/apps/mcp/tools?server=${encodeURIComponent(selectedServer)}`
            : '/v1/apps/mcp/tools'
        )
      ])
      const allServers = readArray<McpServerStatus>(serversPayload, 'servers')
      const filtered = allServers.filter((s) => installedIds.includes(s.name))
      setServers(filtered)
      setTools(readArray<McpToolStatus>(toolsPayload, 'tools'))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [installedIds, selectedServer])

  useEffect(() => {
    void refresh()
    intervalRef.current = setInterval(refresh, 15_000)
    return () => clearInterval(intervalRef.current)
  }, [refresh])

  const connectedCount = servers.filter((s) => s.connected).length
  const totalTools = servers.reduce((sum, s) => sum + (s.enabled_tools?.length ?? 0), 0)

  return (
    <div className="rounded-2xl border border-ds-border bg-ds-card/95 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-ds-ink">
          {t('pluginMcpStatusTitle')}
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

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-xl bg-ds-subtle px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ds-faint">
            {t('pluginMcpConnected')}
          </div>
          <div className="mt-0.5 text-[14px] font-semibold text-ds-ink">
            {connectedCount}/{servers.length}
          </div>
        </div>
        <div className="rounded-xl bg-ds-subtle px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ds-faint">
            {t('pluginMcpToolsAvailable')}
          </div>
          <div className="mt-0.5 text-[14px] font-semibold text-ds-ink">
            {totalTools}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-300/80 bg-red-50 px-3 py-2 text-[12px] text-red-800 dark:border-red-800/70 dark:bg-red-950/25 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {servers.length === 0 && !loading ? (
        <div className="mt-4 rounded-xl border border-dashed border-ds-border px-3 py-6 text-center text-[12.5px] text-ds-faint">
          {t('pluginMcpNoServers')}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {servers.map((server) => (
            <div
              key={server.name}
              className="rounded-xl border border-ds-border bg-ds-subtle/60 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${
                      server.connected ? 'bg-emerald-500' : server.enabled ? 'bg-amber-400' : 'bg-ds-border'
                    }`} />
                    <div className="truncate text-[13px] font-semibold text-ds-ink">
                      {server.name}
                    </div>
                  </div>
                  <div className="mt-1 truncate text-[12px] text-ds-faint">
                    {server.url || server.command || '-'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                    server.connected
                      ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                      : server.enabled
                        ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
                        : 'bg-ds-border/30 text-ds-faint'
                  }`}>
                    {server.connected
                      ? t('pluginMcpStatusConnected')
                      : server.enabled
                        ? t('pluginMcpStatusDisconnected')
                        : t('pluginMcpStatusStopped')}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex gap-3 text-[11.5px] text-ds-faint">
                <span>{t('pluginMcpEnabledTools')}: {server.enabled_tools?.length ?? 0}</span>
                <span>{t('pluginMcpDisabledTools')}: {server.disabled_tools?.length ?? 0}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tools.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-[13px] font-semibold text-ds-muted hover:text-ds-ink transition">
            {t('pluginMcpTools')} ({tools.length})
          </summary>
          <div className="mt-2 space-y-1.5">
            {tools.map((tool, i) => (
              <div
                key={`${tool.server}-${tool.prefixed_name || tool.name}-${i}`}
                className="rounded-lg border border-ds-border-muted bg-ds-subtle/40 px-3 py-2"
              >
                <div className="flex items-start gap-2">
                  <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ds-faint" strokeWidth={1.7} />
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-ds-ink">
                      {tool.prefixed_name || tool.name || '-'}
                    </div>
                    <div className="text-[11px] text-ds-faint">{tool.server || '-'}</div>
                    {tool.description ? (
                      <p className="mt-0.5 line-clamp-2 text-[11.5px] text-ds-muted">{tool.description}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {servers.length > 0 ? (
        <div className="mt-3">
          <label className="text-[11px] font-medium uppercase tracking-[0.08em] text-ds-faint">
            {t('pluginMcpFilterTools')}
          </label>
          <select
            value={selectedServer}
            onChange={(e) => setSelectedServer(e.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-ds-border bg-ds-elevated px-2.5 text-[13px] text-ds-ink outline-none"
          >
            <option value="">{t('pluginMcpAllServers')}</option>
            {servers.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  )
}
