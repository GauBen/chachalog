import assert from "node:assert/strict";
import test, { mock, suite } from "node:test";
import { UsageError } from "clipanion";
import pkg from "../../package.json" with { type: "json" };
import { createContext, createMockPlatform } from "../config.test.ts";
import type { Package } from "../index.ts";
import commentPr, { sentenceCase, suggestBump, suggestEntry } from "./comment-pr.ts";

suite("sentenceCase", () => {
	test("basic", () => {
		assert.equal(sentenceCase("hello world"), "Hello world");
		assert.equal(sentenceCase("éé"), "Éé");
		assert.equal(sentenceCase("👀"), "👀");
	});

	test("empty", () => {
		assert.equal(sentenceCase(""), "");
	});
});

suite("suggestBump", () => {
	test("breaking", () => {
		assert.deepEqual(suggestBump("fix!: hello world", ["patch", "minor", "major"]), {
			bump: "major",
			message: "Hello world",
		});
		assert.deepEqual(suggestBump("feat!: écrire un test", ["prerelease", "premajor"]), {
			bump: "premajor",
			message: "Écrire un test",
		});
	});

	test("feat", () => {
		assert.deepEqual(suggestBump("feat: hello world", ["patch", "minor", "major"]), {
			bump: "minor",
			message: "Hello world",
		});
		assert.deepEqual(suggestBump("feat: écrire un test", ["patch", "preminor", "premajor"]), {
			bump: "preminor",
			message: "Écrire un test",
		});
	});

	test("other", () => {
		assert.deepEqual(suggestBump("fix: hello world", ["patch", "minor", "major"]), {
			bump: "patch",
			message: "Hello world",
		});
		assert.deepEqual(suggestBump("écrire un test", ["prepatch", "prerelease", "preminor"]), {
			bump: "prepatch",
			message: "Écrire un test",
		});
		assert.deepEqual(suggestBump("fallback", ["major"]), {
			bump: "major",
			message: "Fallback",
		});
	});
});

test("suggestEntry", () => {
	assert.equal(
		suggestEntry(
			{ bump: "minor", message: "Hello world" },
			[
				{ name: "foo", changed: true },
				{ name: "bar", changed: false },
			],
			["patch", "minor", "major"],
		),
		`---
# Allowed version bumps: patch, minor, major
foo: minor
# bar: minor
---

Hello world`,
	);
});

suite("commentPr", () => {
	test("empty", async () => {
		const packages: Package[] = [{ name: "foo", path: "/pkgs/foo", version: "1.0.0" }];
		const platform = createMockPlatform();
		const context = await createContext({
			allowedBumps: ["patch", "minor", "major"],
			managers: [{ packages }],
			platform,
		});
		await commentPr(context);

		assert.equal(platform.createChangelogEntryLink.mock.calls.length, 1);
		assert.match(platform.createChangelogEntryLink.mock.calls[0].arguments[0], /^custom\/.+\.md$/);
		assert.equal(
			platform.createChangelogEntryLink.mock.calls[0].arguments[1],
			`---
# Allowed version bumps: patch, minor, major
# foo: minor
---

Hello world`,
		);
		assert.equal(platform.upsertChangelogComment.mock.calls.length, 1);
		assert.equal(
			platform.upsertChangelogComment.mock.calls[0].arguments[0],
			`## 🦜 Chachalog

No changelog entries detected. [Learn more about Chachalog.](https://github.com/GauBen/chachalog#readme)

[Create a new entry online](https://example.com) or run \`npx chachalog@${pkg.version} prompt\` to create a new entry locally.
`,
		);
	});

	test("with entries", async () => {
		const packages: Package[] = [{ name: "foo", path: "/pkgs/foo", version: "1.0.0" }];
		const platform = createMockPlatform({
			getChangelogEntries: mock.fn(() => ({
				title: "feat: hello world",
				entries: new Map([
					[
						"custom/aaa.md",
						`---
foo: minor
---
Hello world`,
					],
					[
						"custom/bbb.md",
						`---
foo: patch
---
# Section
I am in my own section`,
					],
				]),
				changedPackages: new Set(["foo"]),
			})),
		});
		const context = await createContext({
			allowedBumps: ["patch", "minor", "major"],
			managers: [{ packages }],
			platform,
		});
		await commentPr(context);

		assert.equal(platform.createChangelogEntryLink.mock.calls.length, 1);
		assert.match(platform.createChangelogEntryLink.mock.calls[0].arguments[0], /^custom\/.+\.md$/);
		assert.equal(
			platform.createChangelogEntryLink.mock.calls[0].arguments[1],
			`---
# Allowed version bumps: patch, minor, major
foo: minor
---

Hello world`,
		);
		assert.equal(platform.upsertChangelogComment.mock.calls.length, 1);
		assert.equal(
			platform.upsertChangelogComment.mock.calls[0].arguments[0],
			`## 🦜 Chachalog

<details><summary><code>foo</code> minor</summary>

> ### Section
>
> * I am in my own section
>
> ### New Features
>
> * Hello world

</details>

[Create a new entry online](https://example.com) or run \`npx chachalog@${pkg.version} prompt\` to create a new entry locally.
`,
		);
	});

	test("invalid bump", async () => {
		const platform = createMockPlatform({
			getChangelogEntries: mock.fn(() => ({
				title: "feat: hello world",
				entries: new Map([
					[
						"custom/aaa.md",
						`---
foo: invalid
---
Hello world`,
					],
				]),
				changedPackages: new Set(["foo"]),
			})),
		});
		const context = await createContext({
			allowedBumps: ["patch", "minor", "major"],
			managers: [{ packages: { name: "foo", path: "/pkgs/foo", version: "1.0.0" } }],
			platform,
		});
		await assert.rejects(
			() => commentPr(context),
			new UsageError('Error processing custom/aaa.md: bump "invalid" for package "foo" is invalid'),
		);

		assert.equal(platform.upsertChangelogComment.mock.calls.length, 1);
		assert.equal(
			platform.upsertChangelogComment.mock.calls[0].arguments[0],
			`## 🦜 Chachalog

Something went: Error processing custom/aaa.md: bump "invalid" for package "foo" is invalid

Check the logs for more details.`,
		);
	});
});
