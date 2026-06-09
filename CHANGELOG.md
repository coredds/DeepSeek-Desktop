# Changelog

## [0.2.0] — 2026-06-08

### Removed
- Write mode (markdown editor, FIM completion, export, templates).
- Claw mode (IM bot automation, Feishu/Lark integration, scheduled tasks).
- Pure Chat route — merged into single chat mode; no workspace required to chat.
- Deep Think / Smart Search toggles from the composer.
- Mode tab switcher from the sidebar.
- Suggestion cards from the empty-state hero page.

### Changed
- Single chat interface with workspace file I/O, terminal, git, and plugin marketplace.
- Sidebar header: whale logo icon replaces "DeepSeek Desktop" text.
- Section headings now compact ("3 tools" instead of "Used 3 tools").
- Settings sidebar footer shows "Local AI desktop" tagline.
- Ctrl+N creates a new thread from any view (sets route before creating).

### Fixed
- Thread deletion no longer blocks the composer (archiveThread now auto-selects a remaining thread).
- Missing `settingsFooter` i18n key now renders properly.

## [0.1.1] — 2026-06-01

### Added
- Keyboard shortcut overlay (`?` key) showing all available shortcuts.
- Workspace health indicators in the connection status bar.
- Write template system.
- Platform-aware shortcut display.
- One-click "Try with a sample workspace" during initial setup.
- DeepSeek Desktop app identity injected into all messages.
- WhatsApp MCP server in Plugin Marketplace.
- MCP prerequisite badges and "Configure" button flow.
- GitHub Actions CI workflow.
- CHANGELOG.md.

### Changed
- Simplified onboarding: removed redundant language picker.
- Runtime startup progress spinner during initial setup.
- GitHub, Brave Search, and Context7 MCP snippets now include active env lines.
- Repository uses `develop` branch for PRs, `master` for stable releases.

### Fixed
- "New Agent" button shortcut display always showed Mac `⌘` regardless of platform.
- Write mode: "New Draft" button required double-click when no workspace was set.
- Write mode: truncated files blocked switching to any other file.
- Fixed ESLint warnings.
- Removed stale maintainer email from SECURITY.md and CODE_OF_CONDUCT.md.

## [0.1.0] — 2026-05-31

Initial release forked from DeepSeek GUI. Code, Write, and Claw workbench modes. DeepSeek TUI HTTP/SSE integration. Markdown live editing. Feishu/Lark IM integration. Terminal with command palette. Settings: API key, base URL, theme, approval policy, MCP config, skills. Plugin marketplace. Electron-based desktop shell.
