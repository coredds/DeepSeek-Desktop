import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import {
  DEFAULT_DEEPSEEK_BASE_URL,
  normalizeAppSettings,
  type AppSettingsPatch,
  type AppSettingsV1
} from '../shared/app-settings'

export type { AppSettingsV1 }

const DEFAULT_WORKSPACE_ROOT = join(homedir(), '.deepseekdesktop', 'default_workspace')

function expandHomePath(raw: string | null | undefined): string {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return ''
  if (value === '~') return homedir()
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return join(homedir(), value.slice(2))
  }
  return value
}

function normalizeWorkspaceRoot(raw: string | null | undefined): string {
  return expandHomePath(raw) || DEFAULT_WORKSPACE_ROOT
}

function normalizeStoredSettings(settings: AppSettingsV1): AppSettingsV1 {
  const normalized = normalizeAppSettings(settings)
  return {
    ...normalized,
    workspaceRoot: normalizeWorkspaceRoot(normalized.workspaceRoot)
  }
}

async function ensureWorkspaceRootExists(workspaceRoot: string): Promise<void> {
  if (workspaceRoot !== DEFAULT_WORKSPACE_ROOT) return
  await mkdir(workspaceRoot, { recursive: true })
}

const defaultSettings = (): AppSettingsV1 => ({
  version: 1,
  locale: 'en',
  theme: 'system',
  uiFontScale: 'small',
  agentProvider: 'deepseek-runtime',
  deepseek: {
    binaryPath: '',
    port: 7878,
    autoStart: true,
    apiKey: '',
    baseUrl: DEFAULT_DEEPSEEK_BASE_URL,
    runtimeToken: '',
    extraCorsOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    visionEnabled: true,
    // `serve --http` defaults to prompting for write tools, but the GUI has no
    // native terminal prompt. Default to auto so GUI turns can send the runtime
    // `auto_approve: true`; users can tighten this from Settings if needed.
    approvalPolicy: 'auto',
    sandboxMode: 'workspace-write'
  },
  workspaceRoot: DEFAULT_WORKSPACE_ROOT,
  log: {
    enabled: true,
    retentionDays: 2
  },
  notifications: {
    turnComplete: true
  }
})

function buildMergedSettings(parsed: Partial<AppSettingsV1>): AppSettingsV1 {
  const defaults = defaultSettings()
  return {
    ...defaults,
    ...parsed,
    deepseek: { ...defaults.deepseek, ...parsed.deepseek },
    log: { ...defaults.log, ...parsed.log },
    notifications: { ...defaults.notifications, ...parsed.notifications },
    agentProvider: 'deepseek-runtime'
  }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null
}

async function loadDefaultSettings(): Promise<AppSettingsV1> {
  const defaults = normalizeStoredSettings(defaultSettings())
  await ensureWorkspaceRootExists(defaults.workspaceRoot)
  return defaults
}

async function writeInvalidSettingsBackup(path: string, raw: string): Promise<string | null> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = join(
    dirname(path),
    `${basename(path, '.json')}.invalid-${stamp}.json`
  )
  try {
    await writeFile(backupPath, raw, 'utf8')
    return backupPath
  } catch {
    return null
  }
}

export class JsonSettingsStore {
  private path: string
  private cache: AppSettingsV1 | null = null

  constructor(userDataPath: string) {
    this.path = join(userDataPath, 'deepseek-desktop-settings.json')
  }

  async load(): Promise<AppSettingsV1> {
    if (this.cache) return this.cache

    let raw = ''
    try {
      raw = await readFile(this.path, 'utf8')
    } catch (error) {
      if (isErrnoException(error) && error.code === 'ENOENT') {
        this.cache = await loadDefaultSettings()
        return this.cache
      }
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to read settings file ${this.path}: ${message}`, { cause: error })
    }

    let parsed: Partial<AppSettingsV1>
    try {
      parsed = JSON.parse(raw) as Partial<AppSettingsV1>
    } catch (error) {
      if (error instanceof SyntaxError) {
        const backupPath = await writeInvalidSettingsBackup(this.path, raw)
        const defaults = await loadDefaultSettings()
        await this.save(defaults)
        if (backupPath) {
          console.warn(
            `[deepseek-desktop] Invalid settings JSON was replaced with defaults. Backup: ${backupPath}`
          )
        } else {
          console.warn(
            `[deepseek-desktop] Invalid settings JSON was replaced with defaults. Backup could not be written for ${this.path}.`
          )
        }
        return defaults
      }
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to parse settings file ${this.path}: ${message}`, { cause: error })
    }

    const normalized = normalizeStoredSettings(buildMergedSettings(parsed))
    await ensureWorkspaceRootExists(normalized.workspaceRoot)
    this.cache = normalized
    return this.cache
  }

  async save(data: AppSettingsV1): Promise<void> {
    const normalized = normalizeStoredSettings(data)
    await ensureWorkspaceRootExists(normalized.workspaceRoot)
    this.cache = normalized
    await mkdir(dirname(this.path), { recursive: true })
    await writeFile(this.path, JSON.stringify(normalized, null, 2), 'utf8')
  }

  async patch(partial: AppSettingsPatch): Promise<AppSettingsV1> {
    const cur = await this.load()
    const next = normalizeStoredSettings({
      ...cur,
      ...partial,
      deepseek: { ...cur.deepseek, ...(partial.deepseek ?? {}) },
      log: { ...cur.log, ...(partial.log ?? {}) },
      notifications: { ...cur.notifications, ...(partial.notifications ?? {}) },
      agentProvider: 'deepseek-runtime'
    })
    await this.save(next)
    return next
  }
}

export function getRuntimeBaseUrl(port: number): string {
  return `http://127.0.0.1:${port}`
}

export function devServerHintUrl(): string | undefined {
  return process.env.ELECTRON_RENDERER_URL
}
