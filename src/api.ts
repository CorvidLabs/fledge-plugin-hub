import { Hono } from "hono";
import { fledge, fledgeJson, projectCwd } from "./fledge";
import { browseAll, browsePlugins, browseTemplates, getRepoReadme } from "./github";
import { gatherProjectInfo, openInBrowser } from "./project";

export const api = new Hono();

api.get("/project", async (c) => {
  const info = await gatherProjectInfo();
  return c.json(info);
});

api.post("/project/run-task", async (c) => {
  const body = await c.req.json<{ task?: string }>().catch(() => ({}));
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
  const body = await c.req.json<{ lane?: string }>().catch(() => ({}));
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
  return c.json(result);
});

api.get("/plugins", async (c) => {
  const result = await fledgeJson(["plugins", "list", "--json"]);
  return c.json(result);
});

api.get("/plugins/search", async (c) => {
  const query = c.req.query("q") || "";
  const result = await fledgeJson(["plugins", "search", query, "--json"]);
  return c.json(result);
});

api.post("/plugins/install", async (c) => {
  const body = await c.req.json<{ source?: string; force?: boolean }>().catch(() => ({}));
  if (!body.source) return c.json({ error: "source required" }, 400);
  const args = ["plugins", "install", body.source, "--json"];
  if (body.force) args.push("--force");
  const result = await fledge(args);
  return c.json({
    success: result.exitCode === 0,
    exitCode: result.exitCode,
    output: result.stdout,
    error: result.exitCode !== 0 ? result.stderr || result.stdout : null,
  });
});

api.post("/plugins/remove", async (c) => {
  const body = await c.req.json<{ name?: string }>().catch(() => ({}));
  if (!body.name) return c.json({ error: "name required" }, 400);
  const result = await fledge(["plugins", "remove", body.name, "--json"]);
  return c.json({
    success: result.exitCode === 0,
    exitCode: result.exitCode,
    output: result.stdout,
    error: result.exitCode !== 0 ? result.stderr || result.stdout : null,
  });
});

api.post("/plugins/update", async (c) => {
  const body = await c.req.json<{ name?: string }>().catch(() => ({}));
  const args = ["plugins", "update"];
  if (body.name) args.push(body.name);
  args.push("--json");
  const result = await fledge(args);
  return c.json({
    success: result.exitCode === 0,
    exitCode: result.exitCode,
    output: result.stdout,
    error: result.exitCode !== 0 ? result.stderr || result.stdout : null,
  });
});

api.get("/templates", async (c) => {
  const result = await fledgeJson(["search", "--json"]);
  return c.json(result);
});

api.get("/lanes", async (c) => {
  const result = await fledgeJson(["lanes", "list", "--json"]);
  return c.json(result);
});

api.get("/config", async (c) => {
  const result = await fledgeJson(["config", "list", "--json"]);
  return c.json(result);
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
  return c.json({
    version: version.stdout.trim(),
    commands: result,
  });
});

api.get("/github/browse", async (c) => {
  const category = c.req.query("category") || "all";
  const query = c.req.query("q") || undefined;
  try {
    let repos;
    if (category === "plugins") repos = await browsePlugins(query);
    else if (category === "templates") repos = await browseTemplates(query);
    else repos = await browseAll(query);
    return c.json({ items: repos, total: repos.length });
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
