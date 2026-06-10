import { dialog, ipcMain, shell, type BrowserWindow, type WebContents } from 'electron'
import { watch, type FSWatcher } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { z } from 'zod'
import type { AppSettingsPatch, AppSettingsV1 } from '../../shared/app-settings'
import type { DeepseekUpdateInfo, DeepseekUpdateInstallResult } from '../../shared/deepseek-update'
import type {
  DeepseekRuntimeDiagnosticIssue,
  DeepseekRuntimeDiagnosticsResult,
  McpEnvDeleteResult,
  McpEnvListResult,
  McpEnvSetResult,
  RuntimeRequestResult,
  SystemNotificationResult,
  TurnCompleteNotificationPayload,
  UpstreamModelsResult,
  WorkspacePickResult
} from '../../shared/ds-gui-api'
import {
  deepseekConfigContentSchema,
  defaultPathSchema,
  gitBranchPayloadSchema,
  logErrorPayloadSchema,
  mcpEnvDeletePayloadSchema,
  mcpEnvSetPayloadSchema,
  mcpServerIdSchema,
  notificationPayloadSchema,
  openEditorPathPayloadSchema,
  rootPathSchema,
  runtimeRequestPayloadSchema,
  shellOpenExternalUrlSchema,
  skillSaveFilePayloadSchema,
  streamIdSchema,
  terminalCreateOptionsSchema,
  terminalInputPayloadSchema,
  terminalLifecyclePayloadSchema,
  terminalResizePayloadSchema,
  workspaceDirectoryCreatePayloadSchema,
  workspaceClipboardImageSavePayloadSchema,
  workspaceDirectoryTargetPayloadSchema,
  workspaceEntryDeletePayloadSchema,
  workspaceEntryRenamePayloadSchema,
  workspaceFileCreatePayloadSchema,
  workspaceFileTargetPayloadSchema,
  workspaceFileWatchPayloadSchema,
  workspaceFileWritePayloadSchema,
  workspaceRootSchema,
  describeImagesPayloadSchema,
  exportMarkdownPayloadSchema
} from './app-ipc-schemas'
import type { JsonSettingsStore } from '../settings-store'
import { getRuntimeBaseUrl } from '../settings-store'
import { findListeningProcessOnPort, getRuntimeOutput } from '../deepseek-process'
import { createAndSwitchGitBranch, getGitBranches, switchGitBranch } from '../services/git-service'
import { getWorkspaceHealth } from '../services/workspace-health-service'
import {
  createWorkspaceDirectory,
  createWorkspaceFile,
  deleteWorkspaceEntry,
  expandHomePath,
  listEditorsResult,
  listWorkspaceDirectory,
  normalizeSkillFolderName,
  openEditorPath,
  openPathWithShell,
  readWorkspaceImage,
  readWorkspaceFile,
  renameWorkspaceEntry,
  resolveWorkspaceFile,
  saveWorkspaceClipboardImage,
  writeWorkspaceFile
} from '../services/workspace-service'
import type { createTerminalService } from '../services/terminal-service'

type TerminalService = ReturnType<typeof createTerminalService>

type WorkspaceFileWatchRecord = {
  watcher: FSWatcher
  sender: WebContents
  path: string
  workspaceRoot: string
  timer: ReturnType<typeof setTimeout> | null
}

type RegisterAppIpcHandlersOptions = {
  store: JsonSettingsStore
  getMainWindow: () => BrowserWindow | null
  applySettingsPatch: (partial: AppSettingsPatch) => Promise<AppSettingsV1>
  runtimeRequest: (
    path: string,
    method?: string,
    body?: string
  ) => Promise<RuntimeRequestResult>
  fetchUpstreamModels: () => Promise<UpstreamModelsResult>
  prepareDeepseekBinary: () => Promise<
    { ok: true; path: string } | { ok: false; message: string }
  >
  checkDeepseekUpdate: () => Promise<DeepseekUpdateInfo>
  installDeepseekUpdate: () => Promise<DeepseekUpdateInstallResult>
  resolveDeepseekConfigPath: () => string
  terminalService: TerminalService
  showTurnCompleteNotification: (
    payload: TurnCompleteNotificationPayload
  ) => Promise<SystemNotificationResult>
  getAppVersion: () => string
  resolveLogDirectory: () => string
  logError: (category: string, message: string, detail?: unknown) => void
  restartRuntime: () => Promise<void>
}

function parseIpcPayload<T>(channel: string, schema: z.ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload)
  if (parsed.success) return parsed.data
  const issue = parsed.error.issues[0]
  throw new Error(`Invalid payload for ${channel}: ${issue?.message ?? 'Bad request.'}`)
}

const settingsPatchSchema = z.object({}).passthrough()

function trimDiagnosticBody(body: string, max = 2_000): string {
  const text = body.trim()
  if (text.length <= max) return text
  return `${text.slice(0, max)}…`
}

function detectTomlConfigIssues(path: string, content: string): DeepseekRuntimeDiagnosticIssue[] {
  const issues: DeepseekRuntimeDiagnosticIssue[] = []
  const tables = new Map<string, number>()
  const lines = content.split(/\r?\n/)

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^\[([^\][\r\n]+)\]\s*(?:#.*)?$/)
    if (!match) continue
    const tableName = match[1].trim()
    const firstLine = tables.get(tableName)
    if (typeof firstLine === 'number') {
      issues.push({
        severity: 'error',
        code: 'duplicate_toml_table',
        title: 'Duplicate TOML table',
        message: `[${tableName}] is declared again on line ${index + 1}. TOML tables can only be declared once; merge or remove the duplicate block.`,
        path,
        line: index + 1
      })
      continue
    }
    tables.set(tableName, index + 1)
  }

  return issues
}

async function probeRuntimeEndpoint(url: string): Promise<{
  ok: boolean
  status: number
  body: string
  message?: string
}> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2_000) })
    return {
      ok: res.ok,
      status: res.status,
      body: trimDiagnosticBody(await res.text())
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: '',
      message: error instanceof Error ? error.message : String(error)
    }
  }
}

async function diagnoseDeepseekRuntime(
  options: Pick<RegisterAppIpcHandlersOptions, 'store' | 'prepareDeepseekBinary' | 'resolveDeepseekConfigPath'>
): Promise<DeepseekRuntimeDiagnosticsResult> {
  const settings = await options.store.load()
  const configPath = options.resolveDeepseekConfigPath()
  let configContent = ''
  let configExists = true
  try {
    configContent = await readFile(configPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      configExists = false
    } else {
      throw error
    }
  }

  const configIssues = detectTomlConfigIssues(configPath, configContent)
  const binary = await options.prepareDeepseekBinary()
  const baseUrl = getRuntimeBaseUrl(settings.deepseek.port)
  const portOwner = await findListeningProcessOnPort(settings.deepseek.port)
  const health = await probeRuntimeEndpoint(`${baseUrl}/health`)
  const threadApi = health.ok
    ? await probeRuntimeEndpoint(`${baseUrl}/v1/threads?limit=1`)
    : null
  const issues: DeepseekRuntimeDiagnosticIssue[] = [...configIssues]

  if (!settings.deepseek.apiKey.trim() && !process.env.DEEPSEEK_API_KEY?.trim()) {
    issues.push({
      severity: 'error',
      code: 'missing_api_key',
      title: 'Missing DeepSeek API key',
      message: 'The GUI cannot auto-start the local runtime until a DeepSeek API key is configured.'
    })
  }

  if (!settings.deepseek.autoStart) {
    issues.push({
      severity: 'warning',
      code: 'auto_start_disabled',
      title: 'Automatic runtime startup is disabled',
      message: 'Enable auto-start or run `deepseek serve --http` manually before retrying the connection.'
    })
  }

  if (!binary.ok) {
    issues.push({
      severity: 'error',
      code: 'binary_unavailable',
      title: 'deepseek CLI is unavailable',
      message: binary.message
    })
  }

  if (!portOwner) {
    issues.push({
      severity: settings.deepseek.autoStart ? 'info' : 'warning',
      code: 'runtime_not_listening',
      title: 'No runtime is listening on the configured port',
      message: `Nothing is listening on ${baseUrl}. Retry will ask the GUI to start the managed runtime.`
    })
  } else if (!portOwner.command.toLowerCase().includes('deepseek')) {
    issues.push({
      severity: 'warning',
      code: 'port_owned_by_other_process',
      title: 'Configured port is owned by another process',
      message: `Port ${settings.deepseek.port} is currently owned by PID ${portOwner.pid}: ${portOwner.command}`
    })
  }

  if (health.ok && threadApi && !threadApi.ok) {
    issues.push({
      severity: threadApi.status === 401 ? 'error' : 'warning',
      code: threadApi.status === 401 ? 'runtime_auth_required' : 'thread_api_unavailable',
      title: threadApi.status === 401 ? 'Runtime token mismatch' : 'Thread API check failed',
      message: threadApi.body || threadApi.message || `Thread API returned ${threadApi.status}.`
    })
  }

  return {
    checkedAt: new Date().toISOString(),
    settings: {
      port: settings.deepseek.port,
      autoStart: settings.deepseek.autoStart,
      binaryPath: settings.deepseek.binaryPath,
      baseUrl: settings.deepseek.baseUrl,
      approvalPolicy: settings.deepseek.approvalPolicy,
      sandboxMode: settings.deepseek.sandboxMode,
      hasApiKey: Boolean(settings.deepseek.apiKey.trim() || process.env.DEEPSEEK_API_KEY?.trim()),
      hasRuntimeToken: Boolean(settings.deepseek.runtimeToken.trim())
    },
    binary,
    config: {
      path: configPath,
      exists: configExists,
      content: configContent,
      issues: configIssues
    },
    runtime: {
      baseUrl,
      portOwner,
      health,
      threadApi
    },
    issues
  }
}

const LOOKAHEAD_NEXT_SECTION = '(?=\\r?\\n\\[|\\r?\\n*$)'

function parseTomlEnvBlock(config: string, serverId: string): string | null {
  const escaped = serverId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `\\[mcp_servers\\."${escaped}"\\][\\s\\S]*?${LOOKAHEAD_NEXT_SECTION}`,
    'i'
  )
  const match = config.match(pattern)
  return match ? match[0] : null
}

function parseTomlInlineEnv(line: string): Array<{ key: string; value: string }> {
  const results: Array<{ key: string; value: string }> = []
  const entryRe = /([A-Za-z_]\w*)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([^,\s}]+))/g
  let m: RegExpExecArray | null
  while ((m = entryRe.exec(line)) !== null) {
    const raw = m[2] ?? m[3] ?? m[4] ?? ''
    const value = m[2] !== undefined
      ? raw.replace(/\\(.)/g, '$1')
      : raw
    results.push({ key: m[1], value })
  }
  return results
}

function tomlBasicString(value: string): string {
  let result = ''
  for (let i = 0; i < value.length; i += 1) {
    const c = value[i]
    if (c === '\\') result += '\\\\'
    else if (c === '"') result += '\\"'
    else if (c === '\n') result += '\\n'
    else if (c === '\r') result += '\\r'
    else if (c === '\t') result += '\\t'
    else result += c
  }
  return result
}

function serializeTomlEnv(vars: Array<{ key: string; value: string }>): string {
  if (vars.length === 0) return ''
  const entries = vars.map((v) => `${v.key} = "${tomlBasicString(v.value)}"`)
  return `env = { ${entries.join(', ')} }`
}

async function listMcpEnvVars(
  configPath: string,
  serverIdFilter?: string
): Promise<McpEnvListResult> {
  let content = ''
  try {
    content = await readFile(configPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { servers: [] }
    throw error
  }

  const blockRe = /\[mcp_servers\."([^"]+)"\]\s*\r?\n?([\s\S]*?)(?=\r?\n\[|\r?\n*$)/g
  const servers: McpEnvListResult['servers'] = []
  let blockMatch: RegExpExecArray | null
  while ((blockMatch = blockRe.exec(content)) !== null) {
    const id = blockMatch[1]
    if (serverIdFilter && id !== serverIdFilter) continue
    const blockBody = blockMatch[2]

    const commandMatch = blockBody.match(/command\s*=\s*"([^"]*)"/)
    const command = commandMatch ? commandMatch[1] : undefined

    const envVars: Array<{ key: string; value: string }> = []
    const envRe = /env\s*=\s*\{([^}]+)\}/g
    let envMatch: RegExpExecArray | null
    while ((envMatch = envRe.exec(blockBody)) !== null) {
      const parsed = parseTomlInlineEnv(envMatch[1])
      for (const entry of parsed) {
        envVars.push(entry)
      }
    }

    servers.push({ id, command, envVars })
  }

  return { servers }
}

async function setMcpEnvVar(
  configPath: string,
  serverId: string,
  key: string,
  value: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  let content = ''
  try {
    content = await readFile(configPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ok: false, message: 'Config file not found.' }
    }
    throw error
  }

  const block = parseTomlEnvBlock(content, serverId)
  if (!block) {
    return { ok: false, message: `MCP server "${serverId}" not found in config.` }
  }

  const envRe = /env\s*=\s*\{([^}]+)\}/g
  let envMatch = envRe.exec(block)
  let existingVars: Array<{ key: string; value: string }> = []
  if (envMatch) {
    existingVars = parseTomlInlineEnv(envMatch[1])
    const filtered = existingVars.filter((v) => v.key !== key)
    filtered.push({ key, value })
    existingVars = filtered
  } else {
    existingVars = [{ key, value }]
  }

  const escapedId = serverId.replace(/[.*+^?${}()|[\]\\]/g, '\\$&')
  const blockRe = new RegExp(
    `(\\[mcp_servers\\."${escapedId}"\\][\\s\\S]*?)${LOOKAHEAD_NEXT_SECTION}`,
    'i'
  )

  let newBlock = block
  if (envMatch) {
    newBlock = block.replace(envRe, serializeTomlEnv(existingVars))
  } else {
    const tableLineRe = /(\[mcp_servers\."([^"]+)"\]\s*\r?\n?)/i
    const envLine = serializeTomlEnv(existingVars)
    newBlock = block.replace(tableLineRe, `$1${envLine}\n`)
  }

  const updated = content.replace(blockRe, newBlock)
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, updated, 'utf8')
  return { ok: true }
}

async function deleteMcpEnvVar(
  configPath: string,
  serverId: string,
  key: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  let content = ''
  try {
    content = await readFile(configPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ok: false, message: 'Config file not found.' }
    }
    throw error
  }

  const block = parseTomlEnvBlock(content, serverId)
  if (!block) {
    return { ok: false, message: `MCP server "${serverId}" not found in config.` }
  }

  const envRe = /env\s*=\s*\{([^}]+)\}/g
  let envMatch = envRe.exec(block)
  if (!envMatch) {
    return { ok: true }
  }

  let existingVars = parseTomlInlineEnv(envMatch[1])
  existingVars = existingVars.filter((v) => v.key !== key)

  const escapedId = serverId.replace(/[.*+^?${}()|[\]\\]/g, '\\$&')
  const blockRe = new RegExp(
    `(\\[mcp_servers\\."${escapedId}"\\][\\s\\S]*?)${LOOKAHEAD_NEXT_SECTION}`,
    'i'
  )

  let newBlock: string
  if (existingVars.length === 0) {
    newBlock = block.replace(/\s*env\s*=\s*\{[^}]*\}\s*\r?\n?/g, '\n')
  } else {
    newBlock = block.replace(envRe, serializeTomlEnv(existingVars))
  }

  const updated = content.replace(blockRe, newBlock)
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, updated, 'utf8')
  return { ok: true }
}

export function registerAppIpcHandlers(options: RegisterAppIpcHandlersOptions): void {
  const {
    store,
    getMainWindow,
    applySettingsPatch,
    runtimeRequest,
    fetchUpstreamModels,
    prepareDeepseekBinary,
    checkDeepseekUpdate,
    installDeepseekUpdate,
    resolveDeepseekConfigPath,
    terminalService,
    showTurnCompleteNotification,
    getAppVersion,
    resolveLogDirectory,
    logError,
    restartRuntime
  } = options
  const workspaceFileWatchers = new Map<string, WorkspaceFileWatchRecord>()

  const disposeWorkspaceFileWatch = (watchId: string): boolean => {
    const record = workspaceFileWatchers.get(watchId)
    if (!record) return false
    if (record.timer) clearTimeout(record.timer)
    try {
      record.watcher.close()
    } catch (error) {
      logError('workspace-watch', 'Failed to close workspace file watcher', {
        watchId,
        message: error instanceof Error ? error.message : String(error)
      })
    }
    workspaceFileWatchers.delete(watchId)
    return true
  }

  const disposeWorkspaceFileWatchesForSender = (sender: WebContents): void => {
    for (const [watchId, record] of workspaceFileWatchers) {
      if (record.sender.id === sender.id) {
        disposeWorkspaceFileWatch(watchId)
      }
    }
  }

  const emitWorkspaceFileChange = async (watchId: string): Promise<void> => {
    const record = workspaceFileWatchers.get(watchId)
    if (!record) return
    const changedAt = new Date().toISOString()
    try {
      const result = await readWorkspaceFile({
        path: record.path,
        workspaceRoot: record.workspaceRoot
      })
      const latest = workspaceFileWatchers.get(watchId)
      if (!latest || latest.sender.isDestroyed()) return
      if (result.ok) {
        latest.sender.send('file:workspace-changed', {
          ok: true,
          watchId,
          workspaceRoot: latest.workspaceRoot,
          path: result.path,
          content: result.content,
          size: result.size,
          truncated: result.truncated,
          changedAt
        })
        return
      }
      latest.sender.send('file:workspace-changed', {
        ok: false,
        watchId,
        workspaceRoot: latest.workspaceRoot,
        path: latest.path,
        message: result.message,
        changedAt
      })
    } catch (error) {
      const latest = workspaceFileWatchers.get(watchId)
      if (!latest || latest.sender.isDestroyed()) return
      latest.sender.send('file:workspace-changed', {
        ok: false,
        watchId,
        workspaceRoot: latest.workspaceRoot,
        path: latest.path,
        message: error instanceof Error ? error.message : String(error),
        changedAt
      })
    }
  }

  const scheduleWorkspaceFileChange = (watchId: string): void => {
    const record = workspaceFileWatchers.get(watchId)
    if (!record) return
    if (record.timer) clearTimeout(record.timer)
    record.timer = setTimeout(() => {
      const latest = workspaceFileWatchers.get(watchId)
      if (!latest) return
      latest.timer = null
      void emitWorkspaceFileChange(watchId)
    }, 90)
  }

  ipcMain.handle('settings:get', async () => store.load())
  ipcMain.handle('settings:set', async (_, partial: unknown) =>
    applySettingsPatch(
      parseIpcPayload('settings:set', settingsPatchSchema, partial) as AppSettingsPatch
    )
  )

  ipcMain.handle('runtime:request', async (_, payload: unknown) => {
    const request = parseIpcPayload('runtime:request', runtimeRequestPayloadSchema, payload)
    return runtimeRequest(request.path, request.method, request.body)
  })

  ipcMain.handle('upstream:models', async () => fetchUpstreamModels())

  ipcMain.handle('vision:describe', async (_, payload: unknown) => {
    const { images } = parseIpcPayload('vision:describe', describeImagesPayloadSchema, payload)
    const settings = await store.load()

    if (!settings.deepseek.visionEnabled) {
      return { descriptions: [], diagnostics: [{ name: '', ok: false, detail: 'vision disabled' }] }
    }
    if (!settings.deepseek.apiKey.trim()) {
      return { descriptions: [], diagnostics: [{ name: '', ok: false, detail: 'no api key' }] }
    }

    return {
      descriptions: [],
      diagnostics: images.map((img) => ({ name: img.name, ok: false, detail: 'vision endpoint unavailable' }))
    }
  })

  ipcMain.handle('deepseek:prepare-binary', async () => prepareDeepseekBinary())
  ipcMain.handle('deepseek:update-check', async () => checkDeepseekUpdate())
  ipcMain.handle('deepseek:update-install', async () => installDeepseekUpdate())

  ipcMain.handle('workspace:pick-directory', async (_, defaultPath: unknown): Promise<WorkspacePickResult> => {
    const normalizedDefaultPath = parseIpcPayload(
      'workspace:pick-directory',
      z.object({ defaultPath: defaultPathSchema }).strict(),
      { defaultPath }
    ).defaultPath
    const options: Electron.OpenDialogOptions = {
      title: 'Select working directory',
      defaultPath: normalizedDefaultPath,
      properties: ['openDirectory', 'createDirectory', 'dontAddToRecent']
    }
    const mainWindow = getMainWindow()
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    return {
      canceled: result.canceled,
      path: result.canceled ? null : (result.filePaths[0] ?? null)
    }
  })

  ipcMain.handle(
    'skill:save-file',
    async (_, payload: unknown) => {
      const request = parseIpcPayload('skill:save-file', skillSaveFilePayloadSchema, payload)
      try {
        const rootPath = expandHomePath(request.rootPath)
        if (!rootPath) {
          return { ok: false as const, message: 'Skill directory is required.' }
        }
        const skillName = normalizeSkillFolderName(request.skillName)
        const skillDir = join(rootPath, skillName)
        const filePath = join(skillDir, 'SKILL.md')
        await mkdir(skillDir, { recursive: true })
        await writeFile(filePath, request.content, 'utf8')
        return { ok: true as const, path: filePath }
      } catch (error) {
        return {
          ok: false as const,
          message: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  ipcMain.handle('skill:open-root', async (_, rootPath: unknown) => {
    const normalizedRootPath = parseIpcPayload('skill:open-root', rootPathSchema, rootPath)
    try {
      const target = expandHomePath(normalizedRootPath)
      if (!target) {
        return { ok: false as const, message: 'Skill directory is required.' }
      }
      await mkdir(target, { recursive: true })
      return openPathWithShell(target)
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  })

  ipcMain.handle('deepseek:config:read', async () => {
    const path = resolveDeepseekConfigPath()
    try {
      const content = await readFile(path, 'utf8')
      return { path, content, exists: true as const }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { path, content: '', exists: false as const }
      }
      throw error
    }
  })

  ipcMain.handle('deepseek:config:write', async (_, content: unknown) => {
    const validatedContent = parseIpcPayload(
      'deepseek:config:write',
      deepseekConfigContentSchema,
      content
    )
    const path = resolveDeepseekConfigPath()
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, validatedContent, 'utf8')
    void restartRuntime().catch((e: unknown) => {
      logError('mcp-config-restart', 'Runtime restart after MCP config write failed', e)
    })
    return { ok: true as const, path }
  })

  ipcMain.handle('deepseek:config:open-dir', async () => {
    try {
      const path = resolveDeepseekConfigPath()
      const dirPath = dirname(path)
      await mkdir(dirPath, { recursive: true })
      return openPathWithShell(dirPath)
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  })

  ipcMain.handle('deepseek:diagnostics', async () =>
    diagnoseDeepseekRuntime({ store, prepareDeepseekBinary, resolveDeepseekConfigPath })
  )

  ipcMain.handle('mcp:runtime-output', async () => {
    return { output: getRuntimeOutput() }
  })

  ipcMain.handle('mcp:env:list', async (_, serverId: unknown) => {
    const filter = parseIpcPayload('mcp:env:list', mcpServerIdSchema.optional(), serverId)
    return listMcpEnvVars(resolveDeepseekConfigPath(), filter)
  })

  ipcMain.handle('mcp:env:set', async (_, payload: unknown) => {
    const req = parseIpcPayload('mcp:env:set', mcpEnvSetPayloadSchema, payload)
    const result = await setMcpEnvVar(resolveDeepseekConfigPath(), req.serverId, req.key, req.value)
    if (result.ok) {
      void restartRuntime().catch((e: unknown) => {
        logError('mcp-env-restart', 'Runtime restart after MCP env var set failed', e)
      })
    }
    return result
  })

  ipcMain.handle('mcp:env:delete', async (_, payload: unknown) => {
    const req = parseIpcPayload('mcp:env:delete', mcpEnvDeletePayloadSchema, payload)
    const result = await deleteMcpEnvVar(resolveDeepseekConfigPath(), req.serverId, req.key)
    if (result.ok) {
      void restartRuntime().catch((e: unknown) => {
        logError('mcp-env-restart', 'Runtime restart after MCP env var delete failed', e)
      })
    }
    return result
  })

  ipcMain.handle('git:branches', async (_, workspaceRoot: unknown) =>
    getGitBranches(parseIpcPayload('git:branches', workspaceRootSchema, workspaceRoot))
  )
  ipcMain.handle(
    'git:switch-branch',
    async (_, payload: unknown) => {
      const request = parseIpcPayload('git:switch-branch', gitBranchPayloadSchema, payload)
      return switchGitBranch(request.workspaceRoot, request.branch)
    }
  )
  ipcMain.handle(
    'git:create-and-switch-branch',
    async (_, payload: unknown) => {
      const request = parseIpcPayload(
        'git:create-and-switch-branch',
        gitBranchPayloadSchema,
        payload
      )
      return createAndSwitchGitBranch(request.workspaceRoot, request.branch)
    }
  )

  ipcMain.handle('workspace:health', async (_, workspaceRoot: unknown) =>
    getWorkspaceHealth(parseIpcPayload('workspace:health', workspaceRootSchema, workspaceRoot))
  )

  ipcMain.handle('editor:list', async () => listEditorsResult())
  ipcMain.handle('editor:open-path', async (_, payload: unknown) =>
    openEditorPath(parseIpcPayload('editor:open-path', openEditorPathPayloadSchema, payload))
  )

  ipcMain.handle('terminal:create', async (event, payload: unknown) =>
    terminalService.createTerminalSession(
      event.sender,
      parseIpcPayload('terminal:create', terminalCreateOptionsSchema, payload)
    )
  )
  ipcMain.handle('terminal:write', async (_, payload: unknown) =>
    terminalService.writeTerminalSession(
      parseIpcPayload('terminal:write', terminalInputPayloadSchema, payload)
    )
  )
  ipcMain.handle('terminal:resize', async (_, payload: unknown) =>
    terminalService.resizeTerminalSession(
      parseIpcPayload('terminal:resize', terminalResizePayloadSchema, payload)
    )
  )
  ipcMain.handle('terminal:close', async (_, payload: unknown) =>
    terminalService.closeTerminalSession(
      parseIpcPayload('terminal:close', terminalLifecyclePayloadSchema, payload)
    )
  )

  ipcMain.handle('file:resolve-workspace', async (_, payload: unknown) =>
    resolveWorkspaceFile(
      parseIpcPayload('file:resolve-workspace', workspaceFileTargetPayloadSchema, payload)
    )
  )
  ipcMain.handle('file:list-workspace-directory', async (_, payload: unknown) =>
    listWorkspaceDirectory(
      parseIpcPayload('file:list-workspace-directory', workspaceDirectoryTargetPayloadSchema, payload)
    )
  )
  ipcMain.handle('file:read-workspace', async (_, payload: unknown) =>
    readWorkspaceFile(
      parseIpcPayload('file:read-workspace', workspaceFileTargetPayloadSchema, payload)
    )
  )
  ipcMain.handle('file:read-workspace-image', async (_, payload: unknown) =>
    readWorkspaceImage(
      parseIpcPayload('file:read-workspace-image', workspaceFileTargetPayloadSchema, payload)
    )
  )
  ipcMain.handle('file:write-workspace', async (_, payload: unknown) =>
    writeWorkspaceFile(
      parseIpcPayload('file:write-workspace', workspaceFileWritePayloadSchema, payload)
    )
  )
  ipcMain.handle('file:create-workspace', async (_, payload: unknown) =>
    createWorkspaceFile(
      parseIpcPayload('file:create-workspace', workspaceFileCreatePayloadSchema, payload)
    )
  )
  ipcMain.handle('file:create-workspace-directory', async (_, payload: unknown) =>
    createWorkspaceDirectory(
      parseIpcPayload('file:create-workspace-directory', workspaceDirectoryCreatePayloadSchema, payload)
    )
  )
  ipcMain.handle('file:save-workspace-clipboard-image', async (_, payload: unknown) =>
    saveWorkspaceClipboardImage(
      parseIpcPayload(
        'file:save-workspace-clipboard-image',
        workspaceClipboardImageSavePayloadSchema,
        payload
      )
    )
  )
  ipcMain.handle('file:rename-workspace-entry', async (_, payload: unknown) =>
    renameWorkspaceEntry(
      parseIpcPayload('file:rename-workspace-entry', workspaceEntryRenamePayloadSchema, payload)
    )
  )
  ipcMain.handle('file:delete-workspace-entry', async (_, payload: unknown) =>
    deleteWorkspaceEntry(
      parseIpcPayload('file:delete-workspace-entry', workspaceEntryDeletePayloadSchema, payload)
    )
  )
  ipcMain.handle('file:watch-workspace', async (event, payload: unknown) => {
    const request = parseIpcPayload('file:watch-workspace', workspaceFileWatchPayloadSchema, payload)
    const initial = await readWorkspaceFile(request)
    let watchedPath: string
    let initialContent: string
    let initialSize: number
    let initialTruncated: boolean
    if (initial.ok) {
      watchedPath = initial.path
      initialContent = initial.content
      initialSize = initial.size
      initialTruncated = initial.truncated
    } else {
      const initialImage = await readWorkspaceImage(request)
      if (!initialImage.ok) return initial
      watchedPath = initialImage.path
      initialContent = ''
      initialSize = initialImage.size
      initialTruncated = false
    }

    const watchId = randomUUID()
    try {
      const watcher = watch(watchedPath, { persistent: false }, () => {
        scheduleWorkspaceFileChange(watchId)
      })
      workspaceFileWatchers.set(watchId, {
        watcher,
        sender: event.sender,
        path: watchedPath,
        workspaceRoot: request.workspaceRoot,
        timer: null
      })
      event.sender.once('destroyed', () => disposeWorkspaceFileWatchesForSender(event.sender))
      return {
        ok: true as const,
        watchId,
        path: watchedPath,
        content: initialContent,
        size: initialSize,
        truncated: initialTruncated,
        startedAt: new Date().toISOString()
      }
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  })
  ipcMain.handle('file:unwatch-workspace', async (_, watchId: unknown) =>
    disposeWorkspaceFileWatch(parseIpcPayload('file:unwatch-workspace', streamIdSchema, watchId))
  )
  ipcMain.handle('shell:open-external', async (_, url: unknown) => {
    const validatedUrl = parseIpcPayload('shell:open-external', shellOpenExternalUrlSchema, url)
    await shell.openExternal(validatedUrl)
  })
  ipcMain.handle('notification:turn-complete', async (_, payload: unknown) =>
    showTurnCompleteNotification(
      parseIpcPayload('notification:turn-complete', notificationPayloadSchema, payload)
    )
  )
  ipcMain.handle(
    'export:save-markdown',
    async (_, payload: unknown) => {
      const request = parseIpcPayload('export:save-markdown', exportMarkdownPayloadSchema, payload)
      const mainWindow = getMainWindow()
      const result = mainWindow
        ? await dialog.showSaveDialog(mainWindow, {
            title: 'Export conversation as Markdown',
            defaultPath: request.defaultName,
            filters: [{ name: 'Markdown', extensions: ['md'] }]
          })
        : await dialog.showSaveDialog({
            title: 'Export conversation as Markdown',
            defaultPath: request.defaultName,
            filters: [{ name: 'Markdown', extensions: ['md'] }]
          })
      if (result.canceled || !result.filePath) {
        return { ok: false as const, message: 'Cancelled' }
      }
      try {
        await writeFile(result.filePath, request.content, 'utf8')
        return { ok: true as const, path: result.filePath }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false as const, message }
      }
    }
  )

  ipcMain.handle('app:version', async () => getAppVersion())
  ipcMain.handle('log:error', async (_, payload: unknown) => {
    const request = parseIpcPayload('log:error', logErrorPayloadSchema, payload)
    logError(request.category, request.message, request.detail)
  })
  ipcMain.handle('log:get-path', async () => resolveLogDirectory())
  ipcMain.handle('log:open-dir', async () => {
    const dir = resolveLogDirectory()
    try {
      await mkdir(dir, { recursive: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, message }
    }
    const error = await shell.openPath(dir)
    if (error) return { ok: false, message: error }
    return { ok: true }
  })
  ipcMain.handle('window:focus', async () => {
    getMainWindow()?.focus()
  })
}
