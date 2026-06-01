# Changelog

## [0.1.1] — 2026-06-01

### Added
- Keyboard shortcut overlay (`?` key) showing all available shortcuts.
- Workspace health indicators in the connection status bar:
  - Git dirty file count.
  - Large file warnings (files >100 MB in workspace root).
  - Low disk space alerts (below 1 GB free).
- Write template system: templates loaded from `~/.deepseekdesktop/templates/` with YAML frontmatter support (title, description, filename).
- Platform-aware shortcut display: shows `⌘` on macOS, `Ctrl` on Windows/Linux.
- One-click "Try with a sample workspace" during initial setup.
- DeepSeek Desktop app identity injected into all messages so the AI correctly describes the app.
- WhatsApp MCP server in Plugin Marketplace.
- MCP prerequisite badges on marketplace items (env vars shown before install).
- "Configure" button after installing MCP servers that need env vars (opens Settings → MCP config).
- GitHub Actions CI workflow (typecheck, lint, test, build).
- CHANGELOG.md.

### Changed
- Simplified onboarding: removed redundant single-option language picker.
- Runtime startup progress shown during initial setup (spinner while TUI initializes).
- GitHub, Brave Search, and Context7 MCP snippets now include active (uncommented) env lines with placeholder values.
- Repository structured with `develop` branch for PRs, `master` for stable releases.

### Fixed
- "New Agent" button shortcut display always showed Mac `⌘` regardless of platform.
- Write mode: "New Draft" button required double-click when no workspace was set.
- Write mode: truncated files blocked switching to any other file (flushSave deadlock removed).
- Fixed two ESLint warnings (missing useCallback dependency, unnecessary useMemo dependency).
- Removed stale maintainer email from SECURITY.md and CODE_OF_CONDUCT.md.
- Fixed issue template references from "DeepSeek GUI" to "DeepSeek Desktop".

## [0.1.0] — 2026-05-31

Initial release forked from DeepSeek GUI.

### Features
- Code, Write, and Claw workbench modes.
- DeepSeek TUI HTTP/SSE integration.
- Markdown live editing with FIM completion (Write mode).
- Feishu / Lark IM integration (Claw mode).
- Terminal with command palette.
- Settings: API key, base URL, theme, approval policy, MCP config, skills.
- Plugin marketplace (MCP servers and skills).
- Electron-based desktop shell (macOS, Windows, Linux).
