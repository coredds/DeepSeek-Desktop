# DeepSeek Desktop

<p align="center">
  <a href="https://github.com/coredds/DeepSeek-Desktop/actions/workflows/ci.yml"><img src="https://github.com/coredds/DeepSeek-Desktop/actions/workflows/ci.yml/badge.svg?branch=develop" alt="CI"></a>
  <a href="https://github.com/coredds/DeepSeek-Desktop/releases"><img src="https://img.shields.io/github/package-json/v/coredds/DeepSeek-Desktop" alt="Version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/coredds/DeepSeek-Desktop" alt="License"></a>
</p>

A local-first desktop workbench for the DeepSeek agent. Pick a workspace folder, chat with the agent, and let it read files, run commands, switch git branches — all through a clean graphical interface.

Built on [DeepSeek TUI](https://github.com/Hmbown/DeepSeek-TUI), wrapping the terminal agent into a long-lived desktop app with streamed reasoning, file review, terminal access, and a plugin marketplace for skills and MCP servers.

---

## What It Does

- **Chat with context** — pick any folder as a workspace; the agent can browse files, run CLI tools, manage git, and edit content across your project.
- **Streamed reasoning** — watch tool calls, thinking, and file changes as they happen.
- **Built-in terminal** — toggle a terminal panel attached to your workspace directory.
- **Change review** — diff viewer and inspector panel for file modifications.
- **Plugin marketplace** — discover and install MCP servers and skills to extend the agent's capabilities.
- **OpenAI-compatible** — works with any provider matching the DeepSeek/OpenAI API shape; set a custom base URL in Settings.

---

## Install

### Download

[GitHub Releases](https://github.com/coredds/DeepSeek-Desktop/releases):

| Platform | Package |
| --- | --- |
| macOS | `.dmg` or `.zip`, Intel and Apple Silicon |
| Windows | `.exe`, NSIS installer, x64 |

Linux users can build from source.

On first launch, enter your [DeepSeek API key](https://platform.deepseek.com/api_keys).

### From Source

```bash
git clone https://github.com/coredds/DeepSeek-Desktop.git
cd DeepSeek-Desktop
npm install
npm run dev
```

Requirements: Node.js 20+, a DeepSeek API key.

---

## Usage

1. Open the app and enter your API key.
2. Pick a workspace folder (any project directory).
3. Type your prompt and send.
4. The agent reads files, runs commands, makes changes — you review diffs in the inspector panel.
5. Press `?` for keyboard shortcuts; `Ctrl+N` for a new thread.

**Settings** covers API key, base URL, runtime port, approval policy, sandbox mode, theme, and skill/MCP configuration.

**Plugins** lets you browse and install MCP servers and skills from the marketplace.

---

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Ctrl+N` / `⌘N` | New thread |
| `Ctrl+B` / `⌘B` | Toggle sidebar |
| `Ctrl+J` / `⌘J` | Toggle terminal |
| `Ctrl+\` / `⌘\` | Toggle right panel |
| `?` | Show all shortcuts |
| `Enter` | Send message |
| `Shift+Enter` | Newline |
| `Esc` | Close panel / overlay |

---

## Local Build

```bash
npm run build           # production build
npm run dist:mac        # macOS packages
npm run dist:win        # Windows installer
```

---

## Contributing

Contributions welcome. See [CONTRIBUTING.md](./docs/CONTRIBUTING.md) and [DEVELOPMENT.md](./docs/DEVELOPMENT.md).

Run `npm run typecheck`, `npm run build`, and `npm run test` before opening a PR.

---

## Uninstall

**Windows**: Settings → Apps → Installed apps → DeepSeek Desktop → Uninstall.

**macOS**: Move `DeepSeek Desktop.app` to Trash.

To remove local data: delete `%APPDATA%\DeepSeek Desktop` (Windows) or `~/Library/Application Support/DeepSeek Desktop` (macOS).

---

## Acknowledgments

- [DeepSeek GUI](https://github.com/XingYu-Zhong/DeepSeek-GUI) — this project is forked from their work. MIT.
- [DeepSeek TUI](https://github.com/Hmbown/DeepSeek-TUI) — the local agent runtime.
- [DeepSeek](https://github.com/deepseek-ai) — for the models and API.

> [!NOTE]
> This project is not affiliated with DeepSeek Inc.

## License

[MIT](./LICENSE)
