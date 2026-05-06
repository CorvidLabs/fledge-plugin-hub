import { describe, expect, test } from "bun:test";
import { compareVersions, isOutdated, parseVersion } from "../src/semver";

describe("parseVersion", () => {
  test("parses x.y.z", () => {
    expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, pre: "" });
  });

  test("strips a leading v", () => {
    expect(parseVersion("v0.7.0")).toEqual({ major: 0, minor: 7, patch: 0, pre: "" });
  });

  test("fills missing minor/patch with 0", () => {
    expect(parseVersion("2")).toEqual({ major: 2, minor: 0, patch: 0, pre: "" });
    expect(parseVersion("2.5")).toEqual({ major: 2, minor: 5, patch: 0, pre: "" });
  });

  test("captures a pre-release suffix", () => {
    expect(parseVersion("1.0.0-rc1")).toEqual({ major: 1, minor: 0, patch: 0, pre: "rc1" });
    expect(parseVersion("1.0.0+build.5")).toEqual({ major: 1, minor: 0, patch: 0, pre: "build.5" });
  });

  test("returns null for falsy / unparseable input", () => {
    expect(parseVersion(null)).toBeNull();
    expect(parseVersion("")).toBeNull();
    expect(parseVersion("not-a-version")).toBeNull();
  });
});

describe("compareVersions", () => {
  test("returns 0 for equal versions", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("v1.2.3", "1.2.3")).toBe(0);
  });

  test("orders by major then minor then patch", () => {
    expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
    expect(compareVersions("1.5.0", "1.4.9")).toBe(1);
    expect(compareVersions("1.2.3", "1.2.4")).toBe(-1);
  });

  test("treats pre-release as less than the matching release", () => {
    expect(compareVersions("1.0.0-rc1", "1.0.0")).toBe(-1);
    expect(compareVersions("1.0.0", "1.0.0-rc1")).toBe(1);
  });

  test("treats two unparseable versions as equal, parseable wins otherwise", () => {
    expect(compareVersions("xxx", "yyy")).toBe(0);
    expect(compareVersions("xxx", "1.0.0")).toBe(-1);
    expect(compareVersions("1.0.0", "xxx")).toBe(1);
  });
});

describe("isOutdated", () => {
  test("true when latest is greater", () => {
    expect(isOutdated("1.0.0", "1.1.0")).toBe(true);
    expect(isOutdated("v0.6.0", "v0.7.0")).toBe(true);
  });

  test("false when equal or current is greater", () => {
    expect(isOutdated("1.0.0", "1.0.0")).toBe(false);
    expect(isOutdated("2.0.0", "1.5.0")).toBe(false);
  });

  test("false when either side is missing", () => {
    expect(isOutdated(null, "1.0.0")).toBe(false);
    expect(isOutdated("1.0.0", null)).toBe(false);
    expect(isOutdated("", "")).toBe(false);
  });
});
