import assert from "node:assert/strict";
import { cpSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import test, { afterEach, beforeEach, mock, suite } from "node:test";
import pkg from "../../package.json" with { type: "json" };
import { createContext, createMockPlatform } from "../config.test.ts";
import prepareNextRelease from "./prepare-next-release.ts";

const cwd = "_fixtures-next-release";

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
    const platform = createMockPlatform();
    const setVersion = mock.fn(() => true);
    const context = await createContext(
      {
        managers: { packages: [foo, bar, baz], setVersion },
        platform,
        getNewChangelog: () => "> ✨",
      },
      { dir: `${cwd}/entries` },
    );
    await prepareNextRelease(context);

    assert.partialDeepStrictEqual(setVersion.mock.calls, [
      { arguments: [foo, "1.1.0"] },
      { arguments: [bar, "2.0.0"] },
    ]);

    assert.equal(
      readFileSync(path.resolve(foo.path, "CHANGELOG.md"), "utf-8"),
      `# I'm an existing changelog

This should not be removed

\`\`\`js
console.log("Hello, World!");
\`\`\`

### This title should be preserved

The next version should be inserted here:

## 1.1.0

* This is a minor change to the \`foo\` package.

## 1.0.0

* I'm an existing changelog entry.
`,
    );

    assert.equal(
      readFileSync(path.resolve(bar.path, "CHANGELOG.md"), "utf-8"),
      `> ✨

## 2.0.0

This major release is accompanied by a complete documentation overhaul...

* This is a major change to the \`bar\` package.
`,
    );

    assert.partialDeepStrictEqual(platform.upsertReleasePr.mock.calls, [
      {
        arguments: [
          `## [🦜](https://github.com/GauBen/chachalog) Chachalog

This PR will bump the following packages:

<details><summary><code>foo</code> 1.1.0</summary>

> * This is a minor change to the \`foo\` package.

</details>

<details><summary><code>bar</code> 2.0.0</summary>

> This major release is accompanied by a complete documentation overhaul...
>
> * This is a major change to the \`bar\` package.

</details>
`,
        ],
      },
    ]);
  });

  test("do nothing when empty", async () => {
    const foo = { name: "foo", path: path.resolve(cwd, "pkgs/foo"), version: "1.0.0" };
    const platform = createMockPlatform();
    const context = await createContext(
      {
        managers: { packages: [foo], setVersion: () => true },
        platform,
      },
      { dir: `${cwd}/empty` },
    );
    await prepareNextRelease(context);
    assert.equal(platform.upsertReleasePr.mock.calls.length, 0);
  });

  test("handle read errors", async () => {
    const broken = { name: "broken", path: path.resolve(cwd, "pkgs/broken"), version: "1.0.0" };
    const platform = createMockPlatform();
    const context = await createContext(
      {
        managers: { packages: [broken], setVersion: () => true },
        platform,
      },
      { dir: `${cwd}/broken-entries` },
    );
    await assert.rejects(
      () => prepareNextRelease(context),
      new Error("EISDIR: illegal operation on a directory, read"),
    );
  });

  test("handle semver errors", async () => {
    const foo = { name: "foo", path: path.resolve(cwd, "pkgs/foo"), version: "oops" };
    const bar = { name: "bar", path: path.resolve(cwd, "pkgs/bar"), version: "1.0.0" };
    const platform = createMockPlatform();
    const context = await createContext(
      {
        managers: { packages: [foo, bar], setVersion: () => true },
        platform,
      },
      { dir: `${cwd}/entries` },
    );
    await assert.rejects(() => prepareNextRelease(context), new Error("bump failed"));
  });

  test("notify version changes", async () => {
    const platform = createMockPlatform();
    const context = await createContext(
      {
        managers: {
          packages: [
            { name: "foo", path: path.resolve(cwd, "pkgs/foo"), version: "1.0.0" },
            { name: "bar", path: path.resolve(cwd, "pkgs/bar"), version: "1.0.0" },
          ],
          setVersion: () => true,
        },
        platform,
      },
      { dir: `${cwd}/entries`, latestVersion: "2.0.0" },
    );
    await prepareNextRelease(context);

    assert.partialDeepStrictEqual(platform.upsertReleasePr.mock.calls, [
      {
        arguments: [
          `## [🦜](https://github.com/GauBen/chachalog) Chachalog

This PR will bump the following packages:

<details><summary><code>foo</code> 1.1.0</summary>

> * This is a minor change to the \`foo\` package.

</details>

<details><summary><code>bar</code> 2.0.0</summary>

> This major release is accompanied by a complete documentation overhaul...
>
> * This is a major change to the \`bar\` package.

</details>

Chachalog 2.0.0 is available, you are running chachalog ${pkg.version}
`,
        ],
      },
    ]);
  });
});
