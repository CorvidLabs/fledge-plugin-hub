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

export async function browsePlugins(query?: string): Promise<GHRepo[]> {
  const q = query
    ? `${query} topic:fledge-plugin`
    : "topic:fledge-plugin";
  const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=30`;
  const result = (await ghFetch(url)) as SearchResult;
  return toRepoList(result);
}

export async function browseTemplates(query?: string): Promise<GHRepo[]> {
  const q = query
    ? `${query} topic:fledge-template`
    : "topic:fledge-template";
  const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=30`;
  const result = (await ghFetch(url)) as SearchResult;
  return toRepoList(result);
}

export async function browseAll(query?: string): Promise<GHRepo[]> {
  const [plugins, templates] = await Promise.all([
    browsePlugins(query),
    browseTemplates(query),
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

export async function getRepoReadme(owner: string, repo: string): Promise<string> {
  const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`;
  const data = (await ghFetch(url)) as { content: string; encoding: string };
  if (data.encoding === "base64") {
    return atob(data.content);
  }
  return data.content;
}
