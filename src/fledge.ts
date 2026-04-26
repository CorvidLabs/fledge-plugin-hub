const FLEDGE_BIN = process.env.FLEDGE_BIN || "fledge";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function fledge(args: string[]): Promise<ExecResult> {
  const proc = Bun.spawn([FLEDGE_BIN, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1", FLEDGE_NON_INTERACTIVE: "1" },
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

export async function fledgeJson(args: string[]): Promise<unknown> {
  const result = await fledge(args);
  if (result.exitCode !== 0) {
    return { error: result.stderr || result.stdout, exitCode: result.exitCode };
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    return { raw: result.stdout, exitCode: result.exitCode };
  }
}
