---
spec: hub.spec.md
---

## User Stories

- As a developer, I want one local dashboard for inspecting and operating my Fledge project.

## Acceptance Criteria

### REQ-hub-001

The Hub SHALL expose project, task, lane, plugin, template, configuration, and doctor information through its local dashboard API.

### REQ-hub-002

All user-selected operation identifiers SHALL be validated before they are passed to Fledge as argument arrays.

### REQ-hub-003

Long-running plugin operations SHALL stream ordered output and a terminal completion event.

### REQ-hub-004

Remote discovery and README content SHALL be normalized and safely rendered without weakening local functionality when GitHub is unavailable.

### REQ-hub-005

Version comparison, configuration parsing, and project inspection SHALL remain deterministic and covered by native tests.

## Constraints

- The dashboard is intended for local use and depends on the installed Fledge CLI for mutations.

## Out of Scope

- Remote multi-user hosting, authentication, and replacing Fledge's command authorization.
