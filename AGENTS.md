# AGENTS.md — DeepSeek Desktop

## Build & Verify

```bash
npm run dev          # Dev server with hot reload (electron-vite)
npm run build        # Production build
npm run typecheck    # TypeScript check (tsconfig.web.json + tsconfig.node.json)
npm run test         # Vitest (src/**/*.test.ts)
npm run lint         # ESLint
```

## Architecture

### Process Model (Electron)

```
┌─────────────────────────────────────────────┐
│ Main Process (src/main/index.ts)            │
│  - BrowserWindow management                 │
│  - DeepSeek TUI child process lifecycle      │
│  - SSE streaming to renderer                │
│  - IPC handlers (ipc/register-app-ipc-*)    │
│  - Settings persistence (electron-store)     │
│  - Claw background runtime                  │
│  - Services: terminal, git, workspace, write │
├─────────────────────────────────────────────┤
│ Preload (src/preload/index.ts)              │
│  - contextBridge → window.dsGui             │
│  - ~50 typed IPC methods                    │
├─────────────────────────────────────────────┤
│ Renderer (src/renderer/)                    │
│  - React 19 SPA with Zustand state          │
│  - Tailwind CSS 4 + PostCSS                 │
│  - i18n (i18next, en only)                  │
│  - Routes: chat, write, settings, plugins,  │
│    claw (custom route state, not React      │
│    Router)                                  │
└─────────────────────────────────────────────┘
```

### Data Flow

1. User sends message → renderer calls `window.dsGui.runtimeRequest()` → main proxies to DeepSeek TUI HTTP API on localhost
2. Streaming: renderer calls `window.dsGui.startSse(threadId)` → main opens SSE to `localhost:{port}/v1/threads/{id}/events` → forwards events via IPC
3. Settings: changes persist via `electron-store` → `deepseek-desktop-settings.json` in userData
4. File I/O: renderer calls `window.dsGui.readFile()` etc. → main uses Node.js `fs`

### Key Files

| File | Purpose |
|---|---|
| `src/main/index.ts` | Main process entry (startup, window, IPC wiring) |
| `src/main/ipc/register-app-ipc-handlers.ts` | All IPC handler registration |
| `src/main/settings-store.ts` | JSON settings persistence (electron-store) |
| `src/main/deepseek-process.ts` | DeepSeek TUI child process management |
| `src/main/deepseek-updater.ts` | TUI binary updater (npm-based) |
| `src/main/claw-runtime.ts` | Claw background automation |
| `src/preload/index.ts` | Context bridge (window.dsGui API) |
| `src/renderer/src/App.tsx` | React entry → AppShell |
| `src/renderer/src/AppShell.tsx` | Router: Workbench or SettingsView |
| `src/renderer/src/store/chat-store.ts` | Central Zustand store (~2200 lines) |
| `src/renderer/src/components/Workbench.tsx` | Main workbench (Code/Write/Claw) |
| `src/renderer/src/components/SettingsView.tsx` | Full settings panel |
| `src/shared/app-settings.ts` | Settings types, defaults, normalization |
| `src/shared/ds-gui-api.ts` | Full DsGuiApi type (preload → renderer contract) |

### Shared Directory (`src/shared/`)

Types shared between main and renderer. Imported as `@shared/*` (tsconfig paths alias). Never imports from `src/main/` or `src/renderer/`.

## Conventions

- **State**: Zustand stores in `src/renderer/src/store/`. Main process has no state library — uses closures and module-level variables.
- **IPC**: Zod schemas in `src/main/ipc/app-ipc-schemas.ts`. Handlers registered in `register-app-ipc-handlers.ts`. Preload exposes typed methods matching `DsGuiApi` in `src/shared/ds-gui-api.ts`.
- **CSS**: Tailwind utility classes + custom CSS variables (`--ds-*` prefix). Component-specific styles in `src/renderer/src/index.css`.
- **i18n**: Keys in `src/renderer/src/locales/en/`. Single namespace per domain: `common.json`, `settings.json`. Use `useTranslation('common')` or `useTranslation('settings')`.
- **Testing**: Vitest. Test files co-located with source: `*.test.ts`. Run `npm run test`.
- **No React Router**: Route state is `route: 'chat' | 'write' | 'settings' | 'plugins' | 'claw'` in the Zustand chat store.
- **localStorage keys**: All prefixed `deepseekdesktop.*`.
- **Data directory**: `~/.deepseekdesktop/` (userData for Electron, plus write workspaces and claw channels).
