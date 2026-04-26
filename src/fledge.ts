const FLEDGE_BIN = process.env.FLEDGE_BIN || "fledge";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ExecOptions {
  cwd?: string;
  timeoutMs?: number;
}

export async function fledge(args: string[], opts: ExecOptions = {}): Promise<ExecResult> {
  return spawnExec([FLEDGE_BIN, ...args], opts);
}

export async function fledgeJson(args: string[], opts: ExecOptions = {}): Promise<unknown> {
  const result = await fledge(args, opts);
  if (result.exitCode !== 0) {
    return { error: result.stderr || result.stdout, exitCode: result.exitCode };
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    return { raw: result.stdout, exitCode: result.exitCode };
  }
}

export async function spawnExec(cmd: string[], opts: ExecOptions = {}): Promise<ExecResult> {
  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
    cwd: opts.cwd,
    env: { ...process.env, NO_COLOR: "1", FLEDGE_NON_INTERACTIVE: "1" },
  });

  const timer = opts.timeoutMs
    ? setTimeout(() => proc.kill(), opts.timeoutMs)
    : null;

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (timer) clearTimeout(timer);

  return { stdout, stderr, exitCode };
}

export function projectCwd(): string {
  return process.env.FLEDGE_HUB_CWD || process.cwd();
}
