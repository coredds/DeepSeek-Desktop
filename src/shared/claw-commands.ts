import type { ClawModel } from './app-settings'

export type ClawCommand =
  | { kind: 'clear' }
  | { kind: 'help' }
  | { kind: 'showModel' }
  | { kind: 'model'; model: ClawModel }
  | { kind: 'invalidModel' }

export function parseClawCommand(text: string): ClawCommand | null {
  const raw = text.trim()
  const lower = raw.toLowerCase()
  if (['/clear', '/reset', '/new'].includes(lower)) {
    return { kind: 'clear' }
  }
  if (['/help'].includes(lower)) {
    return { kind: 'help' }
  }
  const match = raw.match(/^\/(?:model)(?:\s+(.+))?$/i)
  if (!match) return null
  const value = (match[1] ?? '').trim().toLowerCase()
  if (!value) return { kind: 'showModel' }
  if (value === 'auto') return { kind: 'model', model: 'auto' }
  if (value === 'pro' || value === 'deepseek-v4-pro') {
    return { kind: 'model', model: 'deepseek-v4-pro' }
  }
  if (value === 'flash' || value === 'deepseek-v4-flash') {
    return { kind: 'model', model: 'deepseek-v4-flash' }
  }
  return { kind: 'invalidModel' }
}
