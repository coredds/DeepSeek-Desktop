import { type ReactElement, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppSettingsV1 } from '@shared/app-settings'
import { applyTheme } from '../lib/apply-theme'
import { useChatStore } from '../store/chat-store'
import { Eye, EyeOff, ExternalLink, Sparkles, Sun, Moon, Monitor, X, Loader2, FolderOpen } from 'lucide-react'

type ThemePref = AppSettingsV1['theme']
type SetupFormPatch = Partial<Omit<AppSettingsV1, 'deepseek'>> & {
  deepseek?: Partial<AppSettingsV1['deepseek']>
}

const themeOptions: { value: ThemePref; icon: typeof Sun; labelKey: string }[] = [
  { value: 'system', icon: Monitor, labelKey: 'themeSystem' },
  { value: 'light', icon: Sun, labelKey: 'themeLight' },
  { value: 'dark', icon: Moon, labelKey: 'themeDark' }
]
const DEEPSEEK_USAGE_URL = 'https://platform.deepseek.com/usage'

const SAMPLE_README = [
  '# Welcome to DeepSeek Desktop',
  '',
  'This is a sample workspace. You can use it to explore the app before connecting your own project. The agent can read and edit files in this directory. Try asking it to create a new file, write a script, or explain a concept.',
  '',
  '',
  '## Getting Started',
  '',
  '1. **Type a message** in the composer at the bottom of the screen',
  '2. **Watch the agent work** - it will show its reasoning, run commands, and edit files',
  '3. **Review changes** in the inspector panel (right sidebar)',
  '4. **Create a new thread** from the left sidebar to start a fresh conversation',
  '',
  '## Try These',
  '',
  '- "Create a simple Python script that prints Hello World"',
  '- "Write a Markdown note summarizing the project structure"',
  '- "Explain how the observer pattern works with a code example"',
  '- "Help me plan a small web app - ask clarifying questions first"',
  ''
].join('\n')

export function InitialSetupDialog(): ReactElement {
  const { t } = useTranslation('settings')
  const initialSetupMode = useChatStore((s) => s.initialSetupMode)
  const closeInitialSetup = useChatStore((s) => s.closeInitialSetup)
  const reloadUiSettings = useChatStore((s) => s.reloadUiSettings)
  const probeRuntime = useChatStore((s) => s.probeRuntime)

  const [form, setForm] = useState<AppSettingsV1 | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creatingSample, setCreatingSample] = useState(false)
  const [startPhase, setStartPhase] = useState<'idle' | 'saving' | 'starting'>('idle')
  const isPreview = initialSetupMode === 'preview'

  useEffect(() => {
    let cancelled = false
    if (typeof window.dsGui === 'undefined') return
    void window.dsGui.getSettings().then((s) => {
      if (!cancelled) setForm(s)
    })
    return () => { cancelled = true }
  }, [])

  const updateForm = (patch: SetupFormPatch) => {
    if (!form) return
    const next: AppSettingsV1 = {
      ...form,
      ...patch,
      deepseek: { ...form.deepseek, ...(patch.deepseek ?? {}) }
    }
    setForm(next)
  }

  const handleThemeChange = (theme: ThemePref) => {
    if (!form) return
    updateForm({ theme })
    applyTheme(theme)
  }

  const handleClose = () => {
    setError(null)
    setStartPhase('idle')
    closeInitialSetup()
    void reloadUiSettings()
  }

  const handleOpenOfficialApiPage = () => {
    if (typeof window.dsGui?.openExternal !== 'function') return
    void window.dsGui.openExternal(DEEPSEEK_USAGE_URL)
  }

  const handleSave = async () => {
    if (!form) return
    if (!form.deepseek.apiKey.trim()) {
      setError(t('firstRunApiKeyValidation'))
      return
    }
    await doSave()
  }

  const doSave = async () => {
    if (!form) return
    setSaving(true)
    setError(null)
    try {
      if (typeof window.dsGui === 'undefined') throw new Error('Preload bridge missing')
      const next = await window.dsGui.setSettings(form)
      setForm(next)
      void reloadUiSettings()
      setSaving(false)
      setStartPhase('starting')
      await probeRuntime('user')
      const storeState = useChatStore.getState()
      if (storeState.runtimeConnection === 'ready') {
        handleClose()
      } else {
        setStartPhase('idle')
        setError(storeState.error ?? t('firstRunRuntimeFailed'))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  const handleCreateSampleWorkspace = async () => {
    if (!form) return
    setCreatingSample(true)
    setError(null)
    try {
      if (typeof window.dsGui === 'undefined') throw new Error('Preload bridge missing')
      const settings = await window.dsGui.getSettings()
      const root = settings.workspaceRoot || ''
      if (root) {
        await window.dsGui.createWorkspaceDirectory({ path: root, workspaceRoot: root }).catch(function () {})
        await window.dsGui.writeWorkspaceFile({
          path: root.replace(/\\/g, '/').replace(/\/+$/, '') + '/README.md',
          content: SAMPLE_README,
          workspaceRoot: root
        }).catch(function () {})
      }
      setSaving(true)
      setCreatingSample(false)
      const next = await window.dsGui.setSettings(form)
      setForm(next)
      void reloadUiSettings()
      setSaving(false)
      setStartPhase('starting')
      await probeRuntime('user')
      const storeState = useChatStore.getState()
      if (storeState.runtimeConnection === 'ready') {
        handleClose()
      } else {
        setStartPhase('idle')
        setError(storeState.error ?? t('firstRunRuntimeFailed'))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
      setCreatingSample(false)
    }
  }

  if (!form) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-md dark:bg-black/70">
        <div className="rounded-2xl border border-ds-border bg-ds-card/95 px-5 py-4 text-sm text-ds-muted shadow-panel backdrop-blur-xl">
          {t('loading')}
        </div>
      </div>
    )
  }

  const selectedTheme = form.theme
  const choiceButtonClass = (active: boolean): string =>
    [
      'flex h-12 items-center justify-center gap-2 rounded-[16px] border px-4 text-[15px] font-medium transition-all duration-200',
      active
        ? 'border-[#1388ff] bg-[#1388ff]/[0.06] text-[#1388ff] shadow-[0_0_0_1px_rgba(19,136,255,0.14),0_10px_24px_rgba(19,136,255,0.08)] dark:border-[#3aa0ff] dark:bg-[#3aa0ff]/[0.12] dark:text-[#7dc1ff]'
        : 'border-slate-300/80 bg-white/70 text-slate-600 hover:border-slate-400/80 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-white/16 dark:hover:bg-white/[0.045]'
    ].join(' ')
  const fieldClass =
    'w-full rounded-[18px] border border-slate-300/75 bg-white/88 px-4 py-3 text-[15px] text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] outline-none transition focus:border-[#1388ff]/70 focus:ring-2 focus:ring-[#1388ff]/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:shadow-none dark:focus:border-[#3aa0ff]/70 dark:focus:ring-[#3aa0ff]/15 dark:placeholder:text-slate-500'
  const labelClass = 'text-[15px] font-medium text-slate-700 dark:text-slate-200'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#eef2fb]/38 p-4 backdrop-blur-[18px] dark:bg-black/60 dark:backdrop-blur-[22px]">
      <div className="w-full max-w-[592px] overflow-hidden rounded-[28px] border border-white/75 bg-[rgba(255,255,255,0.92)] text-slate-900 shadow-[0_38px_96px_rgba(119,135,172,0.22)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(18,21,28,0.94)] dark:text-white dark:shadow-[0_34px_110px_rgba(0,0,0,0.55)]">
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(19,136,255,0.08),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.88))] px-8 pb-7 pt-8 dark:bg-[radial-gradient(circle_at_top_right,rgba(58,160,255,0.12),transparent_28%),linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,21,28,0.96))]">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1388ff]/22 bg-[#1388ff]/[0.06] px-3.5 py-1.5 text-[13px] font-semibold text-[#1388ff] dark:border-[#3aa0ff]/22 dark:bg-[#3aa0ff]/[0.12] dark:text-[#7dc1ff]">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} />
              {t(isPreview ? 'firstRunPreviewBadge' : 'firstRunBadge')}
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label={t('firstRunClose')}
              title={t('firstRunClose')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300/80 bg-white/72 text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-white/18 dark:hover:text-slate-200"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
          </div>
          <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">
            {t('firstRunTitle')}
          </h1>
          <p className="mt-3 text-[15px] leading-7 text-slate-500 dark:text-slate-400">
            {t('firstRunSubtitle')}
          </p>
        </div>

        <div className="space-y-6 px-8 py-7">
          <div className="border-t border-slate-200/80 dark:border-white/10" />

          <div className="space-y-3">
            <label className={labelClass}>
              {t('theme')}
            </label>
            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map(({ value, icon: Icon, labelKey }) => {
                const isActive = selectedTheme === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleThemeChange(value)}
                    className={choiceButtonClass(isActive)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{t(labelKey)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-3">
            <label className={labelClass}>
              {t('apiKey')}
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={form.deepseek.apiKey}
                onChange={(e) => updateForm({ deepseek: { apiKey: e.target.value } })}
                placeholder="sk-..."
                className={`${fieldClass} pr-12 font-mono tracking-[0.02em] placeholder:font-sans`}
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex flex-col gap-2 rounded-[18px] border border-slate-200/80 bg-slate-50/75 px-4 py-3 text-[13px] text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <p className="leading-6">
                {t('firstRunBuyApiHint')}
              </p>
              <button
                type="button"
                onClick={handleOpenOfficialApiPage}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#1388ff]/24 bg-[#1388ff]/[0.06] px-3 py-1.5 text-[12.5px] font-semibold text-[#1388ff] transition hover:bg-[#1388ff]/[0.1] dark:border-[#3aa0ff]/22 dark:bg-[#3aa0ff]/[0.12] dark:text-[#7dc1ff] dark:hover:bg-[#3aa0ff]/[0.18]"
              >
                <span>{t('firstRunBuyApiAction')}</span>
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.9} />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className={labelClass}>
              {t('baseUrl')}
            </label>
            <input
              type="text"
              value={form.deepseek.baseUrl}
              onChange={(e) => updateForm({ deepseek: { baseUrl: e.target.value } })}
              placeholder="https://api.deepseek.com/beta"
              className={fieldClass}
            />
          </div>
        </div>

        <div className="space-y-4 px-8 pb-8 pt-1">
          {(error || creatingSample || startPhase === 'starting') && (
            <div className={`rounded-[18px] border px-4 py-3 text-[13px] ${
              error
                ? 'border-red-500/18 bg-red-500/[0.08] text-red-700 dark:border-red-500/20 dark:bg-red-500/[0.12] dark:text-red-200'
                : 'border-[#1388ff]/18 bg-[#1388ff]/[0.06] text-[#1388ff] dark:border-[#3aa0ff]/18 dark:bg-[#3aa0ff]/[0.08] dark:text-[#7dc1ff]'
            }`}>
              {error || (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {creatingSample ? t('firstRunCreatingSample') : t('firstRunStartingRuntime')}
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={startPhase !== 'idle'}
              className="h-11 rounded-[16px] border border-slate-300/80 bg-white/75 px-4 text-[15px] font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/16 dark:hover:bg-white/[0.06]"
            >
              {t('firstRunSkipForNow')}
            </button>
            <button
              type="button"
              disabled={saving || creatingSample || startPhase !== 'idle'}
              onClick={handleSave}
              className="h-11 rounded-[16px] bg-[linear-gradient(180deg,#2392ff_0%,#0e7df0_100%)] px-4 text-[15px] font-semibold text-white shadow-[0_16px_34px_rgba(19,136,255,0.24)] transition hover:opacity-95 disabled:opacity-50 dark:bg-[linear-gradient(180deg,#2c9dff_0%,#1584f6_100%)] dark:shadow-[0_16px_34px_rgba(21,132,246,0.22)]"
            >
              {saving || startPhase === 'starting' ? t('firstRunStartingRuntime') : t('firstRunSave')}
            </button>
          </div>

          <button
            type="button"
            disabled={saving || creatingSample || startPhase !== 'idle'}
            onClick={handleCreateSampleWorkspace}
            className="flex w-full h-11 items-center justify-center gap-2 rounded-[16px] border border-[#1388ff]/20 bg-[#1388ff]/[0.04] px-4 text-[14px] font-semibold text-[#1388ff] transition hover:bg-[#1388ff]/[0.08] disabled:opacity-50 dark:border-[#3aa0ff]/18 dark:bg-[#3aa0ff]/[0.06] dark:text-[#7dc1ff] dark:hover:bg-[#3aa0ff]/[0.1]"
          >
            <FolderOpen className="h-4 w-4" strokeWidth={1.8} />
            <div className="text-left">
              <div>{t('firstRunSampleWorkspace')}</div>
              <div className="text-[11px] font-normal text-slate-400 dark:text-slate-500">{t('firstRunSampleSub')}</div>
            </div>
          </button>

          <p className="text-center text-[12.5px] leading-6 text-slate-400 dark:text-slate-500">
            {t(isPreview ? 'firstRunPreviewHint' : 'firstRunChangeLater')}
          </p>
        </div>
      </div>
    </div>
  )
}
