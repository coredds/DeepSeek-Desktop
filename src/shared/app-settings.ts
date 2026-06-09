export type ApprovalPolicy = 'on-request' | 'untrusted' | 'never' | 'auto' | 'suggest'
export type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access' | 'external-sandbox'
export type UiFontScale = 'small' | 'medium' | 'large'

export const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com/beta'

export type DeepseekSettingsV1 = {
  binaryPath: string
  port: number
  autoStart: boolean
  apiKey: string
  baseUrl: string
  runtimeToken: string
  extraCorsOrigins: string[]
  visionEnabled: boolean
  approvalPolicy: ApprovalPolicy
  sandboxMode: SandboxMode
}

export type LogConfigV1 = {
  enabled: boolean
  retentionDays: number
}

export type NotificationConfigV1 = {
  turnComplete: boolean
}

export type AppSettingsV1 = {
  version: 1
  locale: 'en'
  theme: 'system' | 'light' | 'dark'
  uiFontScale: UiFontScale
  agentProvider: 'deepseek-runtime'
  deepseek: DeepseekSettingsV1
  workspaceRoot: string
  log: LogConfigV1
  notifications: NotificationConfigV1
}

export type AppSettingsPatch = Partial<
  Omit<AppSettingsV1, 'deepseek' | 'log' | 'notifications'>
> & {
  deepseek?: Partial<DeepseekSettingsV1>
  log?: Partial<LogConfigV1>
  notifications?: Partial<NotificationConfigV1>
}

export const USER_REQUEST_HEADING = '[User request]'

const DEEPSEEK_DESKTOP_APP_CONTEXT = [
  'You are running inside DeepSeek Desktop — a local-first desktop application for developers and AI users.',
  'It wraps the DeepSeek TUI agent runtime and provides a full GUI for working with files in a project workspace.',
  'Users interact with you through this GUI, which provides composer input, streamed responses,',
  'file review panels, a built-in terminal, settings, and a plugin marketplace.',
  'DeepSeek Desktop runs locally — no cloud sync, no accounts. Settings persist on the user\'s machine.',
  'When asked about the application, explain it as DeepSeek Desktop, not CodeWhale.'
].join(' ')

export function wrapWithAppContext(prompt: string): string {
  return `${DEEPSEEK_DESKTOP_APP_CONTEXT}\n\n---\n${USER_REQUEST_HEADING}\n${prompt}`
}

export function normalizeDeepseekBaseUrl(baseUrl: string | null | undefined): string {
  const trimmed = typeof baseUrl === 'string' ? baseUrl.trim() : ''
  return trimmed || DEFAULT_DEEPSEEK_BASE_URL
}

export function normalizeAppSettings(settings: AppSettingsV1): AppSettingsV1 {
  const maybeSettings = settings as AppSettingsV1 & {
    notifications?: Partial<NotificationConfigV1>
  }
  return {
    ...settings,
    deepseek: {
      ...settings.deepseek,
      baseUrl: normalizeDeepseekBaseUrl(settings.deepseek.baseUrl)
    },
    notifications: {
      turnComplete: maybeSettings.notifications?.turnComplete !== false
    }
  }
}
