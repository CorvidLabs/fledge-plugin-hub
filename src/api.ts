import { Hono } from "hono";
import { fledge, fledgeJson } from "./fledge";
import { browseAll, browsePlugins, browseTemplates, getRepoReadme } from "./github";

export const api = new Hono();

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
  return c.json({ output: result.stdout, exitCode: result.exitCode });
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
