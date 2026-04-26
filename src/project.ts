import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fledgeJson, projectCwd, spawnExec } from "./fledge";

export interface ProjectHealth {
  name: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

export interface ProjectCommit {
  hash: string;
  subject: string;
  author: string;
  date: string;
}

export interface ProjectTask {
  name: string;
  cmd?: string;
  description?: string;
}

export interface ProjectLane {
  name: string;
  description?: string;
  steps?: number;
  fail_fast?: boolean;
  trust_tier?: string;
}

export interface ProjectInfo {
  cwd: string;
  name: string;
  version: string;
  languages: string[];
  isGit: boolean;
  branch: string;
  remote: string;
  remoteUrl: string;
  tags: string[];
  commits: ProjectCommit[];
  workingTree: string[];
  hasFledgeToml: boolean;
  tasks: ProjectTask[];
  lanes: ProjectLane[];
  health: ProjectHealth[];
}

async function git(args: string[], cwd: string): Promise<string> {
  const result = await spawnExec(["git", ...args], { cwd });
  return result.exitCode === 0 ? result.stdout.trim() : "";
}

function detectLanguages(cwd: string): string[] {
  const langs: string[] = [];
  if (existsSync(join(cwd, "Cargo.toml"))) langs.push("Rust");
  if (existsSync(join(cwd, "package.json"))) langs.push("Node");
  if (existsSync(join(cwd, "go.mod"))) langs.push("Go");
  if (existsSync(join(cwd, "Package.swift"))) langs.push("Swift");
  if (existsSync(join(cwd, "pyproject.toml")) || existsSync(join(cwd, "setup.py"))) langs.push("Python");
  if (existsSync(join(cwd, "Gemfile"))) langs.push("Ruby");
  if (existsSync(join(cwd, "pom.xml"))) langs.push("Java/Maven");
  if (existsSync(join(cwd, "build.gradle")) || existsSync(join(cwd, "build.gradle.kts"))) langs.push("Java/Gradle");
  return langs;
}

function readPackageJson(cwd: string): { name?: string; version?: string } {
  try {
    const data = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
    return { name: data.name, version: data.version };
  } catch {
    return {};
  }
}

function readCargoToml(cwd: string): { name?: string; version?: string } {
  try {
    const text = readFileSync(join(cwd, "Cargo.toml"), "utf8");
    const pkgIdx = text.indexOf("[package]");
    if (pkgIdx < 0) return {};
    const after = text.slice(pkgIdx);
    const nameMatch = after.match(/^\s*name\s*=\s*"([^"]+)"/m);
    const versionMatch = after.match(/^\s*version\s*=\s*"([^"]+)"/m);
    return { name: nameMatch?.[1], version: versionMatch?.[1] };
  } catch {
    return {};
  }
}

function readFledgeProject(cwd: string): { name?: string; version?: string } {
  try {
    const text = readFileSync(join(cwd, "fledge.toml"), "utf8");
    const projIdx = text.indexOf("[project]");
    if (projIdx < 0) return {};
    const after = text.slice(projIdx);
    const nameMatch = after.match(/^\s*name\s*=\s*"([^"]+)"/m);
    const versionMatch = after.match(/^\s*version\s*=\s*"([^"]+)"/m);
    return { name: nameMatch?.[1], version: versionMatch?.[1] };
  } catch {
    return {};
  }
}

function remoteUrl(remote: string): string {
  if (!remote) return "";
  if (remote.startsWith("git@")) {
    return remote.replace(/^git@([^:]+):/, "https://$1/").replace(/\.git$/, "");
  }
  return remote.replace(/\.git$/, "");
}

async function gitLog(cwd: string): Promise<ProjectCommit[]> {
  const fmt = '{"hash":"%h","subject":"%s","author":"%an","date":"%cr"}';
  const result = await spawnExec(["git", "log", "--format=" + fmt, "-20"], { cwd });
  if (result.exitCode !== 0) return [];
  const commits: ProjectCommit[] = [];
  for (const line of result.stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      commits.push(parsed);
    } catch {
      // Skip malformed lines (e.g. subjects with embedded quotes — rare).
    }
  }
  return commits;
}

export async function gatherProjectInfo(): Promise<ProjectInfo> {
  const cwd = projectCwd();
  const isGit = (await spawnExec(["git", "rev-parse", "--is-inside-work-tree"], { cwd })).exitCode === 0;

  let branch = "";
  let remote = "";
  let tags: string[] = [];
  let commits: ProjectCommit[] = [];
  let workingTree: string[] = [];

  if (isGit) {
    branch = await git(["branch", "--show-current"], cwd);
    remote = await git(["remote", "get-url", "origin"], cwd);
    const tagsOut = await git(["tag", "--sort=-v:refname"], cwd);
    tags = tagsOut ? tagsOut.split("\n").slice(0, 5) : [];
    commits = await gitLog(cwd);
    const status = await git(["status", "--porcelain"], cwd);
    workingTree = status ? status.split("\n") : [];
  }

  const hasFledgeToml = existsSync(join(cwd, "fledge.toml"));

  let tasks: ProjectTask[] = [];
  let lanes: ProjectLane[] = [];
  if (hasFledgeToml) {
    const taskListing = await fledgeJson(["run", "--list", "--json"], { cwd }) as { tasks?: ProjectTask[] };
    tasks = Array.isArray(taskListing?.tasks) ? taskListing.tasks : [];
    const laneListing = await fledgeJson(["lanes", "list", "--json"], { cwd });
    if (Array.isArray(laneListing)) lanes = laneListing as ProjectLane[];
  }

  const fromFledge = readFledgeProject(cwd);
  const fromCargo = readCargoToml(cwd);
  const fromNode = readPackageJson(cwd);
  const name = fromFledge.name || fromCargo.name || fromNode.name || basename(cwd);
  const version = fromFledge.version || fromCargo.version || fromNode.version || "";

  const languages = detectLanguages(cwd);

  const health: ProjectHealth[] = [];
  health.push(
    isGit
      ? { name: "Git repo", status: "ok", detail: branch || "—" }
      : { name: "Git repo", status: "warn", detail: "Not a git repo" }
  );
  health.push(
    hasFledgeToml
      ? { name: "fledge.toml", status: "ok", detail: `${tasks.length} tasks, ${lanes.length} lanes` }
      : { name: "fledge.toml", status: "warn", detail: "Not found" }
  );
  if (isGit) {
    health.push(
      workingTree.length === 0
        ? { name: "Working tree", status: "ok", detail: "Clean" }
        : { name: "Working tree", status: "warn", detail: `${workingTree.length} change${workingTree.length === 1 ? "" : "s"}` }
    );
  }

  return {
    cwd,
    name,
    version,
    languages,
    isGit,
    branch,
    remote,
    remoteUrl: remoteUrl(remote),
    tags,
    commits,
    workingTree,
    hasFledgeToml,
    tasks,
    lanes,
    health,
  };
}

export async function openInBrowser(url: string): Promise<boolean> {
  for (const cmd of [["open", url], ["xdg-open", url], ["start", url]]) {
    const result = await spawnExec(cmd);
    if (result.exitCode === 0) return true;
  }
  return false;
}
