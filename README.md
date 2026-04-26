# fledge-plugin-hub

Local web dashboard for browsing and managing fledge templates, plugins, lanes, and config.

## Install as fledge plugin

```bash
fledge plugins install CorvidLabs/fledge-plugin-hub
fledge hub
```

## Run standalone

```bash
bun install
bun run start
# → http://localhost:3800
```

## Development

```bash
bun run dev
```

## Features

- **Overview** — command tree, stats at a glance
- **Plugins** — browse installed plugins, search for new ones
- **Templates** — discover available project templates
- **Lanes** — visualize workflow pipelines from fledge.toml
- **Config** — view global fledge configuration
- **Doctor** — run environment diagnostics

## Requirements

- [Bun](https://bun.sh) runtime
- [fledge](https://github.com/CorvidLabs/fledge) CLI installed and on PATH
