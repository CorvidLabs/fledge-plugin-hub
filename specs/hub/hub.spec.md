---
module: hub
version: 1
status: active
files:
  - src/api.ts
  - src/config.ts
  - src/fledge.ts
  - src/github.ts
  - src/project.ts
  - src/semver.ts
  - src/server.ts
  - public/app.js

db_tables: []
depends_on: []
---

# Hub

## Purpose

Provide a localhost-only dashboard for inspecting the current project, running Fledge tasks and lanes, browsing plugins and templates, managing installed plugins, and viewing configuration and doctor results.

## Public API

### Exported Functions and Types

| Export | Description |
|--------|-------------|
| `api` | Hono router for Hub's local API. |
| `ConfigEntry` | Parsed Fledge configuration row. |
| `ConfigList` | Parsed configuration collection. |
| `parseConfigList` | Parse Fledge's configuration table output. |
| `ExecResult` | Captured process exit and streams. |
| `ExecOptions` | Working-directory and timeout controls for execution. |
| `fledge` | Run a Fledge command and capture its result. |
| `fledgeJson` | Run Fledge and decode its JSON output. |
| `spawnExec` | Spawn an argument-array command with bounded execution. |
| `StreamEvent` | Structured streaming process event. |
| `StreamHandler` | Consumer for streaming events. |
| `spawnStream` | Spawn a command and stream output events. |
| `fledgeStream` | Stream a Fledge command. |
| `projectCwd` | Resolve the current project directory. |
| `fetchLatestVersion` | Resolve the latest remote repository version. |
| `GHRepo` | Normalized GitHub repository result. |
| `BrowseFilters` | GitHub discovery filters. |
| `FacetEntry` | One computed discovery facet. |
| `Facets` | Topic, language, owner, and license facets. |
| `buildQualifiers` | Build validated GitHub search qualifiers. |
| `browsePlugins` | Discover Fledge plugin repositories. |
| `browseTemplates` | Discover Fledge template repositories. |
| `browseAll` | Discover all supported Fledge repositories. |
| `computeFacets` | Aggregate discovery facets. |
| `getRepoReadme` | Fetch repository README content. |
| `ProjectHealth` | Project health summary. |
| `ProjectCommit` | Recent project commit summary. |
| `ProjectTask` | Introspected Fledge task. |
| `ProjectLane` | Introspected Fledge lane. |
| `ProjectInfo` | Aggregated local project information. |
| `gatherProjectInfo` | Inspect the current project. |
| `openInBrowser` | Open a validated URL with the platform browser. |
| `ParsedVersion` | Parsed semantic-version components. |
| `parseVersion` | Parse a tolerant semantic version. |
| `compareVersions` | Compare two semantic versions. |
| `isOutdated` | Determine whether an installed version is older. |

| Surface | Behavior |
|---------|----------|
| Local dashboard | Serve project, plugin, template, lane, configuration, and doctor views on localhost. |
| Hub API | Translate validated browser requests into structured Fledge and GitHub operations. |
| Streaming operations | Stream plugin install, update, and removal progress through server-sent events. |

## Invariants

1. The server binds to the configured local port and serves only the bundled dashboard and API.
2. Task, lane, plugin, and source identifiers are validated before becoming process arguments.
3. Fledge commands are spawned as argument arrays rather than interpolated shell commands.
4. Streaming operations emit ordered events and always finish with a terminal done event.
5. GitHub discovery is cached briefly and normalized before rendering.
6. Browser-rendered external content is escaped or passed through the constrained markdown renderer.
7. The plugin manifest registers the extensionless dispatcher while native verification covers it separately.

## Behavioral Examples

```
Given a project with Fledge tasks, lanes, and installed plugins
When the developer opens the Hub dashboard
Then the dashboard displays project state and performs validated operations through the local API
```

## Error Cases

| Error | When | Behavior |
|-------|------|----------|
| Invalid operation name | A task, lane, plugin, or source contains disallowed characters | Return a client error without spawning Fledge. |
| Fledge failure | A command exits non-zero | Return or stream its structured exit code and diagnostics. |
| GitHub unavailable | Discovery or README fetch fails | Surface a bounded error while preserving local project functions. |
| Browser open unavailable | The platform cannot open the repository URL | Return a false opened result without crashing the server. |

## Dependencies

- Bun
- Hono
- Installed Fledge CLI
- GitHub API for remote discovery surfaces

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1 | 2026-07-12 | Document existing dashboard, API, and operation safety behavior for SpecSync 5 adoption. |
