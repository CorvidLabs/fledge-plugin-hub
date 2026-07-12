---
spec: hub.spec.md
---

## Context

Hub gives developers a visual companion to Fledge while keeping the CLI as the authority for project and plugin operations.

## Related Modules

- Fledge CLI introspection, tasks, lanes, plugins, config, and doctor commands.
- GitHub repository discovery API.

## Design Decisions

- Spawn commands with argument arrays and validate identifiers at the API boundary.
- Use server-sent events for observable long-running operations.
- Keep the dashboard dependency-light with Bun, Hono, and static assets.
