import assert from "node:assert";
import { cpSync, rmSync } from "node:fs";
import test, { afterEach, beforeEach, suite } from "node:test";
import path from "path";

const cwd = "_fixtures-pnpm-live";

beforeEach(() => {
	cpSync("fixtures/pnpm", cwd, { recursive: true, force: true });
});

afterEach(() => {
	rmSync(cwd, { recursive: true, force: true });
});

suite("pnpm", async () => {
	for (const entrypoint of ["./pnpm.ts", "chachalog/pnpm"]) {
		test(entrypoint, async () => {
			const { default: pnpm } = (await import(entrypoint)) as typeof import("./pnpm.ts");
			const manager = await pnpm({ cwd });
			assert.deepStrictEqual(manager.packages, [
				{ name: "bar", version: "1.0.1", path: path.resolve(cwd, "packages/bar") },
				{ name: "foo", version: "0.1.2", path: path.resolve(cwd, "packages/foo") },
				{ name: "sub-foo", version: "0.1.2", path: path.resolve(cwd, "packages/foo/sub-foo") },
			]);
			await manager.setVersion?.(manager.packages[0], "1.0.2");
			await manager.setVersion?.(manager.packages[1], "1.0.0");
			await manager.setVersion?.(manager.packages[2], "0.2.0");
			// Ensure packages are matched using object equality
			await manager.setVersion?.(
				{ name: "bar", version: "1.0.1", path: path.resolve(cwd, "packages/bar") },
				"2.0.0",
			);

			const after = await pnpm({ cwd });
			assert.deepStrictEqual(after.packages, [
				{ name: "bar", version: "1.0.2", path: path.resolve(cwd, "packages/bar") },
				{ name: "foo", version: "1.0.0", path: path.resolve(cwd, "packages/foo") },
				{ name: "sub-foo", version: "0.2.0", path: path.resolve(cwd, "packages/foo/sub-foo") },
			]);
		});
	}
});
