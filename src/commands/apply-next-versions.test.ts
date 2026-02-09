import assert from "node:assert/strict";
import { cpSync, rmSync } from "node:fs";
import path from "node:path";
import test, { afterEach, beforeEach, mock, suite } from "node:test";
import { createLocalContext } from "../config.test.ts";
import applyNextVersions from "./apply-next-versions.ts";

const cwd = "_fixtures-next-versions";

beforeEach(() => {
  cpSync("fixtures/next-release", cwd, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

suite("prepareNextRelease", () => {
  test("basic release preparation", async () => {
    const foo = { name: "foo", path: path.resolve(cwd, "pkgs/foo"), version: "1.0.0" };
    const bar = { name: "bar", path: path.resolve(cwd, "pkgs/bar"), version: "1.0.0" };
    const baz = { name: "baz", path: path.resolve(cwd, "pkgs/baz"), version: "1.0.0" };
    const setVersion = mock.fn(() => true);
    const context = await createLocalContext(
      {
        managers: { packages: [foo, bar, baz], setVersion },
      },
      { dir: `${cwd}/entries` },
    );
    await applyNextVersions(context);

    // @ts-expect-error
    assert.partialDeepStrictEqual(setVersion.mock.calls, [
      { arguments: [foo, "1.1.0"] },
      { arguments: [bar, "2.0.0"] },
    ]);
  });

  test("do nothing when empty", async () => {
    const foo = { name: "foo", path: path.resolve(cwd, "pkgs/foo"), version: "1.0.0" };
    const setVersion = mock.fn(() => true);
    const context = await createLocalContext(
      { managers: { packages: [foo], setVersion } },
      { dir: `${cwd}/empty` },
    );
    await applyNextVersions(context);
    assert.equal(setVersion.mock.calls.length, 0);
  });

  test("handle semver errors", async () => {
    const foo = { name: "foo", path: path.resolve(cwd, "pkgs/foo"), version: "oops" };
    const bar = { name: "bar", path: path.resolve(cwd, "pkgs/bar"), version: "1.0.0" };
    const context = await createLocalContext(
      { managers: { packages: [foo, bar], setVersion: () => true } },
      { dir: `${cwd}/entries` },
    );
    await assert.rejects(() => applyNextVersions(context), new Error("bump failed"));
  });
});
