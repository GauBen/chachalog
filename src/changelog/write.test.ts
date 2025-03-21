import assert from "node:assert";
import test, { suite } from "node:test";
import { remark } from "remark";
import { type MdChildren, processEntries } from "./process.ts";
import { insertChangelog, writeChangelog } from "./write.ts";
import type { ReleaseTypes } from "../index.ts";

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
pkg-c: patch
pkg-b: patch
---
## Section 1
Hello
`,
				],
			]),
			(bumps) => bumps as Record<string, "major" | "minor" | "patch">,
		);

		const expected = {
			"pkg-a": `### Section 1

* I'm a basic changelog entry

### Breaking changes

* Different entry

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
								[{ type: "paragraph", children: [{ type: "text", value: "Hello" }] }],
							],
						]),
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
		const changelogEntry = {
			releaseEntries: new Map(),
			namedEntries: new Map<string, MdChildren>([
				["Section 1", [{ type: "paragraph", children: [{ type: "text", value: "Hello" }] }]],
			]),
		};

		assert.strictEqual(
			insertChangelog("# Changelog", version, changelogEntry, bumpTitles),
			`# Changelog

## 1.0.0

### Section 1

* Hello
`,
		);

		assert.strictEqual(
			insertChangelog("# Changelog\n\n## 0.1.0", version, changelogEntry, bumpTitles),
			`# Changelog

## 1.0.0

### Section 1

* Hello

## 0.1.0
`,
		);
	});
});
