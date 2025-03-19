import assert from "node:assert";
import { describe, suite, test } from "node:test";
import { UsageError } from "clipanion";
import type { RootContent } from "mdast";
import { remark } from "remark";
import { processEntries, processEntry } from "./process.ts";

const toMd = (children: RootContent[]) => remark().stringify({ type: "root", children });

suite("processEntry", async () => {
	await test("basic", async () => {
		const { bumps, defaultEntry, namedEntries } = await processEntry(`---
foo: bar
baz: 42
---

I'm a basic changelog entry
`);

		assert.deepStrictEqual(bumps, { foo: "bar", baz: 42 });
		assert.deepStrictEqual(toMd(defaultEntry), `I'm a basic changelog entry\n`);
		assert.deepStrictEqual(namedEntries, new Map());
	});

	await test("basic section", async () => {
		const { defaultEntry, namedEntries } = await processEntry(`---

---

# Section
I'm a basic changelog entry
`);

		assert.deepStrictEqual(defaultEntry, []);
		assert.deepStrictEqual(
			Object.fromEntries([...namedEntries].map(([title, children]) => [title, toMd(children)])),
			{ Section: `I'm a basic changelog entry\n` },
		);
	});

	await test("complex", async () => {
		const { bumps, defaultEntry, namedEntries } = await processEntry(`---
# Comment
foo: bar # Comment
baz: 42
---

No section

<!-- I'm ignored -->

# Section 1

I'm a basic changelog entry

### Section _2_

I'm a super changelog entry

<!-- I'm ignored too -->

#### Title with [link](https://example.com) and **bold**

> Quote with \`code\``);

		assert.deepStrictEqual(bumps, { foo: "bar", baz: 42 });
		assert.deepStrictEqual(toMd(defaultEntry), "No section\n");
		assert.deepStrictEqual(
			Object.fromEntries([...namedEntries].map(([title, children]) => [title, toMd(children)])),
			{
				"Section 1": "I'm a basic changelog entry\n",
				"Section *2*": `I'm a super changelog entry

#### Title with [link](https://example.com) and **bold**

> Quote with \`code\`
`,
			},
		);
	});

	await test("empty", async () => {
		const { bumps, defaultEntry, namedEntries } = await processEntry("");

		assert.deepStrictEqual(bumps, {});
		assert.deepStrictEqual(defaultEntry, []);
		assert.deepStrictEqual(namedEntries, new Map());
	});

	await test("empty frontmatter", async () => {
		const { bumps, defaultEntry, namedEntries } = await processEntry(`---

---`);

		assert.deepStrictEqual(bumps, {});
		assert.deepStrictEqual(defaultEntry, []);
		assert.deepStrictEqual(namedEntries, new Map());
	});
});

describe("processEntries", async () => {
	await test("basic", async () => {
		const result = await processEntries(
			new Map([
				[
					"file.md",
					`---
pkg-a: patch
---
## Section 1
I'm a basic changelog entry
`,
				],
			]),
			(bumps) => bumps as Record<string, "major" | "minor" | "patch">,
		);

		assert.deepStrictEqual(
			Object.fromEntries(
				[...result].map(([pkg, { bump, defaultEntry, namedEntries }]) => [
					pkg,
					{
						bump,
						defaultEntry: toMd(defaultEntry),
						namedEntries: Object.fromEntries(
							[...namedEntries].map(([title, children]) => [title, toMd(children)]),
						),
					},
				]),
			),
			{
				"pkg-a": {
					bump: "patch",
					defaultEntry: "",
					namedEntries: { "Section 1": "I'm a basic changelog entry\n" },
				},
			},
		);
	});

	await test("complex", async () => {
		const result = await processEntries(
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

		assert.deepStrictEqual(
			Object.fromEntries(
				[...result].map(([pkg, { bump, defaultEntry, namedEntries }]) => [
					pkg,
					{
						bump,
						defaultEntry: toMd(defaultEntry),
						namedEntries: Object.fromEntries(
							[...namedEntries].map(([title, children]) => [title, toMd(children)]),
						),
					},
				]),
			),
			{
				"pkg-a": {
					bump: "major",
					defaultEntry: "Different entry\n\nNo section\n",
					namedEntries: {
						"Section 1": "I'm a basic changelog entry\n",
					},
				},
				"pkg-b": {
					bump: "minor",
					defaultEntry: "No section\n",
					namedEntries: {
						"Section 1": "I'm a basic changelog entry\n\nHello\n",
					},
				},
				"pkg-c": {
					bump: "patch",
					defaultEntry: "",
					namedEntries: {
						"Section 1": "Hello\n",
					},
				},
			},
		);
	});

	await test("invalid", async () => {
		await assert.rejects(
			processEntries(
				new Map([
					[
						"file.md",
						`---
pkg-a: invalid
---
`,
					],
				]),
				() => {
					throw new Error("hello");
				},
			),
			new UsageError("Error processing file.md: hello"),
		);
	});
});
