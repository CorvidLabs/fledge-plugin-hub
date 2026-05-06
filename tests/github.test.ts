import { describe, expect, test } from "bun:test";
import { buildQualifiers, computeFacets, type GHRepo } from "../src/github";

function repo(overrides: Partial<GHRepo>): GHRepo {
  return {
    full_name: "acme/widget",
    name: "widget",
    description: null,
    html_url: "https://github.com/acme/widget",
    stargazers_count: 0,
    language: null,
    topics: [],
    owner: { login: "acme", avatar_url: "" },
    updated_at: "2025-01-01T00:00:00Z",
    license: null,
    ...overrides,
  };
}

describe("buildQualifiers", () => {
  test("always includes the base topic qualifier", () => {
    expect(buildQualifiers("fledge-plugin", {})).toBe("topic:fledge-plugin");
  });

  test("prepends the free-text query before qualifiers", () => {
    const q = buildQualifiers("fledge-plugin", { q: "deploy" });
    expect(q).toBe("deploy topic:fledge-plugin");
  });

  test("adds extra topic, language, owner and license qualifiers", () => {
    const q = buildQualifiers("fledge-template", {
      topics: ["swift", "ios"],
      language: "Swift",
      owner: "CorvidLabs",
      license: "mit",
    });
    expect(q).toBe(
      "topic:fledge-template topic:swift topic:ios language:Swift user:CorvidLabs license:mit",
    );
  });

  test("filters reserved topics so users can't override the base marker", () => {
    const q = buildQualifiers("fledge-plugin", { topics: ["fledge-plugin", "fledge", "deploy"] });
    expect(q).toBe("topic:fledge-plugin topic:deploy");
  });

  test("quotes language values that contain whitespace", () => {
    const q = buildQualifiers("fledge-plugin", { language: "Objective C" });
    expect(q).toBe('topic:fledge-plugin language:"Objective C"');
  });

  test("ignores empty/falsy filters", () => {
    const q = buildQualifiers("fledge-plugin", {
      q: "",
      language: "",
      owner: "",
      license: "",
      topics: ["", "swift"],
    });
    expect(q).toBe("topic:fledge-plugin topic:swift");
  });
});

describe("computeFacets", () => {
  const items: GHRepo[] = [
    repo({
      full_name: "corvidlabs/swift-ascii",
      owner: { login: "CorvidLabs", avatar_url: "" },
      language: "Swift",
      topics: ["fledge-plugin", "swift", "ascii", "art"],
      license: { spdx_id: "MIT" },
    }),
    repo({
      full_name: "corvidlabs/swift-color",
      owner: { login: "CorvidLabs", avatar_url: "" },
      language: "Swift",
      topics: ["fledge-plugin", "swift", "color"],
      license: { spdx_id: "MIT" },
    }),
    repo({
      full_name: "acme/py-helper",
      owner: { login: "acme", avatar_url: "" },
      language: "Python",
      topics: ["fledge-template", "python"],
      license: { spdx_id: "Apache-2.0" },
    }),
    repo({
      full_name: "anon/no-license",
      owner: { login: "anon", avatar_url: "" },
      language: null,
      topics: [],
      license: { spdx_id: "NOASSERTION" },
    }),
  ];

  test("excludes reserved topics", () => {
    const facets = computeFacets(items);
    const values = facets.topics.map((t) => t.value);
    expect(values).not.toContain("fledge-plugin");
    expect(values).not.toContain("fledge-template");
  });

  test("counts each topic once per repo and sorts by count desc", () => {
    const facets = computeFacets(items);
    expect(facets.topics).toEqual([
      { value: "swift", count: 2 },
      { value: "art", count: 1 },
      { value: "ascii", count: 1 },
      { value: "color", count: 1 },
      { value: "python", count: 1 },
    ]);
  });

  test("aggregates languages and owners correctly", () => {
    const facets = computeFacets(items);
    expect(facets.languages).toEqual([
      { value: "Swift", count: 2 },
      { value: "Python", count: 1 },
    ]);
    expect(facets.owners).toEqual([
      { value: "CorvidLabs", count: 2 },
      { value: "acme", count: 1 },
      { value: "anon", count: 1 },
    ]);
  });

  test("skips NOASSERTION licenses", () => {
    const facets = computeFacets(items);
    expect(facets.licenses).toEqual([
      { value: "MIT", count: 2 },
      { value: "Apache-2.0", count: 1 },
    ]);
  });

  test("returns empty arrays for an empty input", () => {
    const facets = computeFacets([]);
    expect(facets).toEqual({ topics: [], languages: [], owners: [], licenses: [] });
  });

  test("dedupes duplicate topics within a single repo", () => {
    const dup = [
      repo({
        full_name: "acme/dup",
        topics: ["swift", "swift", "deploy"],
      }),
    ];
    const facets = computeFacets(dup);
    expect(facets.topics).toEqual([
      { value: "deploy", count: 1 },
      { value: "swift", count: 1 },
    ]);
  });
});
