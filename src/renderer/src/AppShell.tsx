import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useChatStore } from './store/chat-store'

const Workbench = lazy(() =>
  import('./components/Workbench').then((module) => ({ default: module.Workbench }))
)
const SettingsView = lazy(() =>
  import('./components/SettingsView').then((module) => ({ default: module.SettingsView }))
)
const InitialSetupDialog = lazy(() =>
  import('./components/InitialSetupDialog').then((module) => ({
    default: module.InitialSetupDialog
  }))
)
const KeyboardShortcutPanel = lazy(() =>
  import('./components/KeyboardShortcutPanel').then((module) => ({
    default: module.KeyboardShortcutPanel
  }))
)

function RouteFallback(): React.ReactElement {
  return <div className="h-full bg-ds-main" />
}

export default function AppShell(): React.ReactElement {
  const route = useChatStore((s) => s.route)
  const boot = useChatStore((s) => s.boot)
  const initialSetupOpen = useChatStore((s) => s.initialSetupOpen)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const closeShortcuts = useCallback(() => setShortcutsOpen(false), [])

  useEffect(() => {
    let frame = 0
    const timer = window.setTimeout(() => {
      frame = window.requestAnimationFrame(() => {
        void boot()
      })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [boot])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement | null
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
        e.preventDefault()
        setShortcutsOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="h-full min-h-0 bg-transparent">
      <Suspense fallback={<RouteFallback />}>
        {route === 'settings' ? <SettingsView /> : <Workbench />}
      </Suspense>
      {initialSetupOpen ? (
        <Suspense fallback={null}>
          <InitialSetupDialog />
        </Suspense>
      ) : null}
      <Suspense fallback={null}>
        <KeyboardShortcutPanel open={shortcutsOpen} onClose={closeShortcuts} />
      </Suspense>
    </div>
  )
}
