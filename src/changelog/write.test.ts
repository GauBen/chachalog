import assert from "node:assert";
import test, { suite } from "node:test";
import { remark } from "remark";
import type { ReleaseTypes } from "../index.ts";
import { processEntries } from "./process.ts";
import { insertChangelog, writeChangelog } from "./write.ts";

const bumpTitles: Record<ReleaseTypes, string> = {
	major: "Breaking changes",
	minor: "New features",
	patch: "Bug fixes",
	premajor: "premajor changes",
	preminor: "preminor changes",
	prepatch: "prepatch changes",
	prerelease: "prerelease changes",
};

suite("writeChangelog", async () => {
	await test("complex", async () => {
		const entries = await processEntries(
			new Map([
				[
					"major.md",
					`---
pkg-a: major
---
Different entry

On several lines
`,
				],
				[
					"minor.md",
					`---
pkg-a: minor
pkg-b: minor
---
No section
## Section 1
I'm a basic changelog entry
`,
				],
				[
					"patch.md",
					`---
pkg-b: patch
pkg-c: patch
---
## Section 1
Hello
## Lonely title
`,
				],
				[
					".chachalog/intro.md",
					`# pkg-a

Introducting the major changes for pkg-a.
`,
				],
			]),
			["pkg-a", "pkg-b", "pkg-c"],
			(bumps) => bumps as Record<string, "major" | "minor" | "patch">,
		);

		const expected = {
			"pkg-a": `Introducting the major changes for pkg-a.

### Section 1

* I'm a basic changelog entry

### Breaking changes

* Different entry

  On several lines

### New features

* No section
`,
			"pkg-b": `### Section 1

* I'm a basic changelog entry

* Hello

### New features

* No section
`,
			"pkg-c": `### Section 1

* Hello
`,
		};

		assert.deepStrictEqual(
			Object.fromEntries(
				[...entries].map(([pkg, entry]) => [
					pkg,
					remark.stringify({ type: "root", children: writeChangelog(entry, bumpTitles) }),
				]),
			),
			expected,
		);
	});

	test("invalid", () => {
		assert.throws(
			() =>
				writeChangelog(
					{
						releaseEntries: new Map(),
						namedEntries: new Map([
							[
								"> Section 1",
								[[{ type: "paragraph", children: [{ type: "text", value: "Hello" }] }]],
							],
						]),
						intro: [],
					},
					bumpTitles,
				),
			new Error("Title parsing failed"),
		);
	});
});

suite("insertChangelog", () => {
	test("basic", () => {
		const version = "1.0.0";
		assert.strictEqual(
			insertChangelog("# Changelog", version, [
				{ type: "paragraph", children: [{ type: "text", value: "Hello" }] },
			]),
			`# Changelog

## 1.0.0

Hello
`,
		);

		assert.strictEqual(
			insertChangelog("# Changelog\n\n## 0.1.0", version, [
				{ type: "paragraph", children: [{ type: "text", value: "Hello" }] },
			]),
			`# Changelog

## 1.0.0

Hello

## 0.1.0
`,
		);
	});
});
