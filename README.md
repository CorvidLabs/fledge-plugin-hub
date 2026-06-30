# fledge-plugin-hub

Local web dashboard for fledge — manage your install and inspect the project you're working in.

## Install as fledge plugin

```bash
fledge plugins install CorvidLabs/fledge-plugin-hub
cd your-project
fledge hub
```

Visit <http://localhost:3800>. Set `FLEDGE_HUB_PORT` to use a different port.

## Run standalone

```bash
bun install
bun run start
```

## Features

### Project (current working directory)

- Project name, version, language, branch, recent commits, working tree
- Tasks from `fledge.toml` — one-click run with output panel
- Lanes from `fledge.toml` — one-click run with output panel
- Open repo in browser

### Global (your fledge install)

- **Store** — browse plugins and templates from GitHub with faceted filtering (topic, language, author, license); install / update / remove from the UI
- **Installed** — manage installed plugins
- **Config** — global fledge configuration
- **Doctor** — environment diagnostics with structured pass/warn/fail view

## Development

```bash
bun install
bun run dev          # start with --watch for live reload
bun test             # run unit tests
bun run typecheck    # type-check without emitting
```

## Requirements

- [Bun](https://bun.sh) runtime
- [fledge](https://github.com/CorvidLabs/fledge) CLI on PATH

## Replaces

This plugin supersedes [`fledge-plugin-dashboard`](https://github.com/CorvidLabs/fledge-plugin-dashboard) (project view) by combining its project-scoped surface with global plugin / template management.
