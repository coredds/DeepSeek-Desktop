# Roadmap

## Phase 1 — Polish (immediate)

Goal: reduce friction, improve first impressions. No new architecture.

- [ ] **AGENTS.md** — codebase map, build commands, architecture overview so AI tools (including DeepSeek Desktop itself) can navigate the project
- [ ] **Simplified onboarding** — remove language picker, add one-click "Try with sample workspace" that creates a demo project, show runtime startup progress
- [ ] **Keyboard shortcut panel** — press `?` anywhere to see all shortcuts in a quick-reference overlay (data already exists in settings JSON)
- [ ] **Workspace health indicator** — surface git dirty-file count, large-file warnings, and low-disk-space alerts in the connection status bar

## Phase 2 — Differentiate (1–2 sprints)

Goal: features no other desktop agent has.

### Write mode upgrade
- [ ] **Template system** — `~/.deepseekdesktop/templates/` directory; templates with YAML frontmatter appear in the "New file" dialog
- [ ] **Git-backed version history** — per writing space, "History" button shows `git log -- <file>` and allows restoring previous versions via existing git-service

### Claw mode expansion
- [ ] **Discord webhook provider** — new IM provider using Discord webhook API; reuses existing Claw channel/agent infrastructure
- [ ] **Slack webhook provider** — new IM provider using Slack Incoming Webhooks; same architecture

### Terminal upgrade
- [ ] **Terminal command palette** — `Ctrl+Shift+P` shows workspace-aware suggestions (npm scripts, make targets), recently run commands, "explain this error" action that sends last output to the agent

## Phase 3 — Power tools (2–3 sprints)

Goal: close gaps with commercial desktops without sacrificing local-first identity.

- [ ] **Dev server integration** — auto-detect `npm run dev` success, offer one-click preview; surface dev server console output in side panel; reflect HMR events
- [ ] **PR review workflow** — "Review PR" quick-start card: paste a GitHub/GitLab PR URL → checkout branch → send structured diff to agent → surface findings in change inspector
- [ ] **Plugin/extension system** — define `deepseek-plugin.json` manifest format: MCP servers to register, skills to install, keyboard shortcuts, custom slash commands; a community plugin registry (GitHub-based, file-tree driven)

### Guidelines

- **No cloud sync or accounts** — local-first is a feature, not a gap
- **No desktop automation / screen control** — scope risk and security surface don't justify the complexity
- **No built-in model serving** — the app wraps the TUI runtime; model infrastructure belongs upstream
- **No auto-update** — not needed until the project has stable releases and distribution channels
