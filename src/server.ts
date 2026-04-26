import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { api } from "./api";

const app = new Hono();

app.route("/api", api);

app.use("/*", serveStatic({ root: "./public" }));

app.get("/", serveStatic({ path: "./public/index.html" }));

const port = Number(process.env.PORT) || 3800;

console.log(`fledge hub running at http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
