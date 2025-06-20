import assert from "node:assert/strict";
import { cpSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import test, { afterEach, beforeEach, mock, suite } from "node:test";
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
		const platform = createMockPlatform();
		const setVersion = mock.fn(() => true);
		const context = await createContext(
			{
				managers: { packages: [foo, bar], setVersion },
				platform,
				getNewChangelog: () => "> ✨",
			},
			{ dir: `${cwd}/entries` },
		);
		await prepareNextRelease(context);

		// @ts-expect-error
		assert.partialDeepStrictEqual(setVersion.mock.calls, [
			{
				arguments: [foo, "1.1.0"],
			},
			{
				arguments: [bar, "2.0.0"],
			},
		]);

		assert.equal(
			readFileSync(path.resolve(foo.path, "CHANGELOG.md"), "utf-8"),
			`# I'm an existing changelog

This should not be removed

\`\`\`js
console.log('Hello, World!');
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

* This is a major change to the \`bar\` package.
`,
		);
	});
});
