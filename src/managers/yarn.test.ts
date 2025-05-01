import assert from "node:assert";
import { cpSync, rmSync } from "node:fs";
import test, { afterEach, beforeEach, suite } from "node:test";
import path from "path";

const cwd = "_fixtures-yarn-live";

beforeEach(() => {
	cpSync("fixtures/yarn", cwd, { recursive: true, force: true });
});

afterEach(() => {
	rmSync(cwd, { recursive: true, force: true });
});

suite("yarn", async () => {
	for (const entrypoint of ["./yarn.ts", "chachalog/yarn"]) {
		test(entrypoint, async () => {
			const { default: yarn } = (await import(entrypoint)) as typeof import("./yarn.ts");
			const manager = await yarn({ cwd });
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

			const after = await yarn({ cwd });
			assert.deepStrictEqual(after.packages, [
				{ name: "bar", version: "1.0.2", path: path.resolve(cwd, "packages/bar") },
				{ name: "foo", version: "1.0.0", path: path.resolve(cwd, "packages/foo") },
				{ name: "sub-foo", version: "0.2.0", path: path.resolve(cwd, "packages/foo/sub-foo") },
			]);
		});
	}
});
