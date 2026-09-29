## MODIFIED

### REQUIREMENT REQ-hub-001

The Hub SHALL expose project, task, lane, plugin, template, configuration, and doctor information through its local dashboard API.

Acceptance Criteria
- TypeScript checking validates the complete dashboard API surface.
- The manifest registers the local Hub dispatcher.

### REQUIREMENT REQ-hub-002

All user-selected operation identifiers SHALL be validated before they are passed to Fledge as argument arrays.

Acceptance Criteria
- The API accepts only validated identifiers.
- Fledge processes are spawned with argument arrays rather than interpolated commands.

### REQUIREMENT REQ-hub-003

Long-running plugin operations SHALL stream ordered output and a terminal completion event.

Acceptance Criteria
- TypeScript checking validates structured streaming events.
- Every streaming path emits a terminal completion event.

### REQUIREMENT REQ-hub-004

Remote discovery and README content SHALL be normalized and safely rendered without weakening local functionality when GitHub is unavailable.

Acceptance Criteria
- GitHub qualifier and facet tests cover normalized discovery data.
- Remote failures remain bounded and do not disable local project operations.

### REQUIREMENT REQ-hub-005

Version comparison, configuration parsing, and project inspection SHALL remain deterministic and covered by native tests.

Acceptance Criteria
- Bun tests cover semantic-version comparison and configuration parsing.
- The native verification lane passes all 29 tests and TypeScript checking.
