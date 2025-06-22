import assert from "node:assert/strict";
import test from "node:test";
import { createContext, createMockPlatform } from "../config.test.ts";
import deletePrComment from "./delete-pr-comment.ts";

test("deletePrComment", async () => {
	const platform = createMockPlatform();
	const context = await createContext({
		platform,
		managers: {
			packages: [{ name: "foo", path: "/pkgs/foo", version: "1.0.0" }],
		},
	});

	await deletePrComment(context);

	assert.equal(platform.deleteChangelogComment.mock.callCount(), 1);
});
