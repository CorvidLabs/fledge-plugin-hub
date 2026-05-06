const GITHUB_API = "https://api.github.com";
const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry {
  data: unknown;
  ts: number;
}

const cache = new Map<string, CacheEntry>();

function cached(key: string): unknown | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

async function ghFetch(url: string): Promise<unknown> {
  const hit = cached(url);
  if (hit) return hit;

  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "fledge-plugin-hub",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }

  const data = await res.json();
  setCache(url, data);
  return data;
}

export interface GHRepo {
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  topics: string[];
  owner: { login: string; avatar_url: string };
  updated_at: string;
  license: { spdx_id: string } | null;
}

interface SearchResult {
  total_count: number;
  items: GHRepo[];
}

export interface BrowseFilters {
  q?: string;
  language?: string;
  topics?: string[];
  owner?: string;
  license?: string;
}

export interface FacetEntry {
  value: string;
  count: number;
}

export interface Facets {
  topics: FacetEntry[];
  languages: FacetEntry[];
  owners: FacetEntry[];
  licenses: FacetEntry[];
}

function toRepoList(result: SearchResult): GHRepo[] {
  return (result.items || []).map((r) => ({
    full_name: r.full_name,
    name: r.name,
    description: r.description,
    html_url: r.html_url,
    stargazers_count: r.stargazers_count,
    language: r.language,
    topics: r.topics || [],
    owner: { login: r.owner.login, avatar_url: r.owner.avatar_url },
    updated_at: r.updated_at,
    license: r.license,
  }));
}

// Topics that should not appear as user-selectable filters because they're
// the markers that tell us a repo is a fledge plugin/template at all.
const RESERVED_TOPICS = new Set(["fledge-plugin", "fledge-template", "fledge"]);

export function buildQualifiers(baseTopic: string, filters: BrowseFilters): string {
  const parts: string[] = [];
  if (filters.q) parts.push(filters.q);
  parts.push(`topic:${baseTopic}`);
  for (const t of filters.topics || []) {
    if (!t || RESERVED_TOPICS.has(t.toLowerCase())) continue;
    parts.push(`topic:${t}`);
  }
  if (filters.language) parts.push(`language:${quoteIfNeeded(filters.language)}`);
  if (filters.owner) parts.push(`user:${filters.owner}`);
  if (filters.license) parts.push(`license:${filters.license}`);
  return parts.join(" ");
}

function quoteIfNeeded(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value;
}

async function search(baseTopic: string, filters: BrowseFilters): Promise<GHRepo[]> {
  const q = buildQualifiers(baseTopic, filters);
  const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=50`;
  const result = (await ghFetch(url)) as SearchResult;
  return toRepoList(result);
}

export async function browsePlugins(filters: BrowseFilters = {}): Promise<GHRepo[]> {
  return search("fledge-plugin", filters);
}

export async function browseTemplates(filters: BrowseFilters = {}): Promise<GHRepo[]> {
  return search("fledge-template", filters);
}

export async function browseAll(filters: BrowseFilters = {}): Promise<GHRepo[]> {
  const [plugins, templates] = await Promise.all([
    browsePlugins(filters),
    browseTemplates(filters),
  ]);
  const seen = new Set<string>();
  const merged: GHRepo[] = [];
  for (const r of [...plugins, ...templates]) {
    if (!seen.has(r.full_name)) {
      seen.add(r.full_name);
      merged.push(r);
    }
  }
  merged.sort((a, b) => b.stargazers_count - a.stargazers_count);
  return merged;
}

function tally<Value>(
  items: readonly GHRepo[],
  pick: (repo: GHRepo) => readonly Value[],
  key: (value: Value) => string,
): FacetEntry[] {
  const counts = new Map<string, { value: string; count: number }>();
  for (const repo of items) {
    const seen = new Set<string>();
    for (const value of pick(repo)) {
      const k = key(value);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      const entry = counts.get(k);
      if (entry) entry.count += 1;
      else counts.set(k, { value: String(value), count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function computeFacets(items: readonly GHRepo[]): Facets {
  return {
    topics: tally(
      items,
      (r) => (r.topics || []).filter((t) => !RESERVED_TOPICS.has(t.toLowerCase())),
      (t) => t.toLowerCase(),
    ),
    languages: tally(
      items,
      (r) => (r.language ? [r.language] : []),
      (l) => l,
    ),
    owners: tally(
      items,
      (r) => (r.owner?.login ? [r.owner.login] : []),
      (l) => l.toLowerCase(),
    ),
    licenses: tally(
      items,
      (r) => (r.license?.spdx_id && r.license.spdx_id !== "NOASSERTION" ? [r.license.spdx_id] : []),
      (l) => l,
    ),
  };
}

export async function getRepoReadme(owner: string, repo: string): Promise<string> {
  const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`;
  const data = (await ghFetch(url)) as { content: string; encoding: string };
  if (data.encoding === "base64") {
    return atob(data.content);
  }
  return data.content;
}
