import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { fledge, fledgeJson, fledgeStream, projectCwd } from "./fledge";
import {
  browseAll,
  browsePlugins,
  browseTemplates,
  computeFacets,
  fetchLatestVersion,
  getRepoReadme,
  type BrowseFilters,
} from "./github";
import { isOutdated } from "./semver";
import { gatherProjectInfo, openInBrowser } from "./project";
import { parseConfigList } from "./config";

const HUB_VERSION: string = (() => {
  try {
    const pkg = JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "";
  } catch {
    return "";
  }
})();

export const api = new Hono();

// Fledge 1.0 wraps list-style JSON responses in an envelope:
//   plugins list  -> { plugins: [...] }
//   lanes list    -> { lanes: [...] }
//   plugins search / templates search -> { results: [...] }
// Unwrap the envelope so the frontend sees a plain array.
function unwrap<T>(value: unknown, key: string): T[] | unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj[key])) return obj[key] as T[];
    if ("error" in obj) return value;
  }
  return value;
}

api.get("/project", async (c) => {
  const info = await gatherProjectInfo();
  return c.json(info);
});

api.post("/project/run-task", async (c) => {
  const body: { task?: string } = await c.req.json<{ task?: string }>().catch(() => ({}));
  const task = body.task;
  if (!task || !/^[A-Za-z0-9_-]+$/.test(task)) {
    return c.json({ error: "invalid task name" }, 400);
  }
  const cwd = projectCwd();
  const result = await fledge(["run", task], { cwd, timeoutMs: 120_000 });
  return c.json({
    success: result.exitCode === 0,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  });
});

api.post("/project/run-lane", async (c) => {
  const body: { lane?: string } = await c.req.json<{ lane?: string }>().catch(() => ({}));
  const lane = body.lane;
  if (!lane || !/^[A-Za-z0-9_-]+$/.test(lane)) {
    return c.json({ error: "invalid lane name" }, 400);
  }
  const cwd = projectCwd();
  const result = await fledge(["lanes", "run", lane], { cwd, timeoutMs: 300_000 });
  return c.json({
    success: result.exitCode === 0,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  });
});

api.post("/project/open-repo", async (c) => {
  const info = await gatherProjectInfo();
  if (!info.remoteUrl) return c.json({ error: "no remote found" }, 404);
  const opened = await openInBrowser(info.remoteUrl);
  return c.json({ opened, url: info.remoteUrl });
});

api.get("/introspect", async (c) => {
  const result = await fledgeJson(["introspect", "--json"]);
  // Frontend expects an array of top-level commands.
  if (result && typeof result === "object" && Array.isArray((result as { subcommands?: unknown }).subcommands)) {
    return c.json((result as { subcommands: unknown[] }).subcommands);
  }
  return c.json(result);
});

api.get("/plugins", async (c) => {
  const result = await fledgeJson(["plugins", "list", "--json"]);
  return c.json(unwrap(result, "plugins"));
});

interface InstalledPluginRow {
  name?: unknown;
  source?: unknown;
  version?: unknown;
}

api.get("/plugins/outdated", async (c) => {
  const list = await fledgeJson(["plugins", "list", "--json"]);
  const plugins = unwrap(list, "plugins");
  if (!Array.isArray(plugins)) return c.json({ items: [] });

  const items = await Promise.all(
    (plugins as InstalledPluginRow[]).map(async (p) => {
      const name = typeof p.name === "string" ? p.name : "";
      const source = typeof p.source === "string" ? p.source : "";
      const current = typeof p.version === "string" ? p.version : "";
      const slash = source.indexOf("/");
      if (slash <= 0) {
        return { name, source, current, latest: null, outdated: false };
      }
      const owner = source.slice(0, slash);
      const repo = source.slice(slash + 1);
      try {
        const latest = await fetchLatestVersion(owner, repo);
        return { name, source, current, latest, outdated: isOutdated(current, latest) };
      } catch {
        return { name, source, current, latest: null, outdated: false };
      }
    }),
  );

  return c.json({ items });
});

api.get("/plugins/search", async (c) => {
  const query = c.req.query("q") || "";
  const result = await fledgeJson(["plugins", "search", query, "--json"]);
  return c.json(unwrap(result, "results"));
});

// SSE-based streaming endpoints. EventSource only supports GET, so the
// payload travels in the query string. Sources are validated to keep
// shell-style metacharacters out of argv.

const VALID_SOURCE = /^[A-Za-z0-9_./@:-]+$/;
const VALID_NAME = /^[A-Za-z0-9_-]+$/;

function streamFledge(c: Context, args: string[], opts: { cwd?: string; timeoutMs?: number } = {}) {
  return streamSSE(c, async (stream) => {
    let id = 0;
    const send = async (event: { kind: string; line?: string; exitCode?: number; message?: string }) => {
      await stream.writeSSE({
        id: String(id++),
        event: event.kind,
        data: JSON.stringify(event),
      });
    };
    try {
      const exitCode = await fledgeStream(args, send, opts);
      await send({ kind: "done", exitCode, message: exitCode === 0 ? "ok" : "failed" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      await send({ kind: "error", message });
      await send({ kind: "done", exitCode: -1, message });
    }
  });
}

api.get("/plugins/install/stream", (c) => {
  const source = c.req.query("source") || "";
  const force = c.req.query("force") === "1";
  if (!source || !VALID_SOURCE.test(source)) {
    return c.json({ error: "valid source required" }, 400);
  }
  const args = ["plugins", "install", source, "--yes", "--json"];
  if (force) args.push("--force");
  return streamFledge(c, args);
});

api.get("/plugins/update/stream", (c) => {
  const name = c.req.query("name") || "";
  if (name && !VALID_NAME.test(name)) {
    return c.json({ error: "invalid plugin name" }, 400);
  }
  const args = ["plugins", "update"];
  if (name) args.push(name);
  args.push("--json");
  return streamFledge(c, args);
});

api.get("/plugins/remove/stream", (c) => {
  const name = c.req.query("name") || "";
  if (!name || !VALID_NAME.test(name)) {
    return c.json({ error: "valid plugin name required" }, 400);
  }
  return streamFledge(c, ["plugins", "remove", name, "--json"]);
});

api.get("/config", async (c) => {
  // `fledge config list` does not accept --json in 1.0 — parse the table form.
  const result = await fledge(["config", "list"]);
  if (result.exitCode !== 0) {
    return c.json({ error: result.stderr || result.stdout, exitCode: result.exitCode });
  }
  return c.json(parseConfigList(result.stdout));
});

api.get("/doctor", async (c) => {
  const result = await fledge(["doctor", "--json"]);
  try {
    const parsed = JSON.parse(result.stdout);
    return c.json({ report: parsed, exitCode: result.exitCode });
  } catch {
    return c.json({ raw: result.stdout, exitCode: result.exitCode });
  }
});

api.get("/info", async (c) => {
  const result = await fledgeJson(["introspect", "--json"]);
  const version = await fledge(["--version"]);
  const commands = result && typeof result === "object" && Array.isArray((result as { subcommands?: unknown }).subcommands)
    ? (result as { subcommands: unknown[] }).subcommands
    : [];
  return c.json({
    version: version.stdout.trim(),
    hubVersion: HUB_VERSION,
    commands,
  });
});

api.get("/github/browse", async (c) => {
  const category = c.req.query("category") || "all";
  const filters: BrowseFilters = {
    q: c.req.query("q") || undefined,
    language: c.req.query("language") || undefined,
    owner: c.req.query("owner") || undefined,
    license: c.req.query("license") || undefined,
    topics: c.req.queries("topic"),
  };
  try {
    let repos;
    if (category === "plugins") repos = await browsePlugins(filters);
    else if (category === "templates") repos = await browseTemplates(filters);
    else repos = await browseAll(filters);
    return c.json({
      items: repos,
      total: repos.length,
      facets: computeFacets(repos),
      applied: {
        category,
        q: filters.q ?? null,
        language: filters.language ?? null,
        owner: filters.owner ?? null,
        license: filters.license ?? null,
        topics: filters.topics ?? [],
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: msg, items: [] }, 502);
  }
});

api.get("/github/readme/:owner/:repo", async (c) => {
  try {
    const content = await getRepoReadme(c.req.param("owner"), c.req.param("repo"));
    return c.json({ content });
  } catch {
    return c.json({ error: "README not found" }, 404);
  }
});
