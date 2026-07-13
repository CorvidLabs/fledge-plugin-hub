---
change: CHG-0001-adopt-specsync-5-0-1-and-trust-1-0-0-governance-for-the-hub-fledge-plugin
artifact: testing
---

# Testing

Local acceptance requires the five-step Fledge lane, strict 100% SpecSync coverage, all four integrations, a healthy Trust doctor, and a clean diff.

## Requirement Evidence

- `REQ-hub-001`: `bunx tsc --noEmit` validates the dashboard API; the manifest task validates registration.
- `REQ-hub-002`: `bunx tsc --noEmit`, ShellCheck, and Bash syntax validation cover typed and dispatcher command boundaries.
- `REQ-hub-003`: `bunx tsc --noEmit` validates the structured streaming implementation.
- `REQ-hub-004`: `tests/github.test.ts` covers qualifiers, normalization, facets, and empty results.
- `REQ-hub-005`: `tests/semver.test.ts` and `tests/config.test.ts` cover deterministic version and configuration behavior.

Hosted acceptance requires the new `trust` job and existing test, typecheck, and ShellCheck jobs to pass on Ubuntu.
