import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Eye, EyeOff, Loader2, Plus, Trash2, X, XCircle } from 'lucide-react'

type EnvVarEntry = { key: string; value: string }

type McpServerEnvInfo = {
  id: string
  command?: string
  envVars: EnvVarEntry[]
}

type NewVar = { key: string; value: string }

type Props = {
  serverId: string
  serverLabel: string
  onClose: () => void
  onUpdated: () => void
}

export function McpEnvManager({ serverId, serverLabel, onClose, onUpdated }: Props): ReactElement {
  const { t } = useTranslation('common')
  const [envVars, setEnvVars] = useState<EnvVarEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [newVar, setNewVar] = useState<NewVar>({ key: '', value: '' })
  const [hiddenValues, setHiddenValues] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null)

  const load = useCallback(async () => {
    try {
      if (typeof window.dsGui?.listMcpEnvVars !== 'function') {
        setError('API not available')
        return
      }
      const result = await window.dsGui.listMcpEnvVars(serverId)
      const server = result.servers.find((s) => s.id === serverId)
      setEnvVars(server?.envVars ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [serverId])

  useEffect(() => {
    void load()
  }, [load])

  const saveVar = async (key: string, value: string): Promise<void> => {
    setBusy(key)
    setNotice(null)
    try {
      if (typeof window.dsGui?.setMcpEnvVar !== 'function') throw new Error('API not available')
      const result = await window.dsGui.setMcpEnvVar(serverId, key, value)
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.message ?? t('pluginMcpEnvSaveFailed') })
        return
      }
      setNotice({ tone: 'success', message: t('pluginMcpEnvSaved') })
      await load()
      onUpdated()
    } catch (e) {
      setNotice({ tone: 'error', message: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
    }
  }

  const deleteVar = async (key: string): Promise<void> => {
    setBusy(key)
    setNotice(null)
    try {
      if (typeof window.dsGui?.deleteMcpEnvVar !== 'function') throw new Error('API not available')
      const result = await window.dsGui.deleteMcpEnvVar(serverId, key)
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.message ?? t('pluginMcpEnvDeleteFailed') })
        return
      }
      setNotice({ tone: 'success', message: t('pluginMcpEnvDeleted') })
      await load()
      onUpdated()
    } catch (e) {
      setNotice({ tone: 'error', message: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
    }
  }

  const addVar = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    const key = newVar.key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
    if (!key) return
    await saveVar(key, newVar.value)
    setNewVar({ key: '', value: '' })
  }

  const toggleHidden = (key: string): void => {
    setHiddenValues((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-ds-border bg-ds-card/95 p-4 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-ds-faint" />
        <span className="text-[13px] text-ds-faint">{t('pluginLoading')}</span>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-ds-border bg-ds-card/95 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold text-ds-ink">
            {t('pluginMcpEnvTitle')} — {serverLabel}
          </h3>
          <p className="mt-0.5 text-[12px] text-ds-faint">{t('pluginMcpEnvHint')}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ds-faint transition hover:bg-ds-hover hover:text-ds-ink"
          title={t('pluginClose')}
        >
          <XCircle className="h-3.5 w-3.5" strokeWidth={1.9} />
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-300/80 bg-red-50 px-3 py-2 text-[12px] text-red-800 dark:border-red-800/70 dark:bg-red-950/25 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className={`mt-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-[12px] leading-5 ${
          notice.tone === 'error'
            ? 'border-red-300/80 bg-red-50 text-red-800 dark:border-red-800/70 dark:bg-red-950/25 dark:text-red-200'
            : 'border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/25 dark:text-emerald-200'
        }`}>
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-current opacity-60 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {envVars.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-ds-border px-3 py-6 text-center text-[12.5px] text-ds-faint">
          {t('pluginMcpEnvEmpty')}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {envVars.map((v) => {
            const isBusy = busy === v.key
            const isHidden = hiddenValues.has(v.key)
            return editing && editing.key === v.key ? (
              <form
                key={v.key}
                onSubmit={(e) => {
                  e.preventDefault()
                  saveVar(editing.key, editing.value).then(() => setEditing(null))
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={editing.value}
                  onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                  className="h-9 flex-1 rounded-lg border border-ds-border bg-ds-main/80 px-2.5 font-mono text-[13px] text-ds-ink outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/30"
                  autoFocus
                />
                <button
                  type="submit"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 transition hover:bg-emerald-500/20"
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ds-faint transition hover:bg-ds-hover hover:text-ds-ink"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </form>
            ) : (
              <div
                key={v.key}
                className="flex items-center gap-2 rounded-xl border border-ds-border bg-ds-subtle/60 px-3 py-2"
              >
                <code className="text-[12px] font-semibold text-ds-ink shrink-0">{v.key}</code>
                <div className="min-w-0 flex-1 truncate font-mono text-[12px] text-ds-muted">
                  {isHidden ? '••••••••' : v.value || <span className="italic text-ds-faint">({t('pluginMcpEnvEmptyValue')})</span>}
                </div>
                <button
                  type="button"
                  onClick={() => toggleHidden(v.key)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ds-faint transition hover:bg-ds-hover hover:text-ds-ink"
                  title={isHidden ? t('pluginMcpEnvShow') : t('pluginMcpEnvHide')}
                >
                  {isHidden ?
                    <Eye className="h-3.5 w-3.5" strokeWidth={1.7} /> :
                    <EyeOff className="h-3.5 w-3.5" strokeWidth={1.7} />
                  }
                </button>
                <button
                  type="button"
                  onClick={() => setEditing({ key: v.key, value: v.value })}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ds-faint transition hover:bg-ds-hover hover:text-ds-ink"
                  title={t('pluginMcpEnvEdit')}
                  disabled={isBusy}
                >
                  {isBusy ?
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                    <span className="text-[10px] font-semibold uppercase tracking-[0.06em]">{t('pluginEdit')}</span>
                  }
                </button>
                <button
                  type="button"
                  onClick={() => deleteVar(v.key)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ds-faint transition hover:bg-ds-hover hover:text-red-600"
                  title={t('pluginMcpEnvDelete')}
                  disabled={isBusy}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <form onSubmit={addVar} className="mt-3 flex items-center gap-2">
        <input
          value={newVar.key}
          onChange={(e) => setNewVar({ ...newVar, key: e.target.value })}
          className="h-9 w-40 rounded-lg border border-ds-border bg-ds-main/80 px-2.5 font-mono text-[13px] text-ds-ink outline-none placeholder:text-[11px] placeholder:text-ds-faint focus:border-accent/40 focus:ring-1 focus:ring-accent/30"
          placeholder={t('pluginMcpEnvKey')}
        />
        <input
          value={newVar.value}
          onChange={(e) => setNewVar({ ...newVar, value: e.target.value })}
          className="h-9 min-w-0 flex-1 rounded-lg border border-ds-border bg-ds-main/80 px-2.5 font-mono text-[13px] text-ds-ink outline-none placeholder:text-[11px] placeholder:text-ds-faint focus:border-accent/40 focus:ring-1 focus:ring-accent/30"
          placeholder={t('pluginMcpEnvValue')}
        />
        <button
          type="submit"
          disabled={!newVar.key.trim() || busy !== null}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ds-userbubble text-ds-userbubbleFg shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
          title={t('pluginMcpEnvAdd')}
        >
          {busy !== null ?
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> :
            <Plus className="h-4 w-4" strokeWidth={2} />
          }
        </button>
      </form>
    </div>
  )
}
