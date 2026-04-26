import { Hono } from "hono";
import { fledge, fledgeJson } from "./fledge";

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
