import assert from "node:assert/strict";
import test, { suite } from "node:test";
import { sentenceCase, suggestBump, suggestEntry } from "./comment-pr.ts";

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
