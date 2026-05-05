import { describe, expect, test } from "bun:test";
import { parseConfigList } from "../src/config";

describe("parseConfigList", () => {
  test("parses config path", () => {
    const input = `* Config: /home/user/.config/fledge/config.toml

    Defaults
    defaults.author              0xLeif         Author name for new projects
`;
    const result = parseConfigList(input);
    expect(result.path).toBe("/home/user/.config/fledge/config.toml");
  });

  test("parses sections and entries", () => {
    const input = `* Config: /home/user/.config/fledge/config.toml

    Defaults
    defaults.author              0xLeif         Author name for new projects
    defaults.github_org          (not set)      GitHub org for new projects

    GitHub
    github.token                 (not set)      API token for GitHub operations
`;
    const result = parseConfigList(input);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].name).toBe("Defaults");
    expect(result.sections[0].entries).toHaveLength(2);
    expect(result.sections[1].name).toBe("GitHub");
    expect(result.sections[1].entries).toHaveLength(1);
  });

  test("marks unset values correctly", () => {
    const input = `* Config: /path/to/config.toml

    Defaults
    defaults.author              0xLeif         Author name
    defaults.github_org          (not set)      GitHub org
    defaults.license             (none)         Default license
`;
    const result = parseConfigList(input);
    const entries = result.sections[0].entries;
    expect(entries[0].unset).toBe(false);
    expect(entries[0].value).toBe("0xLeif");
    expect(entries[1].unset).toBe(true);
    expect(entries[2].unset).toBe(true);
  });

  test("returns null path when none present", () => {
    const input = `
    Defaults
    defaults.author              val         help text
`;
    const result = parseConfigList(input);
    expect(result.path).toBeNull();
  });

  test("handles empty input", () => {
    const result = parseConfigList("");
    expect(result.path).toBeNull();
    expect(result.sections).toHaveLength(0);
  });
});
