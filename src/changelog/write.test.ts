import test, { suite } from "node:test";
import { processEntries, type MdChildren } from "./process.ts";
import { insertChangelog, writeChangelog } from "./write.ts";
import { remark } from "remark";
import assert from "node:assert";

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

### major changes

* Different entry

### minor changes

* No section
`,
			"pkg-b": `### Section 1

* I'm a basic changelog entry

* Hello

### minor changes

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
					remark.stringify({ type: "root", children: writeChangelog(entry) }),
				]),
			),
			expected,
		);
	});

	test("invalid", () => {
		assert.throws(
			() =>
				writeChangelog({
					releaseEntries: new Map(),
					namedEntries: new Map([
						["> Section 1", [{ type: "paragraph", children: [{ type: "text", value: "Hello" }] }]],
					]),
				}),
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
			insertChangelog("# Changelog", version, changelogEntry),
			`# Changelog

## 1.0.0

### Section 1

* Hello
`,
		);

		assert.strictEqual(
			insertChangelog("# Changelog\n\n## 0.1.0", version, changelogEntry),
			`# Changelog

## 1.0.0

### Section 1

* Hello

## 0.1.0
`,
		);
	});
});
