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

export interface StreamEvent {
  kind: "stdout" | "stderr" | "done" | "error";
  line?: string;
  exitCode?: number;
  message?: string;
}

export type StreamHandler = (event: StreamEvent) => void | Promise<void>;

async function pumpLines(
  stream: ReadableStream<Uint8Array>,
  kind: "stdout" | "stderr",
  send: StreamHandler,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      await send({ kind, line });
    }
  }
  if (buffer.length > 0) await send({ kind, line: buffer });
}

export async function spawnStream(
  cmd: string[],
  send: StreamHandler,
  opts: ExecOptions = {},
): Promise<number> {
  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
    cwd: opts.cwd,
    env: { ...process.env, NO_COLOR: "1", FLEDGE_NON_INTERACTIVE: "1" },
  });

  const timer = opts.timeoutMs
    ? setTimeout(() => proc.kill(), opts.timeoutMs)
    : null;

  await Promise.all([
    pumpLines(proc.stdout, "stdout", send),
    pumpLines(proc.stderr, "stderr", send),
  ]);
  const exitCode = await proc.exited;
  if (timer) clearTimeout(timer);
  return exitCode;
}

export async function fledgeStream(args: string[], send: StreamHandler, opts: ExecOptions = {}): Promise<number> {
  return spawnStream([FLEDGE_BIN, ...args], send, opts);
}

export function projectCwd(): string {
  return process.env.FLEDGE_HUB_CWD || process.cwd();
}
