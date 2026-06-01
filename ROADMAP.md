# Roadmap

## Phase 1 — Polish (immediate) ✓

Goal: reduce friction, improve first impressions. No new architecture.

- [x] **AGENTS.md** — codebase map, build commands, architecture overview (`AGENTS.md`)
- [x] **Simplified onboarding** — removed single-option language picker, added one-click "Try with sample workspace", runtime startup progress spinner (`InitialSetupDialog.tsx`)
- [x] **Keyboard shortcut panel** — press `?` anywhere for quick-reference overlay of all shortcuts (`KeyboardShortcutPanel.tsx`); shortcuts display `⌘`/`Ctrl` based on platform
- [x] **Workspace health indicator** — git dirty-file count, large-file warnings (>100 MB in workspace root), low-disk alerts (<1 GB free) in the connection status bar (`ConnectionStatusBar.tsx`, `workspace-health-service.ts`)

## Phase 2 — Differentiate (1–2 sprints)

Goal: features no other desktop agent has.

### Write mode upgrade
- [x] **Template system** — `~/.deepseekdesktop/templates/` directory; `.md` templates with YAML frontmatter appear in Write mode's "From template" section (`WriteTemplatePicker.tsx`, `template-service.ts`)
- [ ] **Git-backed version history** — per writing space, "History" button shows `git log -- <file>` and allows restoring previous versions via existing git-service

### Claw mode expansion
- [ ] **Discord webhook provider** — new IM provider using Discord webhook API; reuses existing Claw channel/agent infrastructure
- [ ] **Slack webhook provider** — new IM provider using Slack Incoming Webhooks; same architecture

### Terminal upgrade
- [x] **Terminal command palette** — `Ctrl+Shift+P` shows npm script suggestions, recently run commands, "explain this error" action (`TerminalCommandPalette.tsx`, `AppTerminalPanel.tsx`)

## Phase 3 — Power tools (2–3 sprints)

Goal: close gaps with commercial desktops without sacrificing local-first identity.

- [ ] **Dev server integration** — auto-detect `npm run dev` success (done: `dev-preview-detection.ts`), preview panel (done: `DevBrowserPanel.tsx`); pending: dev server console output in side panel, HMR event reflection
- [ ] **PR review workflow** — paste GitHub/GitLab PR URL → checkout branch → send structured diff to agent → surface findings in change inspector
- [ ] **Plugin/extension system** — define `deepseek-plugin.json` manifest format (MCP servers, skills, shortcuts, slash commands); community plugin registry (GitHub-based); MCP + skill marketplace already exists (`PluginMarketplaceView.tsx`)

### Guidelines

- **No cloud sync or accounts** — local-first is a feature, not a gap
- **No desktop automation / screen control** — scope risk and security surface don't justify the complexity
- **No built-in model serving** — the app wraps the TUI runtime; model infrastructure belongs upstream
- **No auto-update** — not needed until the project has stable releases and distribution channels
