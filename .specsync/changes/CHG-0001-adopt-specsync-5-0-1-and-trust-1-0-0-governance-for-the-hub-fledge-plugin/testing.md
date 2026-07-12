---
change: CHG-0001-adopt-specsync-5-0-1-and-trust-1-0-0-governance-for-the-hub-fledge-plugin
artifact: testing
---

# Testing

Local acceptance requires the five-step Fledge lane, strict 100% SpecSync coverage, all four integrations, a healthy Trust doctor, and a clean diff.

Hosted acceptance requires the new `trust` job and existing test, typecheck, and ShellCheck jobs to pass on Ubuntu.
