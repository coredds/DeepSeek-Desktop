import { type ReactElement, useCallback, useEffect, useMemo, useState } from 'react'
import { Terminal, Play, Bug } from 'lucide-react'
import { useChatStore } from '../store/chat-store'

type Props = {
  open: boolean
  onClose: () => void
  onRun: (command: string) => void
}

type CommandItem = {
  id: string
  label: string
  command: string
  category: 'npm' | 'recent' | 'action'
  icon: typeof Terminal
}

const RECENT_COMMANDS_KEY = 'deepseekdesktop.terminal.recentCommands'
const MAX_RECENT = 10

function loadRecentCommands(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_COMMANDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string').slice(0, MAX_RECENT)
    return []
  } catch {
    return []
  }
}

function saveRecentCommand(cmd: string): void {
  const recent = loadRecentCommands().filter((c) => c !== cmd)
  recent.unshift(cmd)
  localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
}

export function TerminalCommandPalette({ open, onClose, onRun }: Props): ReactElement | null {
  const workspaceRoot = useChatStore((s) => s.workspaceRoot)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const [npmScripts, setNpmScripts] = useState<Array<{ name: string; command: string }>>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentCommands, setRecentCommands] = useState<string[]>([])

  useEffect(() => {
    if (open) setRecentCommands(loadRecentCommands())
  }, [open])

  useEffect(() => {
    if (!open || !workspaceRoot) return
    let cancelled = false
    async function load() {
      try {
        const result = await window.dsGui.readWorkspaceFile({
          workspaceRoot,
          path: 'package.json'
        })
        if (cancelled || !result.ok) return
        const pkg = JSON.parse(result.content) as Record<string, unknown>
        const scripts = pkg.scripts
        if (scripts && typeof scripts === 'object') {
          setNpmScripts(
            Object.entries(scripts as Record<string, string>)
              .filter(([, v]) => typeof v === 'string')
              .map(([name, command]) => ({ name, command: `npm run ${name}` }))
          )
        }
      } catch {
        if (!cancelled) setNpmScripts([])
      }
    }
    void load()
    return () => { cancelled = true }
  }, [open, workspaceRoot])

  const items = useMemo<CommandItem[]>(() => {
    const result: CommandItem[] = []
    for (const script of npmScripts) {
      result.push({ id: `npm:${script.name}`, label: script.name, command: script.command, category: 'npm', icon: Play })
    }
    for (const cmd of recentCommands.slice(0, 5)) {
      result.push({ id: `recent:${cmd}`, label: cmd, command: cmd, category: 'recent', icon: Terminal })
    }
    result.push({ id: 'action:explain', label: 'Send last error to agent', command: '', category: 'action', icon: Bug })
    return result
  }, [npmScripts, recentCommands])

  useEffect(() => { setSelectedIndex(0) }, [items])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, items.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[selectedIndex]
      if (!item) return
      if (item.id === 'action:explain') {
        sendMessage('I got an error in the terminal. Can you help me understand what went wrong and suggest a fix?')
        onClose()
        return
      }
      saveRecentCommand(item.command)
      onRun(item.command)
      onClose()
    }
  }, [items, selectedIndex, onClose, onRun, sendMessage])

  useEffect(() => {
    if (!open) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  if (!open) return null

  const categories = [
    { key: 'npm' as const, label: 'NPM Scripts' },
    { key: 'recent' as const, label: 'Recent' },
    { key: 'action' as const, label: 'Actions' }
  ]

  return (
    <div
      className="absolute inset-x-0 bottom-12 z-50 mx-auto max-w-lg px-4"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="overflow-hidden rounded-xl border border-ds-border-strong bg-ds-card shadow-[0_24px_72px_rgba(15,23,42,0.28)]">
        <div className="border-b border-ds-border px-3 py-2">
          <input
            readOnly
            value=""
            placeholder="Select a command..."
            className="w-full bg-transparent text-[13px] text-ds-muted outline-none placeholder:text-ds-faint"
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto p-1">
          {categories.map((cat) => {
            const catItems = items.filter((i) => i.category === cat.key)
            if (catItems.length === 0) return null
            return (
              <div key={cat.key}>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-ds-faint">
                  {cat.label}
                </div>
                {catItems.map((item) => {
                  const idx = items.indexOf(item)
                  const selected = idx === selectedIndex
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition ${
                        selected
                          ? 'bg-accent/10 text-accent'
                          : 'text-ds-ink hover:bg-ds-hover'
                      }`}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onMouseDown={() => {
                        if (item.id === 'action:explain') {
                          sendMessage('I got an error in the terminal. Can you help me understand what went wrong and suggest a fix?')
                        } else {
                          saveRecentCommand(item.command)
                          onRun(item.command)
                        }
                        onClose()
                      }}
                    >
                      <item.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                      <span className="truncate">{item.label}</span>
                      {item.command ? (
                        <span className="ml-auto shrink-0 truncate pl-2 font-mono text-[11px] text-ds-faint">
                          {item.command}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div className="border-t border-ds-border px-3 py-1.5 text-[10px] text-ds-faint">
          <kbd className="rounded-[3px] border border-ds-border bg-ds-subtle px-1 py-0.5 text-[9px]">↑↓</kbd> navigate &middot; <kbd className="rounded-[3px] border border-ds-border bg-ds-subtle px-1 py-0.5 text-[9px]">Enter</kbd> run &middot; <kbd className="rounded-[3px] border border-ds-border bg-ds-subtle px-1 py-0.5 text-[9px]">Esc</kbd> close
        </div>
      </div>
    </div>
  )
}
