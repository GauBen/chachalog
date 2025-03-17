/// @ts-check
/// <reference types="@chachalog/types" />
import fs from "node:fs/promises";
import { defineConfig } from "chachalog";
import github from "chachalog/github";
import yarn from "chachalog/yarn";

export default defineConfig(() => ({
	platform: github(),
	managers: [
		yarn(),
		{
			/** Keep `@chachalog/types` up-to-date */
			async setVersion(pkg, version) {
				if (pkg.name !== "chachalog") return;
				const current = await fs.readFile("types/package.json", "utf-8");
				const updated = current.replace(
					/"version": "[^"]*"/,
					`"version": ${JSON.stringify(version)}`,
				);
				await fs.writeFile("types/package.json", updated);
			},
		},
	],
}));
