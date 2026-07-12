---
spec: hub.spec.md
---

## Test Plan

### Unit Tests

- Configuration table parsing.
- GitHub search qualification and facets.
- Semantic-version parsing and ordering.

### Integration Tests

- `bun install --frozen-lockfile`
- `bun test`
- `bunx tsc --noEmit`
- ShellCheck and syntax-check the dispatcher.
- Validate the Hub command manifest.
