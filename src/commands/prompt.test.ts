import assert from "node:assert/strict";
import { rmSync, existsSync, mkdirSync } from "node:fs";
import test, { afterEach, beforeEach, suite } from "node:test";
import { createOptionalLocalContext } from "../config.test.ts";

const cwd = "_fixtures-prompt-test";

suite("prompt command - configuration handling", () => {
  beforeEach(() => {
    if (!existsSync(cwd)) {
      mkdirSync(cwd, { recursive: true });
    }
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  suite("context creation for optional config", () => {
    test("createOptionalLocalContext without config creates null config", async () => {
      const context = await createOptionalLocalContext(null, { dir: cwd });
      assert.equal(context.config, null);
    });

    test("createOptionalLocalContext with config creates valid config", async () => {
      const foo = { name: "foo", path: "/path/to/foo", version: "1.0.0" };
      const context = await createOptionalLocalContext(
        {
          managers: { packages: [foo], setVersion: () => true },
        },
        { dir: cwd },
      );
      assert.notEqual(context.config, null);
      assert.ok(context.config);
      if (context.config) {
        assert.equal(context.config.packages[0].name, "foo");
      }
    });

    test("createOptionalLocalContext with multiple packages", async () => {
      const foo = { name: "foo", path: "/path/to/foo", version: "1.0.0" };
      const bar = { name: "bar", path: "/path/to/bar", version: "2.0.0" };
      const context = await createOptionalLocalContext(
        {
          managers: { packages: [foo, bar], setVersion: () => true },
        },
        { dir: cwd },
      );
      assert.notEqual(context.config, null);
      assert.ok(context.config);
      if (context.config) {
        assert.equal(context.config.packages.length, 2);
        assert.equal(context.config.packages[0].name, "foo");
        assert.equal(context.config.packages[1].name, "bar");
      }
    });

    test("dir property is set correctly on optional context", async () => {
      const context = await createOptionalLocalContext(null, { dir: cwd });
      assert.equal(context.dir, cwd);
    });

    test("allowedBumps defaults correctly in optional context with config", async () => {
      const foo = { name: "foo", path: "/path/to/foo", version: "1.0.0" };
      const context = await createOptionalLocalContext(
        {
          managers: { packages: [foo], setVersion: () => true },
        },
        { dir: cwd },
      );
      assert.notEqual(context.config, null);
      assert.ok(context.config);
      if (context.config) {
        // should have all default bump types
        assert.ok(context.config.allowedBumps.includes("patch"));
        assert.ok(context.config.allowedBumps.includes("minor"));
        assert.ok(context.config.allowedBumps.includes("major"));
      }
    });

    test("custom allowedBumps are used in optional context", async () => {
      const foo = { name: "foo", path: "/path/to/foo", version: "1.0.0" };
      const context = await createOptionalLocalContext(
        {
          managers: { packages: [foo], setVersion: () => true },
          allowedBumps: ["prerelease"],
        },
        { dir: cwd },
      );
      assert.notEqual(context.config, null);
      assert.ok(context.config);
      if (context.config) {
        assert.deepEqual(context.config.allowedBumps, ["prerelease"]);
      }
    });
  });

  suite("optional config behavior", () => {
    test("prompt command can be created with null config (no config file)", async () => {
      // Test that CommandWithOptionalLocalConfig accepts null config
      const context = await createOptionalLocalContext(null, { dir: cwd });
      assert.equal(context.config, null);
      // context.dir should still be accessible
      assert.equal(context.dir, cwd);
    });

    test("prompt command can be created with valid config (config file exists)", async () => {
      // Test that CommandWithOptionalLocalConfig properly resolves config
      const foo = { name: "foo", path: "/path/to/foo", version: "1.0.0" };
      const context = await createOptionalLocalContext(
        {
          managers: { packages: [foo], setVersion: () => true },
        },
        { dir: cwd },
      );
      assert.notEqual(context.config, null);
      assert.ok(context.config);
    });
  });
});

