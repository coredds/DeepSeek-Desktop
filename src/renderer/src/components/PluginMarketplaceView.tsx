import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  ChevronDown,
  FileText,
  FolderOpen,
  Key,
  Loader2,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  Server,
  Settings
} from 'lucide-react'
import {
  joinFsPath,
  loadPreferredSkillRootId,
  savePreferredSkillRootId,
  type SkillRootId
} from '../lib/skill-root-preference'
import { normalizeWorkspaceRoot } from '../lib/workspace-path'
import { useChatStore } from '../store/chat-store'
import { McpStatusDashboard } from './McpStatusDashboard'
import { McpLogViewer } from './McpLogViewer'
import { McpEnvManager } from './McpEnvManager'

type PluginKind = 'mcp' | 'skill'
type PluginFilter = 'all' | 'recommended' | 'installed'
type NoticeTone = 'success' | 'error' | 'info'

type Notice = {
  tone: NoticeTone
  message: string
  actionLabel?: string
  onAction?: () => void
}

type MarketplaceItem = {
  id: string
  kind: PluginKind
  titleKey: string
  descriptionKey: string
  group: 'recommended'
  mcpSnippet?: (workspaceRoot: string) => string
  skillInstructions?: string
  prerequisites?: string[]
}

type SkillRootOption = {
  id: SkillRootId
  label: string
  path: string
  available: boolean
}

const INSTALLED_STORAGE_KEY = 'deepseekdesktop.installedPlugins'

function markerFor(kind: PluginKind, id: string): string {
  return `DeepSeek Desktop plugin:${kind}:${id}`
}

function loadInstalledPlugins(): string[] {
  try {
    const raw = window.localStorage.getItem(INSTALLED_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function saveInstalledPlugins(ids: string[]): void {
  try {
    window.localStorage.setItem(INSTALLED_STORAGE_KEY, JSON.stringify([...new Set(ids)]))
  } catch {
    /* localStorage may be unavailable */
  }
}

function storageKey(kind: PluginKind, id: string): string {
  return `${kind}:${id}`
}

function normalizePluginId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function tomlString(value: string): string {
  return JSON.stringify(value)
}

function tomlArray(values: string[]): string {
  return `[${values.map(tomlString).join(', ')}]`
}

function buildMcpSnippet(
  id: string,
  title: string,
  description: string,
  command: string,
  args: string[]
): string {
  return [
    `# ${markerFor('mcp', id)}`,
    `# ${title} - ${description}`,
    `[mcp_servers.${tomlString(id)}]`,
    `command = ${tomlString(command)}`,
    `args = ${tomlArray(args)}`
  ].join('\n')
}

function buildSkillContent(id: string, title: string, description: string, instructions: string): string {
  return [
    '---',
    `name: ${id}`,
    `description: ${description}`,
    '---',
    '',
    `# ${title}`,
    '',
    instructions
  ].join('\n')
}

function skillNameLooksValid(raw: string): boolean {
  const value = raw.trim()
  return !!value && value !== '.' && value !== '..' && !/[\\/]/.test(value)
}

const RECOMMENDED_ITEMS: MarketplaceItem[] = [
  {
    id: 'filesystem',
    kind: 'mcp',
    titleKey: 'pluginMcpFilesystemTitle',
    descriptionKey: 'pluginMcpFilesystemDesc',
    group: 'recommended',
    mcpSnippet: (workspaceRoot) =>
      buildMcpSnippet(
        'filesystem',
        'Filesystem',
        'Read and write files in the selected workspace.',
        'npx',
        ['-y', '@modelcontextprotocol/server-filesystem', workspaceRoot || '/path/to/project']
      )
  },
  {
    id: 'playwright',
    kind: 'mcp',
    titleKey: 'pluginMcpPlaywrightTitle',
    descriptionKey: 'pluginMcpPlaywrightDesc',
    group: 'recommended',
    mcpSnippet: () =>
      buildMcpSnippet(
        'playwright',
        'Playwright',
        'Automate and inspect real browsers.',
        'npx',
        ['-y', '@playwright/mcp@latest']
      )
  },
  {
    id: 'github',
    kind: 'mcp',
    titleKey: 'pluginMcpGithubTitle',
    descriptionKey: 'pluginMcpGithubDesc',
    group: 'recommended',
    prerequisites: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    mcpSnippet: () =>
      [
        buildMcpSnippet(
          'github',
          'GitHub',
          'Read repositories, issues, pull requests, and CI context.',
          'npx',
          ['-y', '@modelcontextprotocol/server-github']
        ),
        'env = { GITHUB_PERSONAL_ACCESS_TOKEN = "your-token-here" }'
      ].join('\n')
  },
  {
    id: 'context7',
    kind: 'mcp',
    titleKey: 'pluginMcpContext7Title',
    descriptionKey: 'pluginMcpContext7Desc',
    group: 'recommended',
    prerequisites: ['CONTEXT7_API_KEY'],
    mcpSnippet: () =>
      [
        buildMcpSnippet(
          'context7',
          'Context7',
          'Fetch current library documentation for coding tasks.',
          'npx',
          ['-y', '@upstash/context7-mcp@latest']
        ),
        'env = { CONTEXT7_API_KEY = "your-key-here" }'
      ].join('\n')
  },
  {
    id: 'brave-search',
    kind: 'mcp',
    titleKey: 'pluginMcpBraveSearchTitle',
    descriptionKey: 'pluginMcpBraveSearchDesc',
    group: 'recommended',
    prerequisites: ['BRAVE_API_KEY'],
    mcpSnippet: () =>
      [
        buildMcpSnippet(
          'brave-search',
          'Brave Search',
          'Web and local search via Brave Search API.',
          'npx',
          ['-y', '@anthropic-ai/mcp-server-brave-search']
        ),
        'env = { BRAVE_API_KEY = "your-key-here" }'
      ].join('\n')
  },
  {
    id: 'memory',
    kind: 'mcp',
    titleKey: 'pluginMcpMemoryTitle',
    descriptionKey: 'pluginMcpMemoryDesc',
    group: 'recommended',
    mcpSnippet: () =>
      buildMcpSnippet(
        'memory',
        'Memory',
        'Persistent knowledge graph so the agent remembers across sessions.',
        'npx',
        ['-y', '@anthropic-ai/mcp-server-memory']
      )
  },
  {
    id: 'sequential-thinking',
    kind: 'mcp',
    titleKey: 'pluginMcpSequentialThinkingTitle',
    descriptionKey: 'pluginMcpSequentialThinkingDesc',
    group: 'recommended',
    mcpSnippet: () =>
      buildMcpSnippet(
        'sequential-thinking',
        'Sequential Thinking',
        'Step-by-step reasoning for complex multi-step problems.',
        'npx',
        ['-y', '@anthropic-ai/mcp-server-sequential-thinking']
      )
  },
  {
    id: 'puppeteer',
    kind: 'mcp',
    titleKey: 'pluginMcpPuppeteerTitle',
    descriptionKey: 'pluginMcpPuppeteerDesc',
    group: 'recommended',
    mcpSnippet: () =>
      buildMcpSnippet(
        'puppeteer',
        'Puppeteer',
        'Headless Chrome automation for scraping and screenshots.',
        'npx',
        ['-y', '@anthropic-ai/mcp-server-puppeteer']
      )
  },
  {
    id: 'whatsapp',
    kind: 'mcp',
    titleKey: 'pluginMcpWhatsappTitle',
    descriptionKey: 'pluginMcpWhatsappDesc',
    group: 'recommended',
    prerequisites: ['Go', 'uv', 'QR auth'],
    mcpSnippet: () =>
      [
        '# Prerequisites: clone the repo and start the Go bridge before use.',
        '#   git clone https://github.com/lharries/whatsapp-mcp ~/.deepseekdesktop/mcp/whatsapp-mcp',
        '#   cd ~/.deepseekdesktop/mcp/whatsapp-mcp/whatsapp-bridge && go run main.go',
        '# Then scan the QR code with WhatsApp to authenticate.',
        '',
        buildMcpSnippet(
          'whatsapp',
          'WhatsApp',
          'Search contacts, read chats, send messages via your personal WhatsApp account.',
          'uv',
          ['--directory', '~/.deepseekdesktop/mcp/whatsapp-mcp/whatsapp-mcp-server', 'run', 'main.py']
        )
      ].join('\n')
  },
  {
    id: 'code-review',
    kind: 'skill',
    titleKey: 'pluginSkillReviewTitle',
    descriptionKey: 'pluginSkillReviewDesc',
    group: 'recommended',
    skillInstructions:
      'Use this skill when reviewing a code change. Prioritize correctness, regressions, security, performance, and missing tests. Lead with concrete findings and file references.'
  },
  {
    id: 'frontend-polish',
    kind: 'skill',
    titleKey: 'pluginSkillFrontendTitle',
    descriptionKey: 'pluginSkillFrontendDesc',
    group: 'recommended',
    skillInstructions:
      'Use this skill when improving UI. Preserve the product style, check responsive states, avoid generic layouts, and verify the result visually before handing it back.'
  },
  {
    id: 'bug-hunt',
    kind: 'skill',
    titleKey: 'pluginSkillBugTitle',
    descriptionKey: 'pluginSkillBugDesc',
    group: 'recommended',
    skillInstructions:
      'Use this skill when investigating bugs. Reproduce or narrow the symptom, trace the data flow, identify the smallest fix, and add focused verification where possible.'
  },
  {
    id: 'release-notes',
    kind: 'skill',
    titleKey: 'pluginSkillReleaseTitle',
    descriptionKey: 'pluginSkillReleaseDesc',
    group: 'recommended',
    skillInstructions:
      'Use this skill when preparing release notes. Group user-facing changes by outcome, call out migrations or risks, and keep wording concise and scannable.'
  }
]

export function PluginMarketplaceView(): ReactElement {
  const { t } = useTranslation('common')
  const workspaceRoot = normalizeWorkspaceRoot(useChatStore((s) => s.workspaceRoot))
  const [activeKind, setActiveKind] = useState<PluginKind>('mcp')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<PluginFilter>('all')
  const [installed, setInstalled] = useState<string[]>(() => loadInstalledPlugins())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customDescription, setCustomDescription] = useState('')
  const [customCommand, setCustomCommand] = useState('')
  const [customArgs, setCustomArgs] = useState('')
  const [customConfig, setCustomConfig] = useState('')
  const [customSkillBody, setCustomSkillBody] = useState('')
  const [skillRootId, setSkillRootId] = useState<SkillRootId>(() => loadPreferredSkillRootId())
  const [mcpConfigText, setMcpConfigText] = useState('')
  const [mcpLoaded, setMcpLoaded] = useState(false)
  const [expandedPanel, setExpandedPanel] = useState<{ itemKey: string; panel: 'status' | 'log' | 'env' } | null>(null)

  const skillRootOptions = useMemo<SkillRootOption[]>(() => {
    const hasWorkspace = !!workspaceRoot
    return [
      {
        id: 'workspace-agents',
        label: t('pluginSkillRootWorkspaceAgents'),
        path: workspaceRoot ? joinFsPath(workspaceRoot, '.agents/skills') : '',
        available: hasWorkspace
      },
      {
        id: 'workspace-skills',
        label: t('pluginSkillRootWorkspaceSkills'),
        path: workspaceRoot ? joinFsPath(workspaceRoot, 'skills') : '',
        available: hasWorkspace
      },
      {
        id: 'global-agents',
        label: t('pluginSkillRootGlobalAgents'),
        path: '~/.agents/skills',
        available: true
      },
      {
        id: 'global-deepseek',
        label: t('pluginSkillRootGlobalDeepseek'),
        path: '~/.deepseek/skills',
        available: true
      }
    ]
  }, [t, workspaceRoot])

  const selectedSkillRoot =
    skillRootOptions.find((option) => option.id === skillRootId && option.available) ??
    skillRootOptions.find((option) => option.available)

  useEffect(() => {
    const selectedOption = skillRootOptions.find((option) => option.id === skillRootId && option.available)
    if (selectedOption) {
      savePreferredSkillRootId(skillRootId)
      return
    }
    const fallback = skillRootOptions.find((option) => option.available)
    if (fallback && fallback.id !== skillRootId) {
      setSkillRootId(fallback.id)
    }
  }, [skillRootId, skillRootOptions])

  const readMcpConfig = useCallback(async (): Promise<string> => {
    if (typeof window.dsGui?.getDeepseekConfigFile !== 'function') return mcpConfigText
    const file = await window.dsGui.getDeepseekConfigFile()
    setMcpConfigText(file.content)
    setMcpLoaded(true)
    return file.content
  }, [mcpConfigText])

  useEffect(() => {
    if (activeKind !== 'mcp' || mcpLoaded) return
    void readMcpConfig().catch((e) => {
      setNotice({ tone: 'error', message: e instanceof Error ? e.message : String(e) })
    })
  }, [activeKind, mcpLoaded, readMcpConfig])

  useEffect(() => {
    setNotice(null)
    setCustomOpen(false)
    setExpandedPanel(null)
  }, [activeKind])

  const markInstalled = (key: string): void => {
    setInstalled((prev) => {
      const next = [...new Set([...prev, key])]
      saveInstalledPlugins(next)
      return next
    })
  }

  const isInstalled = useCallback((item: Pick<MarketplaceItem, 'kind' | 'id'>): boolean => {
    const key = storageKey(item.kind, item.id)
    if (installed.includes(key)) return true
    return item.kind === 'mcp' && mcpConfigText.includes(markerFor('mcp', item.id))
  }, [installed, mcpConfigText])

  const isMcpDisabled = useCallback((id: string): boolean => {
    const marker = markerFor('mcp', id)
    const idx = mcpConfigText.indexOf(`# ${marker}`)
    if (idx < 0) return false
    const sectionStart = mcpConfigText.indexOf('\n', idx)
    if (sectionStart < 0) return false
    const nextMarker = mcpConfigText.indexOf('\n# DeepSeek Desktop plugin:', sectionStart + 1)
    const sectionEnd = nextMarker > 0 ? nextMarker : mcpConfigText.length
    const section = mcpConfigText.slice(sectionStart, sectionEnd)
    const lines = section.split('\n').filter((l) => l.trim())
    return lines.length > 0 && lines.every((l) => l.trimStart().startsWith('#'))
  }, [mcpConfigText])

  const toggleMcpServer = useCallback(async (id: string): Promise<void> => {
    const marker = markerFor('mcp', id)
    const disabled = isMcpDisabled(id)
    const content = mcpLoaded ? mcpConfigText : await readMcpConfig()
    const markerIdx = content.indexOf(`# ${marker}`)
    if (markerIdx < 0) return

    const sectionStart = content.indexOf('\n', markerIdx)
    if (sectionStart < 0) return
    const nextMarker = content.indexOf('\n# DeepSeek Desktop plugin:', sectionStart + 1)
    const sectionEnd = nextMarker > 0 ? nextMarker - 1 : content.length
    const before = content.slice(0, sectionStart + 1)
    const section = content.slice(sectionStart + 1, sectionEnd)
    const after = content.slice(sectionEnd)

    let newSection: string
    if (disabled) {
      newSection = section.replace(/^# /gm, '')
    } else {
      newSection = section.split('\n').map((l) => l ? `# ${l}` : l).join('\n')
    }
    const next = before + newSection + after
    await window.dsGui.setDeepseekConfigFile(next)
    setMcpConfigText(next)
    setMcpLoaded(true)
  }, [mcpConfigText, mcpLoaded, isMcpDisabled, readMcpConfig])

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return RECOMMENDED_ITEMS.filter((item) => item.kind === activeKind)
      .filter((item) => {
        const title = t(item.titleKey).toLowerCase()
        const description = t(item.descriptionKey).toLowerCase()
        return !normalizedQuery || title.includes(normalizedQuery) || description.includes(normalizedQuery)
      })
      .filter((item) => {
        if (filter === 'recommended') return item.group === 'recommended'
        if (filter === 'installed') return isInstalled(item)
        return true
      })
  }, [activeKind, filter, isInstalled, query, t])

  const recommendedItems = visibleItems.filter((item) => !isInstalled(item))
  const personalItems = visibleItems.filter(isInstalled)

  const installedMcpIds = useMemo(
    () =>
      RECOMMENDED_ITEMS.filter(
        (item) => item.kind === 'mcp' && isInstalled(item)
      ).map((item) => item.id),
    [isInstalled]
  )

  const installedMcpNames = useMemo(
    () =>
      RECOMMENDED_ITEMS.filter(
        (item) => item.kind === 'mcp' && isInstalled(item)
      ).map((item) => t(item.titleKey)),
    [isInstalled, t]
  )

  const togglePanel = useCallback(
    (itemKey: string, panel: 'status' | 'log' | 'env') => {
      setExpandedPanel((prev) =>
        prev?.itemKey === itemKey && prev?.panel === panel ? null : { itemKey, panel }
      )
    },
    []
  )

  const showSplit = filter === 'all'
  const hasAnyInstalled = personalItems.length > 0

  const appendMcpSnippet = async (id: string, snippet: string, item?: MarketplaceItem): Promise<void> => {
    const content = mcpLoaded ? mcpConfigText : await readMcpConfig()
    if (content.includes(markerFor('mcp', id))) {
      markInstalled(storageKey('mcp', id))
      setNotice({ tone: 'info', message: t('pluginAlreadyAdded') })
      return
    }
    const next = `${content.trimEnd()}${content.trim() ? '\n\n' : ''}${snippet.trim()}\n`
    const result = await window.dsGui.setDeepseekConfigFile(next)
    setMcpConfigText(next)
    setMcpLoaded(true)
    markInstalled(storageKey('mcp', id))
    if (item?.prerequisites && item.prerequisites.length > 0) {
      setNotice({
        tone: 'success',
        message: t('pluginMcpAdded', { path: result.path }),
        actionLabel: t('pluginConfigureEnv'),
        onAction: () => useChatStore.getState().openSettings('agents')
      })
    } else {
      setNotice({ tone: 'success', message: t('pluginMcpAdded', { path: result.path }) })
    }
  }

  const addItem = async (item: MarketplaceItem): Promise<void> => {
    setBusyId(storageKey(item.kind, item.id))
    setNotice(null)
    try {
      if (item.kind === 'mcp') {
        if (!item.mcpSnippet) return
        await appendMcpSnippet(item.id, item.mcpSnippet(workspaceRoot), item)
        return
      }

      if (!selectedSkillRoot?.path) {
        setNotice({ tone: 'error', message: t('pluginSkillRootMissing') })
        return
      }
      const title = t(item.titleKey)
      const description = t(item.descriptionKey)
      const content = buildSkillContent(
        item.id,
        title,
        description,
        item.skillInstructions ?? description
      )
      const result = await window.dsGui.saveSkillFile(selectedSkillRoot.path, item.id, content)
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.message })
        return
      }
      markInstalled(storageKey('skill', item.id))
      setNotice({ tone: 'success', message: t('pluginSkillAdded', { path: result.path }) })
    } catch (e) {
      setNotice({ tone: 'error', message: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusyId(null)
    }
  }

  const addCustom = async (): Promise<void> => {
    const id = normalizePluginId(customName)
    if (!id) {
      setNotice({ tone: 'error', message: t('pluginCustomNameRequired') })
      return
    }
    const description = customDescription.trim() || t('pluginCustomFallbackDesc')
    setBusyId(`custom:${activeKind}`)
    setNotice(null)
    try {
      if (activeKind === 'mcp') {
        const snippet = customConfig.trim() || buildMcpSnippet(
          id,
          customName.trim() || id,
          description,
          customCommand.trim() || 'npx',
          customArgs
            .split('\n')
            .map((arg) => arg.trim())
            .filter(Boolean)
        )
        await appendMcpSnippet(id, snippet.includes(markerFor('mcp', id)) ? snippet : `${`# ${markerFor('mcp', id)}`}\n${snippet}`)
      } else {
        if (!selectedSkillRoot?.path) {
          setNotice({ tone: 'error', message: t('pluginSkillRootMissing') })
          return
        }
        const body = customSkillBody.trim() || t('pluginCustomSkillFallbackBody')
        const content = buildSkillContent(id, customName.trim() || id, description, body)
        const result = await window.dsGui.saveSkillFile(selectedSkillRoot.path, id, content)
        if (!result.ok) {
          setNotice({ tone: 'error', message: result.message })
          return
        }
        markInstalled(storageKey('skill', id))
        setNotice({ tone: 'success', message: t('pluginSkillAdded', { path: result.path }) })
      }
      setCustomName('')
      setCustomDescription('')
      setCustomCommand('')
      setCustomArgs('')
      setCustomConfig('')
      setCustomSkillBody('')
      setCustomOpen(false)
    } catch (e) {
      setNotice({ tone: 'error', message: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusyId(null)
    }
  }

  const openManageTarget = async (): Promise<void> => {
    try {
      if (activeKind === 'mcp') {
        const result = await window.dsGui.openDeepseekConfigDir()
        if (!result.ok) setNotice({ tone: 'error', message: result.message ?? t('pluginActionFailed') })
        return
      }
      if (!selectedSkillRoot?.path) {
        setNotice({ tone: 'error', message: t('pluginSkillRootMissing') })
        return
      }
      const result = await window.dsGui.openSkillRoot(selectedSkillRoot.path)
      if (!result.ok) setNotice({ tone: 'error', message: result.message ?? t('pluginActionFailed') })
    } catch (e) {
      setNotice({ tone: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <div className="ds-no-drag h-full min-h-0 overflow-y-auto px-6 py-7 md:px-10 lg:px-14">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-ds-subtle p-1">
            <TabButton active={activeKind === 'mcp'} onClick={() => setActiveKind('mcp')}>
              {t('pluginTabMcp')}
            </TabButton>
            <TabButton active={activeKind === 'skill'} tone="skill" onClick={() => setActiveKind('skill')}>
              {t('pluginTabSkill')}
            </TabButton>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void openManageTarget()}
              className="inline-flex items-center gap-2 rounded-xl bg-ds-subtle px-3 py-2 text-[13px] font-semibold text-ds-ink transition hover:bg-ds-hover"
            >
              <Settings className="h-4 w-4" strokeWidth={1.75} />
              {t('pluginManage')}
            </button>
            <button
              type="button"
              onClick={() => setCustomOpen((value) => !value)}
              className="inline-flex items-center gap-2 rounded-xl bg-ds-userbubble px-3 py-2 text-[13px] font-semibold text-ds-userbubbleFg shadow-sm transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" strokeWidth={1.9} />
              {t('pluginCreate')}
            </button>
          </div>
        </div>

        <div className="mt-9 flex flex-col items-center text-center">
          <h1 className="text-[32px] font-semibold text-ds-ink md:text-[40px]">
            {activeKind === 'mcp' ? t('pluginMcpTitle') : t('pluginSkillTitle')}
          </h1>
        </div>

        <div className="mt-9 flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-2xl border border-ds-border bg-ds-card pl-11 pr-4 text-[15px] text-ds-ink shadow-sm outline-none transition focus:border-accent/40 focus:ring-1 focus:ring-accent/30"
              placeholder={activeKind === 'mcp' ? t('pluginSearchMcp') : t('pluginSearchSkill')}
            />
          </label>
          <label className="relative w-full md:w-[168px]">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as PluginFilter)}
              className="h-11 w-full appearance-none rounded-2xl border border-ds-border bg-ds-card px-4 pr-9 text-[15px] font-medium text-ds-ink shadow-sm outline-none transition focus:border-accent/40 focus:ring-1 focus:ring-accent/30"
            >
              <option value="all">{t('pluginFilterAll')}</option>
              <option value="recommended">{t('pluginFilterRecommended')}</option>
              <option value="installed">{t('pluginFilterInstalled')}</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-faint" />
          </label>
        </div>

        {activeKind === 'skill' ? (
          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center">
            <select
              value={selectedSkillRoot?.id ?? ''}
              onChange={(event) => setSkillRootId(event.target.value as SkillRootId)}
              className="h-10 rounded-xl border border-ds-border bg-ds-card px-3 text-[13px] text-ds-ink shadow-sm outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/30"
            >
              {skillRootOptions.map((option) => (
                <option key={option.id} value={option.id} disabled={!option.available}>
                  {option.available ? option.label : `${option.label} · ${t('pluginSkillRootNeedsWorkspace')}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void openManageTarget()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-ds-border bg-ds-card px-3 text-[13px] font-medium text-ds-ink shadow-sm transition hover:bg-ds-hover"
            >
              <FolderOpen className="h-4 w-4" />
              {t('pluginOpenLocation')}
            </button>
          </div>
        ) : null}

        {customOpen ? (
          <CustomPluginPanel
            activeKind={activeKind}
            customName={customName}
            customDescription={customDescription}
            customCommand={customCommand}
            customArgs={customArgs}
            customConfig={customConfig}
            customSkillBody={customSkillBody}
            busy={busyId === `custom:${activeKind}`}
            onNameChange={setCustomName}
            onDescriptionChange={setCustomDescription}
            onCommandChange={setCustomCommand}
            onArgsChange={setCustomArgs}
            onConfigChange={setCustomConfig}
            onSkillBodyChange={setCustomSkillBody}
            onAdd={() => void addCustom()}
          />
        ) : null}

        {notice ? <NoticeView notice={notice} /> : null}

        {showSplit ? (
          <>
            <PluginSection
              title={t('pluginRecommended')}
              emptyText={t('pluginNoResults')}
              items={recommendedItems}
              busyId={busyId}
              isInstalled={isInstalled}
              onAdd={addItem}
              onToggle={activeKind === 'mcp' ? toggleMcpServer : undefined}
              isDisabled={activeKind === 'mcp' ? isMcpDisabled : undefined}
              expandedPanel={activeKind === 'mcp' ? expandedPanel : undefined}
              onPanelToggle={activeKind === 'mcp' ? togglePanel : undefined}
              t={t}
            />
            {hasAnyInstalled ? (
              <PluginSection
                title={t('pluginPersonal')}
                emptyText={t('pluginPersonalEmpty')}
                items={personalItems}
                busyId={busyId}
                isInstalled={isInstalled}
                onAdd={addItem}
                onToggle={activeKind === 'mcp' ? toggleMcpServer : undefined}
                isDisabled={activeKind === 'mcp' ? isMcpDisabled : undefined}
                expandedPanel={activeKind === 'mcp' ? expandedPanel : undefined}
                onPanelToggle={activeKind === 'mcp' ? togglePanel : undefined}
                t={t}
              />
            ) : null}
          </>
        ) : (
          <PluginSection
            title={filter === 'installed' ? t('pluginPersonal') : t('pluginRecommended')}
            emptyText={filter === 'installed' ? t('pluginPersonalEmpty') : t('pluginNoResults')}
            items={filter === 'installed' ? personalItems : recommendedItems}
            busyId={busyId}
            isInstalled={isInstalled}
            onAdd={addItem}
            onToggle={activeKind === 'mcp' ? toggleMcpServer : undefined}
            isDisabled={activeKind === 'mcp' ? isMcpDisabled : undefined}
            expandedPanel={activeKind === 'mcp' ? expandedPanel : undefined}
            onPanelToggle={activeKind === 'mcp' ? togglePanel : undefined}
            t={t}
          />
        )}

        {expandedPanel ? (
          <div className="mt-6">
            {expandedPanel.panel === 'status' ? (
              <McpStatusDashboard
                installedIds={installedMcpIds}
                onClose={() => setExpandedPanel(null)}
              />
            ) : expandedPanel.panel === 'log' ? (
              <McpLogViewer
                serverNames={installedMcpNames}
                onClose={() => setExpandedPanel(null)}
              />
            ) : expandedPanel.panel === 'env' ? (
              <McpEnvManager
                serverId={expandedPanel.itemKey.replace('mcp:', '')}
                serverLabel={installedMcpNames[installedMcpIds.indexOf(expandedPanel.itemKey.replace('mcp:', ''))] ?? expandedPanel.itemKey}
                onClose={() => setExpandedPanel(null)}
                onUpdated={() => {
                  readMcpConfig().catch(() => {})
                }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function TabButton({
  active,
  tone = 'default',
  onClick,
  children
}: {
  active: boolean
  tone?: 'default' | 'skill'
  onClick: () => void
  children: string
}): ReactElement {
  const activeClass =
    tone === 'skill'
      ? 'bg-ds-skill-soft text-ds-skill shadow-sm'
      : 'bg-ds-card text-ds-ink shadow-sm'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-[15px] font-semibold transition ${
        active ? activeClass : 'text-ds-muted hover:text-ds-ink'
      }`}
    >
      {children}
    </button>
  )
}

type PanelType = 'status' | 'log' | 'env'

function PluginSection({
  title,
  emptyText,
  items,
  busyId,
  isInstalled,
  onAdd,
  onToggle,
  isDisabled,
  expandedPanel,
  onPanelToggle,
  t
}: {
  title: string
  emptyText: string
  items: MarketplaceItem[]
  busyId: string | null
  isInstalled: (item: Pick<MarketplaceItem, 'kind' | 'id'>) => boolean
  onAdd: (item: MarketplaceItem) => Promise<void>
  onToggle?: (id: string) => Promise<void>
  isDisabled?: (id: string) => boolean
  expandedPanel?: { itemKey: string; panel: PanelType } | null
  onPanelToggle?: (itemKey: string, panel: PanelType) => void
  t: (key: string, values?: Record<string, unknown>) => string
}): ReactElement {
  return (
    <section className="mt-8">
      <h2 className="border-b border-ds-border-muted pb-3 text-[20px] font-semibold text-ds-ink">
        {title}
      </h2>
      {items.length === 0 ? (
        <div className="py-8 text-[14px] text-ds-faint">{emptyText}</div>
      ) : (
        <div className="grid gap-x-14 md:grid-cols-2">
          {items.map((item) => {
            const itemKey = storageKey(item.kind, item.id)
            const installed = isInstalled(item)
            const busy = busyId === itemKey
            return (
              <div
                key={itemKey}
                className="flex min-h-[92px] items-center gap-5 border-b border-ds-border-muted py-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[17px] font-semibold text-ds-ink">
                    {t(item.titleKey)}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[14px] leading-5 text-ds-muted">
                    {t(item.descriptionKey)}
                  </p>
                  {!installed && item.prerequisites && item.prerequisites.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.prerequisites.map((req) => (
                        <span
                          key={req}
                          className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
                        >
                          {req}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={installed || busy}
                  onClick={() => void onAdd(item)}
                  title={installed ? t('pluginAdded') : t('pluginAdd')}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                    installed
                      ? 'text-ds-faint'
                      : 'bg-ds-subtle text-ds-ink hover:bg-ds-hover disabled:opacity-60'
                  }`}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  ) : installed ? (
                    <Check className="h-4 w-4" strokeWidth={2} />
                  ) : (
                    <Plus className="h-4 w-4" strokeWidth={2} />
                  )}
                </button>
                {installed && item.kind === 'mcp' && onToggle && isDisabled ? (
                    <button
                      type="button"
                      key={`toggle-${itemKey}`}
                      onClick={() => void onToggle(item.id)}
                      title={isDisabled(item.id) ? t('pluginMcpEnable') : t('pluginMcpDisable')}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                        isDisabled(item.id)
                          ? 'text-amber-600 hover:bg-amber-500/10 dark:text-amber-400'
                          : 'text-ds-muted hover:bg-ds-hover hover:text-ds-ink'
                      }`}
                    >
                      {isDisabled(item.id) ? (
                        <PowerOff className="h-3.5 w-3.5" strokeWidth={2} />
                      ) : (
                        <Power className="h-3.5 w-3.5" strokeWidth={2} />
                      )}
                    </button>
                ) : null}
                {installed && item.kind === 'mcp' && onPanelToggle ? (
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onPanelToggle(itemKey, 'status')}
                      title={t('pluginMcpViewStatus')}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                        expandedPanel?.itemKey === itemKey && expandedPanel?.panel === 'status'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'text-ds-faint hover:bg-ds-hover hover:text-ds-ink'
                      }`}
                    >
                      <Server className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onPanelToggle(itemKey, 'log')}
                      title={t('pluginMcpViewLog')}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                        expandedPanel?.itemKey === itemKey && expandedPanel?.panel === 'log'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'text-ds-faint hover:bg-ds-hover hover:text-ds-ink'
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onPanelToggle(itemKey, 'env')}
                      title={t('pluginMcpViewEnv')}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                        expandedPanel?.itemKey === itemKey && expandedPanel?.panel === 'env'
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          : 'text-ds-faint hover:bg-ds-hover hover:text-ds-ink'
                      }`}
                    >
                      <Key className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function CustomPluginPanel({
  activeKind,
  customName,
  customDescription,
  customCommand,
  customArgs,
  customConfig,
  customSkillBody,
  busy,
  onNameChange,
  onDescriptionChange,
  onCommandChange,
  onArgsChange,
  onConfigChange,
  onSkillBodyChange,
  onAdd
}: {
  activeKind: PluginKind
  customName: string
  customDescription: string
  customCommand: string
  customArgs: string
  customConfig: string
  customSkillBody: string
  busy: boolean
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onCommandChange: (value: string) => void
  onArgsChange: (value: string) => void
  onConfigChange: (value: string) => void
  onSkillBodyChange: (value: string) => void
  onAdd: () => void
}): ReactElement {
  const { t } = useTranslation('common')
  return (
    <section className="mt-6 rounded-2xl border border-ds-border bg-ds-card/95 p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <input
          value={customName}
          onChange={(event) => onNameChange(event.target.value)}
          className="h-10 rounded-xl border border-ds-border bg-ds-main/45 px-3 text-[14px] text-ds-ink outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/30"
          placeholder={t('pluginCustomName')}
        />
        <input
          value={customDescription}
          onChange={(event) => onDescriptionChange(event.target.value)}
          className="h-10 rounded-xl border border-ds-border bg-ds-main/45 px-3 text-[14px] text-ds-ink outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/30"
          placeholder={t('pluginCustomDescription')}
        />
      </div>
      {activeKind === 'mcp' ? (
        <div className="mt-3 grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={customCommand}
              onChange={(event) => onCommandChange(event.target.value)}
              className="h-10 rounded-xl border border-ds-border bg-ds-main/45 px-3 text-[14px] text-ds-ink outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/30"
              placeholder={t('pluginCustomCommand')}
            />
            <textarea
              value={customArgs}
              onChange={(event) => onArgsChange(event.target.value)}
              className="min-h-[80px] rounded-xl border border-ds-border bg-ds-main/45 px-3 py-2 font-mono text-[13px] leading-5 text-ds-ink outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/30"
              placeholder={t('pluginCustomArgs')}
              spellCheck={false}
            />
          </div>
          <textarea
            value={customConfig}
            onChange={(event) => onConfigChange(event.target.value)}
            className="min-h-[120px] rounded-xl border border-ds-border bg-ds-main/45 px-3 py-2 font-mono text-[13px] leading-5 text-ds-ink outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/30"
            placeholder={t('pluginCustomMcpConfig')}
            spellCheck={false}
          />
        </div>
      ) : (
        <textarea
          value={customSkillBody}
          onChange={(event) => onSkillBodyChange(event.target.value)}
          className="mt-3 min-h-[140px] w-full rounded-xl border border-ds-border bg-ds-main/45 px-3 py-2 font-mono text-[13px] leading-5 text-ds-ink outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/30"
          placeholder={t('pluginCustomSkillBody')}
          spellCheck={false}
        />
      )}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onAdd}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-ds-userbubble px-4 py-2 text-[13px] font-semibold text-ds-userbubbleFg shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Plus className="h-4 w-4" strokeWidth={2} />}
          {t('pluginAddCustom')}
        </button>
      </div>
    </section>
  )
}

function NoticeView({ notice }: { notice: Notice }): ReactElement {
  const className =
    notice.tone === 'error'
      ? 'border-red-300/80 bg-red-50 text-red-800 dark:border-red-800/70 dark:bg-red-950/25 dark:text-red-200'
      : notice.tone === 'success'
        ? 'border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/25 dark:text-emerald-200'
        : 'border-ds-border bg-ds-subtle text-ds-muted'
  return (
    <div className={`mt-4 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-[13px] leading-5 ${className}`}>
      <span>{notice.message}</span>
      {notice.actionLabel && notice.onAction && (
        <button
          type="button"
          onClick={notice.onAction}
          className="shrink-0 rounded-lg bg-white/60 px-2.5 py-1 text-[12px] font-semibold shadow-sm transition hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/15"
        >
          {notice.actionLabel}
        </button>
      )}
    </div>
  )
}
