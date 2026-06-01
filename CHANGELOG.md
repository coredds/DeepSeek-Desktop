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

### Changed
- Simplified onboarding: removed redundant single-option language picker.
- Runtime startup progress shown during initial setup (spinner while TUI initializes).

### Fixed
- "New Agent" button shortcut display always showed Mac `⌘` regardless of platform.

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
