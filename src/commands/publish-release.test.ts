import assert from "node:assert/strict";
import test, { suite } from "node:test";
import { createContext, createMockPlatform } from "../config.test.ts";
import publishRelease from "./publish-release.ts";

suite("publishRelease", () => {
  test("basic releases", async () => {
    const platform = createMockPlatform();
    const context = await createContext({
      managers: {
        packages: [
          { name: "foo", path: "/pkgs/foo", version: "1.0.0" },
          { name: "bar", path: "/pkgs/bar", version: "1.0.0" }, // version number is ignored
        ],
      },
      platform,
      getChangelogFile: async ({ name }) => `fixtures/changelogs/${name}.md`,
    });
    await publishRelease(context);
    assert.equal(platform.createRelease.mock.calls.length, 2);
    assert.deepEqual(platform.createRelease.mock.calls[0].arguments, [
      "foo@1.0.0",
      "foo @ v1.0.0",
      "* Hello World!\n",
    ]);
    assert.deepEqual(platform.createRelease.mock.calls[1].arguments, [
      "bar@1.2.3",
      "bar @ v1.2.3",
      "* Hello World!\n",
    ]);
  });

  test("no release", async () => {
    const platform = createMockPlatform();
    const context = await createContext({
      managers: {
        packages: [
          { name: "inexistent", path: "/pkgs/foo", version: "1.0.0" },
          { name: "empty", path: "/pkgs/bar", version: "1.0.0" },
          { name: "unrelated", path: "/pkgs/baz", version: "1.0.0" },
        ],
      },
      platform,
      getChangelogFile: async ({ name }) => `fixtures/changelogs/${name}.md`,
    });
    await publishRelease(context);
    assert.equal(platform.createRelease.mock.calls.length, 0);
  });

  test("parse error", async () => {
    const platform = createMockPlatform();
    const context = await createContext({
      managers: {
        packages: { name: "parse-error", path: "/pkgs/foo", version: "1.0.0" },
      },
      platform,
      getChangelogFile: async () => `fixtures/changelogs/invalid.md`,
    });
    await assert.rejects(publishRelease(context), new Error("title parsing failed"));
    assert.equal(platform.createRelease.mock.calls.length, 0);
  });
});
