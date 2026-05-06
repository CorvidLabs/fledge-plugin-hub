// Tiny semver comparator. Intentionally lenient — fledge plugins don't
// always tag with strict semver, so we tolerate a leading "v", missing
// patch/minor segments, and pre-release suffixes (treated as < release).

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  pre: string;
}

export function parseVersion(input: string | null | undefined): ParsedVersion | null {
  if (!input) return null;
  const trimmed = String(input).trim().replace(/^v/i, "");
  if (!trimmed) return null;

  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+](.+))?$/.exec(trimmed);
  if (!match) return null;

  return {
    major: Number(match[1]) || 0,
    minor: match[2] ? Number(match[2]) : 0,
    patch: match[3] ? Number(match[3]) : 0,
    pre: match[4] || "",
  };
}

export function compareVersions(a: string | null | undefined, b: string | null | undefined): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);

  // Both unparseable → treat as equal (string compare would be misleading).
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;

  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;

  // Pre-release versions sort BEFORE the release. So 1.0.0-rc1 < 1.0.0.
  if (pa.pre === pb.pre) return 0;
  if (!pa.pre) return 1;
  if (!pb.pre) return -1;
  return pa.pre < pb.pre ? -1 : 1;
}

export function isOutdated(current: string | null | undefined, latest: string | null | undefined): boolean {
  if (!current || !latest) return false;
  return compareVersions(current, latest) < 0;
}
