---
change: CHG-0001-adopt-specsync-5-0-1-and-trust-1-0-0-governance-for-the-hub-fledge-plugin
artifact: design
---

# Design

Add one active `hub` specification with stable requirements and 100% coverage of measurable source. Stamp SpecSync 5.0.1 and install all integrations.

Trust runs Bun tests, TypeScript checking, dispatcher ShellCheck/syntax, and manifest validation through Fledge. Risk blocks, provenance is progressive, and Atlas stays disabled for the initial rollout. The workflow installs locked Bun dependencies and pins Trust 1.0.0 immutably.
