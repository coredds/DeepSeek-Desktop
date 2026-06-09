# Roadmap

## Now — Polish (v0.2.x)

- [x] Streamlined to single chat mode — no mode switching, one consistent interface.
- [x] Whale logo in sidebar header replacing verbose branding.
- [x] Clean empty-state hero with no suggestion cards.
- [x] Section headings simplified (compact tool counts instead of verbose sentences).
- [x] Removed non-functional Deep Think / Smart Search toggles.
- [x] Fixed thread deletion locking the composer.
- [x] Ctrl+N correctly creates a thread from any view.

## Next — Skills & MCP (v0.3)

Goal: make finding, installing, and managing skills and MCP servers a first-class experience.

### Plugin discoverability
- [ ] **Featured & curated feed** — highlighted community skills/MCPs with descriptions, ratings, and install counts surfaced in the marketplace.
- [ ] **Search with results** — free-text search across plugin names, descriptions, and tags.
- [ ] **One-click install** — install a plugin without navigating to separate config editors.
- [ ] **Post-install guidance** — after installing an MCP server, show required env vars inline and a "Configure" button to fill them in.

### Skill management
- [ ] **Skill editor** — create and edit skills directly in the app (not through external file editing).
- [ ] **Skill validation** — validate SKILL.md format, required fields, and YAML frontmatter on creation/save.
- [ ] **Skill folders browser** — pick from local skill directories; add and remove folders without typing paths.
- [ ] **Built-in skill library** — bundle a set of useful default skills (project scaffolding, git workflows, code review checklists).

### MCP management
- [ ] **MCP status dashboard** — see which MCP servers are running, their health, and recent errors.
- [ ] **MCP log viewer** — view stdout/stderr from running MCP servers inline.
- [ ] **Env var management** — edit environment variables per MCP server in a structured form (not raw JSON).
- [ ] **Quick-add snippets** — paste a GitHub URL or `npx` command; the app parses and creates the MCP config entry.

### Plugin registry
- [ ] **Community registry** — GitHub-backed plugin index with versioned manifests.
- [ ] **Plugin manifest format** — `deepseek-plugin.json` schema: name, description, MCP config, skills, compatibility.
- [ ] **Auto-update** — check registry for new versions of installed plugins.

## Later — Power tools (v0.4+)

- [ ] **Dev server integration** — auto-detect `npm run dev`, preview panel, HMR reflection.
- [ ] **PR review workflow** — paste GitHub/GitLab PR URL, agent reviews diff and surfaces findings.
- [ ] **Plugin/extension system** — community plugin registry with `deepseek-plugin.json` manifest format.
- [ ] **Agent presets** — save and restore agent configurations (model, skills, MCPs, workspace) as named profiles.

### Guidelines

- **No cloud sync or accounts** — local-first is a feature.
- **No desktop automation / screen control** — scope risk outweighs utility.
- **No built-in model serving** — model infrastructure belongs upstream.
- **No auto-update** — not needed until stable releases and distribution channels exist.
