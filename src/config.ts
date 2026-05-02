export interface ConfigEntry {
  section: string;
  key: string;
  value: string;
  help: string;
  unset: boolean;
}

export interface ConfigList {
  path: string | null;
  sections: Array<{ name: string; entries: ConfigEntry[] }>;
}

// Parses the human-readable output of `fledge config list`.
//
// Sample input:
//   * Config: /path/to/config.toml
//
//     Defaults
//     defaults.author              0xLeif         Author name for new projects
//     defaults.github_org          (not set)      GitHub org for new projects
//
//     GitHub
//     github.token                 (not set)      API token for GitHub operations
export function parseConfigList(text: string): ConfigList {
  const lines = text.split("\n");
  let path: string | null = null;
  const sections: Array<{ name: string; entries: ConfigEntry[] }> = [];
  let current: { name: string; entries: ConfigEntry[] } | null = null;

  for (const raw of lines) {
    if (!raw.trim()) continue;

    const pathMatch = raw.match(/^\*\s*Config:\s*(.+)$/);
    if (pathMatch) {
      path = pathMatch[1].trim();
      continue;
    }

    // Entry rows are dotted keys: `defaults.author    value    help`.
    const entryMatch = raw.match(/^\s+([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)\s{2,}(.+)$/i);
    if (entryMatch && current) {
      const key = entryMatch[1];
      const rest = entryMatch[2];
      // Split rest into value and help on 2+ spaces. Some values like
      // "(not set)" or "(none)" are still treated normally.
      const split = rest.match(/^(.+?)\s{2,}(.+)$/);
      const value = (split ? split[1] : rest).trim();
      const help = split ? split[2].trim() : "";
      current.entries.push({
        section: current.name,
        key,
        value,
        help,
        unset: value === "(not set)" || value === "(none)",
      });
      continue;
    }

    // Section header: indented bare word, no dot, no separator value.
    const sectionMatch = raw.match(/^\s+([A-Z][A-Za-z0-9 /]*)\s*$/);
    if (sectionMatch) {
      current = { name: sectionMatch[1].trim(), entries: [] };
      sections.push(current);
    }
  }

  return { path, sections };
}
